import { Router } from 'express';
import * as roleController from '../controllers/role.controller';
import { authenticate, requirePlatformAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Retrieve all platform roles
router.get('/', authenticate, requirePlatformAdmin, roleController.listRoles);

export default router;
