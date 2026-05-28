// @ts-nocheck
import { useEffect, useRef, useState } from 'react';

function FlappyBird({onGameOver, onRestart, onLeave }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [isDead, setIsDead] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    let bird = { x: 50, y: 200, velocity: 0, radius: 12 };
    let gravity = 0.6;
    let jump = -8;
    let pipes = [];
    let pipeWidth = 50;
    let pipeGap = 130;
    let frameCount = 0;
    let currentScore = 0;
    
    let animationId;

    const handleInput = (e) => {
      if (e.type === 'mousedown' || e.code === 'Space') {
        bird.velocity = jump;
      }
    };
    window.addEventListener('keydown', handleInput);
    canvas.addEventListener('mousedown', handleInput);

    const gameLoop = () => {
      // Update bird
      bird.velocity += gravity;
      bird.y += bird.velocity;

      // Check boundaries
      if (bird.y + bird.radius >= canvas.height || bird.y - bird.radius <= 0) {
        setIsDead(true);
        return;
      }

      // Generate pipes
      if (frameCount % 90 === 0) {
        const minHeight = 50;
        const maxHeight = canvas.height - pipeGap - minHeight;
        const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
        pipes.push({
          x: canvas.width,
          topHeight: topHeight,
          passed: false
        });
      }

      // Update pipes and check collisions
      for (let i = 0; i < pipes.length; i++) {
        let p = pipes[i];
        p.x -= 3;

        // Collision
        if (
          bird.x + bird.radius > p.x && 
          bird.x - bird.radius < p.x + pipeWidth
        ) {
          if (
            bird.y - bird.radius < p.topHeight || 
            bird.y + bird.radius > p.topHeight + pipeGap
          ) {
            setIsDead(true);
            return;
          }
        }

        // Scoring
        if (p.x + pipeWidth < bird.x && !p.passed) {
          p.passed = true;
          currentScore += 1;
          setScore(currentScore);
        }
      }

      pipes = pipes.filter(p => p.x + pipeWidth > 0);

      // Draw
      ctx.fillStyle = '#38bdf8'; // Sky blue
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw pipes
      ctx.fillStyle = '#22c55e'; // Green
      pipes.forEach(p => {
        ctx.fillRect(p.x, 0, pipeWidth, p.topHeight);
        ctx.fillRect(p.x, p.topHeight + pipeGap, pipeWidth, canvas.height - p.topHeight - pipeGap);
        // Pipe borders
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x, 0, pipeWidth, p.topHeight);
        ctx.strokeRect(p.x, p.topHeight + pipeGap, pipeWidth, canvas.height - p.topHeight - pipeGap);
      });

      // Draw bird
      ctx.fillStyle = '#fbbf24'; // Yellow
      ctx.beginPath();
      ctx.arc(bird.x, bird.y, bird.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();

      frameCount++;
      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleInput);
      canvas.removeEventListener('mousedown', handleInput);
      cancelAnimationFrame(animationId);
    };
  }, []);

  if (isDead) {
    return (
      <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '20px' }}>Game Over</h1>
        <h2 style={{ color: 'white', marginBottom: '40px' }}>Score: {score}</h2>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button onClick={() => { onGameOver(score, 'flappybird'); onRestart(); }}>Play Again</button>
          <button className="secondary" onClick={() => { onGameOver(score, 'flappybird'); onLeave(); }}>Leave Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '400px', marginBottom: '20px' }}>
        <h2 className="text-gradient">Flappy Bird</h2>
        <div className="glass-panel" style={{ padding: '8px 16px', borderRadius: '8px' }}>
          Score: {score}
        </div>
      </div>
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: '4px solid var(--border-color)' }}>
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={500} 
          style={{ display: 'block', cursor: 'pointer' }}
        />
      </div>
      <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Click or press Spacebar to jump.</p>
    </div>
  );
}

export default FlappyBird;
