// src/app/app.component.ts
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, PLATFORM_ID, Inject, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { GameService, GameState, Position, Vector3 } from './services/game.service';
import { Subscription } from 'rxjs';

interface Poop {
  id: number;
  mesh: THREE.Mesh;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [CommonModule],
  providers: [GameService],
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('renderCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private flyModel!: THREE.Group;
  private isBrowser: boolean;
  private poops: Map<number, Poop> = new Map();
  private gameStateSubscription?: Subscription;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private gameService: GameService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.gameStateSubscription?.unsubscribe();
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.initializeScene();
      this.loadModel();
    }
  }

  private subscribeToGameState(): void {
    this.gameStateSubscription = this.gameService.getGameState().subscribe((state: GameState) => {
      this.updateFlyPosition(state.fly.position, state.fly.direction);
      this.updatePoops(state.poops);
    });
  }

  private updateFlyPosition(position: Position, direction: Vector3): void {
    if (!this.flyModel) return;
    
    this.flyModel.position.set(position.x, position.y, position.z);

    // Конвертируем direction в rotation
    const rotation = Math.atan2(direction.x, direction.z);
    
    // Теперь не добавляем Math.PI, так как модель уже развернута при инициализации
    this.flyModel.rotation.set(
      0,
      rotation,
      0
    );
  }

  private updatePoops(poops: GameState['poops']): void {
    // Удаляем несуществующие какашки
    for (const [id, poop] of this.poops.entries()) {
      if (!poops.find(p => p.id === id)) {
        this.scene.remove(poop.mesh);
        this.poops.delete(id);
      }
    }

    // Обновляем или создаем новые какашки
    poops.forEach(poop => {
      if (!this.poops.has(poop.id)) {
        this.createPoop(poop);
      } else {
        const existingPoop = this.poops.get(poop.id);
        if (existingPoop) {
          existingPoop.mesh.position.set(
            poop.position.x,
            poop.position.y,
            poop.position.z
          );
        }
      }
    });
  }

  private createPoop(poopState: GameState['poops'][0]): void {
    const poopGeometry = new THREE.SphereGeometry(0.15, 32, 32);
    const poopMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x4a3728,
      roughness: 1,
      metalness: 0
    });
    
    const poopMesh = new THREE.Mesh(poopGeometry, poopMaterial);
    poopMesh.position.set(
      poopState.position.x,
      poopState.position.y,
      poopState.position.z
    );
    
    poopMesh.castShadow = true;
    poopMesh.receiveShadow = true;
    
    this.scene.add(poopMesh);
    this.poops.set(poopState.id, { id: poopState.id, mesh: poopMesh });
  }

  private animate(): void {
    if (!this.isBrowser) return;
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private initializeScene(): void {
    const width = window.innerWidth * 0.66;
    const height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvasRef.nativeElement,
        antialias: true,
        precision: 'highp'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // Создаем пол с текстурой
    const planeSize = 10;
    const gridTexture = this.createGridTexture();
    const planeMaterial = new THREE.MeshStandardMaterial({
        map: gridTexture,
        roughness: 0.8,
        metalness: 0.2
    });
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    this.scene.add(plane);

    // Создаем стеклянные стены
    const wallHeight = 3;
    const wallMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
        roughness: 0,
        metalness: 0.1,
        transmission: 0.9,
        thickness: 0.5
    });

    // Передняя стена
    const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(planeSize, wallHeight, 0.1),
        wallMaterial
    );
    frontWall.position.set(0, wallHeight / 2, planeSize / 2);
    this.scene.add(frontWall);

    // Задняя стена
    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(planeSize, wallHeight, 0.1),
        wallMaterial
    );
    backWall.position.set(0, wallHeight / 2, -planeSize / 2);
    this.scene.add(backWall);

    // Левая стена
    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, wallHeight, planeSize),
        wallMaterial
    );
    leftWall.position.set(-planeSize / 2, wallHeight / 2, 0);
    this.scene.add(leftWall);

    // Правая стена
    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, wallHeight, planeSize),
        wallMaterial
    );
    rightWall.position.set(planeSize / 2, wallHeight / 2, 0);
    this.scene.add(rightWall);

    // Создаем табличку с текстом
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 1024;
    canvas.height = 256;

    // Настраиваем стиль текста
    context.fillStyle = 'rgba(255, 255, 255, 0.95)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Добавляем градиентную рамку
    const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#A51C30');
    gradient.addColorStop(1, '#8B0000');
    context.strokeStyle = gradient;
    context.lineWidth = 6;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    // Настраиваем текст
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Добавляем тень для текста
    context.shadowColor = 'rgba(0, 0, 0, 0.2)';
    context.shadowBlur = 4;
    context.shadowOffsetX = 2;
    context.shadowOffsetY = 2;

    // Основной текст
    context.font = '600 64px "Helvetica Neue", Helvetica, Arial';
    context.fillStyle = '#1E1E1E';
    context.fillText('DRAG TO ROTATE VIEW', canvas.width / 2, canvas.height / 2);

    // Создаем текстуру из canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Создаем материал с текстурой
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
    });

    // Создаем плоскость для таблички
    const signGeometry = new THREE.PlaneGeometry(8, 2);
    const sign = new THREE.Mesh(signGeometry, material);

    // Позиционируем табличку в ближнем левом углу
    const cornerDistance = planeSize / 2 + 2;
    sign.position.set(-cornerDistance, 4, -cornerDistance);
    
    // Поворачиваем табличку на 45 градусов
    sign.rotation.y = Math.PI * 0.25;

    this.scene.add(sign);

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  private createGridTexture(): THREE.Texture {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Заливаем фон
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, size, size);

    // Рисуем основную сетку
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    const gridSize = size / 10;

    for (let i = 0; i <= size; i += gridSize) {
        // Вертикальные линии
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();

        // Горизонтальные линии
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
    }

    // Рисуем более мелкую сетку
    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth = 1;
    const smallGridSize = gridSize / 5;

    for (let i = 0; i <= size; i += smallGridSize) {
        if (i % gridSize !== 0) { // Пропускаем линии основной сетки
            // Вертикальные линии
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, size);
            ctx.stroke();

            // Горизонтальные линии
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(size, i);
            ctx.stroke();
        }
    }

    // Создаем текстуру
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);

    return texture;
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
  
    loader.load(
      'assets/models/low_poly_cartoon_fly.glb',
      (gltf) => {
        console.log('Model loaded');
        this.flyModel = gltf.scene;
        
        this.flyModel.scale.set(30, 30, 30);
        this.flyModel.position.set(0, 0.15, 0);
  
        // Разворачиваем модель на 180 градусов вокруг оси Y при инициализации
        this.flyModel.rotation.set(0, Math.PI, 0);
        
        this.flyModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: (child.material as THREE.MeshStandardMaterial).color,
              metalness: 0.2,
              roughness: 0.8
            });
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
  
        this.scene.add(this.flyModel);
        console.log('Model added to scene');
        
        this.subscribeToGameState();
      },
      (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('Error loading model:', error);
      }
    );
  }
  

  private onWindowResize(): void {
    if (!this.isBrowser) return;

    const width = window.innerWidth * 0.66;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
  }
}
