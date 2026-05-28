// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameProps, RoomPlayer } from './types';

export interface Card {
  suit: string;
  value: string;
}

export interface DonkeyState {
  status: 'playing' | 'finished';
  players: { socketId: string; nickname: string; isBot: boolean; difficulty: string }[];
  currentPlayerIndex: number;
  trickPile: { card: Card; playedBy: string }[];
  ledSuit: string | null;
  savedCount: number;
  loser?: string;
  message?: string;
}

const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function generateDeck() {
  const deck = [];
  let idCounter = 0;
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ id: `c${idCounter++}`, suit, value });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function getValueRank(value: string) {
  return VALUES.indexOf(value);
}

function Donkey({socket, room, nickname, onGameOver, onRestart, onLeave }: GameProps) {
  const amIHost = room.host === socket.id;
  const [gameState, setGameState] = useState<any>(null);
  const hostStateRef = useRef<any>({});

  const broadcastState = useCallback((state: any) => {
    const stateToSend = {
      ...state,
      players: state.players.map((p: any) => ({
        socketId: p.socketId,
        nickname: p.nickname,
        isSaved: p.isSaved,
        rank: p.rank,
        handCount: p.hand.length,
      }))
    };
    socket.emit('gameAction', { type: 'STATE_UPDATE', state: stateToSend });
    setGameState(stateToSend);
    hostStateRef.current = state;
  }, [socket]);

  const getBotMove = useCallback((botPlayer: any, hand: any[], state: any) => {
    if (!hand || hand.length === 0) return null;
    const ledSuit = state.ledSuit;
    let validCards = hand;
    if (ledSuit) {
      const suitCards = hand.filter((c: Card) => c.suit === ledSuit);
      if (suitCards.length > 0) validCards = suitCards;
    }
    validCards.sort((a: Card, b: Card) => getValueRank(b.value) - getValueRank(a.value));
    if (botPlayer.difficulty === 'hard') {
      if (ledSuit && validCards[0].suit !== ledSuit) {
        return validCards.reduce((max: Card, c: Card) => getValueRank(c.value) > getValueRank(max.value) ? c : max, validCards[0]);
      } else {
        return validCards[validCards.length - 1];
      }
    } else {
      return validCards[Math.floor(Math.random() * validCards.length)];
    }
  }, []);

  useEffect(() => {
    if (amIHost && !hostStateRef.current.players) {
      const deck = generateDeck();
      const players = room.players.map(p => ({
        socketId: p.socketId,
        nickname: p.nickname,
        isBot: p.isBot,
        difficulty: p.difficulty,
        hand: [],
        isSaved: false,
        rank: null
      }));

      let pIdx = 0;
      while (deck.length > 0) {
        players[pIdx].hand.push(deck.pop()!);
        pIdx = (pIdx + 1) % players.length;
      }

      let startIndex = 0;
      for (let i = 0; i < players.length; i++) {
        if (players[i].hand.some(c => c.suit === 'Spades' && c.value === 'A')) {
          startIndex = i;
          break;
        }
      }

      const initialState: any = {
        players,
        trickPile: [],
        ledSuit: null,
        currentPlayerIndex: startIndex,
        status: 'playing',
        loser: null,
        savedCount: 0
      };
      hostStateRef.current = initialState;
      broadcastState(initialState);
    }
  }, [amIHost, room.players, broadcastState]);

  useEffect(() => {
    const handleAction = (data: any) => {
      if (data.type === 'STATE_UPDATE' && !amIHost) {
        setGameState(data.state);
        return;
      }
      if (amIHost && data.type === 'PLAY_CARD') {
        handleClientAction(data);
      }
    };
    socket.on('gameAction', handleAction);
    return () => socket.off('gameAction', handleAction);
  }, [amIHost, socket]);

  useEffect(() => {
    if (!amIHost || !gameState || gameState.status !== 'playing') return;
    const state = hostStateRef.current;
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isBot) return;

    const botTimer = setTimeout(() => {
      const freshState = hostStateRef.current;
      if (!freshState || freshState.status !== 'playing') return;
      const botPlayer = freshState.players[freshState.currentPlayerIndex];
      const chosenCard = getBotMove(botPlayer, botPlayer.hand, freshState);
      if (chosenCard) {
        handleClientAction({ type: 'PLAY_CARD', cardId: chosenCard.id, senderId: botPlayer.socketId });
      }
    }, 1500);
    return () => clearTimeout(botTimer);
  }, [amIHost, gameState, getBotMove]);

  const nextActivePlayer = (state: any, startIndex: number) => {
    let index = (startIndex + 1) % state.players.length;
    while (state.players[index].isSaved && index !== startIndex) {
      index = (index + 1) % state.players.length;
    }
    return index;
  };

  const handleClientAction = (data: any) => {
    const state = hostStateRef.current;
    if (!state || state.status !== 'playing') return;

    const playerIndex = state.players.findIndex((p: any) => p.socketId === data.senderId);
    if (playerIndex === -1 || playerIndex !== state.currentPlayerIndex) return;
    const player = state.players[playerIndex];

    if (data.type === 'PLAY_CARD') {
      const cardIdx = player.hand.findIndex((c: Card) => c.id === data.cardId);
      if (cardIdx === -1) return;
      const card = player.hand[cardIdx];

      if (state.trickPile.length > 0) {
        const hasLedSuit = player.hand.some((c: Card) => c.suit === state.ledSuit);
        if (hasLedSuit && card.suit !== state.ledSuit) return;
      } else {
        state.ledSuit = card.suit;
      }

      player.hand.splice(cardIdx, 1);
      state.trickPile.push({ card, playerIndex });

      if (player.hand.length === 0) {
        player.isSaved = true;
        player.rank = state.savedCount + 1;
        state.savedCount++;
      }

      if (state.savedCount >= state.players.length - 1) {
        const loser = state.players.find((p: any) => !p.isSaved);
        state.status = 'finished';
        state.loser = loser ? loser.nickname : 'Unknown';
        broadcastState(state);
        return;
      }

      const isCut = card.suit !== state.ledSuit;
      let trickResolved = false;
      let trickWinnerIndex = -1;
      let cardsToPickUp = false;

      if (isCut) {
        let highestRank = -1;
        state.trickPile.forEach((t: any) => {
          if (t.card.suit === state.ledSuit) {
            const rank = getValueRank(t.card.value);
            if (rank > highestRank) {
              highestRank = rank;
              trickWinnerIndex = t.playerIndex;
            }
          }
        });
        cardsToPickUp = true;
        trickResolved = true;
      } else {
        const activePlayers = state.players.filter((p: any) => !p.isSaved).length;
        if (state.trickPile.length >= activePlayers) {
          let highestRank = -1;
          state.trickPile.forEach((t: any) => {
            if (t.card.suit === state.ledSuit) {
              const rank = getValueRank(t.card.value);
              if (rank > highestRank) {
                highestRank = rank;
                trickWinnerIndex = t.playerIndex;
              }
            }
          });
          trickResolved = true;
          cardsToPickUp = false;
        }
      }

      if (trickResolved) {
        if (cardsToPickUp && trickWinnerIndex !== -1) {
          const trickCards = state.trickPile.map((t: any) => t.card);
          state.players[trickWinnerIndex].hand.push(...trickCards);
          if (state.players[trickWinnerIndex].isSaved) {
            state.players[trickWinnerIndex].isSaved = false;
            state.players[trickWinnerIndex].rank = null;
            state.savedCount--;
          }
        }
        state.trickPile = [];
        state.ledSuit = null;
        state.currentPlayerIndex = trickWinnerIndex !== -1 ? trickWinnerIndex : nextActivePlayer(state, state.currentPlayerIndex);
      } else {
        state.currentPlayerIndex = nextActivePlayer(state, state.currentPlayerIndex);
      }
      broadcastState(state);
    }
  };

  if (!gameState) return <div style={{ color: 'white', textAlign: 'center', marginTop: '40px' }}>Loading Game...</div>;

  const myPlayer = gameState.players.find(p => p.socketId === socket.id);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.socketId === socket.id;

  const playCard = (card: any) => {
    if (!isMyTurn) return;
    socket.emit('gameAction', { type: 'PLAY_CARD', cardId: card.id, senderId: socket.id });
  };

  const getSuitSymbol = (suit: string) => {
    switch (suit) {
      case 'Spades':   return '♠';
      case 'Hearts':   return '♥';
      case 'Diamonds': return '♦';
      case 'Clubs':    return '♣';
      default:         return '';
    }
  };

  const getSuitColor = (suit) =>
    (suit === 'Hearts' || suit === 'Diamonds') ? 'var(--accent-danger)' : 'var(--accent-primary)';

  if (gameState.status === 'finished') {
    return (
      <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '20px' }}>Game Over!</h1>
        <h2 style={{ color: 'white', marginBottom: '40px' }}>🫏 Donkey (Loser): {gameState.loser}</h2>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button onClick={() => { onGameOver(gameState.loser === nickname ? 0 : 50, 'donkey'); onRestart(); }}>Play Again</button>
          <button className="secondary" onClick={() => { onGameOver(gameState.loser === nickname ? 0 : 50, 'donkey'); onLeave(); }}>Leave Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col animate-fade-in" style={{ height: '100%', display: 'flex', gap: '20px' }}>

      {/* Top info */}
      <div style={{ textAlign: 'center', padding: '10px' }}>
        <h2 className="text-gradient">Donkey 🫏</h2>
        {isMyTurn ? (
          <p style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', fontWeight: 'bold' }}>⚡ Your Turn!</p>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>Waiting for {currentPlayer?.nickname}...</p>
        )}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
          Led Suit: <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>{gameState.ledSuit || 'None'}</span>
        </p>
      </div>

      {/* Opponents */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
        {gameState.players.filter(p => p.socketId !== socket.id).map(p => (
          <div key={p.socketId} className="glass-panel" style={{
            padding: '10px 20px',
            textAlign: 'center',
            border: p.socketId === currentPlayer?.socketId ? '2px solid var(--accent-primary)' : 'none',
            opacity: p.isSaved ? 0.5 : 1,
            transition: 'all 0.3s'
          }}>
            <h3 style={{ margin: 0 }}>{p.nickname}</h3>
            {p.isSaved ? (
              <p style={{ margin: 0, color: '#10b981', fontWeight: 'bold' }}>Saved! (#{p.rank})</p>
            ) : (
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{p.handCount ?? p.hand?.length ?? 0} cards</p>
            )}
          </div>
        ))}
      </div>

      {/* Center Table (Trick Pile) */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-panel" style={{ width: '400px', height: '220px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {gameState.trickPile.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No cards played yet</p>}
          {gameState.trickPile.map((t, idx) => {
            const playerNick = gameState.players[t.playerIndex]?.nickname;
            const offset = (idx - (gameState.trickPile.length - 1) / 2);
            return (
              <div key={idx} style={{
                position: 'absolute',
                transform: `translateX(${offset * 65}px) translateY(${Math.abs(offset) * 8}px) rotate(${offset * 8}deg)`,
                zIndex: idx,
                width: '80px', height: '120px',
                background: 'rgba(5, 10, 25, 0.9)',
                border: `2px solid ${getSuitColor(t.card.suit)}`,
                borderRadius: '8px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 12px rgba(0,0,0,0.5), 0 0 10px ${getSuitColor(t.card.suit)}`,
                color: getSuitColor(t.card.suit),
                textShadow: `0 0 8px ${getSuitColor(t.card.suit)}`
              }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'Orbitron' }}>{t.card.value}</span>
                <span style={{ fontSize: '2rem' }}>{getSuitSymbol(t.card.suit)}</span>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px', fontFamily: 'Share Tech Mono' }}>{playerNick}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* My Hand */}
      <div className="glass-panel" style={{ padding: '20px', minHeight: '200px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>
          Your Hand
          {myPlayer?.isSaved && <span style={{ color: '#10b981', marginLeft: '10px' }}>✅ Saved! (#{myPlayer.rank})</span>}
          {!myPlayer?.isSaved && myPlayer?.hand && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '10px' }}>
              ({myPlayer.hand.length} cards)
            </span>
          )}
        </h3>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', minHeight: '120px' }}>
          {myPlayer?.hand
            ? myPlayer.hand
                .sort((a, b) => {
                  if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
                  return getValueRank(a.value) - getValueRank(b.value);
                })
                .map(card => {
                  const hasLedSuit = myPlayer.hand.some(c => c.suit === gameState.ledSuit);
                  let isValid = false;
                  if (isMyTurn && !myPlayer.isSaved) {
                    if (!gameState.ledSuit) isValid = true;
                    else if (hasLedSuit && card.suit === gameState.ledSuit) isValid = true;
                    else if (!hasLedSuit) isValid = true;
                  }
                  return (
                    <div
                      key={card.id}
                      onClick={() => isValid && handlePlayCard(card)}
                      style={{
                        minWidth: '70px', height: '105px',
                        background: 'rgba(5, 10, 25, 0.8)',
                        border: `2px solid ${isValid ? getSuitColor(card.suit) : 'rgba(255,255,255,0.12)'}`,
                        borderRadius: '6px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: isValid ? 'pointer' : 'not-allowed',
                        opacity: (isMyTurn && !isValid) ? 0.3 : 1,
                        transform: isValid ? 'translateY(-8px)' : 'none',
                        transition: 'all 0.15s ease',
                        color: getSuitColor(card.suit),
                        boxShadow: isValid ? `0 4px 12px rgba(0,0,0,0.4), 0 0 12px ${getSuitColor(card.suit)}` : 'none',
                        fontFamily: 'Orbitron'
                      }}
                    >
                      <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>{card.value}</span>
                      <span style={{ fontSize: '1.5rem' }}>{getSuitSymbol(card.suit)}</span>
                    </div>
                  );
                })
            : <p style={{ color: 'var(--text-secondary)', margin: 'auto' }}>Waiting for cards...</p>}
        </div>
      </div>
    </div>
  );
}

export default Donkey;
