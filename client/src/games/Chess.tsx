import { useState, useEffect, useRef } from 'react';
import { Chess as ChessLogic } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { GameProps } from './types';

function Chess({socket, nickname, onGameOver, onRestart, onLeave }: GameProps) {
  const [gameState, setGameState] = useState<any>(null);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<any>({});
  
  const gameStateRef = useRef(gameState);
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const handleAction = (data: any) => {
      if (data.type === 'STATE_UPDATE') {
        setGameState(data.state);
      }
    };

    socket.on('gameAction', handleAction);
    return () => { socket.off('gameAction', handleAction); };
  }, [socket]);

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    const currentGameState = gameStateRef.current;
    if (!currentGameState || currentGameState.status !== 'playing') return false;

    const game = new ChessLogic(currentGameState.fen);
    const currentPlayer = currentGameState.players.find((p: any) => p.socketId === socket.id);
    
    if (!currentPlayer || currentPlayer.color !== game.turn()) return false;

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (move) {
        socket.emit('gameAction', {
          type: 'MOVE',
          sourceSquare,
          targetSquare
        });
        setMoveFrom(null);
        setOptionSquares({});
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  };

  function getMoveOptions(square: string) {
    const currentGameState = gameStateRef.current;
    if (!currentGameState || currentGameState.status !== 'playing') return false;
    const game = new ChessLogic(currentGameState.fen);
    const currentPlayer = currentGameState.players.find((p: any) => p.socketId === socket.id);
    if (!currentPlayer || currentPlayer.color !== game.turn()) return false;
    
    const moves = game.moves({
      square: square as any,
      verbose: true
    }) as any[];
    if (moves.length === 0) {
      return false;
    }

    const newSquares: any = {};
    moves.map((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to as any)?.color && game.get(move.to as any)?.color !== game.get(square as any)?.color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%'
      };
      return move;
    });
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)'
    };
    setOptionSquares(newSquares);
    return true;
  }

  function onSquareClick(square: string) {
    const currentGameState = gameStateRef.current;
    if (!currentGameState || currentGameState.status !== 'playing') return;
    const game = new ChessLogic(currentGameState.fen);
    const currentPlayer = currentGameState.players.find((p: any) => p.socketId === socket.id);
    if (!currentPlayer || currentPlayer.color !== game.turn()) return;

    if (moveFrom === square) {
      setMoveFrom(null);
      setOptionSquares({});
      return;
    }

    if (!moveFrom) {
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
      return;
    }

    try {
      const move = game.move({
        from: moveFrom,
        to: square,
        promotion: 'q'
      });

      if (move) {
        socket.emit('gameAction', {
          type: 'MOVE',
          sourceSquare: moveFrom,
          targetSquare: square
        });
        setMoveFrom(null);
        setOptionSquares({});
      } else {
        const hasMoveOptions = getMoveOptions(square);
        if (hasMoveOptions) setMoveFrom(square);
      }
    } catch (e) {
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
    }
  }

  if (!gameState) return <div style={{ color: 'white' }}>Loading Game...</div>;

  const myPlayer = gameState.players.find((p: any) => p.socketId === socket.id);
  const boardOrientation = myPlayer?.color === 'b' ? 'black' : 'white';

  if (gameState.status === 'finished') {
    return (
      <div className="flex-center flex-col animate-fade-in" style={{ height: '100%' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '20px' }}>Game Over!</h1>
        <h2 style={{ color: 'white', marginBottom: '40px' }}>
          {gameState.winner === 'Draw' ? 'Game Drawn!' : `Checkmate! ${gameState.winner} wins!`}
        </h2>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button onClick={() => { onGameOver(gameState.winner === nickname ? 150 : 25, 'chess'); onRestart?.(); }}>Play Again</button>
          <button className="secondary" onClick={() => { onGameOver(gameState.winner === nickname ? 150 : 25, 'chess'); onLeave?.(); }}>Leave Room</button>
        </div>
      </div>
    );
  }

  const turnPlayer = gameState.players.find((p: any) => p.color === new ChessLogic(gameState.fen).turn());

  return (
    <div className="flex-col animate-fade-in" style={{ height: '100%', alignItems: 'center', display: 'flex', gap: '20px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 className="text-gradient">Chess</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          {turnPlayer?.nickname}'s Turn ({turnPlayer?.color === 'w' ? 'White' : 'Black'})
        </p>
      </div>

      <div style={{ width: '500px', maxWidth: '90vw', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        {/* @ts-ignore */}
        <Chessboard 
          {...({ position: gameState.fen } as any)} 
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          boardOrientation={boardOrientation}
          customDarkSquareStyle={{ backgroundColor: '#475569' }}
          customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
          customSquareStyles={optionSquares}
          arePiecesDraggable={true}
        />
      </div>
      
      <div style={{ display: 'flex', gap: '20px', width: '500px', justifyContent: 'space-between' }}>
        {gameState.players.map((p: any) => (
          <div key={p.socketId} className="glass-panel" style={{ flex: 1, textAlign: 'center', padding: '10px' }}>
            <div style={{ fontWeight: 'bold' }}>{p.nickname}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {p.color === 'w' ? 'White' : 'Black'}
              {p.isBot && ` (Bot)`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Chess;
