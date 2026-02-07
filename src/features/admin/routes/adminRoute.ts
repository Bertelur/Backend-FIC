import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth.js';
import { requireRole } from '../../../middleware/auth.js';
import * as adminController from '../controller/admin.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/dashboard', requireRole('staff', 'super-admin'), adminController.getDashboard);
router.get('/', requireRole('super-admin'), adminController.getAdmins);
router.post('/', requireRole('super-admin'), adminController.createUser);
router.patch('/:id', requireRole('super-admin'), adminController.updateUserRole);
router.delete('/:id', requireRole('super-admin'), adminController.deleteUser);

export default router;
