import express, { Request, Response } from 'express';
import authRouter from '../features/auth/routes/authRoute';
import adminRouter from '../features/admin/routes/adminRoute';
import customersRouter from './customersRoute';
import healthCheckRouter from './healthCheck';

const router = express.Router();

router.use('/auth', authRouter);

const standardRoutes = [
  { path: '/healthCheck', router: healthCheckRouter },
  { path: '/admin', router: adminRouter },
  { path: '/customers', router: customersRouter },
];

standardRoutes.forEach(({ path, router: routeRouter }) => {
  router.use(path, routeRouter);
});

router.get('/', (_req, res) => {
  res.json({
    message: 'Backend-FIC API',
    version: '1.0.0',
    status: 'running',
  });
});

if (process.env.NODE_ENV === 'development') {
  router.get('/debug-sentry', (_req: Request, _res: Response) => {
    throw new Error('Test Sentry error');
  });
}

export default router;
