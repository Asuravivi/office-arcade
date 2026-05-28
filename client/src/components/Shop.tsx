// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';

const ITEMS = [
  { id: 'avatar_dog', name: 'Cool Dog', type: 'avatar', cost: 100, icon: '🐶' },
  { id: 'avatar_cat', name: 'Cool Cat', type: 'avatar', cost: 100, icon: '🐱' },
  { id: 'avatar_robot', name: 'Robot', type: 'avatar', cost: 250, icon: '🤖' },
  { id: 'avatar_alien', name: 'Alien', type: 'avatar', cost: 500, icon: '👽' }
];

function Shop({ nickname, onClose }) {
  const [coins, setCoins] = useState(0);
  const [ownedItems, setOwnedItems] = useState([]);
  const [equippedAvatar, setEquippedAvatar] = useState('default');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError('');
      const [userRes, itemsRes] = await Promise.all([
        fetchApi(`/api/users/${nickname}`),
        fetchApi(`/api/cosmetics/${nickname}`)
      ]);
      setCoins(userRes.arcade_coins || 0);
      setEquippedAvatar(userRes.equipped_avatar || 'default');
      setOwnedItems(itemsRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load shop data');
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (item: any) => {
    try {
      setMessage('');
      setError('');
      const data = await fetchApi('/api/cosmetics/buy', {
        method: 'POST',
        body: JSON.stringify({ username: nickname, itemId: item.id, cost: item.cost })
      });
      setMessage(`Successfully bought ${item.name}!`);
      fetchUserData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEquip = async (item: any) => {
    try {
      setMessage('');
      setError('');
      await fetchApi('/api/cosmetics/equip', {
        method: 'POST',
        body: JSON.stringify({ username: nickname, itemId: item.id })
      });
      setMessage(`Equipped ${item.name}!`);
      fetchUserData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '40px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 className="text-gradient">Arcade Shop</h1>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '8px 16px', borderRadius: '24px', color: '#f59e0b', fontWeight: 'bold' }}>
            🪙 {coins} Coins
          </div>
          <button className="secondary" onClick={onClose}>Back to Lobby</button>
        </div>
      </header>

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        {message && <p style={{ color: 'var(--accent-secondary)' }}>{message}</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    </div>
  );
}

export default Shop;
