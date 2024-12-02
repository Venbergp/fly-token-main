import { FlyState, GameState, PoopState, Position, Vector3 } from '../types';

enum FlyBehavior {
  STANDING = 'STANDING',
  WALKING = 'WALKING',
  FLYING = 'FLYING',
  TARGETING_POOP = 'TARGETING_POOP'
}

export class GameService {
  private gameState: GameState;
  private currentBehavior: FlyBehavior = FlyBehavior.STANDING;
  private behaviorTimer: number = 0;
  private targetPosition: Position = { x: 0, y: 0, z: 0 };
  private lastUpdateTime: number = Date.now();
  private poopCounter: number = 0;
  private flySpeed: number = 3;
  private walkSpeed: number = 0.8;
  private readonly ROTATION_SPEED = 5.0;
  private readonly PLANE_SIZE = 10;
  private readonly MIN_HEIGHT = 0.1;
  private readonly MAX_HEIGHT = 1.5;
  private readonly POOP_DETECTION_RADIUS = 2;
  private readonly POOP_INTERACTION_RADIUS = 0.3;
  private direction: Vector3 = { x: 0, y: 0, z: 1 };
  private targetDirection: Vector3 = { x: 0, y: 0, z: 1 };

  constructor() {
    this.gameState = {
      fly: {
        position: { x: 0, y: 0.1, z: 0 },
        direction: { ...this.direction },
        isMoving: false,
        isFlying: false,
        currentTarget: null
      },
      poops: []
    };
    this.startPoopGeneration();
    this.decideBehavior();
  }

  private normalizeVector(vector: Vector3): Vector3 {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    if (length === 0) return { x: 0, y: 0, z: 1 };
    return {
      x: vector.x / length,
      y: vector.y / length,
      z: vector.z / length
    };
  }

  private setTargetDirection(targetPos: Position): void {
    const dx = targetPos.x - this.gameState.fly.position.x;
    const dy = targetPos.y - this.gameState.fly.position.y;
    const dz = targetPos.z - this.gameState.fly.position.z;
    
    this.targetDirection = this.normalizeVector({ x: dx, y: 0, z: dz });
  }

  private updateDirection(deltaTime: number): void {
    const rotationSpeed = this.ROTATION_SPEED * deltaTime;
    
    const currentDir = this.direction;
    const targetDir = this.targetDirection;
    
    const dx = targetDir.x - currentDir.x;
    const dz = targetDir.z - currentDir.z;
    
    if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) {
      this.direction = { ...targetDir };
      return;
    }

    this.direction = this.normalizeVector({
      x: currentDir.x + dx * rotationSpeed,
      y: 0,
      z: currentDir.z + dz * rotationSpeed
    });

    this.gameState.fly.direction = { ...this.direction };
  }

  private moveInDirection(deltaTime: number, speed: number): void {
    const step = speed * deltaTime;
    const normalizedDir = this.normalizeVector(this.direction);

    const newX = this.gameState.fly.position.x + normalizedDir.x * step;
    const newZ = this.gameState.fly.position.z + normalizedDir.z * step;

    // Сначала проверяем новую позицию
    const testPosition = {
        x: Math.max(-this.PLANE_SIZE / 2, Math.min(this.PLANE_SIZE / 2, newX)),
        y: this.MIN_HEIGHT,
        z: Math.max(-this.PLANE_SIZE / 2, Math.min(this.PLANE_SIZE / 2, newZ))
    };

    // Временно сохраняем текущую позицию
    const oldPosition = { ...this.gameState.fly.position };
    
    // Устанавливаем новую позицию для проверки
    this.gameState.fly.position = testPosition;
    
    // Проверяем, достигли ли какашки
    if (this.checkPoopReached()) {
        // Если достигли, позиция уже обновлена и какашка удалена
        return;
    }
    
    // Если какашку не достигли, применяем новую позицию
    this.gameState.fly.position = {
        x: Math.max(-this.PLANE_SIZE / 2, Math.min(this.PLANE_SIZE / 2, newX)),
        y: this.MIN_HEIGHT,
        z: Math.max(-this.PLANE_SIZE / 2, Math.min(this.PLANE_SIZE / 2, newZ))
    };
  }

  private setRandomTarget(height: number): void {
    const angle = Math.random() * Math.PI * 2;
    const distance = 1 + Math.random() * 3;
    const currentPos = this.gameState.fly.position;

    const currentHeight = currentPos.y;
    const maxHeightChange = distance * 0.5;
    const targetHeight = Math.min(
      Math.max(
        this.MIN_HEIGHT,
        height
      ),
      currentHeight + maxHeightChange
    );

    this.targetPosition = {
      x: currentPos.x + Math.cos(angle) * distance,
      y: targetHeight,
      z: currentPos.z + Math.sin(angle) * distance
    };

    this.targetPosition.x = Math.max(-this.PLANE_SIZE / 2, 
      Math.min(this.PLANE_SIZE / 2, this.targetPosition.x));
    this.targetPosition.z = Math.max(-this.PLANE_SIZE / 2, 
      Math.min(this.PLANE_SIZE / 2, this.targetPosition.z));

    this.setTargetDirection(this.targetPosition);
  }

  private updateFlyPosition(deltaTime: number): void {
    if (!this.gameState.fly.isMoving && this.currentBehavior !== FlyBehavior.STANDING) {
      this.decideBehavior();
      return;
    }

    if (this.checkPoopReached()) {
      this.decideBehavior();
      return;
    }

    this.updateDirection(deltaTime);

    const prevPosition = { ...this.gameState.fly.position };

    if (this.gameState.fly.isFlying) {
      const currentSpeed = this.flySpeed * deltaTime;
      
      const toTarget = {
        x: this.targetPosition.x - this.gameState.fly.position.x,
        y: this.targetPosition.y - this.gameState.fly.position.y,
        z: this.targetPosition.z - this.gameState.fly.position.z
      };
      
      const distance = Math.sqrt(
        toTarget.x * toTarget.x + 
        toTarget.y * toTarget.y + 
        toTarget.z * toTarget.z
      );
      
      if (distance > 0) {
        const moveX = (toTarget.x / distance) * currentSpeed;
        const moveY = (toTarget.y / distance) * currentSpeed;
        const moveZ = (toTarget.z / distance) * currentSpeed;
        
        this.gameState.fly.position.x += moveX;
        this.gameState.fly.position.z += moveZ;
        this.gameState.fly.position.y += moveY;

        if (this.currentBehavior !== FlyBehavior.TARGETING_POOP) {
          this.gameState.fly.position.y += Math.sin(Date.now() * 0.005) * 0.05;
        }

        this.gameState.fly.position.x = Math.max(-this.PLANE_SIZE / 2, 
          Math.min(this.PLANE_SIZE / 2, this.gameState.fly.position.x));
        this.gameState.fly.position.z = Math.max(-this.PLANE_SIZE / 2, 
          Math.min(this.PLANE_SIZE / 2, this.gameState.fly.position.z));
        this.gameState.fly.position.y = Math.max(
          this.MIN_HEIGHT,
          Math.min(this.MAX_HEIGHT, this.gameState.fly.position.y)
        );
      }
    } else if (this.gameState.fly.isMoving) {
      this.moveInDirection(deltaTime, this.walkSpeed);
      this.gameState.fly.position.y = this.MIN_HEIGHT;
    }

    if (prevPosition.x !== this.gameState.fly.position.x ||
      prevPosition.y !== this.gameState.fly.position.y ||
      prevPosition.z !== this.gameState.fly.position.z) {
      if (this.checkPoopReached()) {
        this.decideBehavior();
        return;
      }
    }

    if (this.isTargetReached()) {
      this.behaviorTimer = 0;
      this.decideBehavior();
    }
  }

  private decideBehavior(): void {
    const rand = Math.random();

    if (this.gameState.fly.isFlying && !this.gameState.fly.isMoving) {
      this.startFlying();
      return;
    }

    switch (this.currentBehavior) {
      case FlyBehavior.STANDING:
        if (rand < 0.6) this.startWalking();
        else this.startFlying();
        break;

      case FlyBehavior.WALKING:
        if (rand < 0.3) this.startFlying();
        else if (rand < 0.7 && this.tryFindPoop()) this.targetPoop();
        else this.continueWalking();
        break;

      case FlyBehavior.FLYING:
        if (rand < 0.15) this.startLanding();
        else if (rand < 0.4 && this.tryFindPoop()) this.targetPoop();
        else this.continueFlying();
        break;

      case FlyBehavior.TARGETING_POOP:
        if (this.checkPoopReached()) {
          if (rand < 0.6) this.startFlying();
          else this.startWalking();
        } else {
          if (this.behaviorTimer <= 0) {
            if (rand < 0.5) this.startFlying();
            else this.startWalking();
          }
        }
        break;
    }
  }

  private startStanding(): void {
    if (this.gameState.fly.isFlying) {
      this.startFlying();
      return;
    }

    this.currentBehavior = FlyBehavior.STANDING;
    this.behaviorTimer = Math.random() * 2;
    this.gameState.fly.isMoving = false;
    this.gameState.fly.isFlying = false;
    
    const randomAngle = (Math.random() - 0.5) * Math.PI;
    this.targetDirection = this.normalizeVector({
      x: Math.cos(randomAngle),
      y: 0,
      z: Math.sin(randomAngle)
    });
  }

  private startWalking(): void {
    this.currentBehavior = FlyBehavior.WALKING;
    this.behaviorTimer = 2 + Math.random() * 3;
    this.gameState.fly.isMoving = true;
    this.gameState.fly.isFlying = false;
    this.setRandomTarget(0.1);
  }

  private startFlying(): void {
    this.currentBehavior = FlyBehavior.FLYING;
    this.behaviorTimer = 3 + Math.random() * 4;
    this.gameState.fly.isMoving = true;
    this.gameState.fly.isFlying = true;
    this.setRandomTarget(1 + Math.random());
  }

  private startLanding(): void {
    this.setRandomTarget(0.1);
    this.gameState.fly.isFlying = false;
    this.behaviorTimer = 1;
  }

  private tryFindPoop(): boolean {
    if (this.gameState.poops.length === 0) return false;
    if (Math.random() > 0.7) return false;

    const flyPos = this.gameState.fly.position;
    const nearbyPoops = this.gameState.poops
      .filter(poop => {
        const dx = poop.position.x - flyPos.x;
        const dz = poop.position.z - flyPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        return distance < this.POOP_DETECTION_RADIUS;
      })
      .sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.position.x - flyPos.x, 2) + 
          Math.pow(a.position.z - flyPos.z, 2)
        );
        const distB = Math.sqrt(
          Math.pow(b.position.x - flyPos.x, 2) + 
          Math.pow(b.position.z - flyPos.z, 2)
        );
        return distA - distB;
      });

    if (nearbyPoops.length === 0) return false;

    const closestPoop = nearbyPoops[0];
    this.gameState.fly.currentTarget = closestPoop.id;
    this.targetPosition = { 
      x: closestPoop.position.x,
      y: this.gameState.fly.isFlying ? closestPoop.position.y : this.MIN_HEIGHT,
      z: closestPoop.position.z
    };

    const dx = this.targetPosition.x - flyPos.x;
    const dz = this.targetPosition.z - flyPos.z;
    this.targetDirection = this.normalizeVector({ x: dx, y: 0, z: dz });

    return true;
  }

  private checkPoopReached(): boolean {
    if (!this.gameState.fly.currentTarget) return false;

    const targetPoop = this.gameState.poops.find(p => p.id === this.gameState.fly.currentTarget);
    if (!targetPoop) {
        this.gameState.fly.currentTarget = null;
        return false;
    }

    const flyPos = this.gameState.fly.position;
    const poopPos = targetPoop.position;

    const dx = flyPos.x - poopPos.x;
    const dz = flyPos.z - poopPos.z;
    const dy = flyPos.y - poopPos.y;

    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const verticalDistance = Math.abs(dy);

    // Увеличим радиус взаимодействия при ходьбе
    const interactionRadius = this.gameState.fly.isFlying ? 
        this.POOP_INTERACTION_RADIUS : 
        this.POOP_INTERACTION_RADIUS * 1.5;

    if (horizontalDistance < interactionRadius && 
        verticalDistance < interactionRadius) {
        this.gameState.poops = this.gameState.poops.filter(p => p.id !== targetPoop.id);
        this.gameState.fly.currentTarget = null;
        return true;
    }

    return false;
  }

  public getGameState(): GameState {
    return this.gameState;
  }

  public updateState(): GameState {
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;

    if (deltaTime > 1) {
      this.behaviorTimer = 0;
    } else {
      this.behaviorTimer -= deltaTime;
    }

    if (this.behaviorTimer <= 0) {
      this.decideBehavior();
    }

    this.updateFlyPosition(deltaTime);
    return this.gameState;
  }

  private isTargetReached(): boolean {
    const dx = this.targetPosition.x - this.gameState.fly.position.x;
    const dz = this.targetPosition.z - this.gameState.fly.position.z;
    return Math.sqrt(dx * dx + dz * dz) < 0.1;
  }

  private continueStanding(): void {
    this.behaviorTimer = Math.random() * 2;
  }

  private continueWalking(): void {
    this.behaviorTimer = 2 + Math.random() * 3;
    this.setRandomTarget(0.1);
  }

  private continueFlying(): void {
    this.behaviorTimer = 2 + Math.random() * 3;
    this.setRandomTarget(1 + Math.random());
  }

  private targetPoop(): void {
    this.currentBehavior = FlyBehavior.TARGETING_POOP;
    this.behaviorTimer = 5;
    this.gameState.fly.isMoving = true;
    
    const targetPoop = this.gameState.poops.find(p => p.id === this.gameState.fly.currentTarget);
    if (!targetPoop) {
        this.startWalking();
        return;
    }

    const flyPos = this.gameState.fly.position;
    const dx = targetPoop.position.x - flyPos.x;
    const dz = targetPoop.position.z - flyPos.z;
    const distanceToTarget = Math.sqrt(dx * dx + dz * dz);

    // Если какашка на земле и муха близко, идём к ней пешком
    if (Math.abs(targetPoop.position.y - this.MIN_HEIGHT) < 0.05 && distanceToTarget <= 1.0) {
        this.gameState.fly.isFlying = false;
        this.targetPosition = {
            x: targetPoop.position.x,
            y: this.MIN_HEIGHT,
            z: targetPoop.position.z
        };
    } else {
        // Иначе летим
        this.gameState.fly.isFlying = true;
        this.targetPosition = { ...targetPoop.position };
    }

    this.setTargetDirection(this.targetPosition);
  }

  private startPoopGeneration(): void {
    this.createPoop();
    setInterval(() => {
      if (this.gameState.poops.length < 8) {
        this.createPoop();
      }
    }, 10000);
  }

  private createPoop(): void {
    const x = (Math.random() - 0.5) * (this.PLANE_SIZE - 0.5);
    const z = (Math.random() - 0.5) * (this.PLANE_SIZE - 0.5);

    const poop: PoopState = {
      id: ++this.poopCounter,
      position: { x, y: 0.15, z }
    };

    this.gameState.poops.push(poop);
  }
}