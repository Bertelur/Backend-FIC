import { Router } from 'express';
import * as invoiceController from '../controller/invoice.controller.js';
import { authenticateToken, requireRole, requireUserType } from '../../../middleware/auth.js';

const router = Router();

// Buyer: list own invoices
router.get('/my', authenticateToken, requireUserType('buyer'), invoiceController.getMyInvoices);

// Buyer: export own invoices (.xlsx)
router.get('/my/export', authenticateToken, requireUserType('buyer'), invoiceController.exportMyInvoicesExcel);

// Buyer: sales report (JSON)
router.get('/my/report', authenticateToken, requireUserType('buyer'), invoiceController.getMySalesReport);

// Buyer: sales report export (.xlsx)
router.get('/my/report/export', authenticateToken, requireUserType('buyer'), invoiceController.exportMySalesReportExcel);

// Dashboard: list all invoices (optionally filter by userId)
router.get('/', authenticateToken, requireRole('super-admin', 'staff'), invoiceController.getInvoices);

// Dashboard: overview stats for dashboard cards
router.get(
  '/overview',
  authenticateToken,
  requireRole('super-admin', 'staff'),
  invoiceController.getInvoicesOverview,
);

// Dashboard: sales report (JSON)
router.get(
  '/report',
  authenticateToken,
  requireRole('super-admin', 'staff'),
  invoiceController.getSalesReport,
);

// Dashboard: sales report export (.xlsx)
router.get(
  '/report/export',
  authenticateToken,
  requireRole('super-admin', 'staff'),
  invoiceController.exportSalesReportExcel,
);

// Dashboard: export invoices (.xlsx) with optional date range
router.get(
  '/export',
  authenticateToken,
  requireRole('super-admin', 'staff'),
  invoiceController.exportInvoicesExcel,
);

// Dashboard: invoice detail
router.get(
  '/:id',
  authenticateToken,
  requireRole('super-admin', 'staff'),
  invoiceController.getInvoiceDetails,
);

export default router;
