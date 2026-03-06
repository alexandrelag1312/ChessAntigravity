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

    // ── THE SINGLE SOURCE OF TRUTH for player identity ──────────────
    const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>(null);
    const [isOnline, setIsOnline] = useState(false);

    const socketRef = useRef<Socket | null>(null);

    const handleColorAssigned = useCallback((color: 'w' | 'b') => {
        console.log(`=== SOCKET: COULEUR REÇUE: ${color} ===`);
        setPlayerColor(color);
        setIsOnline(true);
    }, []);

    // Initialize socket connection
    useEffect(() => {
        const newSocket = io(import.meta.env.VITE_BACKEND_URL || '/', {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            // Do NOT set autoConnect: false — we want it to connect immediately
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
        setStatus('connecting');

        // Track if we've already done the initial auto-reconnect
        let hasAttemptedReconnect = false;

        newSocket.on('connect', () => {
            setStatus('connected');
            setError(null);
            console.log(`[socket] connected: ${newSocket.id}`);

            // Auto-reconnect: only attempt ONCE per mount, not on every reconnect
            if (!hasAttemptedReconnect) {
                hasAttemptedReconnect = true;
                const savedRoom = localStorage.getItem('chess_room_id');
                const savedSocketId = localStorage.getItem('chess_socket_id');
                const savedName = localStorage.getItem('chess_player_name') || 'Player';

                if (savedRoom && savedSocketId) {
                    console.log(`[socket] attempting auto-reconnect to ${savedRoom}`);
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
                            if (res.role === 'white') handleColorAssigned('w');
                            if (res.role === 'black') handleColorAssigned('b');
                        } else {
                            localStorage.removeItem('chess_room_id');
                            localStorage.removeItem('chess_socket_id');
                        }
                    });
                }
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

        // ── Color Assignment — THE CANONICAL PLACE ──────────────────
        newSocket.on('assign_color', (color: 'w' | 'b') => {
            handleColorAssigned(color);
        });

        newSocket.on('player_assigned', (data: { color: 'w' | 'b'; roomId: string }) => {
            console.log(`=== SOCKET: player_assigned → JE SUIS ${data.color} dans ${data.roomId} ===`);
            handleColorAssigned(data.color);
            setRoomId(data.roomId);
        });

        // ── Move Sync — SINGLE HANDLER (no duplicate in useChessGame) ─
        newSocket.on('move_received', (move: { from: string; to: string; promotion?: string }) => {
            console.log('[socket] move_received:', move);
            setLastReceivedMove({ ...move, timestamp: Date.now() });
        });

        // ── Room Events ───────────────────────────────────────────────
        newSocket.on('sync_state', (state: RemoteGameState) => {
            setRemoteState(state);
        });

        newSocket.on('player_joined', (data: { role: string; name: string; state: RemoteGameState }) => {
            setRemoteState(data.state);
            console.log(`[socket] player_joined as ${data.role}`);
        });

        newSocket.on('player_disconnected', (data: { role: string; name: string }) => {
            console.log(`[socket] ${data.name} disconnected`);
        });

        newSocket.on('player_reconnected', (data: { role: string; name: string }) => {
            console.log(`[socket] ${data.name} reconnected`);
        });

        return () => {
            newSocket.disconnect();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Actions ──────────────────────────────────────────────────────
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
                // color is set via the 'assign_color' / 'player_assigned' socket events
            } else {
                setError('Failed to create room');
            }
        });
    }, []);

    const joinRoom = useCallback((id: string, playerName: string) => {
        if (!socketRef.current) return;
        setError(null);
        console.log('[socket] Tentative de rejoindre la salle:', id);
        socketRef.current.emit('join_room', { roomId: id, playerName }, (res: any) => {
            if (res.success) {
                setRoomId(res.roomId);
                setRole(res.role);
                setRemoteState(res.state);
                if (res.role !== 'spectator') {
                    localStorage.setItem('chess_room_id', res.roomId);
                    localStorage.setItem('chess_socket_id', socketRef.current!.id!);
                    localStorage.setItem('chess_player_name', playerName);
                }
                // color is set via the 'assign_color' / 'player_assigned' socket events
            } else {
                setError(res.error || 'Failed to join room');
            }
        });
    }, []);

    const leaveRoom = useCallback(() => {
        setRoomId(null);
        setRole(null);
        setRemoteState(null);
        setPlayerColor(null);
        setIsOnline(false);
        localStorage.removeItem('chess_room_id');
        localStorage.removeItem('chess_socket_id');
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current.connect();
        }
    }, []);

    const emitMove = useCallback((from: string, to: string, promotion?: string) => {
        if (!socketRef.current || role === 'spectator') return;
        console.log('[socket] emitting move_made:', { from, to, promotion });
        socketRef.current.emit('move_made', { from, to, promotion }, (res: any) => {
            if (res && !res.success) {
                console.error('[socket] Move rejected by server:', res.error);
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
        playerColor,
        isOnline,
        createRoom,
        joinRoom,
        leaveRoom,
        emitMove,
        sendChat,
        lastReceivedMove,
    };
}
