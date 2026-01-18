import { Router } from 'express';
import * as authController from '../controller/auth.controller.js';
import { authenticateToken } from '../../../middleware/auth.js';

const router = Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.put('/address', authenticateToken as any, authController.updateAddress as any);

export default router;
