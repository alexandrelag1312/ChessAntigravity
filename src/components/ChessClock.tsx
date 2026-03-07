import { motion } from 'framer-motion';

interface ChessClockProps {
    timeSeconds: number;
    isActive: boolean;
    color: 'w' | 'b';
    playerName?: string;
    isMe?: boolean;
}

function formatTime(seconds: number): string {
    if (seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ChessClock({ timeSeconds, isActive, color, playerName, isMe }: ChessClockProps) {
    const isLow = timeSeconds <= 60 && timeSeconds > 0;
    const isOut = timeSeconds <= 0;
    const displayName = playerName || 'Guest';

    return (
        <div
            className={`flex items-center gap-3 rounded-xl px-4 py-2.5 border transition-all duration-300 ${isActive
                ? 'border-accent bg-accent/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'border-border bg-surface-raised'
                }`}
        >
            {/* Color indicator */}
            <div
                className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0"
                style={{ backgroundColor: color === 'w' ? '#f5f5f5' : '#1a1a1a' }}
            />

            {/* Player info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-text-primary truncate">
                        {displayName}
                    </span>
                    {isMe && (
                        <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-[1px] rounded ${isActive ? 'bg-accent/20 text-accent border border-accent/10' : 'bg-surface border border-border text-text-muted/70'}`}>
                            {isActive ? 'Your turn' : 'Waiting'}
                        </span>
                    )}
                </div>
            </div>

            {/* Clock */}
            <motion.div
                animate={isLow && isActive ? { scale: [1, 1.05, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1 }}
                className={`font-mono text-xl font-bold tabular-nums tracking-tight ${isOut
                    ? 'text-red-500'
                    : isLow
                        ? 'text-orange-400'
                        : isActive
                            ? 'text-accent'
                            : 'text-text-secondary'
                    }`}
            >
                {formatTime(timeSeconds)}
            </motion.div>
        </div>
    );
}
