import { motion } from 'framer-motion';

interface ChessClockProps {
    timeSeconds: number;
    isActive: boolean;
    label: string;
    color: 'w' | 'b';
    playerName?: string;
}

function formatTime(seconds: number): string {
    if (seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ChessClock({ timeSeconds, isActive, label, color, playerName }: ChessClockProps) {
    const isLow = timeSeconds <= 60 && timeSeconds > 0;
    const isOut = timeSeconds <= 0;

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
                <div className="text-xs text-text-muted font-medium truncate">{label}</div>
                {playerName && (
                    <div className="text-sm font-semibold text-text-primary truncate">{playerName}</div>
                )}
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
