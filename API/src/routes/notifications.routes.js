import { Router } from 'express';
import { notificationsController } from '../controllers/notifications.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/', notificationsController.list);
router.put('/:id/read', notificationsController.markRead);
router.put('/read-all', notificationsController.markAllRead);

export default router;
