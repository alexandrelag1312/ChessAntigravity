import { motion, AnimatePresence } from 'framer-motion';
import type { PendingPromotion } from '../hooks/useChessGame';

interface PromotionOverlayProps {
    pending: PendingPromotion;
    onConfirm: (piece: 'q' | 'r' | 'b' | 'n') => void;
    onCancel: () => void;
}

const PIECES: { key: 'q' | 'r' | 'b' | 'n'; label: string; unicode: string }[] = [
    { key: 'q', label: 'Queen', unicode: '♛' },
    { key: 'r', label: 'Rook', unicode: '♜' },
    { key: 'b', label: 'Bishop', unicode: '♝' },
    { key: 'n', label: 'Knight', unicode: '♞' },
];

export default function PromotionOverlay({ pending, onConfirm, onCancel }: PromotionOverlayProps) {
    const isWhite = pending.color === 'w';
    const pieceStyle = isWhite
        ? { filter: 'invert(1) drop-shadow(0 0 2px rgba(0,0,0,0.8))' }
        : {};

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            >
                <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    className="relative bg-surface-raised border border-border rounded-2xl p-6 shadow-2xl z-10"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h3 className="text-center text-text-primary font-bold text-lg mb-4">
                        Promote Pawn
                    </h3>
                    <div className="flex gap-3">
                        {PIECES.map((p) => (
                            <button
                                key={p.key}
                                title={p.label}
                                onClick={() => onConfirm(p.key)}
                                className="flex flex-col items-center gap-1 w-16 h-20 rounded-xl border border-border bg-surface hover:bg-accent/20 hover:border-accent transition-all duration-150 hover:scale-105 active:scale-95"
                            >
                                <span className="text-5xl leading-none mt-2" style={pieceStyle}>
                                    {p.unicode}
                                </span>
                                <span className="text-xs text-text-muted font-medium">{p.label}</span>
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={onCancel}
                        className="mt-4 w-full text-xs text-text-muted hover:text-text-primary transition-colors"
                    >
                        Cancel
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
