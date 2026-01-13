import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth';
import { requireRole } from '../../../middleware/auth';
import * as adminController from '../controller/admin.controller';

const router = Router();

router.use(authenticateToken);

router.get('/dashboard', requireRole('admin', 'staff', 'keuangan', 'super-admin'), adminController.getDashboard);
router.get('/', requireRole('admin', 'super-admin'), adminController.getAdmins);
router.post('/', requireRole('admin', 'super-admin'), adminController.createUser);

export default router;
