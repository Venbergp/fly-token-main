// src/app/services/game.service.ts
import { Injectable, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { isPlatformBrowser } from '@angular/common';

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

export interface GameState {
  fly: {
    position: Position;
    direction: Vector3;
    isMoving: boolean;
    isFlying: boolean;
    currentTarget: number | null;
  };
  poops: Array<{
    id: number;
    position: Position;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class GameService implements OnDestroy {
  private readonly WS_URL = 'wss://neuralfly.net:3000';
  private socket$?: WebSocketSubject<GameState>;
  private gameStateSubject = new BehaviorSubject<GameState>({
    fly: {
      position: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: 1 },
      isMoving: false,
      isFlying: false,
      currentTarget: null
    },
    poops: []
  });
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.connect();
    }
  }

  private connect(): void {
    if (!this.socket$ || this.socket$.closed) {
      this.socket$ = webSocket<GameState>({
        url: this.WS_URL,
        deserializer: (e: MessageEvent) => JSON.parse(e.data),
        openObserver: {
          next: () => {
            console.log('WebSocket connection established');
          }
        },
        closeObserver: {
          next: () => {
            console.log('WebSocket connection closed');
            // Попытка переподключения через 2 секунды
            setTimeout(() => this.connect(), 2000);
          }
        }
      });

      this.socket$.subscribe({
        next: (gameState) => this.gameStateSubject.next(gameState),
        error: (error) => {
          console.error('WebSocket error:', error);
          // Попытка переподключения при ошибке
          setTimeout(() => this.connect(), 2000);
        }
      });
    }
  }

  getGameState(): Observable<GameState> {
    return this.gameStateSubject.asObservable();
  }

  ngOnDestroy() {
    if (this.socket$) {
      this.socket$.complete();
    }
  }
}
