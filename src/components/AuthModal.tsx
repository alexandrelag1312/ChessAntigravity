import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (token: string, user: any) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const API_URL = import.meta.env.VITE_BACKEND_URL
        ? `${import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '')}/api`
        : 'http://localhost:3000/api';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
            const finalUrl = `${API_URL}${endpoint}`;

            console.log("🚀 Calling API:", finalUrl);

            const res = await fetch(finalUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('chess_auth_token', data.token);
                onSuccess(data.token, data.user);
            } else {
                setError(data.error || 'Authentication failed');
            }
        } catch (err) {
            setError('Network error. Is the server running?');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="relative w-full max-w-sm bg-surface rounded-2xl border border-border overflow-hidden shadow-2xl"
                >
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-text-primary">
                                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                            </h2>
                            <button onClick={onClose} className="text-text-muted hover:text-text-primary">
                                ✕
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                    placeholder="Enter username"
                                    required
                                    minLength={3}
                                    maxLength={20}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                    placeholder="Enter password"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : (mode === 'login' ? 'Login' : 'Signup')}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-text-muted">
                                {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                                <button
                                    onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
                                    className="ml-2 text-accent font-medium hover:underline"
                                >
                                    {mode === 'login' ? 'Sign up' : 'Log in'}
                                </button>
                            </p>
                        </div>

                        {mode === 'register' && (
                            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                <p className="text-xs text-yellow-400 text-center flex items-center gap-1.5 justify-center">
                                    <span>⚠️</span>
                                    No email is required. Password recovery is impossible if lost!
                                </p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
