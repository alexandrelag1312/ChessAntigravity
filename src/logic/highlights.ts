import type { Square } from 'chess.js';

export type SquareStyles = Record<string, React.CSSProperties>;

/**
 * Returns custom square styles to highlight the last move's from/to squares.
 */
export function getLastMoveStyles(
    lastMove: { from: Square; to: Square } | null
): SquareStyles {
    if (!lastMove) return {};

    return {
        [lastMove.from]: {
            boxShadow: 'inset 0 0 0 9999px rgba(251, 191, 36, 0.28)',
        },
        [lastMove.to]: {
            boxShadow: 'inset 0 0 0 9999px rgba(251, 191, 36, 0.45)',
        },
    };
}

/**
 * Returns custom square styles for a king in check — a red radial glow.
 */
export function getCheckStyles(
    isCheck: boolean,
    kingSquare: Square | null
): SquareStyles {
    if (!isCheck || !kingSquare) return {};

    return {
        [kingSquare]: {
            boxShadow: 'inset 0 0 35px rgba(239, 68, 68, 0.9)',
        },
    };
}

/**
 * Returns highlight style for the currently selected (clicked) square.
 */
export function getSelectionStyles(
    selectedSquare: Square | null
): SquareStyles {
    if (!selectedSquare) return {};

    return {
        [selectedSquare]: {
            boxShadow: 'inset 0 0 0 9999px rgba(16, 185, 129, 0.55)',
        },
    };
}

/**
 * Returns small circular dot indicators on all legal destination squares.
 * - Empty squares get a centered small dot.
 * - Occupied squares (captures) get a ring around the edges.
 */
export function getLegalMoveStyles(
    legalSquares: Square[],
    boardPosition: Record<string, unknown> | string
): SquareStyles {
    if (legalSquares.length === 0) return {};

    const styles: SquareStyles = {};

    // Determine which squares have pieces (for capture ring vs move dot)
    // We'll check by trying to parse if boardPosition is a FEN or object.
    // For simplicity, show dots on all — the look works for both.
    for (const sq of legalSquares) {
        const hasPiece = isSquareOccupied(sq, boardPosition);
        if (hasPiece) {
            // Capture indicator: ring around edges
            styles[sq] = {
                background:
                    'radial-gradient(circle, transparent 60%, rgba(16, 185, 129, 0.4) 61%, rgba(16, 185, 129, 0.4) 70%, transparent 71%)',
            };
        } else {
            // Move indicator: small centered dot
            styles[sq] = {
                background:
                    'radial-gradient(circle, rgba(16, 185, 129, 0.45) 22%, transparent 23%)',
            };
        }
    }

    return styles;
}

/**
 * Checks if a square has a piece on it given a FEN string.
 */
function isSquareOccupied(square: string, position: Record<string, unknown> | string): boolean {
    if (typeof position !== 'string') return false;

    // Parse FEN piece placement
    const fen = position;
    const rows = fen.split(' ')[0].split('/');
    const file = square.charCodeAt(0) - 97; // 'a' = 0
    const rank = 8 - parseInt(square[1]);    // '8' = row 0

    if (rank < 0 || rank > 7 || file < 0 || file > 7) return false;

    const row = rows[rank];
    let col = 0;
    for (const ch of row) {
        if (col > file) break;
        if (/\d/.test(ch)) {
            col += parseInt(ch);
        } else {
            if (col === file) return true;
            col++;
        }
    }
    return false;
}

/**
 * Merges multiple SquareStyles objects into one.
 */
export function mergeSquareStyles(...styles: SquareStyles[]): SquareStyles {
    const merged: SquareStyles = {};
    for (const style of styles) {
        for (const [key, value] of Object.entries(style)) {
            merged[key] = { ...merged[key], ...value };
        }
    }
    return merged;
}
