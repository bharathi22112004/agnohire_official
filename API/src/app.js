import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './configs/env.js';
import { corsOptions } from './configs/cors.js';
import { connectDB } from './configs/db.js';
import { socketService } from './services/socket.service.js';
import { initNotificationSocket } from './sockets/notification.socket.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import sectorsRoutes from './routes/sectors.routes.js';
import candidatesRoutes from './routes/candidates.routes.js';
import interviewsRoutes from './routes/interviews.routes.js';
import questionsRoutes from './routes/questions.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// Socket.IO
const io = new Server(httpServer, {
  cors: corsOptions,
  path: '/socket.io',
});
socketService.init(io);
initNotificationSocket(io);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
    },
  },
}));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.isDev ? 'dev' : 'combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.isDev ? 5000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});
app.use('/api', limiter);
app.use('/api/v1/auth/login', authLimiter);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API Routes
const API = '/api/v1';
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/users`, usersRoutes);
app.use(`${API}/sectors`, sectorsRoutes);
app.use(`${API}/candidates`, candidatesRoutes);
app.use(`${API}/interviews`, interviewsRoutes);
app.use(`${API}/questions`, questionsRoutes);
app.use(`${API}/notifications`, notificationsRoutes);
app.use(`${API}/analytics`, analyticsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.path} not found` } });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    error: { code: 'SERVER_ERROR', message: env.isDev ? err.message : 'Internal server error' },
  });
});

// Start server
async function start() {
  await connectDB();
  httpServer.listen(env.port, () => {
    console.log(`
╔══════════════════════════════════════════╗
║          AgnoHire API Server             ║
║  Port: ${env.port}  |  Mode: ${env.nodeEnv.padEnd(12)}║
╚══════════════════════════════════════════╝
    `);
  });
}

start();
