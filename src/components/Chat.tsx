import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage } from '../hooks/useSocket';

interface ChatProps {
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
}

export default function Chat({ messages, onSendMessage }: ChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [unread, setUnread] = useState(0);
    const prevCount = useRef(messages.length);

    useEffect(() => {
        if (messages.length > prevCount.current) {
            if (!isOpen) {
                setUnread((prev) => prev + (messages.length - prevCount.current));
            } else {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
        prevCount.current = messages.length;
    }, [messages, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setUnread(0);
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }, 100);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
            {/* Chat Box */}
            <motion.div
                initial={false}
                animate={{
                    height: isOpen ? 320 : 0,
                    opacity: isOpen ? 1 : 0,
                    scale: isOpen ? 1 : 0.95,
                    pointerEvents: isOpen ? 'auto' : 'none',
                }}
                className="w-80 rounded-2xl backdrop-blur-xl border border-border shadow-2xl flex flex-col overflow-hidden origin-bottom-right"
                style={{ background: 'var(--color-surface-overlay)' }}
            >
                <div className="p-3 border-b border-border bg-surface-raised flex justify-between items-center">
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                        <span>💬</span> Party Chat
                    </h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-text-muted hover:text-text-primary"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-text-muted italic">
                            No messages yet. Say hi!
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div key={i} className="text-sm">
                                <span className="font-semibold text-accent mr-2">{msg.sender}:</span>
                                <span className="text-text-primary break-words">{msg.text}</span>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-surface/50">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    />
                </form>
            </motion.div>

            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="relative w-14 h-14 rounded-full bg-accent text-white shadow-xl flex items-center justify-center text-2xl"
            >
                💬
                {unread > 0 && !isOpen && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 border-2 border-surface text-white text-xs font-bold flex items-center justify-center shadow-sm"
                    >
                        {unread > 9 ? '9+' : unread}
                    </motion.div>
                )}
            </motion.button>
        </div>
    );
}
