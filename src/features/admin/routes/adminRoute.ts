import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth.js';
import { requireRole } from '../../../middleware/auth.js';
import * as adminController from '../controller/admin.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/dashboard', requireRole('admin', 'staff', 'keuangan', 'super-admin'), adminController.getDashboard);
router.get('/', requireRole('admin', 'super-admin'), adminController.getAdmins);
router.post('/', requireRole('admin', 'super-admin'), adminController.createUser);

export default router;
