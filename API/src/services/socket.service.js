import { notificationRepository } from '../repositories/notification.repository.js';

let io = null;

export const socketService = {
  init(socketIO) {
    io = socketIO;
  },

  async notify(userId, { type, title, message, metadata = {} }) {
    const notification = await notificationRepository.create({
      userId,
      type,
      title,
      message,
      metadata,
    });

    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notification);
    }

    return notification;
  },

  async notifyMany(userIds, payload) {
    const notifications = await Promise.all(
      userIds.map((userId) => this.notify(userId, payload))
    );
    return notifications;
  },

  emitInterviewStarted(recruiterId, data) {
    if (io) {
      io.to(`user:${recruiterId}`).emit('interview:started', data);
    }
  },

  emitInterviewCompleted(recruiterId, data) {
    if (io) {
      io.to(`user:${recruiterId}`).emit('interview:completed', data);
    }
  },

  emitInterviewValidated(userIds, data) {
    if (io) {
      userIds.forEach((uid) => {
        io.to(`user:${uid}`).emit('interview:validated', data);
      });
    }
  },

  emitProctoringAlert(recruiterId, data) {
    if (io) {
      io.to(`user:${recruiterId}`).emit('interview:proctoring_alert', data);
    }
  },
};
