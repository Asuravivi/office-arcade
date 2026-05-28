// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import Uno from '../games/Uno';
import Donkey from '../games/Donkey';
import Shooter from '../games/Shooter';
import Solo2048 from '../games/Solo2048';
import SnakeLadder from '../games/SnakeLadder';
import Snake from '../games/Snake';
import Tetris from '../games/Tetris';
import Ludo from '../games/Ludo';
import FlappyBird from '../games/FlappyBird';
import Chess from '../games/Chess';
import VoiceChat from './VoiceChat';

function Room({ room, socket, nickname, onLeave, onReady, onSendMessage, onTogglePanic }) {
  const [chatMessage, setChatMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [botDifficulty, setBotDifficulty] = useState('medium');
  const chatEndRef = useRef(null);

  // A3 FIX: Derive isReady from server state (room.players) — not local state.
  // Local state caused desync when rejoining: server had isReady:true but client showed false.
  const myPlayerInRoom = room.players.find(p => p.socketId === socket.id);
  const isReady = myPlayerInRoom?.isReady ?? false;

  useEffect(() => {
    const handleNewMessage = (msg) => {
      setChatLog(prev => [...prev, msg]);
    };

    socket.on('newMessage', handleNewMessage);
    
    // We get roomUpdates from props implicitly because App.jsx state updates
    // but we might need to handle 'gameStarting'
    const handleGameStart = () => {
      // Room state will change to playing, handled in App.jsx rendering logic
      // Actually we will render game component in this file based on room.state
    };
    
    socket.on('gameStarting', handleGameStart);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('gameStarting', handleGameStart);
    };
  }, [socket]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const toggleReady = () => {
    // Toggle against the server truth, not local
    const newReady = !isReady;
    onReady(newReady);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      onSendMessage(chatMessage);
      setChatMessage('');
    }
  };

  const addBot = () => {
    socket.emit('addBot', { difficulty: botDifficulty });
  };

  const removeBot = (botId) => {
    socket.emit('removeBot', botId);
  };

  const amIHost = room.host === socket.id;
  const myPlayer = room.players.find(p => p.nickname === nickname);

  const handleGameOver = async (score, gameName) => {
    try {
      // Use socket or simple fetch if we implement score api
      socket.emit('submitScore', { game: gameName, score });
      console.log(`Score submitted: ${score}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestart = () => {
    socket.emit('restartRoom');
  };

  if (room.state === 'playing') {
    // Render the appropriate game
    return (
      <div className="container" style={{ paddingTop: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="secondary" onClick={onLeave}>Leave Game</button>
            <VoiceChat socket={socket} room={room} myId={socket.id} />
          </div>
          <button 
            onClick={onTogglePanic}
            style={{
              backgroundColor: '#ef4444', color: 'white', borderRadius: '4px',
              padding: '8px 12px', fontWeight: 'bold', fontSize: '0.9rem',
              border: '1px solid #7f1d1d', boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
            title="Boss is coming!"
          >
            🚨 Panic
          </button>
        </div>
        <div style={{ flex: 1 }}>
          {room.gameType === 'uno' && <Uno socket={socket} room={room} nickname={nickname} onGameOver={handleGameOver} onRestart={handleRestart} onLeave={onLeave} />}
          {room.gameType === 'donkey' && <Donkey socket={socket} room={room} nickname={nickname} onGameOver={handleGameOver} onRestart={handleRestart} onLeave={onLeave} />}
          {room.gameType === 'shooter' && <Shooter socket={socket} room={room} nickname={nickname} onGameOver={handleGameOver} onRestart={handleRestart} onLeave={onLeave} />}
          {room.gameType === 'solo2048' && <Solo2048 socket={socket} room={room} nickname={nickname} onGameOver={handleGameOver} onRestart={handleRestart} onLeave={onLeave} />}
          {room.gameType === 'snakeladder' && <SnakeLadder socket={socket} room={room} nickname={nickname} onGameOver={handleGameOver} onRestart={handleRestart} onLeave={onLeave} />}
          {room.gameType === 'snake' && <Snake socket={socket} room={room} nickname={nickname} onGameOver={handleGameOver} onRestart={handleRestart} onLeave={onLeave} />}
          {room.gameType === 'tetris' && <Tetris socket={socket} room={room} nickname={nickname} onGameOver={handleGameOver} onRestart={handleRestart} onLeave={onLeave} />}
          {room.gameType === 'ludo' && <Ludo socket={socket} room={room} nickname={nickname} onGameOver={handleGameOver} onRestart={handleRestart} onLeave={onLeave} />}
          {room.gameType === 'flappybird' && <FlappyBird socket={socket} room={room} nickname={nickname} onGameOver={handleGameOver} onRestart={handleRestart} onLeave={onLeave} />}
          {room.gameType === 'chess' && <Chess socket={socket} room={room} nickname={nickname} onGameOver={handleGameOver} onRestart={handleRestart} onLeave={onLeave} />}
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '40px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 className="text-gradient" style={{ textShadow: '0 0 15px rgba(0,255,255,0.6)' }}>{room.name}</h1>
          <p style={{ color: 'var(--accent-secondary)', fontFamily: 'Share Tech Mono', marginTop: '4px' }}>SYSTEM: {room.gameType.toUpperCase()}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <VoiceChat socket={socket} room={room} myId={socket.id} />
          <button 
            onClick={onTogglePanic}
            style={{
              backgroundColor: '#ef4444', color: 'white', borderRadius: '4px',
              padding: '8px 12px', fontWeight: 'bold', fontSize: '0.9rem',
              border: '1px solid #7f1d1d', boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
            title="Boss is coming!"
          >
            🚨 Panic
          </button>
          <button className="secondary" onClick={onLeave}>DISCONNECT</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        {/* Players List */}
        <section className="glass-panel">
          <h2 style={{ marginBottom: '20px', color: 'var(--accent-primary)' }}>CONNECTED PLAYERS ({room.players.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'Share Tech Mono' }}>
            {room.players.map((p) => (
              <div key={p.socketId} style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                background: p.socketId === room.host ? 'rgba(0, 255, 255, 0.1)' : 'rgba(0, 20, 40, 0.5)',
                borderLeft: p.socketId === room.host ? '4px solid var(--accent-primary)' : '4px solid transparent',
                borderRadius: '4px',
                boxShadow: p.socketId === room.host ? 'inset 0 0 15px rgba(0,255,255,0.2)' : 'none'
              }}>
                <div>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#fff' }}>{p.nickname}</span>
                  {p.socketId === room.host && <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--accent-secondary)' }}>[HOST]</span>}
                  {p.nickname === nickname && <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>[YOU]</span>}
                  {p.isBot && <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--accent-tertiary)' }}>[BOT - {p.difficulty.toUpperCase()}]</span>}
                  {p.isPanicked && <span style={{ marginLeft: '8px', fontSize: '1.2rem', textShadow: '0 0 10px red' }} title="Boss is coming! (AFK)">⚠️</span>}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {p.isReady ? (
                    <span className="glow-pulse" style={{ color: 'var(--accent-success)', fontWeight: 'bold', padding: '4px 8px', border: '1px solid var(--accent-success)', borderRadius: '4px' }}>READY</span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>WAITING</span>
                  )}
                  {amIHost && p.isBot && (
                    <button className="secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', marginLeft: '10px' }} onClick={() => removeBot(p.socketId)}>X</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {amIHost && (
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={botDifficulty}
                onChange={e => setBotDifficulty(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid var(--border-color)' }}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <button className="secondary" style={{ flex: 1 }} onClick={addBot}>+ Add Bot</button>
            </div>
          )}

          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <button 
              onClick={toggleReady}
              style={{
                background: isReady ? 'transparent' : 'var(--accent-success)',
                border: isReady ? '2px solid var(--accent-success)' : '2px solid transparent',
                color: isReady ? 'var(--accent-success)' : '#000',
                boxShadow: isReady ? 'none' : '0 0 20px rgba(57, 255, 20, 0.6)',
                padding: '16px 32px',
                fontSize: '1.2rem'
              }}
            >
              {isReady ? 'CANCEL READY' : 'INITIALIZE'}
            </button>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '12px', fontFamily: 'Share Tech Mono' }}>
              AWAITING ALL PLAYERS...
            </p>
          </div>
        </section>

        {/* Room Chat */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
          <h2 style={{ marginBottom: '20px', color: 'var(--accent-primary)' }}>TERMINAL</h2>
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            background: 'rgba(0, 5, 20, 0.8)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontFamily: 'Share Tech Mono'
          }}>
            {chatLog.map((msg, idx) => (
              <div key={idx}>
                <span style={{ 
                  color: msg.sender === nickname ? 'var(--accent-success)' : 'var(--accent-primary)',
                  fontWeight: 'bold',
                  marginRight: '8px',
                  textShadow: '0 0 5px ' + (msg.sender === nickname ? 'rgba(57,255,20,0.5)' : 'rgba(0,255,255,0.5)')
                }}>
                  &gt; {msg.sender}:
                </span>
                <span style={{ color: '#fff' }}>{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              placeholder="Enter command..."
              style={{ flex: 1 }}
            />
            <button type="submit" style={{ padding: '12px 16px' }}>SEND</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Room;
