import React, { useEffect, useState } from 'react';

interface AdminDashboardProps {
  token: string;
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ token, onClose }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/admin/analytics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error('Failed to fetch analytics', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    
    // Poll every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '30px', maxWidth: '800px', margin: '0 auto', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 className="text-gradient" style={{ margin: 0 }}>Admin Analytics</h1>
        <button className="secondary" onClick={onClose}>Close</button>
      </div>

      {loading && !stats ? (
        <p>Loading analytics...</p>
      ) : stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px' }}>
          
          <div style={{ background: 'rgba(0,0,0,0.5)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-secondary)' }}>Total Users</h3>
            <p style={{ fontSize: '2rem', margin: 0, color: 'var(--accent-primary)', fontWeight: 'bold' }}>{stats.users}</p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.5)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-secondary)' }}>Active Rooms</h3>
            <p style={{ fontSize: '2rem', margin: 0, color: 'var(--accent-success)', fontWeight: 'bold' }}>{stats.activeRooms}</p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.5)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-secondary)' }}>Total Trades</h3>
            <p style={{ fontSize: '2rem', margin: 0, color: '#fbbf24', fontWeight: 'bold' }}>{stats.trades}</p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.5)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-secondary)' }}>Economy (Coins)</h3>
            <p style={{ fontSize: '2rem', margin: 0, color: '#c084fc', fontWeight: 'bold' }}>{stats.economy}</p>
          </div>

        </div>
      ) : (
        <p style={{ color: 'var(--accent-danger)' }}>Failed to load stats. Are you an admin?</p>
      )}
    </div>
  );
};

export default AdminDashboard;
