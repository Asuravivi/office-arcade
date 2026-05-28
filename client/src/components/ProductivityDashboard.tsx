// @ts-nocheck
import React, { useMemo } from 'react';

function ProductivityDashboard({ onUnpanic }) {
  const chartData = useMemo(() => Array.from({ length: 9 }, () => Math.floor(Math.random() * 80) + 20), []);
  const ytdRev = useMemo(() => (Math.random() * 5 + 1).toFixed(1), []);
  const revTrend = useMemo(() => Math.floor(Math.random() * 20) - 5, []);
  
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: '#f3f4f6', zIndex: 99999, color: '#1f2937',
      fontFamily: 'Arial, sans-serif', overflow: 'hidden', padding: '20px',
      display: 'flex', flexDirection: 'column'
    }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #d1d5db', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>Q3 Financial Synopsis & Resource Allocation Matrix</h1>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>User: Admin (Active)</span>
          <button 
            onClick={onUnpanic}
            style={{ 
              background: 'transparent', border: 'none', cursor: 'pointer', 
              color: '#9ca3af', fontSize: '0.8rem', textDecoration: 'underline' 
            }}
          >
            Log Out (Return to Game)
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '20px', flex: 1 }}>
        {/* Left Sidebar */}
        <div style={{ width: '200px', borderRight: '1px solid #d1d5db', paddingRight: '20px' }}>
          <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
            {['Dashboard', 'Synergy Metrics', 'Q4 Projections', 'TPS Reports', 'Compliance', 'Settings'].map((item, idx) => (
              <li key={item} style={{ 
                padding: '10px', marginBottom: '5px', 
                backgroundColor: idx === 0 ? '#e5e7eb' : 'transparent', 
                borderRadius: '4px', cursor: 'pointer', fontWeight: idx === 0 ? 'bold' : 'normal' 
              }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top Row Cards */}
          <div style={{ display: 'flex', gap: '20px' }}>
            {[
              { title: 'YTD Revenue', value: `$${ytdRev}M`, trend: `${revTrend > 0 ? '+' : ''}${revTrend}%` },
              { title: 'Active Synergies', value: Math.floor(Math.random() * 200 + 50).toString(), trend: '+5%' },
              { title: 'Action Items', value: Math.floor(Math.random() * 20 + 2).toString(), trend: '-2%' }
            ].map(card => (
              <div key={card.title} style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', textTransform: 'uppercase' }}>{card.title}</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '10px 0' }}>{card.value}</div>
                <div style={{ fontSize: '0.9rem', color: card.trend.startsWith('+') ? '#10b981' : '#ef4444' }}>
                  {card.trend} vs last quarter
                </div>
              </div>
            ))}
          </div>

          {/* Fake Chart Area */}
          <div style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0' }}>Quarterly EBITDA Growth Trajectory</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 'calc(100% - 50px)', gap: '10px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>
              {chartData.map((height, idx) => (
                <div key={idx} style={{ 
                  flex: 1, height: `${height}%`, backgroundColor: '#3b82f6', 
                  borderRadius: '4px 4px 0 0', opacity: 0.8 
                }}></div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default ProductivityDashboard;
