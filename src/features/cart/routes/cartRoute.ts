import { Router } from 'express';
import * as cartController from '../controller/cart.controller.js';
import { authenticateToken, requireUserType } from '../../../middleware/auth.js';

const router = Router();

// Buyer-only
router.use(authenticateToken, requireUserType('buyer'));

router.get('/my', cartController.getMyCart);
router.post('/items', cartController.addCartItem);
router.put('/items/:productId', cartController.updateCartItem);
router.delete('/items/:productId', cartController.removeCartItem);
router.delete('/clear', cartController.clearCart);

// Create payment invoice from cart
router.post('/checkout', cartController.checkoutCart);

export default router;
