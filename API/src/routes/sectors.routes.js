import { Router } from 'express';
import { sectorsController } from '../controllers/sectors.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import { auditMiddleware } from '../middlewares/audit.middleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/', rbac('superadmin', 'admin', 'hr', 'recruiter'), sectorsController.list);
router.get('/:id', rbac('superadmin', 'admin', 'hr'), sectorsController.getOne);
router.get('/:id/domains', sectorsController.getDomains);
router.post('/', rbac('superadmin'), auditMiddleware('CREATE_SECTOR', 'sectors'), sectorsController.create);
router.put('/:id', rbac('superadmin'), auditMiddleware('UPDATE_SECTOR', 'sectors'), sectorsController.update);
router.delete('/:id', rbac('superadmin'), auditMiddleware('DELETE_SECTOR', 'sectors'), sectorsController.remove);

export default router;
