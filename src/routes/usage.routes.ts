import { Router } from 'express';
import { logUsageEntry, listUsageHistory, getUsageStatsHistory } from '../controllers/usage.controller';

const router = Router();

// Endpoint for recording usage from internal services (e.g. agent-service)
router.post('/', logUsageEntry);

// Endpoint for listing usage with filters for frontend/dashboards
router.get('/', listUsageHistory);
router.get('/stats', getUsageStatsHistory);

export default router;
