import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import { initSentry } from './config/sentry.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import router from './routes/index.js';
import { initializeDashboardUserIndexes } from './features/auth/repositories/dashboardUser.repository.js';
import { initializeBuyerIndexes } from './features/auth/repositories/buyer.repository.js';
import { initializePaymentIndexes } from './features/payment/repositories/payment.repository.js';

dotenv.config();

initSentry();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
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

async function startServer() {
  try {
    await connectDatabase();

    await initializeDashboardUserIndexes();
    await initializeBuyerIndexes();
    await initializePaymentIndexes();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} environment`);
    });
  } catch (error) {
    console.error('Failed to start server:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

startServer();
