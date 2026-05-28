import { env } from './env.js';

export const corsOptions = {
  origin: (origin, callback) => {
    const allowed = [
      env.clientUrl,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];

    // Dynamically check if origin belongs to a local network interface in development mode
    const isLocalNetwork = env.isDev && origin && (
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
      /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
      /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/.test(origin)
    );

    if (!origin || allowed.includes(origin) || isLocalNetwork) {
      callback(null, true);
    } else {
      console.log(`[CORS Blocked] Origin requested: "${origin}"`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
};
