import { useEffect, useState } from 'react';
import { GameProps } from './types';

export default function Uno({ socket, nickname, onGameOver, onRestart, onLeave }: GameProps) {
  const [gameState, setGameState] = useState<any>(null);
  const [wildColorChoice, setWildColorChoice] = useState<string | null>(null);

  useEffect(() => {
    const handleAction = (data: any) => {
      if (data.type === 'STATE_UPDATE') {
        setGameState(data.state);
      }
    };
    socket.on('gameAction', handleAction);
    return () => {
      socket.off('gameAction', handleAction);
    };
  }, [socket]);

  if (!gameState) return <div style={{ color: 'white', textAlign: 'center', marginTop: '40px' }}>Loading Game...</div>;

  const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentTurnPlayer?.socketId === socket.id;
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  const handlePlayCard = (card: any) => {
    if (!isMyTurn) return;
    if (card.color === 'Wild') {
      setWildColorChoice(card.id);
      return;
    }
    socket.emit('gameAction', { type: 'PLAY_CARD', cardId: card.id });
  };

  const handleWildChoice = (color: string, cardId: string) => {
    socket.emit('gameAction', { type: 'PLAY_CARD', cardId, wildColor: color });
    setWildColorChoice(null);
  };

  const handleCancelWild = () => setWildColorChoice(null);

  const handleDraw = () => {
    if (!isMyTurn) return;
    socket.emit('gameAction', { type: 'DRAW_CARD' });
  };

  const getColorHex = (color: string) => {
    if (color === 'Red')    return 'var(--accent-danger)';
    if (color === 'Blue')   return 'var(--accent-primary)';
    if (color === 'Green')  return 'var(--accent-success)';
    if (color === 'Yellow') return '#fbbf24';
    return '#1e293b';
  };

  if (gameState.status === 'finished') {
    return (
      <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '20px' }}>Game Over!</h1>
        <h2 style={{ color: 'white', marginBottom: '40px' }}>🏆 Winner: {gameState.winner}</h2>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button onClick={() => { onGameOver(gameState.winner === nickname ? 100 : 10, 'uno'); onRestart?.(); }}>Play Again</button>
          <button className="secondary" onClick={() => { onGameOver(gameState.winner === nickname ? 100 : 10, 'uno'); onLeave?.(); }}>Leave Room</button>
        </div>
      </div>
    );
  }

  // A6 FIX: Look up by socket.id — fixes non-host card visibility
  const myPlayer = gameState.players.find((p: any) => p.socketId === socket.id);

  return (
    <div className="flex-col animate-fade-in" style={{ height: '100%', display: 'flex', gap: '20px' }}>

      {/* Opponents */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '10px 20px', flexWrap: 'wrap' }}>
        {gameState.players.filter((p: any) => p.socketId !== socket.id).map((p: any) => (
          <div key={p.socketId} className="glass-panel" style={{
            padding: '10px 20px',
            textAlign: 'center',
            border: p.socketId === currentTurnPlayer?.socketId ? '2px solid var(--accent-primary)' : 'none',
            transition: 'border 0.3s'
          }}>
            <h3 style={{ margin: 0 }}>{p.nickname}</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{p.hand?.length ?? 0} cards</p>
          </div>
        ))}
      </div>

      {/* Center Table */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px' }}>

        {/* Draw Pile */}
        <div
          onClick={handleDraw}
          style={{
            width: '120px', height: '180px',
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: `2px solid ${isMyTurn ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            borderRadius: '12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: isMyTurn ? 'pointer' : 'default',
            boxShadow: isMyTurn ? '0 0 20px rgba(0,255,255,0.3)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <span style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>DRAW<br />({gameState.deckCount})</span>
        </div>

        {/* Discard Pile */}
        <div style={{
          width: '120px', height: '180px',
          background: 'rgba(0, 0, 0, 0.6)',
          border: `3px solid ${getColorHex(topCard.color)}`,
          borderRadius: '12px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 25px ${getColorHex(topCard.color)}`,
          color: getColorHex(topCard.color),
          fontFamily: 'Orbitron',
          textShadow: `0 0 10px ${getColorHex(topCard.color)}`,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
          <h2 style={{ margin: 0, fontSize: '1rem', position: 'relative', zIndex: 1 }}>{topCard.color}</h2>
          <h1 style={{ margin: 0, fontSize: '2rem', position: 'relative', zIndex: 1 }}>{topCard.value}</h1>
        </div>

        {/* Current Color Indicator */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontFamily: 'Share Tech Mono', fontSize: '0.8rem' }}>Active Color</p>
          <div className="glow-pulse" style={{
            width: '44px', height: '44px',
            borderRadius: '50%',
            background: getColorHex(gameState.currentColor),
            margin: '0 auto',
            boxShadow: `0 0 20px ${getColorHex(gameState.currentColor)}`,
            border: '2px solid rgba(255,255,255,0.4)'
          }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontFamily: 'Share Tech Mono', fontSize: '0.75rem' }}>
            {isMyTurn ? '⚡ YOUR TURN' : `${currentTurnPlayer?.nickname}'s turn`}
          </p>
        </div>
      </div>

      {/* My Hand */}
      <div className="glass-panel" style={{ padding: '20px', minHeight: '200px' }}>
        <h3 style={{ margin: '0 0 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Your Hand ({myPlayer?.hand?.length ?? 0} cards)</span>
          {isMyTurn && !wildColorChoice && <span style={{ color: 'var(--accent-primary)', fontSize: '0.9rem' }}>⚡ Play a card or Draw</span>}
        </h3>

        {/* A23 FIX: Wild color picker has a cancel button */}
        {wildColorChoice ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px' }}>
            <h4 style={{ margin: 0 }}>Choose Wild Color:</h4>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['Red', 'Blue', 'Green', 'Yellow'].map(c => (
                <button
                  key={c}
                  onClick={() => handleWildChoice(c, wildColorChoice)}
                  style={{ background: getColorHex(c), width: '90px', height: '44px', color: c === 'Yellow' ? 'black' : 'white', fontSize: '0.85rem' }}
                >
                  {c}
                </button>
              ))}
            </div>
            <button onClick={handleCancelWild} className="secondary" style={{ fontSize: '0.8rem', padding: '8px 16px' }}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', minHeight: '130px' }}>
            {myPlayer?.hand
              ? myPlayer.hand.map((card: any) => {
                  const isValid = isMyTurn && (card.color === 'Wild' || card.color === gameState.currentColor || card.value === topCard.value);
                  const cardColor = getColorHex(card.color);
                  return (
                    <div
                      key={card.id}
                      onClick={() => handlePlayCard(card)}
                      style={{
                        minWidth: '90px', height: '135px',
                        background: 'rgba(10, 15, 30, 0.8)',
                        border: `2px solid ${cardColor}`,
                        borderRadius: '8px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: isValid ? 'pointer' : 'not-allowed',
                        opacity: (isMyTurn && !isValid) ? 0.35 : 1,
                        transform: isValid ? 'translateY(-12px)' : 'none',
                        transition: 'all 0.15s ease',
                        color: cardColor,
                        boxShadow: isValid ? `0 0 18px ${cardColor}` : 'none',
                        fontFamily: 'Orbitron',
                        textShadow: isValid ? `0 0 8px ${cardColor}` : 'none',
                        position: 'relative', overflow: 'hidden'
                      }}
                    >
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                      <span style={{ fontSize: '0.85rem', position: 'relative', zIndex: 1 }}>{card.color}</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: 'bold', textAlign: 'center', padding: '0 4px', position: 'relative', zIndex: 1 }}>{card.value}</span>
                    </div>
                  );
                })
              : <p style={{ color: 'var(--text-secondary)', margin: 'auto' }}>Waiting for cards...</p>
            }
          </div>
        )}
      </div>
    </div>
  );
}
