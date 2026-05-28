// client/src/components/UserProfile.tsx
import { useEffect, useState } from 'react';
import { fetchApi } from '../utils/api';
import { toast } from '../utils/toast';

interface PortfolioData {
  cashBalance: number;
  totalValue: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    averagePrice: number;
    livePrice: number;
    currentValue: number;
    pnl: number;
    pnlPercent: string;
  }>;
}

const UserProfile = ({ onClose }: { onClose: () => void }) => {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/api/portfolio')
      .then(data => {
        setPortfolio(data);
        setLoading(false);
      })
      .catch(err => {
        toast.error(err.message || 'Failed to load portfolio');
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
        width: '90%', maxWidth: '600px', border: '1px solid #333',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>👤 My Profile</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Loading profile...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Portfolio Summary */}
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#fbbf24' }}>💼 Trading Portfolio</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#888' }}>Total Value:</span>
                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>₹{portfolio?.totalValue.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>Available Cash:</span>
                <span style={{ color: '#fff' }}>₹{portfolio?.cashBalance.toFixed(2)}</span>
              </div>
            </div>

            {/* Positions */}
            <div>
              <h3 style={{ margin: '0 0 12px 0', color: '#fff' }}>Active Positions</h3>
              {portfolio?.positions.length === 0 ? (
                <p style={{ color: '#888', fontStyle: 'italic' }}>No active positions.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {portfolio?.positions.map((pos, idx) => (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                      borderLeft: `4px solid ${pos.pnl >= 0 ? '#26a69a' : '#ef5350'}`
                    }}>
                      <div>
                        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>{pos.symbol}</div>
                        <div style={{ color: '#888', fontSize: '0.85rem' }}>{pos.quantity} shares @ ₹{pos.averagePrice.toFixed(2)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#fff' }}>₹{pos.currentValue.toFixed(2)}</div>
                        <div style={{ color: pos.pnl >= 0 ? '#26a69a' : '#ef5350', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)} ({pos.pnlPercent}%)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
