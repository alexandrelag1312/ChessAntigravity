import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Chess } from 'chess.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User } from './models/User.js';
import authRoutes from './routes/auth.js';
import friendsRoutes from './routes/friends.js';
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_chess_antigravity';
// ─── Database ───────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL;
if (!MONGODB_URI) {
    console.warn('⚠️ NO MONGODB_URI PROVIDED - Attempting localhost fallback...');
}
else {
    console.log(`[server] MONGODB_URI is configured (Starts with: ${MONGODB_URI.substring(0, 15)}...)`);
}
const connectDB = async () => {
    try {
        mongoose.set('bufferCommands', false); // Fix: Do not wait 10s if DB is offline
        await mongoose.connect(MONGODB_URI || 'mongodb://localhost:27017/chessantigravity', {
            serverSelectionTimeoutMS: 5000 // Non-blocking fast-fail
        });
        console.log('📦 Connected to MongoDB successfully');
    }
    catch (err) {
        console.error('❌ MongoDB Connection Error (Non-Blocking):', err.message);
        console.error('   -> Have you properly set MONGODB_URI in your Railway Variables?');
    }
};
// Start connection asynchronously (non-blocking for HTTP server)
connectDB();
// ─── Room Management ────────────────────────────────────────────────
const rooms = new Map();
const socketToRoom = new Map(); // socketId → roomId
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for readability
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Ensure uniqueness
    if (rooms.has(code))
        return generateRoomCode();
    return code;
}
function getRoomRole(room, socketId) {
    if (room.playerWhite?.socketId === socketId)
        return 'white';
    if (room.playerBlack?.socketId === socketId)
        return 'black';
    if (room.spectators.has(socketId))
        return 'spectator';
    return null;
}
function getRoomSnapshot(room) {
    // Calculate current elapsed time for the active clock
    let clockWhite = room.clockWhite;
    let clockBlack = room.clockBlack;
    if (room.clockStarted && room.lastMoveAt) {
        const elapsed = Math.floor((Date.now() - room.lastMoveAt) / 1000);
        if (room.game.turn() === 'w') {
            clockWhite = Math.max(0, clockWhite - elapsed);
        }
        else {
            clockBlack = Math.max(0, clockBlack - elapsed);
        }
    }
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
        chatHistory: room.chatHistory.slice(-50),
        clockWhite,
        clockBlack,
        clockStarted: room.clockStarted,
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
// ─── Express + Server ───────────────────────────────────────────────
const app = express();
// 1. CORS FIRST (Crucial for 502/503 responses to not be blocked by browser)
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://chess-antigravity.vercel.app',
    credentials: true
}));
// 2. Health Endpoint SECOND (Crucial for Railway to keep the container alive)
app.get('/health', (req, res) => res.status(200).send('OK'));
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
    next();
});
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendsRoutes);
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
    },
    // NOTE: connectionStateRecovery is disabled.
    // Railway does not guarantee sticky sessions, so recovery packets
    // can land on a different node and cause an endless reconnect storm.
});
// ─── Authenticated Social Registry ────────────────────────────────────
// Map<userId (string), Set<socketId (string)>>
const activeUsers = new Map();
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.userId = decoded.id;
            socket.username = decoded.username;
        }
        catch { } // Ignore bad tokens, just treat as guest
    }
    next();
});
// ─── Socket.io Events ───────────────────────────────────────────────
io.on('connection', async (socket) => {
    console.log(`[connect] ${socket.id}`);
    const userId = socket.userId;
    const username = socket.username;
    if (userId) {
        if (!activeUsers.has(userId))
            activeUsers.set(userId, new Set());
        activeUsers.get(userId).add(socket.id);
        console.log(`[auth] User ${username} connected via socket`);
        // Broadcast to friends that we are online
        try {
            const user = await User.findById(userId).populate('friends');
            if (user) {
                user.friends.forEach((friend) => {
                    const friendSocketIds = activeUsers.get(friend._id.toString());
                    if (friendSocketIds) {
                        friendSocketIds.forEach(id => {
                            io.to(id).emit('friend_online', { userId, username });
                        });
                    }
                });
            }
        }
        catch { }
    }
    // ── Create Room ─────────────────────────────────────────────────
    socket.on('create_room', (data, callback) => {
        const roomId = generateRoomCode();
        const room = {
            roomId,
            game: new Chess(),
            playerWhite: { socketId: socket.id, name: data.playerName || 'White' },
            playerBlack: null,
            spectators: new Map(),
            chatHistory: [],
            casualMode: data.casualMode ?? false,
            createdAt: Date.now(),
            clockWhite: 10 * 60,
            clockBlack: 10 * 60,
            clockStarted: false,
            lastMoveAt: null,
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
    socket.on('join_room', (data, callback) => {
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
        let role;
        let assignedColor = null;
        if (!room.playerWhite) {
            room.playerWhite = { socketId: socket.id, name: data.playerName || 'White' };
            role = 'white';
            assignedColor = 'w';
        }
        else if (!room.playerBlack) {
            room.playerBlack = { socketId: socket.id, name: data.playerName || 'Black' };
            role = 'black';
            assignedColor = 'b';
        }
        else {
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
    socket.on('move_made', (data, callback) => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId) {
            callback?.({ success: false, error: 'Not in a room' });
            return;
        }
        const room = rooms.get(roomId);
        if (!room) {
            callback?.({ success: false, error: 'Room not found' });
            return;
        }
        // Verify it's this player's turn
        const role = getRoomRole(room, socket.id);
        const turnColor = room.game.turn(); // 'w' or 'b'
        if ((role === 'white' && turnColor !== 'w') ||
            (role === 'black' && turnColor !== 'b') ||
            role === 'spectator' ||
            role === null) {
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
            // Update clocks
            const now = Date.now();
            if (!room.clockStarted) {
                room.clockStarted = true;
            }
            else if (room.lastMoveAt) {
                const elapsed = Math.floor((now - room.lastMoveAt) / 1000);
                // The player who JUST moved was the previous turn
                if (move.color === 'w') {
                    room.clockWhite = Math.max(0, room.clockWhite - elapsed);
                }
                else {
                    room.clockBlack = Math.max(0, room.clockBlack - elapsed);
                }
            }
            room.lastMoveAt = now;
            console.log(`[move_made] Relaying move to room: ${roomId} | ${move.san} by ${role}`);
            socket.to(roomId).emit('move_received', {
                from: data.from,
                to: data.to,
                promotion: data.promotion,
                clockWhite: room.clockWhite,
                clockBlack: room.clockBlack,
            });
            // Send updated board state to all OTHER players (not sender)
            socket.to(roomId).emit('sync_state', getRoomSnapshot(room));
            // Also return clocks to the sender via callback
            callback?.({ success: true, clockWhite: room.clockWhite, clockBlack: room.clockBlack });
            console.log(`[move_made] ✅ ${roomId} ${move.san} by ${role} → relayed`);
        }
        catch {
            callback?.({ success: false, error: 'Invalid move' });
        }
    });
    // ── Chat Message ────────────────────────────────────────────────
    socket.on('chat_message', (data) => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        const role = getRoomRole(room, socket.id);
        let senderName = 'Unknown';
        if (role === 'white')
            senderName = room.playerWhite?.name || 'White';
        else if (role === 'black')
            senderName = room.playerBlack?.name || 'Black';
        else if (role === 'spectator')
            senderName = room.spectators.get(socket.id) || 'Spectator';
        const msg = {
            sender: senderName,
            text: data.text.slice(0, 200), // Cap message length
            timestamp: Date.now(),
        };
        room.chatHistory.push(msg);
        if (room.chatHistory.length > 100)
            room.chatHistory.shift(); // Rolling buffer
        io.to(roomId).emit('chat_message', msg);
    });
    // ── Undo Request (only for casual mode) ─────────────────────────
    socket.on('request_undo', (callback) => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room || !room.casualMode) {
            callback?.({ success: false });
            return;
        }
        const role = getRoomRole(room, socket.id);
        if (role !== 'white' && role !== 'black') {
            callback?.({ success: false });
            return;
        }
        const move = room.game.undo();
        if (move) {
            io.to(roomId).emit('sync_state', getRoomSnapshot(room));
            callback?.({ success: true });
        }
        else {
            callback?.({ success: false });
        }
    });
    // ── Resignation ─────────────────────────────────────────────────
    socket.on('resign', () => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        const role = getRoomRole(room, socket.id);
        if (role !== 'white' && role !== 'black')
            return;
        const loserColor = role === 'white' ? 'w' : 'b';
        const loserName = role === 'white' ? room.playerWhite?.name : room.playerBlack?.name;
        room.chatHistory.push({
            sender: '📢 System',
            text: `${loserName} has resigned.`,
            timestamp: Date.now(),
        });
        console.log(`[resign] ${role} resigned in ${roomId}`);
        io.to(roomId).emit('opponent_resigned', { loserColor });
        io.to(roomId).emit('sync_state', getRoomSnapshot(room));
    });
    // ── New Game (both players must be present) ─────────────────────
    socket.on('new_game', () => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        const role = getRoomRole(room, socket.id);
        if (role !== 'white' && role !== 'black')
            return;
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
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
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
        }
        else if (role === 'black' && room.playerBlack) {
            room.playerBlack.disconnectedAt = Date.now();
            io.to(roomId).emit('player_disconnected', { role: 'black', name: room.playerBlack.name });
            console.log(`[disconnect] Black left ${roomId} — seat reserved 60s`);
            setTimeout(() => {
                if (room.playerBlack?.disconnectedAt) {
                    room.playerBlack = null;
                    io.to(roomId).emit('player_left', { role: 'black' });
                }
            }, 60_000);
        }
        else if (role === 'spectator') {
            room.spectators.delete(socket.id);
            io.to(roomId).emit('spectator_left', { count: room.spectators.size });
        }
        socketToRoom.delete(socket.id);
        // Notify friends offline
        const userId = socket.userId;
        if (userId) {
            const userSockets = activeUsers.get(userId);
            if (userSockets) {
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    activeUsers.delete(userId);
                    // Broadcast offline
                    User.findById(userId).populate('friends').then(user => {
                        if (user) {
                            user.friends.forEach((friend) => {
                                const friendSocketIds = activeUsers.get(friend._id.toString());
                                if (friendSocketIds) {
                                    friendSocketIds.forEach(id => {
                                        io.to(id).emit('friend_offline', { userId });
                                    });
                                }
                            });
                        }
                    }).catch(() => { });
                }
            }
        }
    });
});
// ─── Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
    console.log(`\n  ♟  ChessAntigravity Server`);
    console.log(`  🌐 Listening on port ${PORT}`);
    console.log(`  🔌 Socket.io ready with connectionStateRecovery\n`);
});
