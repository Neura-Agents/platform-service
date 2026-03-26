import { Router } from 'express';
import * as roleController from '../controllers/role.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Retrieve all platform roles
router.get('/', authenticate, roleController.listRoles);

export default router;
