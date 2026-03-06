import { motion, AnimatePresence } from 'framer-motion';
import type { ChessGameState } from '../hooks/useChessGame';

interface GameInfoProps {
    gameState: ChessGameState;
    aiEnabled?: boolean;
    isAiThinking?: boolean;
}

export default function GameInfo({ gameState, aiEnabled, isAiThinking }: GameInfoProps) {
    const { turn, isCheck, isCheckmate, isDraw, isStalemate, isGameOver } = gameState;

    const turnLabel = turn === 'w' ? 'White' : 'Black';
    const turnColor = turn === 'w' ? 'bg-white' : 'bg-gray-900 border border-gray-600';

    let statusText = `${turnLabel} to move`;
    let statusColor = 'text-text-primary';

    if (isCheckmate) {
        const winner = turn === 'w' ? 'Black' : 'White';
        statusText = `Checkmate! ${winner} wins 🏆`;
        statusColor = 'text-accent';
    } else if (isStalemate) {
        statusText = 'Stalemate — Draw';
        statusColor = 'text-yellow-400';
    } else if (isDraw) {
        statusText = 'Draw';
        statusColor = 'text-yellow-400';
    } else if (isCheck) {
        statusText = `${turnLabel} is in Check!`;
        statusColor = 'text-red-400';
    }

    // Show "AI Thinking..." when it's the AI's turn and engine is computing
    const showThinking = aiEnabled && isAiThinking && turn === 'b' && !isGameOver;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-xl p-5 backdrop-blur-md border border-border"
            style={{ background: 'var(--color-surface-overlay)' }}
        >
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-4 h-4 rounded-full ${turnColor} shrink-0`} />
                <span className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                    Turn
                </span>
            </div>

            <AnimatePresence mode="wait">
                <motion.p
                    key={statusText}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.25 }}
                    className={`text-lg font-semibold ${statusColor}`}
                >
                    {statusText}
                </motion.p>
            </AnimatePresence>

            {/* AI Thinking Indicator */}
            <AnimatePresence>
                {showThinking && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-3 flex items-center gap-2"
                    >
                        <motion.div
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            className="flex items-center gap-1.5"
                        >
                            <span className="text-sm text-cyan-400">🤖</span>
                            <span className="text-sm font-medium text-cyan-400">
                                Thinking…
                            </span>
                            <div className="flex gap-0.5">
                                {[0, 1, 2].map((i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ scale: [1, 1.4, 1] }}
                                        transition={{
                                            duration: 0.6,
                                            repeat: Infinity,
                                            delay: i * 0.15,
                                        }}
                                        className="w-1 h-1 rounded-full bg-cyan-400"
                                    />
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {isGameOver && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm text-center"
                >
                    Game Over
                </motion.div>
            )}
        </motion.div>
    );
}
