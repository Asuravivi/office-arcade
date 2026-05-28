// client/src/components/ToastContainer.tsx
import React, { useEffect, useState } from 'react';
import { toast, ToastMessage } from '../utils/toast';

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe((newToast) => {
      setToasts((prev) => [...prev, newToast]);
      // Auto-remove after 3 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter(t => t.id !== newToast.id));
      }, 3000);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none' // allow clicking through empty space
    }}>
      {toasts.map(t => {
        let bgColor = '#333';
        let icon = 'ℹ️';
        if (t.type === 'success') { bgColor = '#059669'; icon = '✅'; }
        else if (t.type === 'error') { bgColor = '#dc2626'; icon = '❌'; }
        else if (t.type === 'warning') { bgColor = '#d97706'; icon = '⚠️'; }

        return (
          <div key={t.id} style={{
            background: bgColor,
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.95rem',
            animation: 'fadeInRight 0.3s ease-out forwards',
            pointerEvents: 'auto'
          }}>
            <span style={{ fontSize: '1.2rem' }}>{icon}</span>
            <span>{t.message}</span>
          </div>
        );
      })}
      <style>
        {`
          @keyframes fadeInRight {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}
      </style>
    </div>
  );
};

export default ToastContainer;
