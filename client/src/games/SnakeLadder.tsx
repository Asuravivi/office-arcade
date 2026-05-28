// @ts-nocheck
import { useEffect, useRef, useState } from 'react';

const SNAKES = {
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78
};

const LADDERS = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100
};

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#eab308', '#ec4899', '#8b5cf6'];

function SnakeLadder({socket, room, nickname, onGameOver, onRestart, onLeave }) {
  const amIHost = room.host === socket.id;
  const [gameState, setGameState] = useState(null);
  const hostStateRef = useRef(null);

  const broadcastState = (state) => {
    socket.emit('gameAction', { type: 'STATE_UPDATE', state });
    setGameState(state);
  };

  useEffect(() => {
    if (amIHost && !hostStateRef.current) {
      const players = room.players.map((p, idx) => ({
        socketId: p.socketId,
        nickname: p.nickname,
        pos: 0,
        color: COLORS[idx % COLORS.length]
      }));

      const initialState = {
        players,
        turnIndex: 0,
        lastRoll: null,
        message: 'Game started!',
        status: 'playing',
        winner: null
      };
      hostStateRef.current = initialState;
      broadcastState(initialState);
    }
  }, [amIHost, room.players]);

  useEffect(() => {
    const handleAction = (data) => {
      if (data.type === 'STATE_UPDATE' && !amIHost) {
        setGameState(data.state);
      }
      if (amIHost) {
        handleClientAction(data);
      }
    };
    socket.on('gameAction', handleAction);
    return () => socket.off('gameAction', handleAction);
  }, [amIHost]);

  useEffect(() => {
    // Bot Logic (Host Only)
    if (amIHost && gameState && gameState.status === 'playing') {
      const currentPlayer = gameState.players[gameState.turnIndex];
      if (currentPlayer.isBot) {
        const botTimer = setTimeout(() => {
          handleClientAction({ type: 'ROLL_DICE', botId: currentPlayer.socketId });
        }, 1500); // 1.5 second delay for realism
        return () => clearTimeout(botTimer);
      }
    }
  }, [amIHost, gameState]);

  const handleClientAction = (data) => {
    const state = hostStateRef.current;
    if (!state || state.status !== 'playing') return;

    if (data.type === 'ROLL_DICE') {
      const actorId = data.botId || data.senderId;
      const playerIndex = state.players.findIndex(p => p.socketId === actorId);
      if (playerIndex !== state.turnIndex) return;

      const player = state.players[playerIndex];
      const roll = Math.floor(Math.random() * 6) + 1;
      state.lastRoll = roll;
      
      let newPos = player.pos;
      if (player.pos === 0) {
        // Need a 1 or 6 to start? Let's just say any roll starts to speed things up
        newPos += roll;
      } else {
        if (player.pos + roll <= 100) {
          newPos += roll;
        }
      }

      let msg = `${player.nickname} rolled a ${roll}.`;

      // Check snake/ladder
      if (SNAKES[newPos]) {
        msg += ` Oh no! Snake bite. Down to ${SNAKES[newPos]}.`;
        newPos = SNAKES[newPos];
      } else if (LADDERS[newPos]) {
        msg += ` Yay! Ladder climbed to ${LADDERS[newPos]}.`;
        newPos = LADDERS[newPos];
      }

      player.pos = newPos;
      state.message = msg;

      if (player.pos === 100) {
        state.status = 'finished';
        state.winner = player.nickname;
      } else {
        if (roll !== 6) {
          state.turnIndex = (state.turnIndex + 1) % state.players.length;
        } else {
          state.message += ' Rolled a 6! Roll again.';
        }
      }

      broadcastState({ ...state });
    }
  };

  if (!gameState) return <div style={{ color: 'white' }}>Loading Game...</div>;

  const isMyTurn = gameState.players[gameState.turnIndex].nickname === nickname;
  const boardSize = 500;
  const cellSize = boardSize / 10;

  const getCellCoords = (pos) => {
    if (pos === 0) return { x: -20, y: boardSize - 20 }; // Start outside
    const p = pos - 1;
    const row = Math.floor(p / 10);
    let col = p % 10;
    if (row % 2 === 1) col = 9 - col;
    
    return {
      x: col * cellSize + cellSize / 2,
      y: boardSize - row * cellSize - cellSize / 2
    };
  };

  if (gameState.status === 'finished') {
    return (
      <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '20px' }}>Game Over!</h1>
        <h2 style={{ color: 'white', marginBottom: '40px' }}>Winner: {gameState.winner}</h2>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button onClick={() => { onGameOver(gameState.winner === nickname ? 100 : 10, 'snakeladder'); onRestart(); }}>Play Again</button>
          <button className="secondary" onClick={() => { onGameOver(gameState.winner === nickname ? 100 : 10, 'snakeladder'); onLeave(); }}>Leave Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col animate-fade-in" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
      
      <div style={{ textAlign: 'center' }}>
        <h2 className="text-gradient">Snake & Ladders</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{gameState.message}</p>
        <div style={{ margin: '10px 0' }}>
          {isMyTurn ? (
            <button onClick={() => socket.emit('gameAction', { type: 'ROLL_DICE' })}>Roll Dice</button>
          ) : (
            <p style={{ color: 'var(--accent-secondary)' }}>Waiting for {gameState.players[gameState.turnIndex].nickname} to roll...</p>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', width: boardSize, height: boardSize, background: 'rgba(255,255,255,0.1)', border: '2px solid var(--border-color)', borderRadius: '8px' }}>
        {/* Draw Cells */}
        {Array.from({ length: 100 }).map((_, i) => {
          const num = i + 1;
          const coords = getCellCoords(num);
          const isOdd = (Math.floor((num-1)/10) + ((num-1)%10)) % 2 === 1;
          return (
            <div key={num} style={{
              position: 'absolute',
              left: coords.x - cellSize/2,
              top: coords.y - cellSize/2,
              width: cellSize,
              height: cellSize,
              background: isOdd ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem'
            }}>
              {num}
            </div>
          );
        })}

        {/* Draw Snakes and Ladders Connections lines */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {Object.entries(SNAKES).map(([head, tail]) => {
                const headC = getCellCoords(parseInt(head));
                const tailC = getCellCoords(parseInt(tail));
                return <line key={`s${head}`} x1={headC.x} y1={headC.y} x2={tailC.x} y2={tailC.y} stroke="#ef4444" strokeWidth="4" strokeDasharray="5,5" />
            })}
            {Object.entries(LADDERS).map(([bottom, top]) => {
                const bC = getCellCoords(parseInt(bottom));
                const tC = getCellCoords(parseInt(top));
                return <line key={`l${bottom}`} x1={bC.x} y1={bC.y} x2={tC.x} y2={tC.y} stroke="#10b981" strokeWidth="6" />
            })}
        </svg>

        {/* Draw Players */}
        {gameState.players.map((p, idx) => {
          const coords = getCellCoords(p.pos);
          const offsetX = (idx % 2 === 0) ? -5 : 5;
          const offsetY = (idx < 2) ? -5 : 5;
          return (
            <div key={p.socketId} style={{
              position: 'absolute',
              left: coords.x + offsetX - 10,
              top: coords.y + offsetY - 10,
              width: 20, height: 20,
              borderRadius: '50%',
              background: p.color,
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
              transition: 'all 0.3s ease-in-out',
              zIndex: 10
            }} title={p.nickname} />
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        {gameState.players.map(p => (
          <div key={p.nickname} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.color }} />
            <span style={{ color: p.nickname === nickname ? 'white' : 'var(--text-secondary)' }}>
              {p.nickname} ({p.pos})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SnakeLadder;
