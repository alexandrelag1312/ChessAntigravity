import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess, type Move, type Square } from 'chess.js';

// ─── Audio URLs ─────────────────────────────────────────────────────
const SOUNDS = {
    move: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3',
    capture: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3',
    check: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3',
    gameStart: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-start.mp3',
    gameEnd: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3',
} as const;

const audioCache: Record<string, HTMLAudioElement> = {};

function playSound(key: keyof typeof SOUNDS) {
    try {
        if (!audioCache[key]) {
            audioCache[key] = new Audio(SOUNDS[key]);
        }
        const audio = audioCache[key];
        audio.currentTime = 0;
        audio.play().catch(() => { });
    } catch {
        // Ignore audio errors silently
    }
}

// ─── LocalStorage ───────────────────────────────────────────────────
const STORAGE_KEY = 'chess-antigravity-save';

interface SavedState {
    fen: string;
    pgn: string;
}

function loadSavedGame(): SavedState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as SavedState;
    } catch {
        return null;
    }
}

function saveGame(game: Chess) {
    try {
        const data: SavedState = { fen: game.fen(), pgn: game.pgn() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
        // quota exceeded etc.
    }
}

function clearSavedGame() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { }
}

// ─── Helper ─────────────────────────────────────────────────────────
function findKingSquare(game: Chess, color: 'w' | 'b'): Square | null {
    const board = game.board();
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.type === 'k' && piece.color === color) {
                const file = String.fromCharCode(97 + col);
                const rank = String(8 - row);
                return `${file}${rank}` as Square;
            }
        }
    }
    return null;
}

function initGame(): Chess {
    const saved = loadSavedGame();
    if (saved) {
        try {
            const g = new Chess();
            g.loadPgn(saved.pgn);
            return g;
        } catch {
            try {
                return new Chess(saved.fen);
            } catch {
                return new Chess();
            }
        }
    }
    return new Chess();
}

// ─── Props: Network Identity injected from App ───────────────────────
export interface ChessGameOptions {
    playerColor?: 'w' | 'b' | null;
    isOnline?: boolean;
    /** Called after every successful local move — use to emit to socket */
    onMoveExecuted?: (from: string, to: string, promotion?: string) => void;
}

// ─── Exported Interface ─────────────────────────────────────────────
export interface PendingPromotion {
    from: string;
    to: string;
    color: 'w' | 'b';
}

export interface ChessGameState {
    position: string;
    turn: 'w' | 'b';
    isCheck: boolean;
    isCheckmate: boolean;
    isDraw: boolean;
    isStalemate: boolean;
    isGameOver: boolean;
    moveHistory: Move[];
    lastMove: { from: Square; to: Square } | null;
    kingSquare: Square | null;
    selectedSquare: Square | null;
    legalMoveSquares: Square[];
    makeMove: (from: string, to: string, promotion?: string) => boolean;
    applyRemoteMove: (from: string, to: string, promotion?: string) => void;
    handleSquareClick: (square: string, piece: string | null) => void;
    undoMove: () => void;
    resetGame: () => void;
    clearSelection: () => void;
    loadState: (fen: string, history: any[]) => void;
    onDrop: (sourceSquare: string, targetSquare: string, piece: string) => boolean;
    pendingPromotion: PendingPromotion | null;
    confirmPromotion: (piece: 'q' | 'r' | 'b' | 'n') => void;
    cancelPromotion: () => void;
    playerColor: 'w' | 'b' | null;
    isOnline: boolean;
}

// ─── Hook — Pure Game Logic (no socket knowledge) ───────────────────
export function useChessGame(options: ChessGameOptions = {}): ChessGameState {
    const { playerColor = null, isOnline = false, onMoveExecuted } = options;

    // Keep a stable ref to onMoveExecuted so makeMove's useCallback
    // never needs to re-run when the callback identity changes
    const onMoveExecutedRef = useRef(onMoveExecuted);
    useEffect(() => { onMoveExecutedRef.current = onMoveExecuted; }, [onMoveExecuted]);

    const gameRef = useRef<Chess>(initGame());
    const [position, setPosition] = useState<string>(gameRef.current.fen());
    const [moveHistory, setMoveHistory] = useState<Move[]>(
        () => [...gameRef.current.history({ verbose: true })]
    );
    const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(() => {
        const hist = gameRef.current.history({ verbose: true });
        if (hist.length > 0) {
            const last = hist[hist.length - 1];
            return { from: last.from, to: last.to };
        }
        return null;
    });
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [legalMoveSquares, setLegalMoveSquares] = useState<Square[]>([]);
    const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
    const hasPlayedStartSound = useRef(false);

    const syncState = useCallback(() => {
        const game = gameRef.current;
        setPosition(game.fen());
        setMoveHistory([...game.history({ verbose: true })]);
        saveGame(game);
    }, []);

    // Play game-start sound on mount
    useEffect(() => {
        if (!hasPlayedStartSound.current) {
            hasPlayedStartSound.current = true;
            setTimeout(() => playSound('gameStart'), 300);
        }
    }, []);

    const turn = gameRef.current.turn();
    const isCheck = gameRef.current.isCheck();
    const isCheckmate = gameRef.current.isCheckmate();
    const isDraw = gameRef.current.isDraw();
    const isStalemate = gameRef.current.isStalemate();
    const isGameOver = gameRef.current.isGameOver();
    const kingSquare = isCheck ? findKingSquare(gameRef.current, turn) : null;

    // ── Core move executor ────────────────────────────────────────────
    // NOTE: Does NOT emit to socket. App.tsx is responsible for calling
    // socket.emitMove() *after* calling this, to avoid double-emit.
    const makeMove = useCallback(
        (from: string, to: string, promotion?: string): boolean => {
            const game = gameRef.current;
            try {
                const move = game.move({
                    from: from as Square,
                    to: to as Square,
                    promotion: promotion || 'q',
                });
                if (move) {
                    setLastMove({ from: move.from, to: move.to });
                    setSelectedSquare(null);
                    setLegalMoveSquares([]);
                    syncState();

                    // Notify App.tsx via callback so it can emit to socket
                    // (avoids the closure trap — onDrop calls makeMove which calls this)
                    if (onMoveExecutedRef.current) {
                        onMoveExecutedRef.current(move.from, move.to, move.promotion);
                    }
                    // Audio
                    if (game.isCheckmate() || game.isDraw() || game.isStalemate()) {
                        playSound('gameEnd');
                    } else if (game.isCheck()) {
                        playSound('check');
                    } else if (move.captured) {
                        playSound('capture');
                    } else {
                        playSound('move');
                    }
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        },
        [syncState]
    );

    // ── SILENT move applier for opponent moves from server ────────────
    // CRITICAL: Does NOT call onMoveExecuted, so it will NOT emit back
    // to the server, breaking the echo loop.
    const applyRemoteMove = useCallback((from: string, to: string, promotion?: string) => {
        const game = gameRef.current;
        try {
            const move = game.move({
                from: from as Square,
                to: to as Square,
                promotion: promotion || 'q',
            });
            if (move) {
                setLastMove({ from: move.from, to: move.to });
                setSelectedSquare(null);
                setLegalMoveSquares([]);
                syncState();
                // Audio for opponent move
                if (game.isCheckmate() || game.isDraw() || game.isStalemate()) {
                    playSound('gameEnd');
                } else if (game.isCheck()) {
                    playSound('check');
                } else if (move.captured) {
                    playSound('capture');
                } else {
                    playSound('move');
                }
            }
        } catch { }
    }, [syncState]);

    // ── Promotion handlers ────────────────────────────────────────────
    const confirmPromotion = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
        if (!pendingPromotion) return;
        makeMove(pendingPromotion.from, pendingPromotion.to, piece);
        setPendingPromotion(null);
    }, [pendingPromotion, makeMove]);

    const cancelPromotion = useCallback(() => {
        setPendingPromotion(null);
        setSelectedSquare(null);
        setLegalMoveSquares([]);
    }, []);

    // Handle click-to-move promotion detection
    const handlePromoClick = (from: Square, to: Square, color: 'w' | 'b') => {
        setPendingPromotion({ from, to, color });
        setSelectedSquare(null);
        setLegalMoveSquares([]);
    };

    // ── Click-to-move with promotion detection ────────────────────────
    const handleSquareClick = useCallback(
        (square: string, piece: string | null) => {
            if (isGameOver) return;

            const sq = square as Square;
            const game = gameRef.current;
            const currentTurn = game.turn();

            // ── ROLE LOCK: Block clicks for wrong color in online mode ──
            if (isOnline && playerColor) {
                // If clicking on a piece, must be our own
                if (piece && piece[0] !== playerColor) {
                    // Only block if no square is selected (selecting opponent piece from scratch)
                    if (!selectedSquare) return;
                }
                // Block if it's not our turn
                if (currentTurn !== playerColor) {
                    // Allow deselecting, but not moving
                    if (!selectedSquare || !legalMoveSquares.includes(sq)) {
                        setSelectedSquare(null);
                        setLegalMoveSquares([]);
                        return;
                    }
                }
            }

            const isOwnPiece =
                piece != null &&
                piece.length >= 1 &&
                piece[0] === currentTurn;

            // Case 1: A square is already selected
            if (selectedSquare) {
                // Sub-case 1a: Clicked on another own piece → switch selection
                if (isOwnPiece && sq !== selectedSquare) {
                    const moves = game.moves({ square: sq, verbose: true });
                    setSelectedSquare(sq);
                    setLegalMoveSquares(moves.map((m) => m.to));
                    return;
                }

                // Sub-case 1b: Clicked on a legal destination → check for promotion
                if (legalMoveSquares.includes(sq)) {
                    const game = gameRef.current;
                    const movingPiece = game.get(selectedSquare as Square);
                    const isPromo =
                        movingPiece?.type === 'p' &&
                        ((movingPiece.color === 'w' && sq[1] === '8') ||
                            (movingPiece.color === 'b' && sq[1] === '1'));
                    if (isPromo) {
                        handlePromoClick(selectedSquare, sq, movingPiece.color);
                    } else {
                        makeMove(selectedSquare, sq);
                    }
                    return;
                }

                // Sub-case 1c: Clicked on something else → deselect
                setSelectedSquare(null);
                setLegalMoveSquares([]);
                return;
            }

            // Case 2: No square selected — select this piece if it's our own
            if (isOwnPiece) {
                const moves = game.moves({ square: sq, verbose: true });
                if (moves.length > 0) {
                    setSelectedSquare(sq);
                    setLegalMoveSquares(moves.map((m) => m.to));
                }
            }
        },
        [selectedSquare, legalMoveSquares, isGameOver, makeMove, playerColor, isOnline]
    );

    // ── Drop handler with strict role lock ────────────────────────────
    const onDrop = useCallback((sourceSquare: string, targetSquare: string, piece: string) => {
        const game = gameRef.current;

        if (isOnline && playerColor) {
            if (game.turn() !== playerColor) return false;
            if (piece.charAt(0) !== playerColor) return false;
        }

        // Detect promotion before executing
        const pieceType = piece.charAt(1)?.toLowerCase();
        const isWhitePromo = pieceType === 'p' && targetSquare[1] === '8' && piece[0] === 'w';
        const isBlackPromo = pieceType === 'p' && targetSquare[1] === '1' && piece[0] === 'b';
        if (isWhitePromo || isBlackPromo) {
            setPendingPromotion({ from: sourceSquare, to: targetSquare, color: piece[0] as 'w' | 'b' });
            setSelectedSquare(null);
            setLegalMoveSquares([]);
            return true; // Return true so the board doesn't snap back
        }

        return makeMove(sourceSquare, targetSquare);
    }, [makeMove, playerColor, isOnline]);

    // ── Clear selection ───────────────────────────────────────────────
    const clearSelection = useCallback(() => {
        setSelectedSquare(null);
        setLegalMoveSquares([]);
    }, []);

    const undoMove = useCallback(() => {
        const game = gameRef.current;
        const move = game.undo();
        if (move) {
            const history = game.history({ verbose: true });
            const prev = history.length > 0 ? history[history.length - 1] : null;
            setLastMove(prev ? { from: prev.from, to: prev.to } : null);
            setSelectedSquare(null);
            setLegalMoveSquares([]);
            syncState();
        }
    }, [syncState]);

    const resetGame = useCallback(() => {
        gameRef.current = new Chess();
        setLastMove(null);
        setSelectedSquare(null);
        setLegalMoveSquares([]);
        clearSavedGame();
        syncState();
        playSound('gameStart');
    }, [syncState]);

    const loadState = useCallback((fen: string, history: Move[]) => {
        try {
            if (fen !== gameRef.current.fen()) {
                gameRef.current = new Chess(fen);
                setPosition(gameRef.current.fen());
                setMoveHistory([...history]);
                const prev = history.length > 0 ? history[history.length - 1] : null;
                setLastMove(prev ? { from: prev.from, to: prev.to } : null);
                setSelectedSquare(null);
                setLegalMoveSquares([]);
            }
        } catch { }
    }, []);

    return {
        position,
        turn,
        isCheck,
        isCheckmate,
        isDraw,
        isStalemate,
        isGameOver,
        moveHistory,
        lastMove,
        kingSquare,
        selectedSquare,
        legalMoveSquares,
        makeMove,
        applyRemoteMove,
        handleSquareClick,
        undoMove,
        resetGame,
        clearSelection,
        loadState,
        onDrop,
        pendingPromotion,
        confirmPromotion,
        cancelPromotion,
        playerColor,
        isOnline,
    };
}
