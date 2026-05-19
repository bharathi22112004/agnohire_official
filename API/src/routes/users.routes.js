import { Router } from 'express';
import { usersController } from '../controllers/users.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();
router.use(authMiddleware);

// Profile routes
router.get('/profile/me', usersController.getProfile);
router.put('/profile/update', usersController.updateProfile);

router.get('/', rbac('superadmin', 'admin', 'hr'), usersController.list);

// System configuration routes
router.get('/config/all', rbac('superadmin', 'admin', 'hr', 'recruiter'), usersController.getAllConfigs);
router.put('/config/update', rbac('superadmin', 'admin'), usersController.updateConfig);
router.get('/config/email-templates', rbac('superadmin', 'admin', 'hr'), usersController.listEmailTemplates);
router.post('/config/email-templates/test', rbac('superadmin', 'admin', 'hr'), usersController.sendTestEmail);
router.put('/config/email-templates/:id', rbac('superadmin', 'admin', 'hr'), usersController.updateEmailTemplate);

router.get('/:id', rbac('superadmin', 'admin', 'hr'), usersController.getOne);
router.post('/', rbac('superadmin', 'admin'), auditMiddleware('CREATE_USER', 'users'), usersController.create);
router.put('/:id', rbac('superadmin', 'admin'), auditMiddleware('UPDATE_USER', 'users'), usersController.update);
router.delete('/:id', rbac('superadmin', 'admin'), auditMiddleware('DELETE_USER', 'users'), usersController.remove);

// Recruiter skills
router.get('/:id/skills', rbac('superadmin', 'admin', 'hr', 'recruiter'), usersController.getRecruiterSkills);
router.put('/:recruiterId/skills', rbac('superadmin', 'admin'), usersController.setRecruiterSkills);

export default router;
