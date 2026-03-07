import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_chess_antigravity';

// Middleware to protect friend routes
const authenticate = async (req: any, res: any, next: any) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string, username: string };
        req.user = await User.findById(decoded.id);
        if (!req.user) return res.status(404).json({ error: 'User not found' });
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

router.use(authenticate);

// ── GET FRIENDS & REQUESTS ──────────────────────────────────────────
router.get('/', async (req: any, res: any) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('friends', 'username stats')
            .populate('friendRequests.incoming', 'username')
            .populate('friendRequests.outgoing', 'username');

        res.json({
            friends: user?.friends || [],
            requests: user?.friendRequests || { incoming: [], outgoing: [] }
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── SEARCH USERS ────────────────────────────────────────────────────
router.get('/search', async (req: any, res: any) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string' || q.length < 3) {
            return res.json({ results: [] });
        }

        // Find up to 10 users matching the query, excluding self
        const users = await User.find({
            username: { $regex: q, $options: 'i' },
            _id: { $ne: req.user._id }
        })
            .select('username stats.wins')
            .limit(10);

        res.json({ results: users });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── SEND FRIEND REQUEST ─────────────────────────────────────────────
router.post('/request', async (req: any, res: any) => {
    try {
        const { targetId } = req.body;
        if (!targetId || targetId === req.user._id.toString()) {
            return res.status(400).json({ error: 'Invalid target user' });
        }

        const targetUser = await User.findById(targetId);
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        // Check if already friends
        if (req.user.friends.includes(targetId)) {
            return res.status(400).json({ error: 'Already friends' });
        }

        // Check if request already sent or received
        if (req.user.friendRequests.outgoing.includes(targetId) || targetUser.friendRequests.incoming.includes(req.user._id)) {
            return res.status(400).json({ error: 'Request already sent' });
        }

        // If they already sent US a request, accept it automatically
        if (req.user.friendRequests.incoming.includes(targetId)) {
            // Remove requests
            req.user.friendRequests.incoming.pull(targetId);
            targetUser.friendRequests.outgoing.pull(req.user._id);
            // Add to friends
            req.user.friends.push(targetId);
            targetUser.friends.push(req.user._id);

            await req.user.save();
            await targetUser.save();
            return res.json({ message: 'Friend request accepted automatically', status: 'accepted' });
        }

        // Add to outgoing/incoming
        req.user.friendRequests.outgoing.push(targetId);
        targetUser.friendRequests.incoming.push(req.user._id);

        await req.user.save();
        await targetUser.save();

        res.json({ message: 'Friend request sent', status: 'sent' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── ACCEPT FRIEND REQUEST ───────────────────────────────────────────
router.post('/accept', async (req: any, res: any) => {
    try {
        const { targetId } = req.body;

        // Ensure the request actually exists
        if (!req.user.friendRequests.incoming.includes(targetId)) {
            return res.status(400).json({ error: 'No incoming request from this user' });
        }

        const targetUser = await User.findById(targetId);
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        // Remove from requests
        req.user.friendRequests.incoming.pull(targetId);
        targetUser.friendRequests.outgoing.pull(req.user._id);

        // Add to friends
        if (!req.user.friends.includes(targetId)) req.user.friends.push(targetId);
        if (!targetUser.friends.includes(req.user._id)) targetUser.friends.push(req.user._id);

        await req.user.save();
        await targetUser.save();

        res.json({ message: 'Friend request accepted' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── REJECT / CANCEL / REMOVE FRIEND ─────────────────────────────────
router.post('/remove', async (req: any, res: any) => {
    try {
        const { targetId } = req.body;

        const targetUser = await User.findById(targetId);
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        // Pull from everywhere just in case
        req.user.friendRequests.incoming.pull(targetId);
        req.user.friendRequests.outgoing.pull(targetId);
        req.user.friends.pull(targetId);

        targetUser.friendRequests.incoming.pull(req.user._id);
        targetUser.friendRequests.outgoing.pull(req.user._id);
        targetUser.friends.pull(req.user._id);

        await req.user.save();
        await targetUser.save();

        res.json({ message: 'User removed/request cancelled' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
