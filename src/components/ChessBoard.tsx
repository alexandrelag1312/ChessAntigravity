import { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { motion } from 'framer-motion';
import type { ChessGameState } from '../hooks/useChessGame';
import {
    getLastMoveStyles,
    getCheckStyles,
    getSelectionStyles,
    getLegalMoveStyles,
    mergeSquareStyles,
} from '../logic/highlights';
import type { BoardTheme } from '../logic/themes';

interface ChessBoardProps {
    gameState: ChessGameState;
    boardOrientation: 'white' | 'black';
    theme: BoardTheme;
    playerRole?: 'white' | 'black' | 'spectator' | null;
}

export default function ChessBoard({ gameState, boardOrientation, theme, playerRole }: ChessBoardProps) {
    const {
        position,
        lastMove,
        isCheck,
        kingSquare,
        makeMove,
        isGameOver,
        selectedSquare,
        legalMoveSquares,
        handleSquareClick,
        clearSelection,
    } = gameState;
    const [boardWidth, setBoardWidth] = useState(400);

    const updateBoardSize = useCallback(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const vmin = Math.min(vw, vh);

        let size: number;
        if (vw < 640) {
            size = Math.min(vw - 32, vh * 0.5, 420);
        } else if (vw < 1024) {
            size = Math.min(vw * 0.6, vh * 0.65, 440);
        } else {
            size = Math.min(vmin * 0.7, 520);
        }
        setBoardWidth(Math.max(280, Math.round(size)));
    }, []);

    useEffect(() => {
        updateBoardSize();
        window.addEventListener('resize', updateBoardSize);
        return () => window.removeEventListener('resize', updateBoardSize);
    }, [updateBoardSize]);

    // Merge all visual indicators into one squareStyles object
    const squareStyles = mergeSquareStyles(
        getLastMoveStyles(lastMove),
        getCheckStyles(isCheck, kingSquare),
        getSelectionStyles(selectedSquare),
        getLegalMoveStyles(legalMoveSquares, position)
    );

    function onPieceDrop(args: any): boolean {
        const { sourceSquare, targetSquare, piece } = args;
        if (isGameOver || !targetSquare) return false;

        const pieceStr = typeof piece === 'string' ? piece : (piece?.pieceType || String(piece || ''));

        // Clear any click-to-move selection when a drag completes
        clearSelection();
        return gameState.onDrop(sourceSquare, targetSquare, pieceStr);
    }

    // ── Click handler — unified for pieces and empty squares ────────
    function onSquareClick({ piece, square }: { piece: { pieceType: string } | null; square: string }) {
        const pieceStr = piece?.pieceType ?? null;

        // Multiplayer Role Locking for Click-to-Move
        if (playerRole === 'spectator') return;
        if (pieceStr) {
            if (playerRole === 'white' && pieceStr.charAt(0) !== 'w' && !gameState.selectedSquare) return;
            if (playerRole === 'black' && pieceStr.charAt(0) !== 'b' && !gameState.selectedSquare) return;
        }

        handleSquareClick(square, pieceStr);
    }

    // When dragging starts, clear any click selection to avoid flicker
    function onPieceDrag() {
        clearSelection();
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex items-center justify-center"
        >
            <div
                className="rounded-2xl overflow-hidden shadow-2xl"
                style={{
                    width: boardWidth,
                    height: boardWidth,
                    boxShadow:
                        '0 0 60px rgba(16, 185, 129, 0.08), 0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                }}
            >
                <Chessboard
                    options={{
                        position,
                        onPieceDrop,
                        onSquareClick,
                        onPieceDrag,
                        boardOrientation,
                        animationDurationInMs: 250,
                        squareStyles,
                        boardStyle: {
                            borderRadius: '16px',
                        },
                        darkSquareStyle: theme.styleDark || { backgroundColor: theme.darkSquare, transition: 'background-color 0.3s ease' },
                        lightSquareStyle: theme.styleLight || { backgroundColor: theme.lightSquare, transition: 'background-color 0.3s ease' },
                        dropSquareStyle: {
                            boxShadow: 'inset 0 0 1px 6px rgba(16, 185, 129, 0.5)',
                        },
                    }}
                />
            </div>
        </motion.div>
    );
}
