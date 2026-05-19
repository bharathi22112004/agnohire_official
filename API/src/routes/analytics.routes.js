import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/global', rbac('superadmin'), analyticsController.globalStats);
router.get('/sector/:sectorId?', rbac('superadmin', 'admin', 'hr'), analyticsController.sectorStats);
router.get('/trends', rbac('superadmin', 'admin', 'hr'), analyticsController.interviewTrends);
router.get('/audit-logs', rbac('superadmin'), analyticsController.auditLogs);

export default router;
