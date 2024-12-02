export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface FlyState {
  position: Position;
  direction: Vector3;
  isMoving: boolean;
  isFlying: boolean;
  currentTarget: number | null;
}

export interface PoopState {
  id: number;
  position: Position;
}

export interface GameState {
  fly: FlyState;
  poops: PoopState[];
}
