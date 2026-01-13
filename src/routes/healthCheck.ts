import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    await db.admin().ping();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
