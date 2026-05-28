// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from 'react';

const SHAPES = [
  { shape: [[1,1,1,1]], color: '#06b6d4' }, // I
  { shape: [[1,1],[1,1]], color: '#eab308' }, // O
  { shape: [[0,1,0],[1,1,1]], color: '#a855f7' }, // T
  { shape: [[0,1,1],[1,1,0]], color: '#10b981' }, // S
  { shape: [[1,1,0],[0,1,1]], color: '#ef4444' }, // Z
  { shape: [[1,0,0],[1,1,1]], color: '#3b82f6' }, // J
  { shape: [[0,0,1],[1,1,1]], color: '#f97316' }  // L
];

const ROWS = 20;
const COLS = 10;

function createEmptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function Tetris({onGameOver, onRestart, onLeave }) {
  const [grid, setGrid] = useState(createEmptyGrid());
  const [activePiece, setActivePiece] = useState(null);
  const [score, setScore] = useState(0);
  const [isDead, setIsDead] = useState(false);
  
  const activePieceRef = useRef(null);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  
  const getNewPiece = () => {
    const r = Math.floor(Math.random() * SHAPES.length);
    const piece = SHAPES[r];
    return {
      shape: piece.shape,
      color: piece.color,
      x: Math.floor((COLS - piece.shape[0].length) / 2),
      y: 0
    };
  };

  const spawnPiece = useCallback(() => {
    const nextPiece = getNewPiece();
    if (hasCollision(nextPiece, gridRef.current)) {
      setIsDead(true);
    } else {
      activePieceRef.current = nextPiece;
      setActivePiece(nextPiece);
    }
  }, []);

  useEffect(() => {
    spawnPiece();
  }, [spawnPiece]);

  function hasCollision(piece, currentGrid) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const newY = piece.y + r;
          const newX = piece.x + c;
          if (newY < 0 || newY >= ROWS || newX < 0 || newX >= COLS || currentGrid[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function mergePiece(piece, currentGrid) {
    const newGrid = currentGrid.map(row => [...row]);
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          newGrid[piece.y + r][piece.x + c] = piece.color;
        }
      }
    }
    return newGrid;
  }

  function clearLines(currentGrid) {
    let linesCleared = 0;
    const newGrid = currentGrid.filter(row => {
      const isFull = row.every(cell => cell !== null);
      if (isFull) linesCleared++;
      return !isFull;
    });
    
    while(newGrid.length < ROWS) {
      newGrid.unshift(Array(COLS).fill(null));
    }
    
    if (linesCleared > 0) {
      setScore(s => s + linesCleared * 100);
    }
    return newGrid;
  }

  const drop = useCallback(() => {
    if (isDead || !activePieceRef.current) return;
    const piece = activePieceRef.current;
    const nextPiece = { ...piece, y: piece.y + 1 };
    
    if (!hasCollision(nextPiece, gridRef.current)) {
      activePieceRef.current = nextPiece;
      setActivePiece(nextPiece);
    } else {
      // Merge and spawn next
      let newGrid = mergePiece(piece, gridRef.current);
      newGrid = clearLines(newGrid);
      setGrid(newGrid);
      spawnPiece();
    }
  }, [isDead, spawnPiece]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isDead || !activePieceRef.current) return;
      const piece = activePieceRef.current;
      
      if (e.key === 'ArrowLeft') {
        const next = { ...piece, x: piece.x - 1 };
        if (!hasCollision(next, gridRef.current)) {
          activePieceRef.current = next;
          setActivePiece(next);
        }
      } else if (e.key === 'ArrowRight') {
        const next = { ...piece, x: piece.x + 1 };
        if (!hasCollision(next, gridRef.current)) {
          activePieceRef.current = next;
          setActivePiece(next);
        }
      } else if (e.key === 'ArrowDown') {
        drop();
      } else if (e.key === 'ArrowUp') {
        // Rotate
        const rotatedShape = piece.shape[0].map((_, i) => piece.shape.map(row => row[i]).reverse());
        const next = { ...piece, shape: rotatedShape };
        if (!hasCollision(next, gridRef.current)) {
          activePieceRef.current = next;
          setActivePiece(next);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDead, drop]);

  useEffect(() => {
    const interval = setInterval(drop, 800);
    return () => clearInterval(interval);
  }, [drop]);

  // Derive rendering grid
  let renderGrid = grid.map(row => [...row]);
  if (activePiece) {
    for (let r = 0; r < activePiece.shape.length; r++) {
      for (let c = 0; c < activePiece.shape[r].length; c++) {
        if (activePiece.shape[r][c]) {
           const y = activePiece.y + r;
           const x = activePiece.x + c;
           if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
              renderGrid[y][x] = activePiece.color;
           }
        }
      }
    }
  }

  if (isDead) {
    return (
      <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '20px' }}>Game Over</h1>
        <h2 style={{ color: 'white', marginBottom: '40px' }}>Score: {score}</h2>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button onClick={() => { onGameOver(score, 'tetris'); onRestart(); }}>Play Again</button>
          <button className="secondary" onClick={() => { onGameOver(score, 'tetris'); onLeave(); }}>Leave Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '300px', marginBottom: '20px' }}>
        <h2 className="text-gradient">Tetris</h2>
        <div className="glass-panel" style={{ padding: '8px 16px', borderRadius: '8px' }}>
          Score: {score}
        </div>
      </div>
      
      <div style={{ 
        width: '300px', height: '600px', 
        background: '#0f172a', 
        border: '2px solid var(--border-color)', 
        borderRadius: '8px',
        display: 'grid', 
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gap: '1px'
      }}>
        {renderGrid.map((row, rIdx) => 
          row.map((cellColor, cIdx) => (
            <div key={`${rIdx}-${cIdx}`} style={{
              background: cellColor || 'rgba(255,255,255,0.05)',
              borderRadius: '2px',
              border: cellColor ? `1px solid rgba(0,0,0,0.2)` : 'none'
            }} />
          ))
        )}
      </div>
      
      <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Use Arrow Keys: Left/Right to move, Up to rotate, Down to drop.</p>
    </div>
  );
}

export default Tetris;
