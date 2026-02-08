import express, { Request, Response } from 'express';
import authRouter from '../features/auth/routes/authRoute.js';
import adminRouter from '../features/admin/routes/adminRoute.js';
import paymentRouter from '../features/payment/routes/paymentRoute.js';
import productRouter from '../features/product/routes/productRoute.js';
import invoiceRouter from '../features/invoice/routes/invoiceRoute.js';
import cartRouter from '../features/cart/routes/cartRoute.js';
import orderRouter from '../features/order/routes/orderRoute.js';
import unitRouter from '../features/unit/routes/unitRoute.js';
import customersRouter from './customersRoute.js';
import healthCheckRouter from './healthCheck.js';
import suratJalanRouter from './suratJalanRoute.js';
import reportsRouter from '../features/reports/routes/reportsRoute.js';

const router = express.Router();

router.use('/auth', authRouter);

const standardRoutes = [
  { path: '/healthCheck', router: healthCheckRouter },
  { path: '/admin', router: adminRouter },
  { path: '/customers', router: customersRouter },
  { path: '/payments', router: paymentRouter },
  { path: '/products', router: productRouter },
  { path: '/invoices', router: invoiceRouter },
  { path: '/cart', router: cartRouter },
  { path: '/orders', router: orderRouter },
  { path: '/units', router: unitRouter },
  { path: '/surat-jalan', router: suratJalanRouter },
  { path: '/reports', router: reportsRouter },
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
