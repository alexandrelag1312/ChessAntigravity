// Version 2.1 — Trigger Build
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
import PromotionOverlay from './components/PromotionOverlay';
import ChessClock from './components/ChessClock';
import { motion } from 'framer-motion';
import { themes, defaultTheme, type BoardTheme } from './logic/themes';

export default function App() {
  const socket = useSocket();

  // Inject network identity AND the move-emit callback into the game hook.
  // onMoveExecuted fires inside makeMove after every successful move,
  // avoiding the closure trap where onDrop captures a stale makeMove.
  const gameState = useChessGame({
    playerColor: socket.playerColor,
    isOnline: socket.isOnline,
    onMoveExecuted: (from, to, promotion) => {
      if (socket.isOnline && socket.roomId) {
        console.log("📤 TENTATIVE D'ENVOI :", { from, to, promotion }, "dans la salle :", socket.roomId);
        socket.emitMove(from, to, promotion);
      }
    },
  });

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

  // Save theme selection

  // Disable AI when entering multiplayer
  useEffect(() => {
    if (appMode === 'multiplayer') {
      setAiEnabled(false);
    }
  }, [appMode]);

  // Force online mode when color is received (from socket)
  useEffect(() => {
    if (socket.isOnline) {
      setAppMode('multiplayer');
    }
  }, [socket.isOnline]);

  // Sync board orientation with multiplayer role
  useEffect(() => {
    if (appMode === 'multiplayer' && socket.role) {
      if (socket.role === 'white' || socket.role === 'black') {
        setBoardOrientation(socket.role);
      }
    }
  }, [socket.role, appMode]);

  // Sync remote state to local state (full payload from server)
  useEffect(() => {
    if (appMode === 'multiplayer' && socket.remoteState) {
      gameState.loadState(socket.remoteState.fen, socket.remoteState.history);
      // Sync clocks from full state
      if (typeof socket.remoteState.clockWhite === 'number') setClockWhite(socket.remoteState.clockWhite);
      if (typeof socket.remoteState.clockBlack === 'number') setClockBlack(socket.remoteState.clockBlack);
    }
  }, [socket.remoteState, appMode]);

  // ECHO FIX: Apply opponent's move SILENTLY (no re-emit to server)
  // Uses applyRemoteMove which intentionally skips onMoveExecuted callback
  const seenMoveTimestamp = useRef<number>(0);
  useEffect(() => {
    if (appMode === 'multiplayer' && socket.lastReceivedMove) {
      if (socket.lastReceivedMove.timestamp === seenMoveTimestamp.current) return;
      seenMoveTimestamp.current = socket.lastReceivedMove.timestamp;
      console.log('[App] 📥 applying opponent move (silent):', socket.lastReceivedMove);
      gameState.applyRemoteMove(
        socket.lastReceivedMove.from,
        socket.lastReceivedMove.to,
        socket.lastReceivedMove.promotion
      );
      // Sync clocks from move payload
      if (typeof socket.lastReceivedMove.clockWhite === 'number') setClockWhite(socket.lastReceivedMove.clockWhite);
      if (typeof socket.lastReceivedMove.clockBlack === 'number') setClockBlack(socket.lastReceivedMove.clockBlack);
    }
  }, [socket.lastReceivedMove, appMode]);

  // ── Chess Clocks ──────────────────────────────────────────────────
  const DEFAULT_CLOCK = 10 * 60; // 10 minutes
  const [clockWhite, setClockWhite] = useState(DEFAULT_CLOCK);
  const [clockBlack, setClockBlack] = useState(DEFAULT_CLOCK);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start/manage the local countdown interval when online and game has started
  useEffect(() => {
    if (appMode !== 'multiplayer' || !socket.isOnline) return;
    if (gameState.isGameOver || clockWhite <= 0 || clockBlack <= 0) {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      return;
    }
    // Only tick once (at least one move played)
    if (gameState.moveHistory.length === 0) return;

    if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    clockIntervalRef.current = setInterval(() => {
      if (gameState.turn === 'w') {
        setClockWhite(prev => Math.max(0, prev - 1));
      } else {
        setClockBlack(prev => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => { if (clockIntervalRef.current) clearInterval(clockIntervalRef.current); };
  }, [appMode, socket.isOnline, gameState.turn, gameState.moveHistory.length, gameState.isGameOver]);

  // Time pressure bip: play every 5s when your clock < 30s
  const lastBipTime = useRef<number>(0);
  useEffect(() => {
    if (appMode !== 'multiplayer' || !socket.isOnline || !socket.playerColor) return;
    const myTime = socket.playerColor === 'w' ? clockWhite : clockBlack;
    if (myTime <= 0 || myTime > 30) return;
    const now = Date.now();
    if (now - lastBipTime.current < 5000) return;
    lastBipTime.current = now;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 440;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch { }
  }, [clockWhite, clockBlack, socket.playerColor, appMode, socket.isOnline]);

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

  // Stable ref for the AI move callback
  const makeMoveRef = useRef(gameState.makeMove);
  makeMoveRef.current = gameState.makeMove;
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
            {gameState.isOnline ? '🌐 Online Play' : '🏡 Local Play'}
          </button>
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight cursor-pointer" onClick={() => window.location.href = '/'}>
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            Chess
          </span>
          <span className="text-text-secondary font-light">Antigravity v2</span>
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
            {gameState.isOnline ? '🌐 Online Play' : '🏡 Local Play'}
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
          <div className="grid grid-cols-1 lg:grid-cols-[280px_auto_280px] gap-6 lg:gap-8 w-full max-w-[1200px] items-start">

            {/* ── LEFT COLUMN: Actions & Controls ─────────────────── */}
            <div className="flex flex-col gap-4 order-2 lg:order-1">
              <GameControls
                onNewGame={handleNewGame}
                onUndo={handleUndo}
                onFlipBoard={flipBoard}
                canUndo={appMode === 'local' ? gameState.moveHistory.length > 0 : false}
                aiEnabled={appMode === 'local' ? aiEnabled : false}
                onToggleAi={handleToggleAi}
                aiLevel={aiLevel}
                onAiLevelChange={setAiLevel}
                theme={theme}
                onThemeChange={setTheme}
              />
            </div>

            {/* ── CENTER COLUMN: Chess Board ───────────────────────── */}
            <div className="shrink-0 relative flex flex-col items-center order-1 lg:order-2">
              {/* Multiplayer room bar */}
              {appMode === 'multiplayer' && socket.remoteState && (
                <div className="w-full flex justify-between items-center px-1 mb-3">
                  <div className="px-3 py-1 rounded-full bg-accent text-white text-xs font-bold shadow-md">
                    Room: <span className="font-mono tracking-widest">{socket.roomId}</span>
                  </div>
                  <button onClick={handleCopyInvite} className="text-xs text-accent hover:underline font-medium flex items-center gap-1">
                    <span>🔗</span> Copy Invite Link
                  </button>
                </div>
              )}

              {/* Spectator badge */}
              {appMode === 'multiplayer' && socket.role === 'spectator' && (
                <div className="absolute z-10 top-12 right-2 pointer-events-none">
                  <span className="bg-surface/90 text-text-primary px-3 py-1.5 rounded-full text-xs font-bold shadow-lg border border-border backdrop-blur-sm">
                    👀 Spectating
                  </span>
                </div>
              )}

              <ChessBoard
                gameState={gameState}
                boardOrientation={boardOrientation}
                theme={theme}
                playerRole={appMode === 'multiplayer' ? socket.role : null}
              />

              {/* Pawn Promotion Overlay */}
              {gameState.pendingPromotion && (
                <PromotionOverlay
                  pending={gameState.pendingPromotion}
                  onConfirm={gameState.confirmPromotion}
                  onCancel={gameState.cancelPromotion}
                />
              )}
            </div>

            {/* ── RIGHT COLUMN: Game Info ──────────────────────────── */}
            <div className="flex flex-col gap-4 order-3">

              {/* Chess Clocks (multiplayer only) */}
              {appMode === 'multiplayer' && socket.isOnline && (
                <div className="flex flex-col gap-2">
                  <ChessClock
                    timeSeconds={boardOrientation === 'white' ? clockBlack : clockWhite}
                    isActive={boardOrientation === 'white' ? gameState.turn === 'b' : gameState.turn === 'w'}
                    label={boardOrientation === 'white' ? 'Opponent' : 'You'}
                    color={boardOrientation === 'white' ? 'b' : 'w'}
                    playerName={boardOrientation === 'white'
                      ? socket.remoteState?.playerBlack?.name
                      : socket.remoteState?.playerWhite?.name}
                  />
                  <ChessClock
                    timeSeconds={boardOrientation === 'white' ? clockWhite : clockBlack}
                    isActive={boardOrientation === 'white' ? gameState.turn === 'w' : gameState.turn === 'b'}
                    label={boardOrientation === 'white' ? 'You' : 'Opponent'}
                    color={boardOrientation === 'white' ? 'w' : 'b'}
                    playerName={boardOrientation === 'white'
                      ? socket.remoteState?.playerWhite?.name
                      : socket.remoteState?.playerBlack?.name}
                  />
                </div>
              )}

              <GameInfo
                gameState={gameState}
                aiEnabled={appMode === 'local' ? aiEnabled : false}
                isAiThinking={engine.isThinking}
              />

              {/* Multiplayer Player Status */}
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
            </div>

          </div>

        )}
      </main>

      {/* Multiplayer Chat Engine */}
      {appMode === 'multiplayer' && socket.roomId && (
        <Chat messages={socket.chatMessages} onSendMessage={socket.sendChat} />
      )}
    </div>
  );
}
