import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Chess } from 'chess.js';

// ─── Types ──────────────────────────────────────────────────────────
interface Player {
    socketId: string;
    name: string;
    disconnectedAt?: number; // timestamp for reconnection window
}

interface ChatMessage {
    sender: string;
    text: string;
    timestamp: number;
}

interface RoomState {
    roomId: string;
    game: Chess;
    playerWhite: Player | null;
    playerBlack: Player | null;
    spectators: Map<string, string>; // socketId → name
    chatHistory: ChatMessage[];
    casualMode: boolean;
    createdAt: number;
}

// ─── Room Management ────────────────────────────────────────────────
const rooms = new Map<string, RoomState>();
const socketToRoom = new Map<string, string>(); // socketId → roomId

function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for readability
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Ensure uniqueness
    if (rooms.has(code)) return generateRoomCode();
    return code;
}

function getRoomRole(room: RoomState, socketId: string): 'white' | 'black' | 'spectator' | null {
    if (room.playerWhite?.socketId === socketId) return 'white';
    if (room.playerBlack?.socketId === socketId) return 'black';
    if (room.spectators.has(socketId)) return 'spectator';
    return null;
}

function getRoomSnapshot(room: RoomState) {
    return {
        roomId: room.roomId,
        fen: room.game.fen(),
        pgn: room.game.pgn(),
        turn: room.game.turn(),
        isCheck: room.game.isCheck(),
        isCheckmate: room.game.isCheckmate(),
        isDraw: room.game.isDraw(),
        isGameOver: room.game.isGameOver(),
        history: room.game.history({ verbose: true }),
        playerWhite: room.playerWhite ? { name: room.playerWhite.name, connected: !room.playerWhite.disconnectedAt } : null,
        playerBlack: room.playerBlack ? { name: room.playerBlack.name, connected: !room.playerBlack.disconnectedAt } : null,
        spectatorCount: room.spectators.size,
        casualMode: room.casualMode,
        chatHistory: room.chatHistory.slice(-50), // last 50 messages
    };
}

// Clean up rooms older than 2 hours with no players
setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) {
        const whiteGone = !room.playerWhite || (room.playerWhite.disconnectedAt && now - room.playerWhite.disconnectedAt > 120_000);
        const blackGone = !room.playerBlack || (room.playerBlack.disconnectedAt && now - room.playerBlack.disconnectedAt > 120_000);
        if (whiteGone && blackGone && now - room.createdAt > 7_200_000) {
            rooms.delete(id);
        }
    }
}, 60_000);

// ─── Express + Socket.io ────────────────────────────────────────────
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
    },
    connectionStateRecovery: {
        maxDisconnectionDuration: 60_000, // 60 seconds
        skipMiddlewares: true,
    },
});

// ─── Health endpoint ────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', rooms: rooms.size });
});

// ─── Socket.io Events ───────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[connect] ${socket.id}`);

    // ── Create Room ─────────────────────────────────────────────────
    socket.on('create_room', (data: { playerName: string; casualMode: boolean }, callback) => {
        const roomId = generateRoomCode();
        const room: RoomState = {
            roomId,
            game: new Chess(),
            playerWhite: { socketId: socket.id, name: data.playerName || 'White' },
            playerBlack: null,
            spectators: new Map(),
            chatHistory: [],
            casualMode: data.casualMode ?? false,
            createdAt: Date.now(),
        };
        rooms.set(roomId, room);
        socketToRoom.set(socket.id, roomId);
        socket.join(roomId);

        io.to(socket.id).emit('assign_color', 'w');
        io.to(socket.id).emit('player_assigned', { color: 'w', roomId: roomId });
        console.log(`Joueur ${socket.id} assigné à w dans ${roomId}`);

        callback({
            success: true,
            roomId,
            role: 'white',
            state: getRoomSnapshot(room),
        });

        console.log(`[create_room] ${socket.id} → ${roomId}`);
    });

    // ── Join Room ───────────────────────────────────────────────────
    socket.on('join_room', (data: { roomId: string; playerName: string; previousSocketId?: string }, callback) => {
        const roomId = data.roomId.toUpperCase();
        const room = rooms.get(roomId);

        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        // Check for reconnection — seat was reserved
        const prevId = data.previousSocketId;
        if (prevId) {
            if (room.playerWhite?.socketId === prevId && room.playerWhite.disconnectedAt) {
                // Reconnect as White
                room.playerWhite.socketId = socket.id;
                room.playerWhite.disconnectedAt = undefined;
                socketToRoom.set(socket.id, roomId);
                socket.join(roomId);
                // Re-send color assignment so frontend state is restored
                io.to(socket.id).emit('assign_color', 'w');
                io.to(socket.id).emit('player_assigned', { color: 'w', roomId });
                io.to(roomId).emit('player_reconnected', { role: 'white', name: room.playerWhite.name });
                callback({ success: true, roomId, role: 'white', state: getRoomSnapshot(room) });
                console.log(`[reconnect] ${socket.id} as White in ${roomId}`);
                return;
            }
            if (room.playerBlack?.socketId === prevId && room.playerBlack.disconnectedAt) {
                // Reconnect as Black
                room.playerBlack.socketId = socket.id;
                room.playerBlack.disconnectedAt = undefined;
                socketToRoom.set(socket.id, roomId);
                socket.join(roomId);
                // Re-send color assignment so frontend state is restored
                io.to(socket.id).emit('assign_color', 'b');
                io.to(socket.id).emit('player_assigned', { color: 'b', roomId });
                io.to(roomId).emit('player_reconnected', { role: 'black', name: room.playerBlack.name });
                callback({ success: true, roomId, role: 'black', state: getRoomSnapshot(room) });
                console.log(`[reconnect] ${socket.id} as Black in ${roomId}`);
                return;
            }
        }

        // Normal join logic
        let role: 'white' | 'black' | 'spectator';
        let assignedColor: 'w' | 'b' | null = null;
        if (!room.playerWhite) {
            room.playerWhite = { socketId: socket.id, name: data.playerName || 'White' };
            role = 'white';
            assignedColor = 'w';
        } else if (!room.playerBlack) {
            room.playerBlack = { socketId: socket.id, name: data.playerName || 'Black' };
            role = 'black';
            assignedColor = 'b';
        } else {
            // Room is full — join as spectator
            room.spectators.set(socket.id, data.playerName || 'Spectator');
            role = 'spectator';
        }

        socketToRoom.set(socket.id, roomId);
        socket.join(roomId);

        if (assignedColor) {
            io.to(socket.id).emit('assign_color', assignedColor);
            io.to(socket.id).emit('player_assigned', { color: assignedColor, roomId: roomId });
            console.log(`Joueur ${socket.id} assigné à ${assignedColor} dans ${roomId}`);
        }

        // Notify everyone
        io.to(roomId).emit('player_joined', {
            role,
            name: data.playerName,
            state: getRoomSnapshot(room),
        });

        callback({
            success: true,
            roomId,
            role,
            state: getRoomSnapshot(room),
        });

        console.log(`[join_room] ${socket.id} as ${role} → ${roomId}`);
    });

    // ── Move Made ───────────────────────────────────────────────────
    socket.on('move_made', (data: { from: string; to: string; promotion?: string }, callback) => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId) { callback?.({ success: false, error: 'Not in a room' }); return; }

        const room = rooms.get(roomId);
        if (!room) { callback?.({ success: false, error: 'Room not found' }); return; }

        // Verify it's this player's turn
        const role = getRoomRole(room, socket.id);
        const turnColor = room.game.turn(); // 'w' or 'b'
        if (
            (role === 'white' && turnColor !== 'w') ||
            (role === 'black' && turnColor !== 'b') ||
            role === 'spectator' ||
            role === null
        ) {
            callback?.({ success: false, error: 'Not your turn' });
            return;
        }

        // Validate move with chess.js (anti-spoofing)
        try {
            const move = room.game.move({
                from: data.from,
                to: data.to,
                promotion: data.promotion || 'q',
            });

            if (!move) {
                callback?.({ success: false, error: 'Invalid move' });
                return;
            }

            socket.to(roomId).emit('move_received', { from: data.from, to: data.to, promotion: data.promotion });

            // Explicitly do NOT use io.emit, only send state to OTHERS
            socket.to(roomId).emit('sync_state', getRoomSnapshot(room));

            callback?.({ success: true });
            console.log(`[move] ${roomId} ${move.san} by ${role}`);
        } catch {
            callback?.({ success: false, error: 'Invalid move' });
        }
    });

    // ── Chat Message ────────────────────────────────────────────────
    socket.on('chat_message', (data: { text: string }) => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;

        const role = getRoomRole(room, socket.id);
        let senderName = 'Unknown';
        if (role === 'white') senderName = room.playerWhite?.name || 'White';
        else if (role === 'black') senderName = room.playerBlack?.name || 'Black';
        else if (role === 'spectator') senderName = room.spectators.get(socket.id) || 'Spectator';

        const msg: ChatMessage = {
            sender: senderName,
            text: data.text.slice(0, 200), // Cap message length
            timestamp: Date.now(),
        };

        room.chatHistory.push(msg);
        if (room.chatHistory.length > 100) room.chatHistory.shift(); // Rolling buffer

        io.to(roomId).emit('chat_message', msg);
    });

    // ── Undo Request (only for casual mode) ─────────────────────────
    socket.on('request_undo', (callback) => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || !room.casualMode) { callback?.({ success: false }); return; }

        const role = getRoomRole(room, socket.id);
        if (role !== 'white' && role !== 'black') { callback?.({ success: false }); return; }

        const move = room.game.undo();
        if (move) {
            io.to(roomId).emit('sync_state', getRoomSnapshot(room));
            callback?.({ success: true });
        } else {
            callback?.({ success: false });
        }
    });

    // ── New Game (both players must be present) ─────────────────────
    socket.on('new_game', () => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;

        const role = getRoomRole(room, socket.id);
        if (role !== 'white' && role !== 'black') return;

        room.game = new Chess();
        room.chatHistory.push({
            sender: '📢 System',
            text: 'A new game has started!',
            timestamp: Date.now(),
        });

        io.to(roomId).emit('sync_state', getRoomSnapshot(room));
    });

    // ── Disconnection ───────────────────────────────────────────────
    socket.on('disconnect', () => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;

        const role = getRoomRole(room, socket.id);

        if (role === 'white' && room.playerWhite) {
            room.playerWhite.disconnectedAt = Date.now();
            io.to(roomId).emit('player_disconnected', { role: 'white', name: room.playerWhite.name });
            console.log(`[disconnect] White left ${roomId} — seat reserved 60s`);

            // After 60s, free the seat if not reconnected
            setTimeout(() => {
                if (room.playerWhite?.disconnectedAt) {
                    room.playerWhite = null;
                    io.to(roomId).emit('player_left', { role: 'white' });
                }
            }, 60_000);
        } else if (role === 'black' && room.playerBlack) {
            room.playerBlack.disconnectedAt = Date.now();
            io.to(roomId).emit('player_disconnected', { role: 'black', name: room.playerBlack.name });
            console.log(`[disconnect] Black left ${roomId} — seat reserved 60s`);

            setTimeout(() => {
                if (room.playerBlack?.disconnectedAt) {
                    room.playerBlack = null;
                    io.to(roomId).emit('player_left', { role: 'black' });
                }
            }, 60_000);
        } else if (role === 'spectator') {
            room.spectators.delete(socket.id);
            io.to(roomId).emit('spectator_left', { count: room.spectators.size });
        }

        socketToRoom.delete(socket.id);
    });
});

// ─── Start ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ♟  ChessAntigravity Server`);
    console.log(`  🌐 http://0.0.0.0:${PORT}`);
    console.log(`  🔌 Socket.io ready with connectionStateRecovery\n`);
});
