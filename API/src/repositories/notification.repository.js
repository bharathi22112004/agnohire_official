import { prisma } from '../configs/db.js';

export const notificationRepository = {
  async create(data) {
    return prisma.notification.create({ data });
  },

  async createMany(notifications) {
    return prisma.notification.createMany({ data: notifications });
  },

  async findByUser(userId, { page = 1, limit = 20, isRead } = {}) {
    const where = {
      userId,
      ...(isRead !== undefined && { isRead }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, total, unreadCount };
  },

  async markRead(id, userId) {
    return prisma.notification.update({
      where: { id, userId },
      data: { isRead: true },
    });
  },

  async markAllRead(userId) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },
};
