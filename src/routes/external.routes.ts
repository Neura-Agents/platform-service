import { Router } from 'express';
import { ExternalApiController } from '../controllers/ExternalApiController';

const router = Router();

router.get('/exchange-rates', ExternalApiController.getExchangeRates);

export default router;
