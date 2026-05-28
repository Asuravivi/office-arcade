// client/src/components/LeagueLeaderboard.tsx
import { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import { toast } from '../utils/toast';

interface LeaderboardEntry {
  username: string;
  avatar: string;
  totalValue: number;
}

const LeagueLeaderboard = ({ onClose }: { onClose: () => void }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/api/league/leaderboard')
      .then(data => {
        setLeaderboard(data);
        setLoading(false);
      })
      .catch(err => {
        toast.error(err.message || 'Failed to load leaderboard');
        setLoading(false);
      });
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#1a1a1a', borderRadius: '12px', padding: '24px',
        width: '90%', maxWidth: '500px', border: '1px solid #333'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>🏆 Trading League</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Loading rankings...</p>
        ) : leaderboard.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888' }}>No traders yet. Be the first to buy a stock!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {leaderboard.map((entry, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
                border: idx === 0 ? '1px solid #fbbf24' : '1px solid transparent'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: idx === 0 ? '#fbbf24' : '#888', minWidth: '24px' }}>
                    #{idx + 1}
                  </span>
                  <div style={{ width: '40px', height: '40px', background: '#333', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                    {entry.avatar === 'default' ? '👾' : '👑'}
                  </div>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{entry.username}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#26a69a', fontWeight: 'bold' }}>₹{entry.totalValue.toFixed(2)}</div>
                  <div style={{ fontSize: '0.8rem', color: entry.totalValue >= 1000000 ? '#26a69a' : '#ef5350' }}>
                    {entry.totalValue >= 1000000 ? '+' : ''}{(((entry.totalValue - 1000000) / 1000000) * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueLeaderboard;
