import { Router } from 'express';
import { questionsController } from '../controllers/questions.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';

const router = Router();
router.use(authMiddleware);

// Question Banks
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

router.get('/banks', questionsController.listBanks);
router.post('/banks/preview', rbac('superadmin', 'admin', 'recruiter'), upload.single('file'), questionsController.previewBankDocument);
router.post('/banks/upload', rbac('superadmin', 'admin', 'recruiter'), upload.single('file'), questionsController.uploadBankDocument);
router.post('/banks', rbac('superadmin', 'admin', 'recruiter'), questionsController.createBank);
router.put('/banks/:id', rbac('superadmin', 'admin', 'recruiter'), questionsController.updateBank);
router.delete('/banks/:id', rbac('superadmin', 'admin', 'recruiter'), questionsController.deleteBank);

// Questions within a bank
router.get('/banks/:bankId/questions', questionsController.listQuestions);
router.post('/banks/:bankId/questions', rbac('superadmin', 'admin', 'recruiter'), questionsController.createQuestion);
router.put('/banks/:bankId/questions/:qid', rbac('superadmin', 'admin', 'recruiter'), questionsController.updateQuestion);
router.delete('/banks/:bankId/questions/:qid', rbac('superadmin', 'admin', 'recruiter'), questionsController.deleteQuestion);

// AI generation
router.post('/ai-generate', rbac('superadmin', 'admin', 'recruiter'), questionsController.aiGenerateQuestions);

// Get questions for interview (public-ish)
router.get('/for-interview', questionsController.getQuestionsForInterview);

export default router;
