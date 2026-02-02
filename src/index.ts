import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import path from 'path';
import { fileURLToPath } from 'url';
import { initSentry } from './config/sentry.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import router from './routes/index.js';
import { initializeDashboardUserIndexes } from './features/auth/repositories/dashboardUser.repository.js';
import { initializeBuyerIndexes } from './features/auth/repositories/buyer.repository.js';
import { initializePaymentIndexes } from './features/payment/repositories/payment.repository.js';
import { initializeProductIndexes } from './features/product/repositories/product.repository.js';
import { initializeInvoiceIndexes } from './features/invoice/repositories/invoice.repository.js';
import { initializeCartIndexes } from './features/cart/repositories/cart.repository.js';
import { createOrderIndexes } from './features/order/models/Order.js';
import { createUnitIndexes } from './features/unit/models/Unit.js';
import { processAutoCancelOrders } from './features/order/jobs/orderAutoCancel.job.js';
import { processAutoCompleteOrders } from './features/order/jobs/orderAutoComplete.job.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

initSentry();

const app = express();
const PORT = process.env.PORT || 3000;

const helmetMiddleware = (() => {
  const helmetAny = helmet as unknown as any;
  return (typeof helmetAny === 'function' ? helmetAny : helmetAny?.default ?? helmetAny?.helmet) as (
    ...args: any[]
  ) => any;
})();

app.use(helmetMiddleware());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  }),
);
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (e.g. product images)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.use('/api/v1', router);

Sentry.setupExpressErrorHandler(app);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Ignore this little intruder!',
  });
});

let appInitPromise: Promise<void> | null = null;

async function ensureAppReady(): Promise<void> {
  if (!appInitPromise) {
    appInitPromise = (async () => {
      await connectDatabase();

      await initializeDashboardUserIndexes();
      await initializeBuyerIndexes();
      await initializePaymentIndexes();
      await initializeProductIndexes();
      await initializeInvoiceIndexes();
      await initializeCartIndexes();
      await createOrderIndexes();
      await createUnitIndexes();
    })();
  }

  await appInitPromise;
}

function startOrderJobs(): void {
  // Run jobs every 5 minutes (300000 ms)
  const JOB_INTERVAL_MS = 5 * 60 * 1000;

  // Initial run after 1 minute
  setTimeout(() => {
    processAutoCancelOrders().catch(console.error);
    processAutoCompleteOrders().catch(console.error);
  }, 60 * 1000);

  // Then run every 5 minutes
  setInterval(() => {
    processAutoCancelOrders().catch(console.error);
    processAutoCompleteOrders().catch(console.error);
  }, JOB_INTERVAL_MS);

  console.log('Order auto-cancel and auto-complete jobs scheduled (every 5 minutes)');
}

async function startServer() {
  try {
    await ensureAppReady();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} environment`);
      startOrderJobs();
    });
  } catch (error) {
    console.error('Failed to start server:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

export { app, startServer };

export default async function handler(req: unknown, res: unknown) {
  await ensureAppReady();
  return (app as unknown as (req: unknown, res: unknown) => unknown)(req, res);
}

const isRunningAsScript = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;
const isVercel = Boolean(process.env.VERCEL);

if (isRunningAsScript && !isVercel) {
  process.on('SIGTERM', async () => {
    await closeDatabase();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await closeDatabase();
    process.exit(0);
  });

  startServer();
}
