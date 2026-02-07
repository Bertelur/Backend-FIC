import { Router } from 'express';
import * as unitController from '../controller/unit.controller.js';
import { authenticateToken, requireRole } from '../../../middleware/auth.js';

const router = Router();

// Public: List units (so frontend can populate dropdowns easily)
router.get('/', unitController.getUnits);

// Admin/Staff: Create unit
router.post(
  '/',
  authenticateToken,
  requireRole('super-admin', 'staff'),
  unitController.createUnit
);

// Admin: Update unit (rename)
router.patch(
  '/:id',
  authenticateToken,
  requireRole('super-admin', 'staff'),
  unitController.updateUnit,
);

// Super-Admin: Delete unit
router.delete(
  '/:id',
  authenticateToken,
  requireRole('super-admin'),
  unitController.deleteUnit,
);

export default router;
