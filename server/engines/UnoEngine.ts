import { GameEngine, GameAction } from './GameEngine';

export class UnoEngine extends GameEngine {
    getInitialState() {
        return {
            status: 'playing',
            currentPlayerIndex: 0,
            direction: 1,
            players: this.players.map(p => ({ ...p, hand: [] })),
            discardPile: [],
            currentColor: 'Red',
            winner: null
        };
    }

    processAction(action: GameAction) {
        if (action.type === 'PLAY_CARD') {
            const playerIndex = this.state.players.findIndex((p: any) => p.socketId === action.senderId);
            if (playerIndex !== this.state.currentPlayerIndex) return; // Not their turn
            
            // For now, this is a stub to fulfill the architectural requirement.
            this.broadcastState();
        }
    }
}
