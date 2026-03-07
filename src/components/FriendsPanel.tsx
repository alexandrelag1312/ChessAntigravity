import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocial, type Friend, type UserProfile } from '../hooks/useSocial';

interface FriendsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    social: ReturnType<typeof useSocial>;
    onInvite: (friendId: string) => void;
}

export default function FriendsPanel({ isOpen, onClose, social, onInvite }: FriendsPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>('friends');

    // Debounce search
    useEffect(() => {
        if (searchQuery.length < 3) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        const timer = setTimeout(async () => {
            const results = await social.searchUsers(searchQuery);
            setSearchResults(results);
            setIsSearching(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, social]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex justify-end">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Panel */}
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-sm h-full bg-surface border-l border-border shadow-2xl flex flex-col"
                >
                    <div className="p-4 border-b border-border flex justify-between items-center bg-surface-raised">
                        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                            <span>👥</span> Friends
                        </h2>
                        <button onClick={onClose} className="text-text-muted hover:text-text-primary p-2">
                            ✕
                        </button>
                    </div>

                    <div className="flex border-b border-border">
                        <button
                            onClick={() => setActiveTab('friends')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'friends' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                        >
                            List ({social.friends.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('requests')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors relative ${activeTab === 'requests' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                        >
                            Requests
                            {social.incomingRequests.length > 0 && (
                                <span className="absolute top-2 right-2 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                                    {social.incomingRequests.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('add')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'add' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                        >
                            Find
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* ── FRIENDS TAB ── */}
                        {activeTab === 'friends' && (
                            <>
                                {social.friends.length === 0 ? (
                                    <div className="text-center py-10 text-text-muted">
                                        <p className="text-4xl mb-3">👻</p>
                                        <p>No friends yet.</p>
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {social.friends.map(friend => (
                                            <li key={friend.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-raised border border-border">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                                                            {friend.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface ${friend.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-text-primary text-sm">{friend.username}</p>
                                                        <p className="text-xs text-text-muted">
                                                            W: {friend.stats.wins} | L: {friend.stats.losses}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {friend.isOnline && (
                                                        <button
                                                            onClick={() => onInvite(friend.id)}
                                                            className="px-3 py-1.5 text-xs font-bold bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-lg transition-colors border border-accent/20"
                                                        >
                                                            Invite
                                                        </button>
                                                    )}
                                                    <button onClick={() => social.removeFriend(friend.id)} className="text-text-muted hover:text-red-400 p-1" title="Remove Friend">
                                                        ×
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}


                        {/* ── REQUESTS TAB ── */}
                        {activeTab === 'requests' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">Incoming ({social.incomingRequests.length})</h3>
                                    {social.incomingRequests.length === 0 ? (
                                        <p className="text-sm text-text-muted italic">No incoming requests.</p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {social.incomingRequests.map(req => (
                                                <li key={req._id} className="flex items-center justify-between p-3 rounded-xl bg-surface-raised border border-border">
                                                    <span className="font-bold text-text-primary text-sm">{req.username}</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => social.acceptRequest(req._id)} className="px-3 py-1 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white border border-green-500/20 rounded-md text-xs font-bold transition-colors">
                                                            Accept
                                                        </button>
                                                        <button onClick={() => social.removeFriend(req._id)} className="px-3 py-1 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-md text-xs font-bold transition-colors">
                                                            Decline
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div>
                                    <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">Outgoing ({social.outgoingRequests.length})</h3>
                                    {social.outgoingRequests.length === 0 ? (
                                        <p className="text-sm text-text-muted italic">No outgoing requests.</p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {social.outgoingRequests.map(req => (
                                                <li key={req._id} className="flex items-center justify-between p-3 rounded-xl bg-surface-raised border border-border">
                                                    <span className="font-bold text-text-primary text-sm">{req.username}</span>
                                                    <button onClick={() => social.removeFriend(req._id)} className="px-2 py-1 text-xs text-text-muted hover:text-red-400">Cancel</button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── ADD TAB ── */}
                        {activeTab === 'add' && (
                            <div>
                                <input
                                    type="text"
                                    placeholder="Search by username..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-muted outline-none focus:border-accent mb-4"
                                />

                                {isSearching ? (
                                    <p className="text-center text-text-muted text-sm py-4">Searching...</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {searchResults.map(user => {
                                            const isFriend = social.friends.some(f => f.id === user.id);
                                            const hasIncoming = social.incomingRequests.some(r => r._id === user.id);
                                            const hasSent = social.outgoingRequests.some(r => r._id === user.id);

                                            return (
                                                <li key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-raised border border-border">
                                                    <div>
                                                        <span className="font-bold text-text-primary text-sm">{user.username}</span>
                                                    </div>

                                                    {isFriend ? (
                                                        <span className="text-xs text-green-500 font-bold px-2">Friends</span>
                                                    ) : hasIncoming ? (
                                                        <button onClick={() => social.acceptRequest(user.id)} className="px-3 py-1 bg-green-500/10 text-green-500 rounded-md text-xs font-bold">Accept</button>
                                                    ) : hasSent ? (
                                                        <span className="text-xs text-text-muted px-2">Pending</span>
                                                    ) : (
                                                        <button onClick={() => social.sendRequest(user.id)} className="px-3 py-1 bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/20 rounded-md text-xs font-bold transition-colors">
                                                            + Add
                                                        </button>
                                                    )}
                                                </li>
                                            );
                                        })}
                                        {searchQuery.length >= 3 && searchResults.length === 0 && (
                                            <p className="text-center text-text-muted text-sm py-4">No specific users found.</p>
                                        )}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
