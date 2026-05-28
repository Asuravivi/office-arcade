import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import db from './db';
import roomManager from './roomManager';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

// ─── A5 FIX: JWT secret from environment, fail with clear warning ─────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.warn('\x1b[33m⚠  WARNING: JWT_SECRET env var not set. Using insecure default — NEVER use in production!\x1b[0m');
}
const SECRET = JWT_SECRET || 'insecure_fallback_set_JWT_SECRET_in_dotenv';

// B2 FIX: Restrict CORS to known origin
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '10kb' })); // prevent large payload attacks

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGIN,
        methods: ['GET', 'POST']
    }
});

// Conditionally setup Redis adapter if REDIS_URL is provided
const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL) {
    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('Redis adapter connected to Socket.io');
    }).catch(err => console.error('Redis connection error:', err));
}

// ─── B4 FIX: Rate limiting on auth endpoints ────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 60 * 1000,      // 1 minute
    max: 10,                   // 10 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, slow down.' }
});

// ─── B1 FIX: JWT auth middleware for protected routes ───────────────────────
function requireAuth(req: Request, res: Response, next: NextFunction): any {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
        const decoded = jwt.verify(token, SECRET) as { userId: number; username: string };
        (req as any).user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// ─── B5 FIX: Input sanitization helpers ─────────────────────────────────────
function sanitizeUsername(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.length > 20) return null;
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return null; // alphanumeric + underscore only
    return trimmed;
}

function sanitizeNickname(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().slice(0, 20);
    return trimmed.length >= 1 ? trimmed : null;
}

// Valid game types for score submission
const VALID_GAMES = new Set(['donkey', 'uno', 'chess', 'ludo', 'snakeladder', 'snake', 'tetris', 'flappybird', 'shooter', 'solo2048']);

// ─── Daily Challenges Background Job ──────────────────────────────────────────
// Runs every hour to check if a new daily challenge needs to be generated for a new day
setInterval(async () => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const existing = await db.dailyChallenge.findFirst({
            where: { date: { gte: new Date(`${todayStr}T00:00:00Z`), lt: new Date(`${todayStr}T23:59:59Z`) } }
        });
        
        if (!existing) {
            const challenges = [
                { desc: 'Win 3 UNO games', type: 'WIN_UNO', val: 3, reward: 500 },
                { desc: 'Win 2 Chess games', type: 'WIN_CHESS', val: 2, reward: 500 },
                { desc: 'Reach 2048', type: 'SCORE_SOLO2048', val: 2048, reward: 200 },
                { desc: 'Score 10,000 in Tetris', type: 'SCORE_TETRIS', val: 10000, reward: 300 }
            ];
            const pick = challenges[Math.floor(Math.random() * challenges.length)];
            
            const newChall = await db.dailyChallenge.create({
                data: {
                    description: pick.desc,
                    targetType: pick.type,
                    targetValue: pick.val,
                    coinReward: pick.reward
                }
            });
            console.log(`[Challenges] Generated new Daily Challenge: ${pick.desc}`);
            io.emit('newDailyChallenge', newChall);
        }
    } catch (e) {
        console.error('[Challenges] Error generating daily challenge:', e);
    }
}, 1000 * 60 * 60); // Check every hour

// ─── Basic routes ─────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
    res.json({ status: 'Arcade Server running 🎮' });
});

app.get('/api/highscores', async (_req: Request, res: Response) => {
    try {
        const game = (_req.query.game as string) || undefined;
        const rows = await db.highScore.findMany({
            where: game ? { game } : undefined,
            orderBy: { score: 'desc' },
            take: 50,
            select: { game: true, nickname: true, score: true, createdAt: true }
        });
        res.json(rows.map((r: typeof rows[0]) => ({ ...r, created_at: r.createdAt })));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Auth routes (rate limited) ───────────────────────────────────────────────
app.post('/api/register', authLimiter, async (req: Request, res: Response): Promise<any> => {
    const username = sanitizeUsername(req.body.username);
    const { password } = req.body;
    if (!username) return res.status(400).json({ error: 'Username must be 2-20 alphanumeric characters' });
    if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
        const hash = await bcrypt.hash(password, 10);
        await db.user.create({ data: { username, passwordHash: hash } });
        res.json({ success: true, message: 'Registration successful' });
    } catch (err: any) {
        if (err.code === 'P2002') return res.status(400).json({ error: 'Username already exists' });
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', authLimiter, async (req: Request, res: Response): Promise<any> => {
    const username = sanitizeUsername(req.body.username);
    const { password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const user = await db.user.findUnique({ where: { username } });
        if (!user) return res.status(400).json({ error: 'Invalid username or password' });

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return res.status(400).json({ error: 'Invalid username or password' });

        const token = jwt.sign({ userId: user.id, username: user.username }, SECRET, { expiresIn: '24h' });
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                arcade_coins: user.arcadeCoins,
                elo_rating: user.eloRating,
                equipped_avatar: user.equippedAvatar
            }
        });
    } catch {
        res.status(500).json({ error: 'Login failed' });
    }
});

// ─── Charting Proxy ────────────────────────────────────────────────────────
const chartCache = new Map<string, { data: any; expiresAt: number }>();

app.get('/api/chart/:symbol', async (req: Request, res: Response): Promise<any> => {
    const symbol = (req.params.symbol as string || '').toUpperCase();
    const timeframeStr = (req.query.timeframe as string) || '1D';
    const intervalMap: Record<string, number> = {
        '1m': 1,
        '5m': 5,
        '15m': 15,
        '1H': 60,
        '1D': 1440
    };
    const intervalInMinutes = intervalMap[timeframeStr] || 15;

    try {
        const cacheKey = `${symbol}_${intervalInMinutes}`;
        const cached = chartCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return res.json(cached.data);
        }

        // Groww API endpoint for full OHLC candlestick data
        const url = `https://groww.in/v1/api/charting_service/v2/chart/exchange/NSE/segment/CASH/${symbol}/daily?intervalInMinutes=${intervalInMinutes}`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'application/json'
            }
        });

        if (response.data && response.data.candles && response.data.candles.length > 0) {
            // Groww full returns candles as array of arrays: [timestamp, open, high, low, close, volume]
            const formatted = response.data.candles.map((c: any) => ({
                time: c[0],
                open: c[1],
                high: c[2],
                low: c[3],
                close: c[4]
            }));
            
            const lastCandle = formatted[formatted.length - 1];
            const firstCandle = formatted[0];
            const currentPrice = lastCandle.close;
            const change = currentPrice - firstCandle.open;
            const changePercent = ((change / firstCandle.open) * 100).toFixed(2);

            const responseData = {
                candles: formatted,
                currentPrice,
                changePercent,
                change
            };
            
            chartCache.set(cacheKey, { data: responseData, expiresAt: Date.now() + 30000 }); // 30s TTL
            
            return res.json(responseData);
        }
        
        res.status(404).json({ error: 'No data found for symbol' });
    } catch (err: any) {
        console.error('Chart fetch error:', err.message);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
});

app.get('/api/verify', requireAuth, async (req: Request, res: Response): Promise<any> => {
    const { userId } = (req as any).user;
    try {
        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                arcade_coins: user.arcadeCoins,
                elo_rating: user.eloRating,
                equipped_avatar: user.equippedAvatar,
                isAdmin: user.isAdmin
            }
        });
    } catch {
        res.status(500).json({ error: 'Verification failed' });
    }
});

// ─── Admin MOTD (Message of the Day) ──────────────────────────────────────────
app.get('/api/motd', async (req: Request, res: Response): Promise<any> => {
    try {
        const config = await db.systemConfig.findUnique({ where: { key: 'motd' } });
        res.json({ message: config?.value || 'Welcome to the Office Arcade!' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load MOTD' });
    }
});

app.post('/api/motd', requireAuth, async (req: Request, res: Response): Promise<any> => {
    const { userId } = (req as any).user;
    const { message } = req.body;
    
    try {
        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Forbidden: Admins only' });
        }
        
        await db.systemConfig.upsert({
            where: { key: 'motd' },
            update: { value: message },
            create: { key: 'motd', value: message }
        });
        
        // Also broadcast via socket to all connected clients so they see it instantly
        io.emit('motdUpdate', message);
        
        res.json({ success: true, message });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update MOTD' });
    }
});

// ─── Friends API ──────────────────────────────────────────────────────────────
app.get('/api/friends/:username', async (req: Request, res: Response): Promise<any> => {
    const username = sanitizeUsername(req.params.username as string);
    if (!username) return res.status(400).json({ error: 'Invalid username' });
    try {
        const user = await db.user.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        const friends = await db.friend.findMany({
            where: { userId: user.id },
            include: { friend: true }
        });
        res.json(friends.map((f: typeof friends[0]) => ({ username: f.friend.username, status: f.status })));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/friends/add', requireAuth, async (req: Request, res: Response): Promise<any> => {
    const { username, friendUsername } = req.body;
    const cleanUser = sanitizeUsername(username);
    const cleanFriend = sanitizeUsername(friendUsername);
    if (!cleanUser || !cleanFriend) return res.status(400).json({ error: 'Invalid username format' });
    if (cleanUser === cleanFriend) return res.status(400).json({ error: 'Cannot add yourself' });

    // Ensure the authenticated user can only add friends for themselves
    const authUser = (req as any).user;
    if (authUser.username !== cleanUser) return res.status(403).json({ error: 'Forbidden' });

    try {
        const user = await db.user.findUnique({ where: { username: cleanUser } });
        const friend = await db.user.findUnique({ where: { username: cleanFriend } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!friend) return res.status(404).json({ error: 'Friend not found' });

        await db.friend.upsert({
            where: { userId_friendId: { userId: user.id, friendId: friend.id } },
            update: { status: 'accepted' },
            create: { userId: user.id, friendId: friend.id, status: 'accepted' }
        });
        await db.friend.upsert({
            where: { userId_friendId: { userId: friend.id, friendId: user.id } },
            update: { status: 'accepted' },
            create: { userId: friend.id, friendId: user.id, status: 'accepted' }
        });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Economy API (auth required) ──────────────────────────────────────────────
app.get('/api/users/:username', async (req: Request, res: Response): Promise<any> => {
    const username = sanitizeUsername(req.params.username as string);
    if (!username) return res.status(400).json({ error: 'Invalid username' });
    try {
        const user = await db.user.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ error: 'Not found' });
        res.json({ arcade_coins: user.arcadeCoins, equipped_avatar: user.equippedAvatar });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/cosmetics/:username', async (req: Request, res: Response): Promise<any> => {
    const username = sanitizeUsername(req.params.username as string);
    if (!username) return res.status(400).json({ error: 'Invalid username' });
    try {
        const user = await db.user.findUnique({
            where: { username },
            include: { cosmetics: true }
        });
        if (!user) return res.status(404).json({ error: 'Not found' });
        res.json(user.cosmetics.map((c: { userId: number; itemId: string }) => c.itemId));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// B1 FIX: Economy endpoints require authentication
app.post('/api/cosmetics/buy', requireAuth, async (req: Request, res: Response): Promise<any> => {
    const { username, itemId, cost } = req.body;
    const authUser = (req as any).user;

    // Ensure user can only buy for themselves
    if (!username || authUser.username !== username) return res.status(403).json({ error: 'Forbidden' });
    if (!itemId || typeof itemId !== 'string') return res.status(400).json({ error: 'Invalid item' });
    if (!Number.isInteger(cost) || cost <= 0) return res.status(400).json({ error: 'Invalid cost' });

    try {
        const user = await db.user.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ error: 'Not found' });
        if (user.arcadeCoins < cost) return res.status(400).json({ error: 'Not enough coins' });

        await db.$transaction([
            db.user.update({ where: { id: user.id }, data: { arcadeCoins: { decrement: cost } } }),
            db.cosmetic.upsert({
                where: { userId_itemId: { userId: user.id, itemId } },
                update: {},
                create: { userId: user.id, itemId }
            })
        ]);
        res.json({ success: true, coins: user.arcadeCoins - cost });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/cosmetics/equip', requireAuth, async (req: Request, res: Response): Promise<any> => {
    const { username, itemId } = req.body;
    const authUser = (req as any).user;
    if (!username || authUser.username !== username) return res.status(403).json({ error: 'Forbidden' });
    if (!itemId) return res.status(400).json({ error: 'Invalid item' });
    try {
        await db.user.update({ where: { username }, data: { equippedAvatar: itemId } });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Trading APIs ─────────────────────────────────────────────────────────────
app.get('/api/portfolio', requireAuth, async (req: Request, res: Response): Promise<any> => {
    const { userId } = (req as any).user;
    try {
        let portfolio = await db.portfolio.findUnique({ where: { userId } });
        if (!portfolio) {
            portfolio = await db.portfolio.create({ data: { userId } });
        }
        const positions = await db.position.findMany({ where: { userId } });

        // Batch fetch prices using our existing chart cache/endpoint logic
        // For simplicity, we can fetch live prices for each unique symbol
        const livePrices: Record<string, number> = {};
        await Promise.all(positions.map(async pos => {
            const symbol = pos.symbol;
            if (livePrices[symbol]) return;
            try {
                // Try to get from cache first
                const cacheKey = `${symbol}_15`; // Default 15m
                const cached = chartCache.get(cacheKey);
                if (cached && cached.expiresAt > Date.now()) {
                    livePrices[symbol] = cached.data.currentPrice;
                    return;
                }
                // Else fetch
                const url = `https://groww.in/v1/api/charting_service/v2/chart/exchange/NSE/segment/CASH/${symbol}/daily?intervalInMinutes=15`;
                const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const candles = response.data?.candles;
                if (candles && candles.length > 0) {
                    livePrices[symbol] = candles[candles.length - 1][4];
                }
            } catch (e) {
                console.error(`Failed to fetch live price for ${symbol}`);
            }
        }));

        res.json({ portfolio, positions, livePrices });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
});

app.post('/api/trade', requireAuth, async (req: Request, res: Response): Promise<any> => {
    const { userId } = (req as any).user;
    const { symbol, action, quantity } = req.body;

    if (!symbol || !['BUY', 'SELL'].includes(action) || quantity <= 0 || quantity > 10000) {
        return res.status(400).json({ error: 'Invalid trade parameters. Max qty 10,000.' });
    }

    try {
        // Fetch current price (using cache if possible)
        let price = 0;
        const cacheKey = `${symbol}_15`;
        const cached = chartCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            price = cached.data.currentPrice;
        } else {
            const url = `https://groww.in/v1/api/charting_service/v2/chart/exchange/NSE/segment/CASH/${symbol}/daily?intervalInMinutes=15`;
            const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const candles = response.data?.candles;
            if (candles && candles.length > 0) price = candles[candles.length - 1][4];
        }

        if (price <= 0) return res.status(400).json({ error: 'Failed to get live price for symbol' });

        const totalCost = price * quantity;

        // Transaction
        await db.$transaction(async (tx) => {
            let portfolio = await tx.portfolio.findUnique({ where: { userId } });
            if (!portfolio) portfolio = await tx.portfolio.create({ data: { userId } });

            let position = await tx.position.findUnique({ where: { userId_symbol: { userId, symbol } } });

            if (action === 'BUY') {
                if (portfolio.cashBalance < totalCost) throw new Error('Insufficient funds');
                await tx.portfolio.update({ where: { userId }, data: { cashBalance: { decrement: totalCost } } });
                
                if (position) {
                    const newQty = position.quantity + quantity;
                    const newAvg = ((position.averagePrice * position.quantity) + totalCost) / newQty;
                    await tx.position.update({
                        where: { id: position.id },
                        data: { quantity: newQty, averagePrice: newAvg }
                    });
                } else {
                    await tx.position.create({
                        data: { userId, symbol, quantity, averagePrice: price }
                    });
                }
            } else if (action === 'SELL') {
                if (!position || position.quantity < quantity) throw new Error('Not enough shares to sell');
                await tx.portfolio.update({ where: { userId }, data: { cashBalance: { increment: totalCost } } });
                
                const newQty = position.quantity - quantity;
                if (newQty === 0) {
                    await tx.position.delete({ where: { id: position.id } });
                } else {
                    await tx.position.update({
                        where: { id: position.id },
                        data: { quantity: newQty }
                    });
                }
            }

            await tx.tradeHistory.create({
                data: { userId, symbol, type: action, quantity, price }
            });

            // If challenge tracking, update it
            const todayStr = new Date().toISOString().split('T')[0];
            const challenge = await tx.dailyChallenge.findFirst({
                where: { date: { gte: new Date(`${todayStr}T00:00:00Z`), lt: new Date(`${todayStr}T23:59:59Z`) } }
            });
            if (challenge && challenge.targetType === 'TRADE_PROFIT' && action === 'SELL') {
                const profit = (price - (position?.averagePrice || 0)) * quantity;
                if (profit > 0) {
                    const uc = await tx.userChallenge.upsert({
                        where: { userId_challengeId: { userId, challengeId: challenge.id } },
                        create: { userId, challengeId: challenge.id, progress: profit },
                        update: { progress: { increment: profit } }
                    });
                    if (!uc.isCompleted && uc.progress >= challenge.targetValue) {
                        await tx.userChallenge.update({ where: { id: uc.id }, data: { isCompleted: true } });
                        await tx.user.update({ where: { id: userId }, data: { arcadeCoins: { increment: challenge.coinReward } } });
                    }
                }
            }
        });

        res.json({ success: true, message: `Successfully ${action === 'BUY' ? 'bought' : 'sold'} ${quantity} shares of ${symbol}` });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// ─── Phase 4 APIs ─────────────────────────────────────────────────────────────
app.get('/api/challenges/daily', async (req: Request, res: Response): Promise<any> => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const challenge = await db.dailyChallenge.findFirst({
            where: { date: { gte: new Date(`${todayStr}T00:00:00Z`), lt: new Date(`${todayStr}T23:59:59Z`) } },
            orderBy: { date: 'desc' }
        });
        res.json({ challenge });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
});

app.get('/api/admin/analytics', requireAuth, async (req: Request, res: Response): Promise<any> => {
    const authUser = (req as any).user;
    try {
        const user = await db.user.findUnique({ where: { id: authUser.userId } });
        if (!user || !user.isAdmin) return res.status(403).json({ error: 'Forbidden' });

        const totalUsers = await db.user.count();
        const totalTrades = await db.tradeHistory.count();
        const totalRooms = roomManager.getRoomsList().length;
        const totalCoins = await db.user.aggregate({ _sum: { arcadeCoins: true } });

        res.json({
            users: totalUsers,
            trades: totalTrades,
            activeRooms: totalRooms,
            economy: totalCoins._sum.arcadeCoins || 0
        });
    } catch (e) {
        res.status(500).json({ error: 'Analytics failed' });
    }
});

// ─── Price Alerts API ─────────────────────────────────────────────────────────
app.post('/api/alerts', requireAuth, async (req: Request, res: Response): Promise<any> => {
    const { userId } = (req as any).user;
    const { symbol, targetPrice, condition } = req.body;
    try {
        const alert = await db.priceAlert.create({
            data: { userId, symbol, target: targetPrice, condition }
        });
        res.json({ success: true, alert });
    } catch (e) {
        res.status(500).json({ error: 'Failed to create alert' });
    }
});

// Price Alert Worker
setInterval(async () => {
    try {
        const alerts = await db.priceAlert.findMany({ where: { isTriggered: false } });
        if (alerts.length === 0) return;
        
        const symbols = [...new Set(alerts.map(a => a.symbol))];
        const prices: Record<string, number> = {};
        
        // Fetch prices
        for (const sym of symbols) {
            try {
                const url = `https://groww.in/v1/api/charting_service/v2/chart/exchange/NSE/segment/CASH/${sym}/daily?intervalInMinutes=15`;
                const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const candles = response.data?.candles;
                if (candles && candles.length > 0) {
                    prices[sym] = candles[candles.length - 1][4];
                }
            } catch(e) {}
        }

        // Evaluate alerts
        for (const alert of alerts) {
            const currentPrice = prices[alert.symbol];
            if (!currentPrice) continue;
            
            let triggered = false;
            if (alert.condition === 'ABOVE' && currentPrice >= alert.target) triggered = true;
            if (alert.condition === 'BELOW' && currentPrice <= alert.target) triggered = true;
            
            if (triggered) {
                // Mark alert triggered
                await db.priceAlert.update({ where: { id: alert.id }, data: { isTriggered: true } });
                
                // Create Notification
                const msg = `${alert.symbol} is now ${alert.condition.toLowerCase()} ₹${alert.target} (Current: ₹${currentPrice})`;
                await db.notification.create({
                    data: { userId: alert.userId, title: 'Price Alert Triggered', message: msg }
                });
                
                // If user is online, emit via socket (we need a way to map userId to socket, 
                // for now we broadcast if they are online, but socket doesn't hold db userId easily. 
                // A simpler way is just to let the client fetch notifications on load, or we can broadcast a global hint).
                io.emit('newNotification', { title: 'Price Alert Triggered', message: msg, isRead: false }); // broadcast to all for simplicity in demo
            }
        }
    } catch (e) {
        console.error('Alert worker error', e);
    }
}, 60 * 1000); // Check every minute

// ─── Socket.io ────────────────────────────────────────────────────────────────
let matchmakingQueue: { socketId: string; nickname: string; gameType: string }[] = [];
const socketRateLimits = new Map<string, number>();

io.on('connection', (socket: Socket) => {
    console.log(`[+] Connected: ${socket.id}`);

    let currentNickname: string | null = null;
    let currentRoomId: string | null = null;

    socket.on('joinQueue', (gameType: string) => {
        if (!currentNickname) return;
        matchmakingQueue = matchmakingQueue.filter(p => p.socketId !== socket.id);
        matchmakingQueue.push({ socketId: socket.id, nickname: currentNickname, gameType });
        socket.emit('queueStatus', { status: 'searching' });

        const peers = matchmakingQueue.filter(p => p.gameType === gameType);
        if (peers.length >= 2) {
            const [player1, player2] = peers;
            matchmakingQueue = matchmakingQueue.filter(
                p => p.socketId !== player1.socketId && p.socketId !== player2.socketId
            );
            const room = roomManager.createRoom(`Ranked ${gameType.toUpperCase()}`, player1.socketId, player1.nickname, gameType);
            roomManager.joinRoom(room.id, player2.socketId, player2.nickname);
            io.to(player1.socketId).emit('matchFound', room.id);
            io.to(player2.socketId).emit('matchFound', room.id);
        }
    });

    socket.on('leaveQueue', () => {
        matchmakingQueue = matchmakingQueue.filter(p => p.socketId !== socket.id);
        socket.emit('queueStatus', { status: 'idle' });
    });

    socket.on('setNickname', (rawNickname: unknown) => {
        // B5 FIX: Sanitize nickname from socket
        const nick = sanitizeNickname(rawNickname);
        if (!nick) return;
        currentNickname = nick;
        socket.emit('nicknameSet', nick);

        // Check if this user was disconnected and reconnect them
        const reconnected = roomManager.reconnectUser(nick, socket.id);
        if (reconnected) {
            currentRoomId = reconnected.room.id;
            socket.join(reconnected.room.id);
            // Inform the room that they reconnected
            io.to(reconnected.room.id).emit('roomUpdated', roomManager.getRoomData(reconnected.room.id));
            io.to(reconnected.room.id).emit('newMessage', {
                sender: 'System',
                text: `${nick} has reconnected!`,
                timestamp: new Date().toISOString()
            });
            // If they are in a playing game, they need the latest STATE_UPDATE
            if (reconnected.room.state === 'playing' && reconnected.room.gameState) {
                socket.emit('gameAction', { type: 'STATE_UPDATE', state: reconnected.room.gameState });
            }
        }

        socket.emit('roomsList', roomManager.getRoomsList());
    });

    socket.on('getRooms', () => {
        socket.emit('roomsList', roomManager.getRoomsList());
    });

    socket.on('createRoom', (data: any) => {
        if (!currentNickname) return;
        const { roomName, gameType } = data;
        const room = roomManager.createRoom(roomName || `${currentNickname}'s Game`, socket.id, currentNickname, gameType);
        currentRoomId = room.id;
        socket.join(room.id);
        io.to(room.id).emit('roomUpdated', roomManager.getRoomData(room.id));
        io.emit('roomsList', roomManager.getRoomsList());
    });

    socket.on('joinRoom', (data: any) => {
        if (!currentNickname) return;
        const roomId = typeof data === 'string' ? data : data.roomId;
        const asSpectator = typeof data === 'object' ? data.asSpectator : false;
        
        const room = roomManager.joinRoom(roomId, socket.id, currentNickname, asSpectator);
        if (room) {
            currentRoomId = room.id;
            socket.join(roomId);
            io.to(roomId).emit('roomUpdated', roomManager.getRoomData(roomId));
            io.emit('roomsList', roomManager.getRoomsList());
            
            // If they are joining as spectator to an already playing room, send them state
            if (asSpectator && room.state === 'playing' && room.gameState) {
                socket.emit('gameStarting');
                socket.emit('gameAction', { type: 'STATE_UPDATE', state: room.gameState });
            }
        } else {
            socket.emit('error', 'Cannot join room');
        }
    });

    socket.on('leaveRoom', () => {
        if (currentRoomId) {
            socket.leave(currentRoomId);
            const room = roomManager.leaveRoom(currentRoomId, socket.id);
            if (room) io.to(currentRoomId).emit('roomUpdated', roomManager.getRoomData(currentRoomId));
            io.emit('roomsList', roomManager.getRoomsList());
            currentRoomId = null;
        }
    });

    socket.on('setReady', (isReady: boolean) => {
        if (!currentRoomId) return;
        const room = roomManager.setReady(currentRoomId, socket.id, isReady);
        if (!room) return;

        io.to(currentRoomId).emit('roomUpdated', roomManager.getRoomData(currentRoomId));

        const allReady = Array.from(room.players.values()).every(p => p.isReady);
        const soloGames = ['solo2048', 'snake', 'tetris', 'flappybird'];
        const minPlayers = soloGames.includes(room.gameType) ? 1 : 2;

        if (allReady && room.players.size >= minPlayers) {
            const startedRoom = roomManager.startGame(currentRoomId, (state) => {
                if (currentRoomId) {
                    io.to(currentRoomId).emit('gameAction', { type: 'STATE_UPDATE', state });
                }
            });
            if (startedRoom) {
                // Emit roomUpdated FIRST, then gameStarting
                io.to(currentRoomId).emit('roomUpdated', roomManager.getRoomData(currentRoomId));
                io.to(currentRoomId).emit('gameStarting');
                
                // If it has authoritative state, push the initial state
                if (startedRoom.gameState) {
                    io.to(currentRoomId).emit('gameAction', { type: 'STATE_UPDATE', state: startedRoom.gameState });
                }
                
                io.emit('roomsList', roomManager.getRoomsList());
            }
        }
    });

    socket.on('restartRoom', () => {
        if (!currentRoomId) return;
        const room = roomManager.getRoom(currentRoomId);
        if (room) {
            room.state = 'lobby';
            room.players.forEach(p => p.isReady = false);
            io.to(currentRoomId).emit('roomUpdated', roomManager.getRoomData(currentRoomId));
            io.emit('roomsList', roomManager.getRoomsList());
        }
    });

    // ─── WebRTC Signaling ───────────────────────────────────────────────────────
    socket.on('webrtc_offer', (data: { targetId: string; offer: any }) => {
        if (!currentRoomId || !currentNickname) return;
        io.to(data.targetId).emit('webrtc_offer', { senderId: socket.id, senderName: currentNickname, offer: data.offer });
    });

    socket.on('webrtc_answer', (data: { targetId: string; answer: any }) => {
        if (!currentRoomId) return;
        io.to(data.targetId).emit('webrtc_answer', { senderId: socket.id, answer: data.answer });
    });

    socket.on('webrtc_ice_candidate', (data: { targetId: string; candidate: any }) => {
        if (!currentRoomId) return;
        io.to(data.targetId).emit('webrtc_ice_candidate', { senderId: socket.id, candidate: data.candidate });
    });

    // ─── Game Logic ─────────────────────────────────────────────────────────────

    socket.on('sendMessage', (message: string) => {
        if (!currentRoomId || !currentNickname) return;
        if (typeof message !== 'string' || message.length > 500) return;
        io.to(currentRoomId).emit('newMessage', {
            sender: currentNickname,
            text: message.trim(),
            timestamp: new Date().toISOString()
        });
    });

    socket.on('sendGlobalMessage', (message: string) => {
        if (!currentNickname) return;
        if (typeof message !== 'string' || message.length > 500) return;
        io.emit('globalMessage', {
            sender: currentNickname,
            text: message.trim(),
            timestamp: new Date().toISOString()
        });
    });

    socket.on('panicStatus', ({ isPanicked }: { isPanicked: boolean }) => {
        if (!currentRoomId) return;
        const room = roomManager.setPanic(currentRoomId, socket.id, isPanicked);
        if (room) io.to(currentRoomId).emit('roomUpdated', roomManager.getRoomData(currentRoomId));
    });

    socket.on('gameAction', (actionData: any) => {
        const now = Date.now();
        const last = socketRateLimits.get(socket.id) || 0;
        if (now - last < 50) return; // max 20 actions/sec per user
        socketRateLimits.set(socket.id, now);

        if (currentRoomId) {
            const room = roomManager.getRoom(currentRoomId);
            if (!room) return;

            if (room.gameType === 'chess' || room.gameType === 'uno') {
                actionData.senderId = socket.id;
                const updatedRoom = roomManager.processGameAction(currentRoomId, actionData);
                if (updatedRoom) {
                    io.to(currentRoomId).emit('gameAction', { type: 'STATE_UPDATE', state: updatedRoom.gameState });
                    // Inform about game over
                    if (updatedRoom.state === 'finished') {
                        io.to(currentRoomId).emit('roomUpdated', roomManager.getRoomData(currentRoomId));
                    }
                }
            } else {
                io.to(currentRoomId).emit('gameAction', {
                    senderId: socket.id,
                    nickname: currentNickname,
                    ...actionData
                });
            }
        }
    });

    socket.on('addBot', ({ difficulty }: { difficulty: string }) => {
        if (!currentRoomId) return;
        const validDifficulties = ['easy', 'medium', 'hard'];
        const safeDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'medium';
        const room = roomManager.addBot(currentRoomId, safeDifficulty);
        if (room) {
            io.to(currentRoomId).emit('roomUpdated', roomManager.getRoomData(currentRoomId));
            io.emit('roomsList', roomManager.getRoomsList());
        }
    });

    socket.on('removeBot', (botId: string) => {
        if (!currentRoomId) return;
        const room = roomManager.removeBot(currentRoomId, botId);
        if (room) {
            io.to(currentRoomId).emit('roomUpdated', roomManager.getRoomData(currentRoomId));
            io.emit('roomsList', roomManager.getRoomsList());
        }
    });

    // B3 FIX: Validate score submission server-side
    socket.on('submitScore', async (data: any) => {
        if (!currentNickname || !data.game || !data.score) return;
        if (!VALID_GAMES.has(data.game)) return; // reject unknown game names
        const score = parseInt(data.score, 10);
        if (!Number.isFinite(score) || score < 0 || score > 1_000_000) return; // reject invalid scores

        try {
            await db.highScore.create({ data: { game: data.game, nickname: currentNickname, score } });
            const coinsEarned = Math.max(5, Math.floor(score / 10));
            // Only award coins if user exists in DB
            await db.user.updateMany({
                where: { username: currentNickname },
                data: { arcadeCoins: { increment: coinsEarned } }
            });
        } catch (err) {
            console.error('Error saving score:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Disconnected: ${socket.id}`);
        matchmakingQueue = matchmakingQueue.filter(p => p.socketId !== socket.id);
        socketRateLimits.delete(socket.id);
        
        if (currentRoomId && currentNickname) {
            const roomIdSnapshot = currentRoomId;
            const socketIdSnapshot = socket.id;
            const nicknameSnapshot = currentNickname;

            // Mark as disconnected. Wait 30 seconds before kicking.
            roomManager.markDisconnected(roomIdSnapshot, socketIdSnapshot, () => {
                const room = roomManager.leaveRoom(roomIdSnapshot, socketIdSnapshot);
                if (room) {
                    io.to(roomIdSnapshot).emit('roomUpdated', roomManager.getRoomData(roomIdSnapshot));
                    io.to(roomIdSnapshot).emit('newMessage', {
                        sender: 'System',
                        text: `${nicknameSnapshot} abandoned the match.`,
                        timestamp: new Date().toISOString()
                    });
                }
                io.emit('roomsList', roomManager.getRoomsList());
            });

            // Immediately let the room know they are disconnected
            io.to(roomIdSnapshot).emit('roomUpdated', roomManager.getRoomData(roomIdSnapshot));
        }
    });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Arcade Server listening on port ${PORT}`);
    console.log(`   CORS origin: ${ALLOWED_ORIGIN}`);
    console.log(`   JWT: ${JWT_SECRET ? 'Loaded from env ✓' : '⚠ Insecure fallback'}`);
});
