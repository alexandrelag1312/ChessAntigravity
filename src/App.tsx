import { useState, useEffect, useCallback, useRef } from 'react';
import { useChessGame } from './hooks/useChessGame';
import { useStockfish } from './hooks/useStockfish';
import { useSocket } from './hooks/useSocket';
import ChessBoard from './components/ChessBoard';
import GameInfo from './components/GameInfo';
import MoveHistory from './components/MoveHistory';
import GameControls from './components/GameControls';
import CapturedPieces from './components/CapturedPieces';
import Lobby from './components/Lobby';
import Chat from './components/Chat';
import { motion } from 'framer-motion';
import { themes, defaultTheme, type BoardTheme } from './logic/themes';

export default function App() {
  const gameState = useChessGame();

  // URL processing for auto-join
  const initialRoomParam = new URLSearchParams(window.location.search).get('room') || '';

  const [appMode, setAppMode] = useState<'local' | 'multiplayer'>(initialRoomParam ? 'multiplayer' : 'local');
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLevel, setAiLevel] = useState(5);
  const [theme, setTheme] = useState<BoardTheme>(() => {
    try {
      const savedThemeId = localStorage.getItem('chess_theme');
      if (savedThemeId) {
        return themes.find(t => t.id === savedThemeId) || defaultTheme;
      }
    } catch { }
    return defaultTheme;
  });

  // Save theme selection
  useEffect(() => {
    try {
      localStorage.setItem('chess_theme', theme.id);
    } catch { }
  }, [theme]);

  const socket = useSocket();

  // Disable AI when entering multiplayer
  useEffect(() => {
    if (appMode === 'multiplayer') {
      setAiEnabled(false);
    }
  }, [appMode]);

  // Sync board orientation with multiplayer role
  useEffect(() => {
    if (appMode === 'multiplayer' && socket.role) {
      if (socket.role === 'white' || socket.role === 'black') {
        setBoardOrientation(socket.role);
      }
    }
  }, [socket.role, appMode]);

  // Sync remote state to local state
  useEffect(() => {
    if (appMode === 'multiplayer' && socket.remoteState) {
      gameState.loadState(socket.remoteState.fen, socket.remoteState.history);
    }
  }, [socket.remoteState, appMode]);

  // Copy Invite Link Helper
  const handleCopyInvite = () => {
    if (!socket.roomId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${socket.roomId}`;
    if (navigator.share) {
      navigator.share({ title: 'ChessAntigravity Match', url }).catch(() => { });
    } else {
      navigator.clipboard.writeText(url);
      alert('Invite link copied to clipboard!');
    }
  };

  // Safe wrapper around makeMove that also emits to server if multiplayer
  const handleMakeMove = useCallback((from: string, to: string, promotion?: string) => {
    // 1. Optimistic Local Update
    const success = gameState.makeMove(from, to, promotion);
    // 2. Network emit
    if (success && appMode === 'multiplayer' && socket.roomId) {
      socket.emitMove(from, to, promotion);
    }
    return success;
  }, [gameState, appMode, socket]);

  // Stable ref for the AI move callback
  const makeMoveRef = useRef(handleMakeMove);
  makeMoveRef.current = handleMakeMove;
  const onBestMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      makeMoveRef.current(from, to, promotion);
    },
    []
  );

  const engine = useStockfish(onBestMove);

  // ── AI auto-trigger ─────
  const { turn, isGameOver, position } = gameState;
  useEffect(() => {
    if (
      aiEnabled &&
      appMode === 'local' &&
      engine.isReady &&
      turn === 'b' &&
      !isGameOver &&
      !engine.isThinking
    ) {
      const timer = setTimeout(() => {
        engine.getBestMove(position, aiLevel);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [aiEnabled, appMode, engine.isReady, turn, isGameOver, position, aiLevel, engine]);

  // ── Controls ─────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (appMode === 'multiplayer') {
      // TODO: Request undo from socket if casual
    } else {
      if (engine.isThinking) engine.stop();
      if (aiEnabled && !isGameOver) {
        gameState.undoMove();
        gameState.undoMove();
      } else {
        gameState.undoMove();
      }
    }
  }, [appMode, engine, aiEnabled, isGameOver, gameState]);

  const handleNewGame = useCallback(() => {
    if (appMode === 'multiplayer') {
      // Only if not spectator
    } else {
      engine.stop();
      engine.reset();
      gameState.resetGame();
    }
  }, [appMode, engine, gameState]);

  const handleToggleAi = useCallback(() => {
    if (appMode === 'multiplayer') return; // disabled
    setAiEnabled((prev) => {
      if (prev) engine.stop();
      return !prev;
    });
  }, [appMode, engine]);

  const flipBoard = () => setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'));

  // ── Wrapped Game State ──
  // We pass a modified gameState to ChessBoard to use our custom makeMove
  const activeGameState = {
    ...gameState,
    makeMove: handleMakeMove,
  };

  return (
    <div className="min-h-screen flex flex-col items-center">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center py-6 lg:py-8 w-full relative max-w-5xl px-4"
      >
        <div className="absolute top-6 right-4 hidden lg:flex gap-2">
          <button
            onClick={() => setAppMode(prev => prev === 'local' ? 'multiplayer' : 'local')}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-surface-raised border border-border text-accent shadow-sm hover:scale-105 transition-transform"
          >
            {appMode === 'local' ? '🌐 Switch to Party Mode' : '🏡 Local Play'}
          </button>
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight cursor-pointer" onClick={() => window.location.href = '/'}>
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            Chess
          </span>
          <span className="text-text-secondary font-light">Antigravity</span>
        </h1>
        <p className="text-text-muted text-sm mt-1">
          {appMode === 'local' ? 'A premium browser chess experience' : 'Party Mode — Live Multiplayer'}
        </p>

        {/* Mobile toggle */}
        <div className="mt-4 flex lg:hidden justify-center">
          <button
            onClick={() => setAppMode(prev => prev === 'local' ? 'multiplayer' : 'local')}
            className="px-4 py-1.5 rounded-full text-xs font-bold bg-surface-raised border border-border text-accent shadow-sm"
          >
            {appMode === 'local' ? '🌐 Switch to Party Mode' : '🏡 Local Play'}
          </button>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 flex items-start justify-center px-4 pb-8 lg:px-8 w-full">
        {appMode === 'multiplayer' && !socket.roomId ? (
          // Lobby View
          <div className="w-full h-full flex items-center justify-center mt-12">
            <Lobby
              onCreateRoom={socket.createRoom}
              onJoinRoom={socket.joinRoom}
              initialRoomId={initialRoomParam}
            />
          </div>
        ) : (
          // Game View (Local or Connected Multiplayer)
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full max-w-5xl items-center lg:items-start relative">

            {/* Board */}
            <div className="shrink-0 relative">
              {appMode === 'multiplayer' && socket.remoteState && (
                <div className="absolute -top-10 left-0 right-0 flex justify-between items-center px-1">
                  <div className="px-3 py-1 rounded-full bg-accent text-white text-xs font-bold shadow-md">
                    Room: <span className="font-mono tracking-widest">{socket.roomId}</span>
                  </div>
                  <button onClick={handleCopyInvite} className="text-xs text-accent hover:underline font-medium flex items-center gap-1">
                    <span>🔗</span> Copy Invite Link
                  </button>
                </div>
              )}

              {appMode === 'multiplayer' && socket.role === 'spectator' && (
                <div className="absolute z-10 top-2 mt-4 right-2 pointer-events-none">
                  <span className="bg-surface/90 text-text-primary px-3 py-1.5 rounded-full text-xs font-bold shadow-lg border border-border backdrop-blur-sm shadow-emerald-500/10">
                    👀 Spectating
                  </span>
                </div>
              )}

              <ChessBoard
                gameState={activeGameState}
                boardOrientation={boardOrientation}
                theme={theme}
              />
            </div>

            {/* Side Panel */}
            <div className="w-full lg:w-72 xl:w-80 flex flex-col gap-4">
              <GameInfo
                gameState={activeGameState}
                aiEnabled={appMode === 'local' ? aiEnabled : false}
                isAiThinking={engine.isThinking}
              />

              {/* Multiplayer Status (if active) */}
              {appMode === 'multiplayer' && socket.remoteState && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-4 backdrop-blur-md border border-border text-sm flex flex-col gap-2"
                  style={{ background: 'var(--color-surface-overlay)' }}
                >
                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <span className="font-semibold text-text-secondary">White</span>
                    <span className={`font-bold ${socket.remoteState.playerWhite?.connected ? 'text-text-primary' : 'text-text-muted italic'}`}>
                      {socket.remoteState.playerWhite?.name || 'Waiting...'}
                      {!socket.remoteState.playerWhite?.connected && socket.remoteState.playerWhite?.name && ' (Offline)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <span className="font-semibold text-text-secondary">Black</span>
                    <span className={`font-bold ${socket.remoteState.playerBlack?.connected ? 'text-text-primary' : 'text-text-muted italic'}`}>
                      {socket.remoteState.playerBlack?.name || 'Waiting...'}
                      {!socket.remoteState.playerBlack?.connected && socket.remoteState.playerBlack?.name && ' (Offline)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 text-xs text-text-muted">
                    <span>Spectators: {socket.remoteState.spectatorCount}</span>
                    <button onClick={socket.leaveRoom} className="text-red-400 hover:text-red-300 transition-colors">Leave Room</button>
                  </div>
                </motion.div>
              )}

              {/* Captured Pieces */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="rounded-xl p-4 backdrop-blur-md border border-border"
                style={{ background: 'var(--color-surface-overlay)' }}
              >
                <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                  Captured Pieces
                </h3>
                <div className="space-y-1">
                  <CapturedPieces moveHistory={gameState.moveHistory} color="w" />
                  <CapturedPieces moveHistory={gameState.moveHistory} color="b" />
                </div>
              </motion.div>

              <MoveHistory moves={gameState.moveHistory} />
              <GameControls
                onNewGame={handleNewGame}
                onUndo={handleUndo}
                onFlipBoard={flipBoard}
                canUndo={appMode === 'local' ? gameState.moveHistory.length > 0 : false} // Undo currently local only
                aiEnabled={appMode === 'local' ? aiEnabled : false}
                onToggleAi={handleToggleAi}
                aiLevel={aiLevel}
                onAiLevelChange={setAiLevel}
                theme={theme}
                onThemeChange={setTheme}
              />
            </div>
          </div>
        )}
      </main>

      {/* Multiplayer Chat Engine */}
      {appMode === 'multiplayer' && socket.roomId && (
        <Chat messages={socket.remoteState?.chatHistory || []} onSendMessage={socket.sendChat} />
      )}
    </div>
  );
}
