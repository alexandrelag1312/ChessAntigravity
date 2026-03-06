import { motion } from 'framer-motion';
import type { Move } from 'chess.js';

interface CapturedPiecesProps {
    moveHistory: Move[];
    color: 'w' | 'b'; // Which player's trophies to show (pieces THEY captured)
}

// Piece unicode symbols
const PIECE_SYMBOLS: Record<string, string> = {
    p: '♟',
    n: '♞',
    b: '♝',
    r: '♜',
    q: '♛',
    k: '♚',
};

// Piece values for sorting (most valuable first)
const PIECE_ORDER: Record<string, number> = {
    q: 5,
    r: 4,
    b: 3,
    n: 2,
    p: 1,
};

/**
 * Calculate material advantage in pawns
 */
function getMaterialDiff(captured: string[]): number {
    return captured.reduce((sum, p) => sum + (PIECE_ORDER[p] || 0), 0);
}

export default function CapturedPieces({ moveHistory, color }: CapturedPiecesProps) {
    // Collect pieces captured BY this color (i.e., opponent's pieces that were taken)
    const captured: string[] = [];
    for (const move of moveHistory) {
        if (move.color === color && move.captured) {
            captured.push(move.captured);
        }
    }

    // Sort: most valuable first
    captured.sort((a, b) => (PIECE_ORDER[b] || 0) - (PIECE_ORDER[a] || 0));

    // Calculate opponent's captures for material diff
    const opponentColor = color === 'w' ? 'b' : 'w';
    const opponentCaptured: string[] = [];
    for (const move of moveHistory) {
        if (move.color === opponentColor && move.captured) {
            opponentCaptured.push(move.captured);
        }
    }

    const myMaterial = getMaterialDiff(captured);
    const theirMaterial = getMaterialDiff(opponentCaptured);
    const diff = myMaterial - theirMaterial;

    const label = color === 'w' ? 'White' : 'Black';
    const pieceColor = color === 'w' ? 'text-white' : 'text-white';

    return (
        <div className="flex items-center gap-1.5 min-h-[28px]">
            <span className="text-text-muted text-xs font-medium w-10 shrink-0">
                {label}
            </span>
            <div className="flex items-center gap-0.5 flex-wrap">
                {captured.map((piece, idx) => (
                    <motion.span
                        key={`${piece}-${idx}`}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                        className={`text-base leading-none ${pieceColor} opacity-80`}
                        title={piece.toUpperCase()}
                    >
                        {PIECE_SYMBOLS[piece] || piece}
                    </motion.span>
                ))}
            </div>
            {diff > 0 && (
                <span className="text-text-muted text-xs ml-1">+{diff}</span>
            )}
        </div>
    );
}
