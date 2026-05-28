// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';

// Basic 2048 logic
const SIZE = 4;

function Solo2048({onGameOver, onRestart, onLeave }) {
  const [board, setBoard] = useState(getEmptyBoard());
  const [score, setScore] = useState(0);

  function getEmptyBoard() {
    return Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
  }

  const addRandomTile = useCallback((currentBoard) => {
    let emptyCells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (currentBoard[r][c] === 0) {
          emptyCells.push({ r, c });
        }
      }
    }
    if (emptyCells.length === 0) return currentBoard;

    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const newBoard = currentBoard.map(row => [...row]);
    newBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
    return newBoard;
  }, []);

  useEffect(() => {
    setBoard(addRandomTile(addRandomTile(getEmptyBoard())));
  }, [addRandomTile]);

  // Simplified slide left for 2048
  const slideLeft = (row) => {
    let arr = row.filter(val => val);
    let newScore = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        newScore += arr[i];
        arr[i + 1] = 0;
      }
    }
    arr = arr.filter(val => val);
    while (arr.length < SIZE) arr.push(0);
    return { newRow: arr, scoreAdded: newScore };
  };

  const handleKeyDown = useCallback((e) => {
    let newBoard = [...board.map(row => [...row])];
    let scoreAdded = 0;
    let changed = false;

    if (e.key === 'ArrowLeft') {
      for (let r = 0; r < SIZE; r++) {
        const { newRow, scoreAdded: s } = slideLeft(newBoard[r]);
        if (newBoard[r].join(',') !== newRow.join(',')) changed = true;
        newBoard[r] = newRow;
        scoreAdded += s;
      }
    } else if (e.key === 'ArrowRight') {
      for (let r = 0; r < SIZE; r++) {
        const reversed = [...newBoard[r]].reverse();
        const { newRow, scoreAdded: s } = slideLeft(reversed);
        const finalRow = newRow.reverse();
        if (newBoard[r].join(',') !== finalRow.join(',')) changed = true;
        newBoard[r] = finalRow;
        scoreAdded += s;
      }
    } else if (e.key === 'ArrowUp') {
      for (let c = 0; c < SIZE; c++) {
        const col = [newBoard[0][c], newBoard[1][c], newBoard[2][c], newBoard[3][c]];
        const { newRow, scoreAdded: s } = slideLeft(col);
        for (let r = 0; r < SIZE; r++) {
          if (newBoard[r][c] !== newRow[r]) changed = true;
          newBoard[r][c] = newRow[r];
        }
        scoreAdded += s;
      }
    } else if (e.key === 'ArrowDown') {
      for (let c = 0; c < SIZE; c++) {
        const col = [newBoard[3][c], newBoard[2][c], newBoard[1][c], newBoard[0][c]];
        const { newRow, scoreAdded: s } = slideLeft(col);
        const finalCol = newRow.reverse();
        for (let r = 0; r < SIZE; r++) {
          if (newBoard[r][c] !== finalCol[r]) changed = true;
          newBoard[r][c] = finalCol[r];
        }
        scoreAdded += s;
      }
    }

    if (changed) {
      setBoard(addRandomTile(newBoard));
      setScore(s => s + scoreAdded);
    }
  }, [board, addRandomTile]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getTileColor = (val) => {
    if (val === 0) return 'rgba(255,255,255,0.05)';
    const colors = {
      2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563',
      32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61',
      512: '#edc850', 1024: '#edc53f', 2048: '#edc22e'
    };
    return colors[val] || '#3c3a32';
  };

  return (
    <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', marginBottom: '20px' }}>
        <h2 className="text-gradient">2048</h2>
        <div className="glass-panel" style={{ padding: '8px 16px', borderRadius: '8px' }}>
          Score: {score}
        </div>
      </div>
      <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', width: '300px', height: '300px' }}>
          {board.map((row, rIdx) => 
            row.map((cell, cIdx) => (
              <div key={`${rIdx}-${cIdx}`} style={{
                background: getTileColor(cell),
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: cell <= 4 ? '#776e65' : '#f9f6f2'
              }}>
                {cell > 0 ? cell : ''}
              </div>
            ))
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button onClick={() => { onGameOver(score, 'solo2048'); onRestart(); }}>Play Again</button>
          <button className="secondary" onClick={() => { onGameOver(score, 'solo2048'); onLeave(); }}>Leave Room</button>
        </div>
    </div>
  );
}

export default Solo2048;
