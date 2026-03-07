import { useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';

export interface UserProfile {
    id: string;
    username: string;
    stats: { wins: number; losses: number; draws: number };
}

export interface Friend extends UserProfile {
    isOnline?: boolean;
}

export function useSocial(socket: Socket | null) {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('chess_auth_token'));
    const [friends, setFriends] = useState<Friend[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<{ _id: string, username: string }[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<{ _id: string, username: string }[]>([]);

    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

    // Headers helper
    const getHeaders = useCallback(() => ({
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }), [token]);

    // ── AUTHENTICATION ──────────────────────────────────────────────
    const fetchMe = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setCurrentUser({ id: data.user._id, username: data.user.username, stats: data.user.stats });
            } else {
                logout();
            }
        } catch { } // Ignore network errors temporarily
    }, [token, getHeaders, API_URL]);

    useEffect(() => {
        if (token) fetchMe();
    }, [token, fetchMe]);

    const logout = useCallback(() => {
        setToken(null);
        setCurrentUser(null);
        setFriends([]);
        localStorage.removeItem('chess_auth_token');
        if (socket) {
            socket.disconnect();
            socket.connect(); // reconnect as guest
        }
    }, [socket]);

    // ── FRIENDS FETCHING ────────────────────────────────────────────
    const fetchFriends = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/friends`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setFriends(data.friends.map((f: any) => ({ id: f._id, username: f.username, stats: f.stats, isOnline: false })));
                setIncomingRequests(data.requests.incoming || []);
                setOutgoingRequests(data.requests.outgoing || []);
            }
        } catch { }
    }, [token, getHeaders, API_URL]);

    useEffect(() => {
        if (currentUser) fetchFriends();
    }, [currentUser, fetchFriends]);

    // ── SOCKET INTEGRATION FOR PRESENCE ─────────────────────────────
    useEffect(() => {
        if (!socket || !currentUser) return;

        // When socket connects/reconnects, send token to authenticate
        socket.auth = { token };
        socket.disconnect().connect(); // Force reconnect with new auth token

        const handleFriendOnline = ({ userId }: { userId: string }) => {
            setFriends(prev => prev.map(f => f.id === userId ? { ...f, isOnline: true } : f));
        };

        const handleFriendOffline = ({ userId }: { userId: string }) => {
            setFriends(prev => prev.map(f => f.id === userId ? { ...f, isOnline: false } : f));
        };

        socket.on('friend_online', handleFriendOnline);
        socket.on('friend_offline', handleFriendOffline);

        return () => {
            socket.off('friend_online', handleFriendOnline);
            socket.off('friend_offline', handleFriendOffline);
        };
    }, [socket, currentUser, token]);

    // ── SOCIAL ACTIONS ──────────────────────────────────────────────
    const sendRequest = async (targetId: string) => {
        if (!token) return { success: false, error: 'Not logged in' };
        try {
            const res = await fetch(`${API_URL}/friends/request`, {
                method: 'POST', headers: getHeaders(), body: JSON.stringify({ targetId })
            });
            const data = await res.json();
            if (res.ok) {
                fetchFriends();
                return { success: true, message: data.message };
            }
            return { success: false, error: data.error };
        } catch { return { success: false, error: 'Network error' }; }
    };

    const acceptRequest = async (targetId: string) => {
        if (!token) return { success: false };
        try {
            const res = await fetch(`${API_URL}/friends/accept`, {
                method: 'POST', headers: getHeaders(), body: JSON.stringify({ targetId })
            });
            if (res.ok) {
                fetchFriends();
                return { success: true };
            }
            return { success: false };
        } catch { return { success: false }; }
    };

    const removeFriend = async (targetId: string) => {
        if (!token) return { success: false };
        try {
            const res = await fetch(`${API_URL}/friends/remove`, {
                method: 'POST', headers: getHeaders(), body: JSON.stringify({ targetId })
            });
            if (res.ok) {
                fetchFriends();
                return { success: true };
            }
            return { success: false };
        } catch { return { success: false }; }
    };

    const searchUsers = async (query: string) => {
        if (!token || query.length < 3) return [];
        try {
            const res = await fetch(`${API_URL}/friends/search?q=${query}`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                return data.results;
            }
            return [];
        } catch { return []; }
    };

    return {
        currentUser,
        token,
        setToken,
        logout,
        friends,
        incomingRequests,
        outgoingRequests,
        sendRequest,
        acceptRequest,
        removeFriend,
        searchUsers,
        refresh: fetchFriends
    };
}
