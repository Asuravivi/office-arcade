import { Chess } from 'chess.js';
// @ts-ignore
import stockfish from 'stockfish';

export class ChessEngine {
    private game: Chess;
    public players: any[];
    public status: 'playing' | 'finished';
    public winner: string | null;
    private engine: any;

    private onStateChange: (state: any) => void;

    constructor(playersList: any[], onStateChange: (state: any) => void) {
        this.game = new Chess();
        this.status = 'playing';
        this.winner = null;
        this.onStateChange = onStateChange;
        
        try {
            this.engine = stockfish();
        } catch(e) {
            console.error('Failed to init stockfish', e);
        }

        // Assign colors based on join order (0 is white, 1 is black)
        this.players = playersList.map((p, idx) => ({
            socketId: p.socketId,
            nickname: p.nickname,
            color: idx === 0 ? 'w' : 'b',
            isBot: p.isBot,
            difficulty: p.difficulty
        }));
    }

    public getState() {
        return {
            fen: this.game.fen(),
            status: this.status,
            winner: this.winner,
            players: this.players,
            turn: this.game.turn()
        };
    }

    public handleAction(actionData: any): boolean {
        if (this.status !== 'playing') return false;

        const actorId = actionData.botId || actionData.senderId;
        const player = this.players.find(p => p.socketId === actorId);

        // Ensure player exists and it is their turn
        if (!player || player.color !== this.game.turn()) return false;

        if (actionData.type === 'MOVE') {
            try {
                const move = this.game.move({
                    from: actionData.sourceSquare,
                    to: actionData.targetSquare,
                    promotion: 'q' // simplify promotion for now
                });

                if (move) {
                    this.checkGameStatus();
                    if (this.status === 'playing') {
                        this.triggerBotMoveIfNeeded();
                    }
                    return true;
                }
            } catch (e) {
                // Invalid move format
                return false;
            }
        }

        return false;
    }

    public triggerBotMoveIfNeeded() {
        if (this.status !== 'playing') return;
        const turnColor = this.game.turn();
        const currentPlayer = this.players.find(p => p.color === turnColor);
        if (currentPlayer && currentPlayer.isBot) {
            setTimeout(() => this.makeBotMove(currentPlayer), 1500);
        }
    }

    private makeBotMove(botPlayer: any) {
        if (this.status !== 'playing' || this.game.isGameOver()) return;
        if (this.game.turn() !== botPlayer.color) return;

        if (!this.engine) {
            // Fallback to random move if stockfish failed
            const possibleMoves = this.game.moves({ verbose: true });
            if (possibleMoves.length > 0) {
                const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                this.handleAction({ type: 'MOVE', sourceSquare: move.from, targetSquare: move.to, botId: botPlayer.socketId });
                this.onStateChange(this.getState());
            }
            return;
        }

        // Setup Stockfish difficulty
        let skillLevel = 5; // medium
        let depth = 5;
        if (botPlayer.difficulty === 'easy') { skillLevel = 0; depth = 1; }
        else if (botPlayer.difficulty === 'hard') { skillLevel = 20; depth = 10; }

        this.engine.postMessage(`setoption name Skill Level value ${skillLevel}`);
        this.engine.postMessage(`position fen ${this.game.fen()}`);
        this.engine.postMessage(`go depth ${depth}`);

        // Listen for the move
        const messageHandler = (msg: string) => {
            if (msg && msg.startsWith('bestmove')) {
                const parts = msg.split(' ');
                const best = parts[1]; // e.g. "e2e4"
                if (best) {
                    const sourceSquare = best.substring(0, 2);
                    const targetSquare = best.substring(2, 4);
                    // Stop listening for this move
                    this.engine.removeListener ? this.engine.removeListener('message', messageHandler) : this.engine.onmessage = null;
                    
                    this.handleAction({
                        type: 'MOVE',
                        sourceSquare,
                        targetSquare,
                        botId: botPlayer.socketId
                    });
                    this.onStateChange(this.getState());
                }
            }
        };

        if (this.engine.on) {
            this.engine.on('message', messageHandler);
        } else {
            this.engine.onmessage = messageHandler;
        }
    }

    private checkGameStatus() {
        if (this.game.isGameOver()) {
            this.status = 'finished';
            if (this.game.isCheckmate()) {
                // The winner is the player whose turn it is NOT
                const winnerColor = this.game.turn() === 'w' ? 'b' : 'w';
                const winnerObj = this.players.find(p => p.color === winnerColor);
                this.winner = winnerObj ? winnerObj.nickname : 'Unknown';
            } else if (this.game.isDraw() || this.game.isStalemate() || this.game.isThreefoldRepetition() || this.game.isInsufficientMaterial()) {
                this.winner = 'Draw';
            } else {
                this.winner = 'Unknown';
            }
        }
    }
}
