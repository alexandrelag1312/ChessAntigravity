import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LobbyProps {
    onCreateRoom: (name: string, casualMode: boolean) => void;
    onJoinRoom: (roomId: string, name: string) => void;
    initialRoomId?: string;
}

export default function Lobby({ onCreateRoom, onJoinRoom, initialRoomId = '' }: LobbyProps) {
    const [view, setView] = useState<'menu' | 'create' | 'join'>('menu');
    const [playerName, setPlayerName] = useState('');
    const [roomCode, setRoomCode] = useState(initialRoomId);
    const [casualMode, setCasualMode] = useState(false);

    // Auto-switch to join view if URL provides a room code
    useEffect(() => {
        if (initialRoomId) {
            setView('join');
            setRoomCode(initialRoomId);
        }
    }, [initialRoomId]);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName.trim()) return;
        onCreateRoom(playerName.trim(), casualMode);
    };

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName.trim() || !roomCode.trim()) return;
        onJoinRoom(roomCode.trim(), playerName.trim());
    };

    return (
        <div className="w-full max-w-md mx-auto relative z-10">
            <AnimatePresence mode="wait">
                {view === 'menu' && (
                    <motion.div
                        key="menu"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="rounded-2xl p-8 backdrop-blur-xl border border-border shadow-2xl flex flex-col gap-6"
                        style={{ background: 'var(--color-surface-overlay)' }}
                    >
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold text-text-primary">Party Mode</h2>
                            <p className="text-text-secondary text-sm">Play online with friends.</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => setView('create')}
                                className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Create Room
                            </button>
                            <button
                                onClick={() => setView('join')}
                                className="w-full py-3.5 rounded-xl bg-surface-raised border border-border text-text-primary font-medium hover:bg-surface-raised/80 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Join Room
                            </button>
                        </div>
                    </motion.div>
                )}

                {view === 'create' && (
                    <motion.form
                        key="create"
                        onSubmit={handleCreate}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="rounded-2xl p-8 backdrop-blur-xl border border-border shadow-2xl flex flex-col gap-6"
                        style={{ background: 'var(--color-surface-overlay)' }}
                    >
                        <button
                            type="button"
                            onClick={() => setView('menu')}
                            className="text-sm text-text-muted hover:text-text-primary self-start transition-colors"
                        >
                            ← Back
                        </button>
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold text-text-primary">Create Room</h2>
                            <p className="text-text-secondary text-sm">Host a new game.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">Your Name</label>
                                <input
                                    type="text"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    placeholder="Enter your name"
                                    maxLength={20}
                                    className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                                    autoFocus
                                    required
                                />
                            </div>
                            <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface/50 cursor-pointer hover:bg-surface transition-colors">
                                <input
                                    type="checkbox"
                                    checked={casualMode}
                                    onChange={(e) => setCasualMode(e.target.checked)}
                                    className="w-5 h-5 rounded text-accent focus:ring-accent bg-surface border-border accent-accent"
                                />
                                <div>
                                    <div className="text-sm font-medium text-text-primary">Casual Mode</div>
                                    <div className="text-xs text-text-muted">Allows Undos and AI Hints</div>
                                </div>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={!playerName.trim()}
                            className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Start Hosting
                        </button>
                    </motion.form>
                )}

                {view === 'join' && (
                    <motion.form
                        key="join"
                        onSubmit={handleJoin}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="rounded-2xl p-8 backdrop-blur-xl border border-border shadow-2xl flex flex-col gap-6"
                        style={{ background: 'var(--color-surface-overlay)' }}
                    >
                        <button
                            type="button"
                            onClick={() => setView('menu')}
                            className="text-sm text-text-muted hover:text-text-primary self-start transition-colors"
                        >
                            ← Back
                        </button>
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold text-text-primary">Join Room</h2>
                            <p className="text-text-secondary text-sm">Enter the 4-digit invite code.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">Room Code</label>
                                <input
                                    type="text"
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. A7B9"
                                    maxLength={4}
                                    className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted/50 font-mono tracking-[0.2em] text-center text-lg focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                                    autoFocus={!initialRoomId}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">Your Name</label>
                                <input
                                    type="text"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    placeholder="Enter your name"
                                    maxLength={20}
                                    className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                                    autoFocus={!!initialRoomId}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!playerName.trim() || roomCode.length !== 4}
                            className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Join Game
                        </button>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
    );
}
