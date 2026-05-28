import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import Room from './components/Room';
import Shop from './components/Shop';
import ProductivityDashboard from './components/ProductivityDashboard';
import TradingViewWidget from './components/TradingViewWidget';
import ToastContainer from './components/ToastContainer';
import { toast } from './utils/toast';
import { fetchApi } from './utils/api';
import './App.css'; // Just for completeness, but styles are in index.css

// A31 FIX: Read server URL from Vite env var — works for both local dev and production
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const socket = io(API);

function App() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [isPanicked, setIsPanicked] = useState<boolean>(false);
  const [showShop, setShowShop] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('arcade_token');
    if (token) {
      fetchApi('/api/verify')
        .then(data => {
          if (data.success && data.user) {
            socket.emit('setNickname', data.user.username);
            setNickname(data.user.username);
            setIsAdmin(data.user.isAdmin);
          } else {
            localStorage.removeItem('arcade_token');
          }
        })
        .catch(console.error);
    }

    socket.on('nicknameSet', (name: string) => {
      setNickname(name);
    });

    socket.on('roomJoined', (room: any) => {
      setCurrentRoom(room);
    });

    socket.on('roomUpdated', (room: any) => {
      setCurrentRoom(room);
    });

    socket.on('error', (msg: string) => {
      toast.error(msg);
    });

    return () => {
      socket.off('nicknameSet');
      socket.off('roomJoined');
      socket.off('roomUpdated');
      socket.off('error');
    };
  }, []);

  // A26 FIX: Removed dead handleSetNickname — login flow calls socket.emit('setNickname') directly

  const handleCreateRoom = (roomName: string, gameType: string) => {
    socket.emit('createRoom', { roomName, gameType });
  };

  const handleJoinRoom = (roomId: string) => {
    socket.emit('joinRoom', roomId);
  };

  const handleLeaveRoom = () => {
    socket.emit('leaveRoom');
    setCurrentRoom(null);
  };

  const handleSetReady = (isReady: boolean) => {
    socket.emit('setReady', isReady);
  };

  const handleSendMessage = (msg: string) => {
    socket.emit('sendMessage', msg);
  };

  const [isRegistering, setIsRegistering] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const handleAuth = async () => {
    if (!usernameInput.trim() || !passwordInput.trim()) {
      toast.error('Username and password required');
      return;
    }

    const endpoint = isRegistering ? '/api/register' : '/api/login';
    try {
      const data = await fetchApi(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username: usernameInput.trim(), password: passwordInput })
      });

      if (isRegistering) {
        setIsRegistering(false);
        toast.success('Registration successful! You can now log in.');
        setPasswordInput('');
      } else {
        localStorage.setItem('arcade_token', data.token);
        socket.emit('setNickname', data.user.username);
        setNickname(data.user.username);
        setIsAdmin(data.user.isAdmin);
        toast.success(`Welcome back, ${data.user.username}!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    }
  };

  const togglePanic = () => {
    const newPanicState = !isPanicked;
    setIsPanicked(newPanicState);
    if (socket && nickname && currentRoom) {
        socket.emit('panicStatus', { isPanicked: newPanicState });
    }
  };

  return (
    <>
      <ToastContainer />
      {isPanicked && <ProductivityDashboard onUnpanic={togglePanic} />}

      {!nickname ? (
        <div className="container flex-center" style={{ minHeight: '100vh' }}>
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '400px', width: '100%' }}>
            <h1 className="text-gradient" style={{ textAlign: 'center', marginBottom: '24px' }}>Office Arcade</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ textAlign: 'center' }}>{isRegistering ? 'Create Account' : 'Login'}</h2>
              
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '-10px' }}>Username</label>
              <input 
                type="text" 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="CoolGamer99"
              />

              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '-10px' }}>Password</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAuth();
                }}
              />

              <button onClick={handleAuth}>{isRegistering ? 'Register' : 'Login'}</button>
              
              <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '8px', cursor: 'pointer' }}
                 onClick={() => { setIsRegistering(!isRegistering); setPasswordInput(''); }}>
                {isRegistering ? 'Already have an account? Login here' : 'Need an account? Register here'}
              </p>
            </div>
          </div>
        </div>
      ) : currentRoom ? (
        <Room 
          room={currentRoom} 
          socket={socket}
          nickname={nickname}
          onLeave={handleLeaveRoom}
          onReady={handleSetReady}
          onSendMessage={handleSendMessage}
          onTogglePanic={togglePanic}
        />
      ) : showShop ? (
        <Shop 
          nickname={nickname}
          onClose={() => setShowShop(false)}
        />
      ) : (
        <Lobby 
          nickname={nickname}
          socket={socket}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onOpenShop={() => setShowShop(true)}
          onTogglePanic={togglePanic}
          isAdmin={isAdmin}
        />
      )}

      {/* Native Floating Widgets powered by lightweight-charts */}
      <TradingViewWidget initialSymbol="NIFTY" position={{ bottom: '20px', left: '20px' }} />
      <TradingViewWidget initialSymbol="BANKNIFTY" position={{ bottom: '20px', right: '20px' }} />
    </>
  );
}

export default App;
