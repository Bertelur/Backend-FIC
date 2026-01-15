import { Router } from 'express';
import * as invoiceController from '../controller/invoice.controller.js';
import { authenticateToken, requireRole, requireUserType } from '../../../middleware/auth.js';

const router = Router();

// Buyer: list own invoices
router.get('/my', authenticateToken, requireUserType('buyer'), invoiceController.getMyInvoices);

// Dashboard: list all invoices (optionally filter by userId)
router.get('/', authenticateToken, requireRole('admin', 'super-admin', 'keuangan', 'staff'), invoiceController.getInvoices);

// Dashboard: overview stats for dashboard cards
router.get(
  '/overview',
  authenticateToken,
  requireRole('admin', 'super-admin', 'keuangan', 'staff'),
  invoiceController.getInvoicesOverview,
);

// Dashboard: invoice detail
router.get(
  '/:id',
  authenticateToken,
  requireRole('admin', 'super-admin', 'keuangan', 'staff'),
  invoiceController.getInvoiceDetails,
);

export default router;
