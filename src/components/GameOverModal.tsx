import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

export type GameOverReason =
    | 'checkmate'
    | 'stalemate'
    | 'threefold'
    | 'insufficient'
    | 'timeout'
    | 'resignation'
    | 'draw';

export interface GameOverModalProps {
    isOpen: boolean;
    reason: GameOverReason | null;
    winner: 'w' | 'b' | 'draw' | null;
    playerColor: 'w' | 'b' | null; // For online relative perspective
    whitePlayerName: string;
    blackPlayerName: string;
    onNewGame: () => void;
    onReviewBoard: () => void;
}

export default function GameOverModal({
    isOpen,
    reason,
    winner,
    playerColor,
    whitePlayerName,
    blackPlayerName,
    onNewGame,
    onReviewBoard,
}: GameOverModalProps) {
    if (!isOpen || !reason) return null;

    useEffect(() => {
        if (!isOpen) return;
        const isVictory = playerColor && winner === playerColor;
        const isDefeat = playerColor && winner && winner !== 'draw' && winner !== playerColor;

        if (isVictory) {
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#10b981', '#3b82f6', '#fbbf24']
            });
            try { navigator.vibrate?.([200, 100, 200]); } catch { }
        } else if (isDefeat) {
            try { navigator.vibrate?.(500); } catch { }
        }
    }, [isOpen, winner, playerColor]);

    let titleStyle = "text-text-primary";
    let titleText = "Game Over";

    // Relative perspective logic
    if (playerColor && winner !== 'draw' && winner !== null) {
        if (winner === playerColor) {
            titleText = "Victory!";
            titleStyle = "text-accent drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]";
        } else {
            titleText = "Defeat...";
            titleStyle = "text-red-500";
        }
    } else if (winner === 'draw') {
        titleText = "Draw";
        titleStyle = "text-text-secondary";
    }

    // Determine specific reason string
    let reasonText = '';
    switch (reason) {
        case 'checkmate': reasonText = "by Checkmate"; break;
        case 'timeout': reasonText = "on Time"; break;
        case 'resignation': reasonText = "by Resignation"; break;
        case 'stalemate': reasonText = "by Stalemate"; break;
        case 'threefold': reasonText = "by Repetition"; break;
        case 'insufficient': reasonText = "by Insufficient Material"; break;
        case 'draw': reasonText = "by Agreement"; break;
    }

    // Determine score
    let scoreDisplay = '½ - ½';
    if (winner === 'w') scoreDisplay = '1 - 0';
    else if (winner === 'b') scoreDisplay = '0 - 1';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="relative bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden"
            >
                <div className="p-8 flex flex-col items-center justify-center text-center">
                    <h2 className={`text-5xl font-black italic tracking-tighter mb-2 ${titleStyle}`}>
                        {titleText}
                    </h2>

                    <p className="text-text-muted font-medium mb-6 uppercase tracking-widest text-xs">
                        {reasonText}
                    </p>

                    <div className="bg-surface-raised w-full rounded-xl p-4 border border-border mb-8 shadow-inner flex justify-between items-center px-6">
                        <div className={`text-sm font-bold ${winner === 'w' ? 'text-text-primary' : 'text-text-muted'}`}>
                            {whitePlayerName}
                        </div>
                        <div className="text-2xl font-black tracking-widest text-text-primary mx-4 tabular-nums">
                            {scoreDisplay}
                        </div>
                        <div className={`text-sm font-bold ${winner === 'b' ? 'text-text-primary' : 'text-text-muted'}`}>
                            {blackPlayerName}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full">
                        <button
                            onClick={onNewGame}
                            className="w-full py-3.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold tracking-wide transition-colors shadow-lg active:scale-[0.98]"
                        >
                            Start New Game
                        </button>
                        <button
                            onClick={onReviewBoard}
                            className="w-full py-3 rounded-xl bg-surface hover:bg-surface-raised border border-border text-text-secondary font-medium transition-colors active:scale-[0.98]"
                        >
                            Review Board
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
