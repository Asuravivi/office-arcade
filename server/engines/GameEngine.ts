export interface GameAction {
    type: string;
    payload?: any;
    senderId: string;
    nickname: string;
}

export abstract class GameEngine {
    public roomId: string;
    public players: any[];
    public state: any;
    public io: any;

    constructor(roomId: string, players: any[], io: any) {
        this.roomId = roomId;
        this.players = players;
        this.io = io;
        this.state = this.getInitialState();
    }

    abstract getInitialState(): any;
    abstract processAction(action: GameAction): void;
    
    broadcastState() {
        this.io.to(this.roomId).emit('gameStateUpdate', this.state);
    }
}
