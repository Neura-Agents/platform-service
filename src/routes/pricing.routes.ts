import { Router } from 'express';
import { getPricingPlans } from '../controllers/pricing.controller';

const router = Router();

router.get('/', getPricingPlans);

export default router;
