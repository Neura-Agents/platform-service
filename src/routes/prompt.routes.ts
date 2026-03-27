import { Router } from 'express';
import multer from 'multer';
import { promptController } from '../controllers/prompt.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /backend/api/platform/prompts/upload
router.post('/upload', authenticate, upload.single('file'), promptController.uploadPrompt);

// GET /backend/api/platform/prompts/active/:type
router.get('/active/:type', authenticate, promptController.getActivePrompt);

// GET /backend/api/platform/prompts/list
router.get('/list', authenticate, promptController.listPrompts);

// PUT /backend/api/platform/prompts/:id/activate
router.put('/:id/activate', authenticate, promptController.activatePrompt);

// GET /backend/api/platform/prompts/types
router.get('/types', authenticate, promptController.listPromptTypes);

// PUT /backend/api/platform/prompts/:id/targeting
router.put('/:id/targeting', authenticate, promptController.updateTargeting);

export default router;
