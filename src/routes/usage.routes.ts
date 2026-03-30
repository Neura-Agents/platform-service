import { Router } from 'express';
import { logUsageEntry, listUsageHistory, getUsageStatsHistory } from '../controllers/usage.controller';

import { authenticate, requirePlatformAdmin, internalAuth } from '../middlewares/auth.middleware';

const router = Router();

// Endpoint for recording usage from internal services (e.g. agent-service)
router.post('/', internalAuth, logUsageEntry);

// Endpoint for listing usage with filters for frontend/dashboards
router.get('/', authenticate, listUsageHistory);
router.get('/stats', authenticate, getUsageStatsHistory);

export default router;
