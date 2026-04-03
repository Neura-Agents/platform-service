import { Router } from 'express';
import { NavigationController } from '../controllers/navigation.controller';
import { tryAuthenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', tryAuthenticate, (req, res) => NavigationController.getNavigation(req, res));

export default router;
