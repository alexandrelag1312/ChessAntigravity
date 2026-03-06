import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Move } from 'chess.js';

interface MoveHistoryProps {
    moves: Move[];
}

export default function MoveHistory({ moves }: MoveHistoryProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [moves.length]);

    // Pair moves by number: [[white, black?], ...]
    const movePairs: [Move, Move | undefined][] = [];
    for (let i = 0; i < moves.length; i += 2) {
        movePairs.push([moves[i], moves[i + 1]]);
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-xl backdrop-blur-md border border-border flex flex-col"
            style={{ background: 'var(--color-surface-overlay)' }}
        >
            <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                    Move History
                </h3>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-5 py-3 max-h-64 lg:max-h-80"
            >
                {movePairs.length === 0 ? (
                    <p className="text-text-muted text-sm italic">No moves yet</p>
                ) : (
                    <div className="space-y-1">
                        {movePairs.map(([white, black], idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                                className="flex items-center gap-2 text-sm font-mono"
                            >
                                <span className="text-text-muted w-8 text-right shrink-0">
                                    {idx + 1}.
                                </span>
                                <span className="text-text-primary w-20">{white.san}</span>
                                {black && (
                                    <span className="text-text-secondary w-20">{black.san}</span>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
