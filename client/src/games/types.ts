import { Socket } from 'socket.io-client';

export interface RoomPlayer {
  socketId: string;
  nickname: string;
  isReady: boolean;
  isBot?: boolean;
  difficulty?: string;
}

export interface RoomData {
  id: string;
  name: string;
  host: string;
  gameType: string;
  players: RoomPlayer[];
  state: 'lobby' | 'playing' | 'finished';
}

export interface GameProps {
  socket: Socket;
  room: RoomData;
  nickname: string;
  onGameOver: (score: number, gameType: string) => void;
  onRestart?: () => void;
  onLeave?: () => void;
}
