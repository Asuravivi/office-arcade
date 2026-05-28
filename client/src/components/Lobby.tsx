// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import LeagueLeaderboard from './LeagueLeaderboard';
import UserProfile from './UserProfile';
import AdminDashboard from './AdminDashboard';
import NotificationBell from './NotificationBell';
import { toast } from '../utils/toast';

function Lobby({ nickname, socket, onCreateRoom, onJoinRoom, onOpenShop, onTogglePanic, isAdmin }) {
  const [rooms, setRooms] = useState([]);
  const [highScores, setHighScores] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedGame, setSelectedGame] = useState('uno');

  const [globalMessages, setGlobalMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  const [friends, setFriends] = useState([]);
  const [friendInput, setFriendInput] = useState('');
  const [friendStatus, setFriendStatus] = useState('');

  const [queueStatus, setQueueStatus] = useState('idle'); // idle, searching
  const [queueGame, setQueueGame] = useState('uno');

  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [motd, setMotd] = useState('Welcome to the Office Arcade!');

  useEffect(() => {
    socket.emit('getRooms');
    fetchApi('/api/motd').then(data => setMotd(data.message)).catch(() => {});

    socket.on('motdUpdate', (newMotd) => {
      setMotd(newMotd);
    });

    // A25 FIX: Actively poll room list every 5 seconds so new rooms appear without user action
    const roomRefreshInterval = setInterval(() => {
      socket.emit('getRooms');
    }, 5000);

    socket.on('roomsList', (roomsList) => {
      setRooms(roomsList);
    });

    // Fetch high scores from server API
    fetchApi('/api/highscores')
      .then(data => setHighScores(data))
      .catch(err => console.error('Failed to fetch high scores', err));

    // Fetch friends list
    fetchApi(`/api/friends/${nickname}`)
      .then(data => setFriends(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to fetch friends', err));

    socket.on('globalMessage', (msg) => {
      setGlobalMessages(prev => [...prev, msg]);
    });

    socket.on('queueStatus', (data) => {
      setQueueStatus(data.status);
    });

    socket.on('matchFound', (roomId) => {
      setQueueStatus('idle');
      onJoinRoom(roomId);
    });

    return () => {
      clearInterval(roomRefreshInterval);
      socket.off('roomsList');
      socket.off('globalMessage');
      socket.off('queueStatus');
      socket.off('matchFound');
      // A4 FIX: Always leave the matchmaking queue when Lobby unmounts
      // Prevents ghost sockets being matched with real players
      socket.emit('leaveQueue');
    };
  }, [socket, nickname, onJoinRoom]);

  const handleSendGlobalMessage = () => {
    if (chatInput.trim()) {
      socket.emit('sendGlobalMessage', chatInput.trim());
      setChatInput('');
    }
  };

  const handleAddFriend = () => {
    if (!friendInput.trim()) return;
    fetchApi('/api/friends/add', {
      method: 'POST',
      body: JSON.stringify({ username: nickname, friendUsername: friendInput.trim() })
    })
    .then(data => {
      if (data.error) setFriendStatus(data.error);
      else {
        setFriendStatus('Friend added!');
        setFriendInput('');
        fetchApi(`/api/friends/${nickname}`)
          .then(data => setFriends(Array.isArray(data) ? data : []));
      }
    })
    .catch(err => setFriendStatus('Failed to add friend'));
  };

  const handleJoinQueue = () => {
    socket.emit('joinQueue', queueGame);
  };

  const handleLeaveQueue = () => {
    socket.emit('leaveQueue');
  };

  const handleCreate = () => {
    const finalRoomName = newRoomName.trim() || `${nickname}'s Game`;
    onCreateRoom(finalRoomName, selectedGame);
  };

  if (showAdminDashboard) return <AdminDashboard token={localStorage.getItem('token')} onClose={() => setShowAdminDashboard(false)} />;
  if (showProfile) return <UserProfile nickname={nickname} onClose={() => setShowProfile(false)} />;
  if (showLeaderboard) return <LeagueLeaderboard nickname={nickname} onClose={() => setShowLeaderboard(false)} />;

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '40px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', textShadow: '0 0 20px rgba(0,255,255,0.8), 0 0 40px rgba(255,0,255,0.6)' }}>ARCADE TERMINAL</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
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
              <button 
                className="secondary" 
                onClick={() => setShowProfile(true)}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                👤 Profile
              </button>
              {isAdmin && (
                <button 
                  className="secondary" 
                  onClick={() => setShowAdminDashboard(true)}
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#c084fc', color: '#c084fc' }}
                >
                  ⚙️ Admin
                </button>
              )}
              <NotificationBell socket={socket} token={localStorage.getItem('token') || ''} />
              <button className="secondary" onClick={onOpenShop}>🛒 Shop</button>
            </div>
            <div className="glass-panel" style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid var(--accent-success)', boxShadow: '0 0 10px rgba(57, 255, 20, 0.3)' }}>
              USER: <span style={{ color: 'var(--accent-success)', fontWeight: 'bold', fontFamily: 'Share Tech Mono' }}>{nickname}</span>
            </div>
          </div>
          <button 
            className="primary" 
            onClick={() => setShowLeaderboard(true)}
            style={{ padding: '8px 16px', background: '#fbbf24', color: '#000', border: 'none', fontWeight: 'bold' }}
          >
            🏆 Trading League
          </button>
        </div>
      </header>

      {/* Message of the Day (Creator Message) */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(38,166,154,0.1) 0%, rgba(41,98,255,0.1) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px', padding: '16px 24px', marginBottom: '32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <span style={{ color: '#fbbf24', fontWeight: 'bold', marginRight: '8px' }}>📢 ADMIN:</span>
          <span style={{ color: '#fff', fontSize: '1.1rem' }}>{motd}</span>
        </div>
        {isAdmin && (
          <button 
            onClick={async () => {
              const newMotd = prompt('Enter new Admin Message:', motd);
              if (newMotd && newMotd !== motd) {
                try {
                  await fetchApi('/api/motd', {
                    method: 'POST',
                    body: JSON.stringify({ message: newMotd })
                  });
                  toast.success('Admin message updated');
                } catch(e) { toast.error('Failed to update message'); }
              }
            }}
            style={{ background: 'transparent', border: '1px solid #888', color: '#888', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}
          >
            ✏️ Edit
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Create Room Section */}
          <section className="glass-panel">
            <h2 style={{ marginBottom: '20px' }}>Host a Game</h2>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Room Name</label>
                <input 
                  type="text" 
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder={`${nickname}'s Game`}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Game Type</label>
                <select 
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                >
                  <option value="uno">Uno</option>
                  <option value="donkey">Donkey</option>
                  <option value="shooter">Arena Shooter</option>
                  <option value="solo2048">2048 (Solo)</option>
                  <option value="snakeladder">Snake & Ladder (Multiplayer)</option>
                  <option value="ludo">Ludo (Multiplayer)</option>
                  <option value="snake">Snake (Solo)</option>
                  <option value="tetris">Tetris (Solo)</option>
                  <option value="flappybird">Flappy Bird (Solo)</option>
                  <option value="chess">Chess (Multiplayer)</option>
                </select>
              </div>
              <button onClick={handleCreate}>Create Room</button>
            </div>
          </section>

          {/* Ranked Matchmaking Section */}
          <section className="glass-panel">
            <h2 style={{ marginBottom: '20px' }}>Ranked Matchmaking (1v1)</h2>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Select Game</label>
                <select 
                  value={queueGame}
                  onChange={(e) => setQueueGame(e.target.value)}
                  disabled={queueStatus === 'searching'}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                >
                  <option value="uno">Uno</option>
                  <option value="ludo">Ludo</option>
                  <option value="chess">Chess</option>
                </select>
              </div>
              {queueStatus === 'idle' ? (
                <button onClick={handleJoinQueue} style={{ background: 'var(--accent-primary)' }}>Find Match</button>
              ) : (
                <button onClick={handleLeaveQueue} style={{ background: '#ef4444' }}>Cancel Search...</button>
              )}
            </div>
          </section>

          {/* Active Rooms Section */}
          <section className="glass-panel">
            <h2 style={{ marginBottom: '20px', color: 'var(--accent-primary)' }}>Active Lobbies</h2>
            {rooms.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono' }}>NO SIGNAL... BE THE FIRST TO HOST.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rooms.map(room => (
                  <div key={room.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    background: 'rgba(0, 20, 40, 0.5)',
                    borderRadius: '4px',
                    borderLeft: '4px solid var(--accent-primary)',
                    boxShadow: 'inset 0 0 10px rgba(0,255,255,0.1)'
                  }}>
                    <div>
                      <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>{room.name}</h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)', fontFamily: 'Share Tech Mono' }}>
                        HOST: {room.hostNickname} | SYS: {room.gameType.toUpperCase()} | PLYRS: {room.playerCount}
                      </span>
                    </div>
                    {room.state === 'lobby' ? (
                      <button 
                        className="secondary" 
                        onClick={() => onJoinRoom(room.id)}
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        CONNECT
                      </button>
                    ) : (
                      <button 
                        className="secondary" 
                        onClick={() => socket.emit('joinRoom', { roomId: room.id, asSpectator: true })}
                        style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: '#3b82f6', color: '#3b82f6' }}
                      >
                        👁️ SPECTATE
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Leaderboard, Chat, Friends */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Global Leaderboard Section */}
          <section className="glass-panel" style={{ height: 'fit-content' }}>
            <h2 style={{ marginBottom: '20px', color: 'var(--accent-secondary)', textShadow: '0 0 10px rgba(255,0,255,0.5)' }}>HIGH SCORES</h2>
            {highScores.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono' }}>AWAITING DATA...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'Share Tech Mono' }}>
                {highScores.map((score, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px dashed var(--border-color)'
                  }}>
                    <div>
                      <span style={{ color: idx === 0 ? 'var(--accent-success)' : 'var(--text-primary)', fontWeight: 'bold', marginRight: '16px' }}>{String(idx + 1).padStart(2, '0')}</span>
                      <span style={{ color: '#fff' }}>{score.nickname}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', marginLeft: '12px' }}>[{score.game.toUpperCase()}]</span>
                    </div>
                    <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold', textShadow: '0 0 5px rgba(255,0,255,0.5)' }}>{score.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Global Chat Section */}
          <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '300px' }}>
            <h2 style={{ marginBottom: '10px', color: 'var(--accent-primary)' }}>GLOBAL COMMS</h2>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '10px', padding: '10px', background: 'rgba(0,5,20,0.6)', border: '1px solid var(--border-color)', borderRadius: '4px', fontFamily: 'Share Tech Mono', fontSize: '0.9rem' }}>
              {globalMessages.map((msg, i) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <span style={{ color: msg.sender === nickname ? 'var(--accent-success)' : 'var(--accent-primary)', textShadow: '0 0 5px ' + (msg.sender === nickname ? 'rgba(57,255,20,0.5)' : 'rgba(0,255,255,0.5)') }}>
                    &gt; {msg.sender}: 
                  </span>
                  <span style={{ marginLeft: '8px', color: '#fff' }}>{msg.text}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendGlobalMessage()}
                placeholder="Transmit message..."
                style={{ flex: 1 }}
              />
              <button onClick={handleSendGlobalMessage} style={{ padding: '0 16px' }}>SEND</button>
            </div>
          </section>

          {/* Friends List Section */}
          <section className="glass-panel" style={{ height: 'fit-content' }}>
            <h2 style={{ marginBottom: '20px' }}>Friends</h2>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input 
                type="text" 
                value={friendInput} 
                onChange={(e) => setFriendInput(e.target.value)}
                placeholder="Add friend by username"
                style={{ flex: 1 }}
              />
              <button onClick={handleAddFriend}>Add</button>
            </div>
            {friendStatus && <div style={{ fontSize: '0.8rem', color: friendStatus.includes('added') ? '#10b981' : '#ef4444', marginBottom: '10px' }}>{friendStatus}</div>}
            
            {friends.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>You haven't added any friends yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {friends.map((f, i) => (
                  <div key={i} style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                    <strong>{f.username}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      
      {showLeaderboard && <LeagueLeaderboard onClose={() => setShowLeaderboard(false)} />}
      {showProfile && <UserProfile onClose={() => setShowProfile(false)} />}
    </div>
  );
}

export default Lobby;
