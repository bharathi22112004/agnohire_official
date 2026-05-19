import { notificationRepository } from '../repositories/notification.repository.js';
import { success, error, paginate } from '../utils/response.js';

export const notificationsController = {
  async list(req, res) {
    try {
      const { page = 1, limit = 20, isRead } = req.query;
      const { notifications, total, unreadCount } = await notificationRepository.findByUser(
        req.user.id,
        { page: parseInt(page), limit: parseInt(limit), isRead: isRead !== undefined ? isRead === 'true' : undefined }
      );
      return success(res, { notifications, unreadCount }, 200, paginate(total, page, limit));
    } catch (err) {
      return error(res, err.message);
    }
  },

  async markRead(req, res) {
    try {
      await notificationRepository.markRead(req.params.id, req.user.id);
      return success(res, { message: 'Notification marked as read' });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async markAllRead(req, res) {
    try {
      await notificationRepository.markAllRead(req.user.id);
      return success(res, { message: 'All notifications marked as read' });
    } catch (err) {
      return error(res, err.message);
    }
  },
};
