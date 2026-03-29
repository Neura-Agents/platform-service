import { Router } from 'express';
import { listFeatures, getFeatureByKey, updateFeature, evaluateFeature, evaluateAllFeatures } from '../controllers/feature.controller';
import { authenticate, requirePlatformAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Evaluate (Publicly available to authenticated users)
router.get('/evaluate/:key', authenticate, evaluateFeature);
router.get('/evaluations', authenticate, evaluateAllFeatures);

// Meta & Management
router.get('/', authenticate, requirePlatformAdmin, listFeatures);
router.get('/:key', authenticate, requirePlatformAdmin, getFeatureByKey);
router.put('/:id', authenticate, requirePlatformAdmin, updateFeature);

export default router;
