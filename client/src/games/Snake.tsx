// @ts-nocheck
import { useEffect, useRef, useState } from 'react';

function Snake({onGameOver, onRestart, onLeave }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [isDead, setIsDead] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const gridSize = 20;
    const tileCount = canvas.width / gridSize;
    
    let snake = [{ x: 10, y: 10 }];
    let food = { x: 15, y: 15 };
    let dx = 0;
    let dy = 0;
    let nextDx = 0;
    let nextDy = 0;
    let currentScore = 0;

    let animationId;
    let lastTime = 0;
    const speed = 100; // ms per frame

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          if (dy === 0) { nextDx = 0; nextDy = -1; }
          break;
        case 'ArrowDown':
        case 's':
          if (dy === 0) { nextDx = 0; nextDy = 1; }
          break;
        case 'ArrowLeft':
        case 'a':
          if (dx === 0) { nextDx = -1; nextDy = 0; }
          break;
        case 'ArrowRight':
        case 'd':
          if (dx === 0) { nextDx = 1; nextDy = 0; }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const placeFood = () => {
      food.x = Math.floor(Math.random() * tileCount);
      food.y = Math.floor(Math.random() * tileCount);
      // Ensure food is not on snake
      while (snake.some(s => s.x === food.x && s.y === food.y)) {
        food.x = Math.floor(Math.random() * tileCount);
        food.y = Math.floor(Math.random() * tileCount);
      }
    };

    const gameLoop = (timestamp) => {
      if (timestamp - lastTime >= speed) {
        lastTime = timestamp;

        dx = nextDx;
        dy = nextDy;

        // Move snake
        const head = { x: snake[0].x + dx, y: snake[0].y + dy };

        // Check walls (wrap around or die? Let's die on walls)
        if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
          setIsDead(true);
          return;
        }

        // Check self collision
        // Only check if we are moving
        if (dx !== 0 || dy !== 0) {
            if (snake.some(s => s.x === head.x && s.y === head.y)) {
              setIsDead(true);
              return;
            }
        }

        if (dx !== 0 || dy !== 0) {
            snake.unshift(head);

            // Check food
            if (head.x === food.x && head.y === food.y) {
            currentScore += 10;
            setScore(currentScore);
            placeFood();
            } else {
            snake.pop();
            }
        }

        // Draw background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for(let i=0; i<=canvas.width; i+=gridSize) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }

        // Draw food
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(food.x * gridSize + gridSize/2, food.y * gridSize + gridSize/2, gridSize/2 - 2, 0, Math.PI*2);
        ctx.fill();

        // Draw snake
        snake.forEach((s, i) => {
          ctx.fillStyle = i === 0 ? '#10b981' : '#34d399'; // Head is darker green
          ctx.fillRect(s.x * gridSize + 1, s.y * gridSize + 1, gridSize - 2, gridSize - 2);
        });
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(animationId);
    };
  }, []);

  if (isDead) {
    return (
      <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '20px' }}>Game Over</h1>
        <h2 style={{ color: 'white', marginBottom: '40px' }}>Score: {score}</h2>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button onClick={() => { onGameOver(score, 'snake'); onRestart(); }}>Play Again</button>
          <button className="secondary" onClick={() => { onGameOver(score, 'snake'); onLeave(); }}>Leave Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '400px', marginBottom: '20px' }}>
        <h2 className="text-gradient">Snake</h2>
        <div className="glass-panel" style={{ padding: '8px 16px', borderRadius: '8px' }}>
          Score: {score}
        </div>
      </div>
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={400} 
          style={{ display: 'block' }}
        />
      </div>
      <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Use WASD or Arrow Keys to move.</p>
    </div>
  );
}

export default Snake;
