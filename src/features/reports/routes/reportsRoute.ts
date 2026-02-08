import { Router } from 'express';
import * as reportsController from '../controller/reports.controller.js';
import { authenticateToken, requireRole } from '../../../middleware/auth.js';

const router = Router();

// GET /api/v1/reports/sales - Combined sales report (invoices + orders), same shape as invoice report
router.get(
  '/sales',
  authenticateToken,
  requireRole('super-admin', 'staff'),
  reportsController.getSalesReport,
);

export default router;
