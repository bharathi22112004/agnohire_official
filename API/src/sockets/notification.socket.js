import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../configs/db.js';

export function initNotificationSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Unauthorized'));

      const decoded = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { role: true },
      });

      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.id;
    if (!userId) return;

    // Join user room
    socket.join(`user:${userId}`);
    console.log(`Socket connected: user:${userId}`);

    socket.on('notification:mark_read', async (notificationId) => {
      try {
        await prisma.notification.update({
          where: { id: notificationId, userId },
          data: { isRead: true },
        });
      } catch {}
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: user:${userId}`);
    });
  });
}
