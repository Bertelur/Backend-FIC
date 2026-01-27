import { Router } from 'express';
import * as orderController from '../controller/order.controller.js';
import { authenticateToken } from '../../../middleware/auth.js';

const router = Router();

router.post('/', authenticateToken, orderController.createOrder);
router.get('/', authenticateToken, orderController.listOrders);
router.get('/:id', authenticateToken, orderController.getOrderById);
router.patch('/:id/status', authenticateToken, orderController.updateOrderStatus);

export default router;
