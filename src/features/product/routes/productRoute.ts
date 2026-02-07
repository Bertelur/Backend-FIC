import { Router } from 'express';
import * as productController from '../controller/product.controller.js';
import { authenticateToken, requireRole } from '../../../middleware/auth.js';
import { uploadProductImage } from '../../../middleware/upload.js';

const router = Router();

// Public endpoints
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductDetails);

// Admin: bulk category update (must be before /:id for PATCH)
router.patch(
  '/bulk-category',
  authenticateToken,
  requireRole('super-admin', 'staff'),
  productController.bulkUpdateCategory,
);

// Admin endpoints
router.post(
  '/',
  authenticateToken,
  requireRole('super-admin', 'staff'),
  uploadProductImage.single('image'),
  productController.createProduct,
);

router.put(
  '/:id',
  authenticateToken,
  requireRole('super-admin', 'staff'),
  uploadProductImage.single('image'),
  productController.editProduct,
);

router.delete(
  '/:id',
  authenticateToken,
  requireRole('super-admin'),
  productController.deleteProduct,
);

export default router;
