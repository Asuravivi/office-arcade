import { v4 as uuidv4 } from 'uuid';
import { ChessEngine } from './engines/chess';
import { UnoEngine } from './engines/uno';

export const MAX_PLAYERS: Record<string, number> = {
    'chess': 2,
    'uno': 4,
    'donkey': 4,
    'ludo': 4,
    'snakeladder': 4,
    'solo2048': 1,
    'snake': 1,
    'tetris': 1,
    'flappybird': 1,
    'shooter': 4
};

export interface Player {
    nickname: string;
    isReady: boolean;
    score: number;
    isPanicked: boolean;
    isBot?: boolean;
    difficulty?: string;
    isDisconnected?: boolean;
    disconnectTimer?: NodeJS.Timeout;
}

export interface Room {
    id: string;
    name: string;
    host: string;
    players: Map<string, Player>;
    gameType: string;
    state: 'lobby' | 'playing' | 'finished';
    gameState: any;
    engine?: any;
}

class RoomManager {
    public rooms: Map<string, Room>;

    constructor() {
        this.rooms = new Map();
    }

    createRoom(roomName: string, hostSocketId: string, hostNickname: string, gameType: string): Room {
        const roomId = uuidv4().substring(0, 8);
        const players = new Map<string, Player>();
        players.set(hostSocketId, { nickname: hostNickname, isReady: false, score: 0, isPanicked: false });
        
        const room: Room = {
            id: roomId,
            name: roomName,
            host: hostSocketId,
            players: players,
            gameType: gameType,
            state: 'lobby',
            gameState: null
        };
        
        this.rooms.set(roomId, room);
        return room;
    }

    joinRoom(roomId: string, socketId: string, nickname: string, asSpectator = false): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        if (room.state !== 'lobby' && !asSpectator) return null;

        if (!asSpectator) {
            const maxPlayers = MAX_PLAYERS[room.gameType] || 4;
            if (room.players.size >= maxPlayers) {
                return null; // Room full
            }
            room.players.set(socketId, { nickname, isReady: false, score: 0, isPanicked: false });
        }
        return room;
    }

    leaveRoom(roomId: string, socketId: string): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        
        const player = room.players.get(socketId);
        if (player && player.disconnectTimer) {
            clearTimeout(player.disconnectTimer);
        }
        
        room.players.delete(socketId);
        
        // If no human players are left, delete the room
        const hasHuman = Array.from(room.players.values()).some(p => !p.isBot);
        if (!hasHuman) {
            this.rooms.delete(roomId);
            return null;
        }

        if (room.host === socketId) {
            const nextHost = Array.from(room.players.keys())[0];
            room.host = nextHost;
        }

        return room;
    }

    setReady(roomId: string, socketId: string, isReady: boolean): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const player = room.players.get(socketId);
        if (player) {
            player.isReady = isReady;
        }
        return room;
    }

    setPanic(roomId: string, socketId: string, isPanicked: boolean): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const player = room.players.get(socketId);
        if (player) {
            player.isPanicked = isPanicked;
        }
        return room;
    }

    addBot(roomId: string, difficulty: string = 'medium'): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        if (room.state !== 'lobby') return null;

        const maxPlayers = MAX_PLAYERS[room.gameType] || 4;
        if (room.players.size >= maxPlayers) return null;

        const botId = `bot-${uuidv4().substring(0, 8)}`;
        const botNumber = Array.from(room.players.values()).filter(p => p.isBot).length + 1;
        room.players.set(botId, { 
            nickname: `Bot ${botNumber} (${difficulty})`, 
            isReady: true, 
            score: 0,
            isPanicked: false,
            isBot: true,
            difficulty 
        });
        return room;
    }

    removeBot(roomId: string, botId: string): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        if (room.players.get(botId)?.isBot) {
            room.players.delete(botId);
        }
        return room;
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    getRoomsList(): any[] {
        const list = [];
        for (const [id, room] of this.rooms.entries()) {
            list.push({
                id: room.id,
                name: room.name,
                hostNickname: room.players.get(room.host)?.nickname,
                playerCount: room.players.size,
                gameType: room.gameType,
                state: room.state
            });
        }
        return list;
    }

    getRoomData(roomId: string): any {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        
        return {
            id: room.id,
            name: room.name,
            host: room.host,
            gameType: room.gameType,
            state: room.state,
            gameState: room.gameState,
            players: Array.from(room.players.entries()).map(([socketId, data]) => {
                // Remove the timer object before sending to client
                const { disconnectTimer, ...safeData } = data;
                return { socketId, ...safeData };
            })
        };
    }

    startGame(roomId: string, onStateChange: (state: any) => void): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const playersList = Array.from(room.players.entries()).map(([socketId, data]) => ({
            socketId,
            ...data
        }));

        if (room.gameType === 'chess') {
            room.engine = new ChessEngine(playersList, onStateChange);
            room.gameState = room.engine.getState();
        } else if (room.gameType === 'uno') {
            room.engine = new UnoEngine(playersList, onStateChange);
            room.gameState = room.engine.getState();
        } else {
            // Placeholder for other games until they are ported to server-side
            room.gameState = null;
        }

        room.state = 'playing';
        return room;
    }

    processGameAction(roomId: string, actionData: any): Room | null {
        const room = this.rooms.get(roomId);
        if (!room || !room.engine) return null;

        const valid = room.engine.handleAction(actionData);
        if (valid) {
            room.gameState = room.engine.getState();
            if (room.gameState.status === 'finished') {
                room.state = 'finished';
            }
            return room;
        }
        return null;
    }

    markDisconnected(roomId: string, socketId: string, onTimeout: () => void): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        const player = room.players.get(socketId);
        if (player) {
            player.isDisconnected = true;
            player.disconnectTimer = setTimeout(onTimeout, 30000); // 30 seconds
        }
        return room;
    }

    reconnectUser(nickname: string, newSocketId: string): { room: Room, oldSocketId: string } | null {
        for (const [roomId, room] of this.rooms.entries()) {
            for (const [socketId, player] of room.players.entries()) {
                if (!player.isBot && player.nickname === nickname) {
                    if (player.disconnectTimer) {
                        clearTimeout(player.disconnectTimer);
                    }
                    
                    // Replace the socket ID key
                    room.players.delete(socketId);
                    player.isDisconnected = false;
                    player.disconnectTimer = undefined;
                    room.players.set(newSocketId, player);
                    
                    if (room.host === socketId) {
                        room.host = newSocketId;
                    }
                    
                    return { room, oldSocketId: socketId };
                }
            }
        }
        return null;
    }
}

export default new RoomManager();
