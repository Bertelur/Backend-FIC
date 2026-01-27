import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import * as buyerRepo from '../features/auth/repositories/buyer.repository.js';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', requireRole('super-admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const customers = await buyerRepo.findAllBuyers();

    const customersWithoutPassword = customers.map(({ password, ...customer }) => ({
      ...customer,
      password: undefined,
    }));

    res.status(200).json({
      message: 'Customers list',
      customers: customersWithoutPassword,
      count: customers.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch customers',
    });
  }
});

export default router;
