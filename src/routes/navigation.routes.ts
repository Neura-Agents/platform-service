import { Router } from 'express';
import { NavigationController } from '../controllers/navigation.controller';

const router = Router();

router.get('/', (req, res) => NavigationController.getNavigation(req, res));

export default router;
