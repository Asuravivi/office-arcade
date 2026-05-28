// @ts-nocheck
import { useEffect, useRef, useState } from 'react';

const TRACK = [
  [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  [7,0],
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
  [14,7],
  [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
  [7,14],
  [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
  [0,7]
].map(([c, r]) => ({ cx: c*40+20, cy: r*40+20 }));

const HOMES = {
  Red: {
    startOffset: 1, endOffset: 50,
    col: [[1,7],[2,7],[3,7],[4,7],[5,7]].map(([c, r]) => ({ cx: c*40+20, cy: r*40+20 })),
    base: [[2,2],[4,2],[2,4],[4,4]].map(([c, r]) => ({ cx: c*40+20, cy: r*40+20 }))
  },
  Green: {
    startOffset: 14, endOffset: 11,
    col: [[7,1],[7,2],[7,3],[7,4],[7,5]].map(([c, r]) => ({ cx: c*40+20, cy: r*40+20 })),
    base: [[10,2],[12,2],[10,4],[12,4]].map(([c, r]) => ({ cx: c*40+20, cy: r*40+20 }))
  },
  Yellow: {
    startOffset: 27, endOffset: 24,
    col: [[13,7],[12,7],[11,7],[10,7],[9,7]].map(([c, r]) => ({ cx: c*40+20, cy: r*40+20 })),
    base: [[10,10],[12,10],[10,12],[12,12]].map(([c, r]) => ({ cx: c*40+20, cy: r*40+20 }))
  },
  Blue: {
    startOffset: 40, endOffset: 37,
    col: [[7,13],[7,12],[7,11],[7,10],[7,9]].map(([c, r]) => ({ cx: c*40+20, cy: r*40+20 })),
    base: [[2,10],[4,10],[2,12],[4,12]].map(([c, r]) => ({ cx: c*40+20, cy: r*40+20 }))
  }
};

const COLOR_MAP = {
  Red: '#ef4444',
  Green: '#10b981',
  Yellow: '#eab308',
  Blue: '#3b82f6'
};

const TURN_ORDER = ['Red', 'Green', 'Yellow', 'Blue'];

function Ludo({socket, room, nickname, onGameOver, onRestart, onLeave }) {
  const amIHost = room.host === socket.id;
  const [gameState, setGameState] = useState(null);
  const hostStateRef = useRef(null);

  const broadcastState = (state) => {
    socket.emit('gameAction', { type: 'STATE_UPDATE', state });
    setGameState(state);
  };

  useEffect(() => {
    if (amIHost && !hostStateRef.current) {
      // Map players to colors
      const players = room.players.map((p, idx) => ({
        socketId: p.socketId,
        nickname: p.nickname,
        color: TURN_ORDER[idx % 4],
        tokens: [
          { state: 'base', pos: 0, steps: 0 },
          { state: 'base', pos: 1, steps: 0 },
          { state: 'base', pos: 2, steps: 0 },
          { state: 'base', pos: 3, steps: 0 }
        ]
      }));

      const initialState = {
        players,
        turnIndex: 0,
        lastRoll: null,
        message: 'Ludo started!',
        status: 'playing',
        winner: null,
        canRoll: true
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
    if (amIHost && gameState && gameState.status === 'playing') {
      const currentPlayer = gameState.players[gameState.turnIndex];
      if (currentPlayer.isBot) {
        const botTimer = setTimeout(() => {
          if (gameState.canRoll) {
             handleClientAction({ type: 'ROLL_DICE', botId: currentPlayer.socketId });
          } else {
             const validTokens = [];
             currentPlayer.tokens.forEach((t, tIdx) => {
               if (t.state === 'base' && gameState.lastRoll === 6) validTokens.push(tIdx);
               if (t.state === 'track') validTokens.push(tIdx);
               if (t.state === 'home' && t.pos + gameState.lastRoll <= 5) validTokens.push(tIdx);
             });

             if (validTokens.length > 0) {
               let chosenToken = validTokens[0];
               if (currentPlayer.difficulty === 'hard') {
                 const baseMove = validTokens.find(idx => currentPlayer.tokens[idx].state === 'base');
                 if (baseMove !== undefined) {
                   chosenToken = baseMove;
                 } else {
                   const trackTokens = validTokens.filter(idx => currentPlayer.tokens[idx].state === 'track');
                   if (trackTokens.length > 0) {
                     // For 'hard', prioritize advancing tokens closest to home
                     chosenToken = trackTokens.reduce((furthest, curr) => {
                       return currentPlayer.tokens[curr].pos > currentPlayer.tokens[furthest].pos ? curr : furthest;
                     }, trackTokens[0]);
                   }
                 }
               } else {
                 chosenToken = validTokens[Math.floor(Math.random() * validTokens.length)];
               }
               handleClientAction({ type: 'MOVE_TOKEN', tokenIndex: chosenToken, botId: currentPlayer.socketId });
             }
          }
        }, 1200);
        return () => clearTimeout(botTimer);
      }
    }
  }, [amIHost, gameState]);

  const nextTurn = (state) => {
    state.turnIndex = (state.turnIndex + 1) % state.players.length;
    state.canRoll = true;
    state.lastRoll = null;
  };

  const handleClientAction = (data) => {
    const state = hostStateRef.current;
    if (!state || state.status !== 'playing') return;

    const actorId = data.botId || data.senderId;
    const playerIndex = state.players.findIndex(p => p.socketId === actorId);
    if (playerIndex !== state.turnIndex) return;
    const player = state.players[playerIndex];

    if (data.type === 'ROLL_DICE' && state.canRoll) {
      const roll = Math.floor(Math.random() * 6) + 1;
      state.lastRoll = roll;
      state.message = `${player.nickname} rolled a ${roll}.`;
      state.canRoll = false;

      // Check if player has any valid moves
      const hasValidMove = player.tokens.some((t, tIdx) => {
        if (t.state === 'base' && roll === 6) return true;
        if (t.state === 'track') return true;
        if (t.state === 'home') {
            return t.pos + roll <= 5; // 5 is finished
        }
        return false;
      });

      if (!hasValidMove) {
        state.message += " No valid moves.";
        nextTurn(state);
      }

      broadcastState({ ...state });
    } 
    else if (data.type === 'MOVE_TOKEN' && !state.canRoll && state.lastRoll !== null) {
      const token = player.tokens[data.tokenIndex];
      const roll = state.lastRoll;

      if (token.state === 'base') {
        if (roll === 6) {
          token.state = 'track';
          token.pos = HOMES[player.color].startOffset;
          token.steps = 0;
          state.message = `${player.nickname} moved out of base! Roll again.`;
          state.canRoll = true;
        } else {
          return; // invalid
        }
      } 
      else if (token.state === 'track') {
        let enteredHome = false;
        let remainingRoll = roll;

        token.steps = token.steps || 0; // fallback just in case

        // Move one by one to check home entry
        for (let i = 0; i < roll; i++) {
          if (token.steps === 49) {
            enteredHome = true;
            remainingRoll = roll - i;
            break;
          }
          token.pos = (token.pos + 1) % 52;
          token.steps++;
        }

        if (enteredHome) {
          // If entering home and overshoots 5 (last space)
          if (remainingRoll - 1 > 5) return; // Invalid move, bounce
          token.state = 'home';
          token.pos = remainingRoll - 1; 
          if (token.pos === 5) token.state = 'finished';
        }

        // Collision logic on track
        if (token.state === 'track') {
            let hit = false;
            state.players.forEach(p => {
                if (p.color !== player.color) {
                    p.tokens.forEach(t => {
                        if (t.state === 'track' && t.pos === token.pos) {
                            // Safe zones check? usually starts and stars are safe. Let's skip safe zones for simplicity.
                            t.state = 'base';
                            // Reassign original base position (0, 1, 2, 3) - but we lost it, so just find empty
                            const used = p.tokens.filter(x => x.state === 'base').map(x => x.pos);
                            let newPos = 0;
                            while(used.includes(newPos)) newPos++;
                            t.pos = newPos;
                            t.steps = 0;
                            hit = true;
                            state.message = `${player.nickname} hit a token! Roll again.`;
                            state.canRoll = true;
                        }
                    });
                }
            });
            if (!hit && roll !== 6) {
                nextTurn(state);
            } else if (roll === 6) {
                state.message = `${player.nickname} moved. Roll again.`;
                state.canRoll = true;
            }
        } else {
            if (roll !== 6) nextTurn(state);
            else {
                state.message = `${player.nickname} moved. Roll again.`;
                state.canRoll = true;
            }
        }
      }
      else if (token.state === 'home') {
        if (token.pos + roll === 5) {
            token.state = 'finished';
            token.pos = 5;
            state.canRoll = true; // Roll again on finish
        } else if (token.pos + roll < 5) {
            token.pos += roll;
            if (roll !== 6) nextTurn(state);
            else state.canRoll = true;
        } else {
            return; // Invalid
        }
      }

      // Check win
      if (player.tokens.every(t => t.state === 'finished')) {
          state.status = 'finished';
          state.winner = player.nickname;
      }

      broadcastState({ ...state });
    }
  };

  if (!gameState) return <div style={{ color: 'white' }}>Loading Game...</div>;

  const isMyTurn = gameState.players[gameState.turnIndex].nickname === nickname;
  const myPlayer = gameState.players.find(p => p.nickname === nickname);

  const handleTokenClick = (tokenIndex) => {
    if (!isMyTurn || gameState.canRoll) return;
    socket.emit('gameAction', { type: 'MOVE_TOKEN', tokenIndex });
  };

  if (gameState.status === 'finished') {
    return (
      <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '20px' }}>Game Over!</h1>
        <h2 style={{ color: 'white', marginBottom: '40px' }}>Winner: {gameState.winner}</h2>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button onClick={() => { onGameOver(gameState.winner === nickname ? 100 : 10, 'ludo'); onRestart(); }}>Play Again</button>
          <button className="secondary" onClick={() => { onGameOver(gameState.winner === nickname ? 100 : 10, 'ludo'); onLeave(); }}>Leave Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col animate-fade-in" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 className="text-gradient">Ludo</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{gameState.message}</p>
        <div style={{ margin: '10px 0', minHeight: '40px' }}>
          {isMyTurn ? (
            gameState.canRoll ? 
              <button onClick={() => socket.emit('gameAction', { type: 'ROLL_DICE' })}>Roll Dice</button>
            : <p style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>Click a valid token to move {gameState.lastRoll} steps!</p>
          ) : (
            <p style={{ color: 'var(--accent-secondary)' }}>Waiting for {gameState.players[gameState.turnIndex].nickname}...</p>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', width: 600, height: 600, background: 'white', border: '4px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
        <svg width="600" height="600">
          {/* Background areas */}
          <rect x="0" y="0" width="240" height="240" fill="#fecaca" />
          <rect x="360" y="0" width="240" height="240" fill="#a7f3d0" />
          <rect x="360" y="360" width="240" height="240" fill="#fef08a" />
          <rect x="0" y="360" width="240" height="240" fill="#bfdbfe" />
          
          <rect x="240" y="240" width="120" height="120" fill="#e2e8f0" />

          {/* Bases inner circles */}
          {['Red', 'Green', 'Yellow', 'Blue'].map(color => (
            HOMES[color].base.map((c, i) => (
              <circle key={`${color}-base-${i}`} cx={c.cx} cy={c.cy} r="15" fill="white" stroke={COLOR_MAP[color]} strokeWidth="2" />
            ))
          ))}

          {/* Track */}
          {TRACK.map((c, i) => (
             <rect key={`track-${i}`} x={c.cx - 20} y={c.cy - 20} width="40" height="40" fill="none" stroke="#cbd5e1" />
          ))}

          {/* Home Columns */}
          {['Red', 'Green', 'Yellow', 'Blue'].map(color => (
            HOMES[color].col.map((c, i) => (
              <rect key={`${color}-col-${i}`} x={c.cx - 20} y={c.cy - 20} width="40" height="40" fill={COLOR_MAP[color]} opacity="0.3" stroke="white" />
            ))
          ))}

          {/* Tokens */}
          {gameState.players.map(p => 
            p.tokens.map((t, idx) => {
              let posCoords = { cx: 300, cy: 300 }; // Default finished
              if (t.state === 'base') posCoords = HOMES[p.color].base[t.pos];
              if (t.state === 'track') posCoords = TRACK[t.pos];
              if (t.state === 'home') posCoords = HOMES[p.color].col[t.pos];

              return (
                <circle 
                  key={`${p.socketId}-${idx}`} 
                  cx={posCoords.cx} 
                  cy={posCoords.cy} 
                  r="12" 
                  fill={COLOR_MAP[p.color]} 
                  stroke="white" 
                  strokeWidth="3"
                  style={{
                    cursor: (isMyTurn && !gameState.canRoll && p.nickname === nickname) ? 'pointer' : 'default',
                    transition: 'all 0.3s ease'
                  }}
                  onClick={() => p.nickname === nickname && handleTokenClick(idx)}
                />
              );
            })
          )}
        </svg>
      </div>
    </div>
  );
}

export default Ludo;
