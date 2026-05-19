import { Router } from 'express';
import { candidatesController } from '../controllers/candidates.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';
import { uploadMiddleware } from '../middlewares/upload.middleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/', rbac('superadmin', 'admin', 'hr', 'recruiter'), candidatesController.list);
router.get('/lists', rbac('superadmin', 'admin', 'hr', 'recruiter'), candidatesController.listLists);
router.delete('/lists/:id', rbac('hr', 'admin', 'superadmin'), auditMiddleware('DELETE_CANDIDATE_LIST', 'candidate_lists'), candidatesController.deleteList);
router.get('/:id', rbac('superadmin', 'admin', 'hr', 'recruiter'), candidatesController.getOne);
router.post('/', rbac('superadmin', 'admin', 'hr'), auditMiddleware('CREATE_CANDIDATE', 'candidates'), candidatesController.create);
router.put('/:id', rbac('superadmin', 'admin', 'hr', 'recruiter'), auditMiddleware('UPDATE_CANDIDATE', 'candidates'), candidatesController.update);
router.delete('/:id', rbac('superadmin', 'admin', 'hr'), auditMiddleware('DELETE_CANDIDATE', 'candidates'), candidatesController.remove);

// Bulk upload
router.post('/bulk-upload', rbac('hr', 'superadmin', 'admin'), uploadMiddleware.single('csv'), candidatesController.bulkUpload);

// Assignment
router.post('/assign', rbac('hr', 'admin', 'superadmin'), auditMiddleware('ASSIGN_CANDIDATES', 'candidates'), candidatesController.assign);

// Bulk schedule
router.post('/bulk-schedule', rbac('hr', 'admin', 'superadmin'), auditMiddleware('SCHEDULE_INTERVIEW_BULK', 'candidates'), candidatesController.bulkSchedule);

// Resume upload
router.post('/:id/resume', rbac('hr', 'admin', 'superadmin', 'recruiter'), uploadMiddleware.single('resume'), candidatesController.uploadResume);

export default router;
