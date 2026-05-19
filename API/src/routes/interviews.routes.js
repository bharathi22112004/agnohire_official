import { Router } from 'express';
import { interviewsController } from '../controllers/interviews.controller.js';
import { authMiddleware, optionalAuth } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();

// Public routes (candidate interview flow — no auth)
router.get('/token/:token', interviewsController.getByToken);
router.post('/:id/start', interviewsController.startInterview);
router.post('/:id/submit', interviewsController.submitAnswers);

// Authenticated routes
router.use(authMiddleware);

router.get('/', rbac('superadmin', 'admin', 'hr', 'recruiter'), interviewsController.list);
router.get('/:id', rbac('superadmin', 'admin', 'hr', 'recruiter'), interviewsController.getOne);
router.post('/schedule', rbac('recruiter', 'admin', 'superadmin'), auditMiddleware('SCHEDULE_INTERVIEW', 'interviews'), interviewsController.schedule);
router.post('/bulk-schedule', rbac('recruiter', 'admin', 'superadmin'), auditMiddleware('SCHEDULE_INTERVIEW_BULK', 'interviews'), interviewsController.bulkSchedule);
router.post('/:id/validate', rbac('recruiter'), auditMiddleware('VALIDATE_INTERVIEW', 'interviews'), interviewsController.validate);

export default router;
