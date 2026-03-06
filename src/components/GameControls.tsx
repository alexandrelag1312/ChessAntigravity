import { motion } from 'framer-motion';
import { themes, type BoardTheme } from '../logic/themes';

interface GameControlsProps {
    onNewGame: () => void;
    onUndo: () => void;
    onFlipBoard: () => void;
    canUndo: boolean;
    aiEnabled: boolean;
    onToggleAi: () => void;
    aiLevel: number;
    onAiLevelChange: (level: number) => void;
    theme: BoardTheme;
    onThemeChange: (theme: BoardTheme) => void;
}

const buttonVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
};

function ControlButton({
    onClick,
    disabled,
    children,
    variant = 'default',
    active,
}: {
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
    variant?: 'default' | 'primary' | 'accent';
    active?: boolean;
}) {
    const baseClasses =
        'px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

    const variantClasses = {
        default:
            'bg-surface-raised text-text-primary border border-border hover:border-text-muted hover:bg-surface-raised/80',
        primary:
            'bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25',
        accent:
            'bg-accent text-surface font-semibold hover:bg-accent/90',
    };

    const activeClass = active
        ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface'
        : '';

    return (
        <motion.button
            variants={buttonVariants}
            initial="rest"
            whileHover={disabled ? undefined : 'hover'}
            whileTap={disabled ? undefined : 'tap'}
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${activeClass}`}
        >
            {children}
        </motion.button>
    );
}

const LEVEL_LABELS: Record<number, string> = {
    1: 'Beginner',
    2: 'Novice',
    3: 'Casual',
    4: 'Club',
    5: 'Intermediate',
    6: 'Advanced',
    7: 'Expert',
    8: 'Master',
    9: 'Grandmaster',
    10: 'Stockfish',
};

export default function GameControls({
    onNewGame,
    onUndo,
    onFlipBoard,
    canUndo,
    aiEnabled,
    onToggleAi,
    aiLevel,
    onAiLevelChange,
    theme,
    onThemeChange,
}: GameControlsProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-xl p-4 backdrop-blur-md border border-border space-y-3"
            style={{ background: 'var(--color-surface-overlay)' }}
        >
            {/* Button Row */}
            <div className="flex flex-wrap gap-2 justify-center">
                <ControlButton onClick={onNewGame} variant="accent">
                    ✦ New Game
                </ControlButton>
                <ControlButton onClick={onUndo} disabled={!canUndo}>
                    ↶ Undo
                </ControlButton>
                <ControlButton onClick={onFlipBoard} variant="primary">
                    ⇅ Flip Board
                </ControlButton>
            </div>

            {/* Theme Selector */}
            <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-medium text-text-secondary">
                    🎨 Board Theme
                </span>
                <div className="flex gap-2 relative">
                    {themes.map((t) => (
                        <motion.button
                            key={t.id}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onThemeChange(t)}
                            className="w-6 h-6 rounded-full relative overflow-hidden shadow-sm"
                            aria-label={`Select ${t.name} theme`}
                        >
                            {/* Split colors diagonally for the swatch */}
                            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${t.lightSquare} 50%, ${t.darkSquare} 50%)` }} />
                            {theme.id === t.id && (
                                <div className="absolute inset-0 ring-2 ring-accent ring-inset rounded-full shadow-[0_0_8px_var(--color-accent)] pointer-events-none" />
                            )}
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* AI Divider */}
            <div className="border-t border-border" />

            {/* AI Toggle */}
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-secondary">
                    🤖 AI Opponent
                </span>
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={onToggleAi}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${aiEnabled
                        ? 'bg-accent'
                        : 'bg-surface-raised border border-border'
                        }`}
                >
                    <motion.div
                        animate={{ x: aiEnabled ? 20 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                    />
                </motion.button>
            </div>

            {/* AI Difficulty Slider */}
            {aiEnabled && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-text-muted">Difficulty</span>
                        <span className="text-xs font-medium text-accent">
                            {aiLevel} — {LEVEL_LABELS[aiLevel] ?? ''}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={1}
                        max={10}
                        value={aiLevel}
                        onChange={(e) => onAiLevelChange(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                            bg-surface-raised
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-4
                            [&::-webkit-slider-thumb]:h-4
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-accent
                            [&::-webkit-slider-thumb]:shadow-md
                            [&::-webkit-slider-thumb]:cursor-pointer
                            [&::-moz-range-thumb]:w-4
                            [&::-moz-range-thumb]:h-4
                            [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-accent
                            [&::-moz-range-thumb]:border-0
                            [&::-moz-range-thumb]:cursor-pointer"
                    />
                </motion.div>
            )}
        </motion.div>
    );
}
