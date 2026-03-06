import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export type PlayerRole = 'white' | 'black' | 'spectator' | null;

export interface ChatMessage {
    sender: string;
    text: string;
    timestamp: number;
}

export interface RemoteGameState {
    roomId: string;
    fen: string;
    pgn: string;
    turn: 'w' | 'b';
    isCheck: boolean;
    isCheckmate: boolean;
    isDraw: boolean;
    isGameOver: boolean;
    history: any[]; // verbose history
    playerWhite: { name: string; connected: boolean } | null;
    playerBlack: { name: string; connected: boolean } | null;
    spectatorCount: number;
    casualMode: boolean;
    chatHistory: ChatMessage[];
}

export function useSocket() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [role, setRole] = useState<PlayerRole>(null);
    const [remoteState, setRemoteState] = useState<RemoteGameState | null>(null);
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [error, setError] = useState<string | null>(null);
    const [lastReceivedMove, setLastReceivedMove] = useState<{ from: string; to: string; promotion?: string; timestamp: number } | null>(null);

    const socketRef = useRef<Socket | null>(null);

    // Initialize socket connection
    useEffect(() => {
        // The default fallback '/' works for local dev with the Vite proxy.
        // In production (Vercel), it uses the specified Railway URL.
        const newSocket = io(import.meta.env.VITE_BACKEND_URL || '/', {
            reconnectionDelayMax: 10000,
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
        setStatus('connecting');

        newSocket.on('connect', () => {
            setStatus('connected');
            setError(null);
            console.log(`[socket] connected: ${newSocket.id}`);

            // Handle auto-reconnect if we have stored credentials
            const savedRoom = localStorage.getItem('chess_room_id');
            const savedSocketId = localStorage.getItem('chess_socket_id');
            const savedName = localStorage.getItem('chess_player_name') || 'Player';

            if (savedRoom && savedSocketId && !roomId) {
                console.log(`[socket] attempting auto-reconnect to ${savedRoom}`);
                console.log("Tentative de rejoindre la salle:", savedRoom);
                newSocket.emit('join_room', {
                    roomId: savedRoom,
                    playerName: savedName,
                    previousSocketId: savedSocketId
                }, (res: any) => {
                    if (res.success) {
                        setRoomId(res.roomId);
                        setRole(res.role);
                        setRemoteState(res.state);
                        localStorage.setItem('chess_socket_id', newSocket.id!);
                    } else {
                        // Room likely expired or invalid
                        localStorage.removeItem('chess_room_id');
                        localStorage.removeItem('chess_socket_id');
                    }
                });
            }
        });

        newSocket.on('disconnect', () => {
            setStatus('disconnected');
            console.log('[socket] disconnected');
        });

        newSocket.on('connect_error', (err) => {
            setStatus('disconnected');
            setError('Connection failed. Server might be offline.');
            console.error('[socket] connect_error:', err);
        });

        // ── State Sync ──
        newSocket.on('sync_state', (state: RemoteGameState) => {
            setRemoteState(state);
        });

        newSocket.on('move_received', (move: { from: string; to: string; promotion?: string }) => {
            setLastReceivedMove({ ...move, timestamp: Date.now() });
        });

        newSocket.on('player_joined', (data: { role: string; name: string; state: RemoteGameState }) => {
            setRemoteState(data.state);
        });

        newSocket.on('player_disconnected', (data: { role: string; name: string }) => {
            // Local UI update, but real state comes from sync_state
            console.log(`[socket] ${data.name} disconnected`);
        });

        newSocket.on('player_reconnected', (data: { role: string; name: string }) => {
            console.log(`[socket] ${data.name} reconnected`);
        });

        return () => {
            newSocket.disconnect();
        };
    }, []); // Run once on mount

    // ── Actions ──
    const createRoom = useCallback((playerName: string, casualMode: boolean = false) => {
        if (!socketRef.current) return;
        setError(null);
        socketRef.current.emit('create_room', { playerName, casualMode }, (res: any) => {
            if (res.success) {
                setRoomId(res.roomId);
                setRole(res.role);
                setRemoteState(res.state);
                localStorage.setItem('chess_room_id', res.roomId);
                localStorage.setItem('chess_socket_id', socketRef.current!.id!);
                localStorage.setItem('chess_player_name', playerName);
            } else {
                setError('Failed to create room');
            }
        });
    }, []);

    const joinRoom = useCallback((id: string, playerName: string) => {
        if (!socketRef.current) return;
        setError(null);
        console.log("Tentative de rejoindre la salle:", id);
        socketRef.current.emit('join_room', { roomId: id, playerName }, (res: any) => {
            if (res.success) {
                setRoomId(res.roomId);
                setRole(res.role);
                setRemoteState(res.state);
                // Only save to localStorage if we joined as a player
                if (res.role !== 'spectator') {
                    localStorage.setItem('chess_room_id', res.roomId);
                    localStorage.setItem('chess_socket_id', socketRef.current!.id!);
                    localStorage.setItem('chess_player_name', playerName);
                }
            } else {
                setError(res.error || 'Failed to join room');
            }
        });
    }, []);

    const leaveRoom = useCallback(() => {
        setRoomId(null);
        setRole(null);
        setRemoteState(null);
        localStorage.removeItem('chess_room_id');
        localStorage.removeItem('chess_socket_id');
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current.connect(); // reconnect to get a clean socket without room
        }
    }, []);

    const emitMove = useCallback((from: string, to: string, promotion?: string) => {
        if (!socketRef.current || role === 'spectator') return;
        socketRef.current.emit('move_made', { from, to, promotion }, (res: any) => {
            if (!res.success) {
                console.error('Move rejected by server:', res.error);
                // We could trigger a sync_state request here to fix desync
            }
        });
    }, [role]);

    const sendChat = useCallback((text: string) => {
        if (!socketRef.current || !roomId) return;
        socketRef.current.emit('chat_message', { text });
    }, [roomId]);

    return {
        socket,
        status,
        error,
        roomId,
        role,
        remoteState,
        createRoom,
        joinRoom,
        leaveRoom,
        emitMove,
        sendChat,
        lastReceivedMove,
    };
}
