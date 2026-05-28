// @ts-nocheck
import { useEffect, useRef, useState } from 'react';

function Shooter({socket, room, nickname, onGameOver, onRestart, onLeave }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);

  const updateScore = (delta) => {
    scoreRef.current = Math.max(0, scoreRef.current + delta);
    setScore(scoreRef.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Game state
    const me = {
      x: Math.random() * 600 + 100,
      y: Math.random() * 400 + 100,
      radius: 15,
      color: 'var(--accent-primary)',
      speed: 4
    };
    
    let otherPlayers = {};
    let bullets = [];
    let keys = {};

    const handleKeyDown = (e) => keys[e.key] = true;
    const handleKeyUp = (e) => keys[e.key] = false;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handleMouseClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const angle = Math.atan2(mouseY - me.y, mouseX - me.x);
      const bullet = {
        x: me.x,
        y: me.y,
        vx: Math.cos(angle) * 8,
        vy: Math.sin(angle) * 8,
        id: Math.random()
      };
      
      bullets.push(bullet);
      
      socket.emit('gameAction', {
        type: 'shoot',
        bullet
      });
    };
    
    canvas.addEventListener('mousedown', handleMouseClick);

    socket.on('gameAction', (data) => {
      if (data.type === 'move') {
        otherPlayers[data.senderId] = {
          x: data.x,
          y: data.y,
          nickname: data.nickname
        };
      } else if (data.type === 'shoot') {
        bullets.push({ ...data.bullet, senderId: data.senderId });
      } else if (data.type === 'hit' && data.targetId === socket.id) {
        // I got hit! Respawn and lose points
        me.x = Math.random() * 600 + 100;
        me.y = Math.random() * 400 + 100;
        updateScore(-5);
        socket.emit('gameAction', { type: 'move', x: me.x, y: me.y });
      }
    });

    let animationId;

    const gameLoop = () => {
      // Update my position
      let moved = false;
      if (keys['w'] || keys['ArrowUp']) { me.y -= me.speed; moved = true; }
      if (keys['s'] || keys['ArrowDown']) { me.y += me.speed; moved = true; }
      if (keys['a'] || keys['ArrowLeft']) { me.x -= me.speed; moved = true; }
      if (keys['d'] || keys['ArrowRight']) { me.x += me.speed; moved = true; }

      // Boundaries
      me.x = Math.max(me.radius, Math.min(canvas.width - me.radius, me.x));
      me.y = Math.max(me.radius, Math.min(canvas.height - me.radius, me.y));

      if (moved) {
        socket.emit('gameAction', { type: 'move', x: me.x, y: me.y });
      }

      // Update bullets
      bullets.forEach(b => {
        b.x += b.vx;
        b.y += b.vy;
      });

      // Hit detection (My bullets hitting others)
      bullets.forEach((b, bIdx) => {
        if (b.senderId === socket.id) {
          Object.entries(otherPlayers).forEach(([id, p]) => {
            const dx = b.x - p.x;
            const dy = b.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < me.radius + 4) { // hit!
              b.toBeRemoved = true;
              updateScore(10);
              socket.emit('gameAction', { type: 'hit', targetId: id });
            }
          });
        }
      });

      // Remove off-screen and collided bullets
      bullets = bullets.filter(b => 
        !b.toBeRemoved &&
        b.x > 0 && b.x < canvas.width && 
        b.y > 0 && b.y < canvas.height
      );

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Draw me
      ctx.beginPath();
      ctx.arc(me.x, me.y, me.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#6366f1';
      ctx.fill();
      ctx.closePath();
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText(nickname, me.x, me.y - 20);

      // Draw others
      Object.values(otherPlayers).forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, me.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ec4899';
        ctx.fill();
        ctx.closePath();
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(p.nickname, p.x, p.y - 20);
      });

      // Draw bullets
      bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.closePath();
      });

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleMouseClick);
      cancelAnimationFrame(animationId);
      socket.off('gameAction');
    };
  }, [socket, nickname]);

  return (
    <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '800px', marginBottom: '20px' }}>
        <h2 className="text-gradient">Arena Shooter</h2>
        <div className="glass-panel" style={{ padding: '8px 16px', borderRadius: '8px' }}>
          Score: {score}
        </div>
      </div>
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={600} 
          style={{ background: '#0f172a', display: 'block', cursor: 'crosshair' }}
        />
      </div>
      <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
        WASD to move, Click to shoot. (Hit detection is simplified for this version)
      </p>
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button onClick={() => { onGameOver(scoreRef.current, 'shooter'); onRestart(); }}>Play Again</button>
          <button className="secondary" onClick={() => { onGameOver(scoreRef.current, 'shooter'); onLeave(); }}>Leave Room</button>
        </div>
    </div>
  );
}

export default Shooter;
