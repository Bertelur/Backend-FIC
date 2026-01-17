import { Router } from 'express';
import * as paymentController from '../controller/payment.controller.js';
import { authenticateToken, requireRole } from '../../../middleware/auth.js';

const router = Router();

// Dashboard: list all payments (admin, keuangan only)
router.get('/all', authenticateToken, requireRole('admin', 'super-admin', 'keuangan'), paymentController.getAllPayments);

// Create payment/invoice
router.post('/', authenticateToken, paymentController.createPayment);

// Get user's payments (requires authentication) - must come before /:externalId
router.get('/my', authenticateToken, paymentController.getMyPayments);

// Checkout result: refresh status, finalize cart, and return invoice when paid
router.get('/:externalId/checkout-result', authenticateToken, paymentController.getCheckoutResult);

// Get payment by external ID
router.get('/:externalId', paymentController.getPayment);

// Webhook endpoint for Xendit callbacks
router.post('/webhook', paymentController.webhook);

export default router;
