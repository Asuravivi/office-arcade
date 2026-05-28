export class UnoEngine {
    public players: any[];
    public status: 'playing' | 'finished';
    public winner: string | null;
    public deck: any[];
    public discardPile: any[];
    public currentPlayerIndex: number;
    public direction: number;
    public currentColor: string;
    private onStateChange: (state: any) => void;

    constructor(playersList: any[], onStateChange: (state: any) => void) {
        this.status = 'playing';
        this.winner = null;
        this.deck = this.generateDeck();
        this.discardPile = [];
        this.currentPlayerIndex = 0;
        this.direction = 1;
        this.onStateChange = onStateChange;

        // Initialize players
        this.players = playersList.map(p => ({
            socketId: p.socketId,
            nickname: p.nickname,
            isBot: p.isBot,
            difficulty: p.difficulty,
            hand: []
        }));

        // Deal 7 cards to each player
        this.players.forEach(p => {
            for (let i = 0; i < 7; i++) {
                p.hand.push(this.deck.pop());
            }
        });

        // Setup discard pile
        let initialCard = this.deck.pop();
        while (initialCard.color === 'Wild') {
            this.deck.unshift(initialCard);
            initialCard = this.deck.pop();
        }
        this.discardPile.push(initialCard);
        this.currentColor = initialCard.color;
    }

    private generateDeck() {
        const colors = ['Red', 'Blue', 'Green', 'Yellow'];
        const deck = [];
        let idCounter = 0;
        for (const color of colors) {
            deck.push({ id: `c${idCounter++}`, color, value: '0' });
            for (let i = 1; i <= 9; i++) {
                deck.push({ id: `c${idCounter++}`, color, value: i.toString() });
                deck.push({ id: `c${idCounter++}`, color, value: i.toString() });
            }
            ['Skip', 'Reverse', 'Draw Two'].forEach(val => {
                deck.push({ id: `c${idCounter++}`, color, value: val });
                deck.push({ id: `c${idCounter++}`, color, value: val });
            });
        }
        for (let i = 0; i < 4; i++) {
            deck.push({ id: `c${idCounter++}`, color: 'Wild', value: 'Wild' });
            deck.push({ id: `c${idCounter++}`, color: 'Wild', value: 'Wild Draw Four' });
        }
        return deck.sort(() => Math.random() - 0.5);
    }

    public getState() {
        return {
            status: this.status,
            winner: this.winner,
            currentPlayerIndex: this.currentPlayerIndex,
            direction: this.direction,
            currentColor: this.currentColor,
            discardPile: this.discardPile,
            deckCount: this.deck.length,
            // Full hands are sent! The client filter it out so clients only see their own hand,
            // or we can filter it here, but keeping it simple for now as it's the exact format the frontend expects right now
            players: this.players,
            deck: this.deck
        };
    }

    private drawCards(count: number) {
        const cards = [];
        for (let i = 0; i < count; i++) {
            if (this.deck.length === 0) {
                if (this.discardPile.length > 1) {
                    const top = this.discardPile.pop();
                    this.deck = this.discardPile.sort(() => Math.random() - 0.5);
                    this.discardPile = [top];
                } else break;
            }
            cards.push(this.deck.pop());
        }
        return cards;
    }

    private nextTurn(skip = false) {
        let step = this.direction;
        if (skip) step *= 2;
        this.currentPlayerIndex = (this.currentPlayerIndex + step + this.players.length) % this.players.length;
    }

    public handleAction(actionData: any): boolean {
        if (this.status !== 'playing') return false;

        const actorId = actionData.botId || actionData.senderId;
        const playerIndex = this.players.findIndex(p => p.socketId === actorId);

        if (playerIndex === -1 || playerIndex !== this.currentPlayerIndex) return false;
        
        const player = this.players[playerIndex];

        if (actionData.type === 'PLAY_CARD') {
            const cardIdx = player.hand.findIndex((c: any) => c.id === actionData.cardId);
            if (cardIdx === -1) return false;
            const card = player.hand[cardIdx];

            const topCard = this.discardPile[this.discardPile.length - 1];
            const isValid = card.color === 'Wild' || card.color === this.currentColor || card.value === topCard.value;
            if (!isValid) return false;

            // Play the card
            player.hand.splice(cardIdx, 1);
            this.discardPile.push(card);
            this.currentColor = card.color === 'Wild' ? actionData.wildColor : card.color;

            // Win condition
            if (player.hand.length === 0) {
                this.status = 'finished';
                this.winner = player.nickname;
                return true;
            }

            // Apply card effects
            if (card.value === 'Reverse') {
                this.direction *= -1;
                this.nextTurn(this.players.length === 2);
            } else if (card.value === 'Skip') {
                this.nextTurn(true);
            } else if (card.value === 'Draw Two') {
                this.nextTurn(false);
                this.players[this.currentPlayerIndex].hand.push(...this.drawCards(2));
                this.nextTurn(false);
            } else if (card.value === 'Wild Draw Four') {
                this.nextTurn(false);
                this.players[this.currentPlayerIndex].hand.push(...this.drawCards(4));
                this.nextTurn(false);
            } else {
                this.nextTurn(false);
            }
            this.triggerBotMoveIfNeeded();
            return true;

        } else if (actionData.type === 'DRAW_CARD') {
            const drawn = this.drawCards(1);
            player.hand.push(...drawn);
            this.nextTurn(false);
            this.triggerBotMoveIfNeeded();
            return true;
        }

        return false;
    }

    private triggerBotMoveIfNeeded() {
        if (this.status !== 'playing') return;
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (currentPlayer && currentPlayer.isBot) {
            setTimeout(() => this.makeBotMove(currentPlayer), 1200);
        }
    }

    private makeBotMove(bot: any) {
        if (this.status !== 'playing') return;
        if (this.players[this.currentPlayerIndex].socketId !== bot.socketId) return;

        const topCard = this.discardPile[this.discardPile.length - 1];
        const validCards = bot.hand.filter((c: any) =>
            c.color === 'Wild' || c.color === this.currentColor || c.value === topCard.value
        );

        if (validCards.length > 0) {
            let chosenCard = validCards[Math.floor(Math.random() * validCards.length)];
            if (bot.difficulty === 'hard') {
                const nonWilds = validCards.filter((c: any) => c.color !== 'Wild');
                if (nonWilds.length > 0) chosenCard = nonWilds[0];
            }

            let wildColor = null;
            if (chosenCard.color === 'Wild') {
                const colorCounts: any = { Red: 0, Blue: 0, Green: 0, Yellow: 0 };
                bot.hand.forEach((c: any) => { if (c.color !== 'Wild') colorCounts[c.color]++; });
                wildColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b);
                if (colorCounts[wildColor] === 0) {
                    const cols = ['Red', 'Blue', 'Green', 'Yellow'];
                    wildColor = cols[Math.floor(Math.random() * cols.length)];
                }
            }
            
            this.handleAction({
                type: 'PLAY_CARD',
                cardId: chosenCard.id,
                wildColor,
                botId: bot.socketId
            });
        } else {
            this.handleAction({
                type: 'DRAW_CARD',
                botId: bot.socketId
            });
        }
        
        this.onStateChange(this.getState());
    }
}
