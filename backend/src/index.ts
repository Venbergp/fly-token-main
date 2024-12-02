import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'https';
import { GameService } from './services/GameService';
import fs from 'fs';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const options = {
  key: fs.readFileSync(path.join(__dirname, '../ssl/privkey.pem')),
  cert: fs.readFileSync(path.join(__dirname, '../ssl/fullchain.pem'))
};

const server = createServer(options, app);
const wss = new WebSocketServer({ server });
const gameService = new GameService();

wss.on('connection', (ws) => {
  console.log('Новое подключение');
  
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(gameService.getGameState()));
    }
  }, 16);

  ws.on('close', () => {
    console.log('Клиент отключился');
    clearInterval(interval);
  });
});

setInterval(() => {
  gameService.updateState();
}, 16);

server.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});