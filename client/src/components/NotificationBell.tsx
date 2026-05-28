import React, { useEffect, useState } from 'react';

interface NotificationBellProps {
  socket: any;
  token: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ socket }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    // We would normally fetch from /api/notifications here
    // For now, listen for socket events
    socket.on('newNotification', (notif: any) => {
      setNotifications(prev => [notif, ...prev]);
    });

    socket.on('motdUpdate', (msg: string) => {
      setNotifications(prev => [{ title: 'System', message: msg, isRead: false }, ...prev]);
    });
    
    socket.on('newDailyChallenge', (chall: any) => {
      setNotifications(prev => [{ title: 'New Challenge', message: chall.description, isRead: false }, ...prev]);
    });

    return () => {
      socket.off('newNotification');
      socket.off('motdUpdate');
      socket.off('newDailyChallenge');
    };
  }, [socket]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setShowDropdown(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button 
        className="secondary"
        onClick={() => setShowDropdown(!showDropdown)}
        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', position: 'relative' }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-5px', right: '-5px',
            background: 'var(--accent-danger)', color: 'white',
            borderRadius: '50%', padding: '2px 6px', fontSize: '0.75rem', fontWeight: 'bold'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="glass-panel animate-fade-in" style={{
          position: 'absolute', top: '100%', right: '0', marginTop: '10px',
          width: '300px', padding: '16px', zIndex: 1000
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.8rem' }}>
                Mark all read
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>No notifications yet</p>
            ) : (
              notifications.map((n, i) => (
                <div key={i} style={{ 
                  background: n.isRead ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)', 
                  padding: '10px', borderRadius: '6px', borderLeft: n.isRead ? '2px solid transparent' : '2px solid var(--accent-primary)' 
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px' }}>{n.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{n.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
