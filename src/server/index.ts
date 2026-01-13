import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import * as Sentry from "@sentry/node";
import { initSentry } from "../config/sentry";
import { connectDatabase, closeDatabase } from "../config/database";
import healthRouter from "../routes/health";
import router from "../routes";
import authRouter from "../features/auth/routes/auth.routes";
import { initializeDashboardUserIndexes } from "../features/auth/repositories/dashboardUser.repository";
import { initializeBuyerIndexes } from "../features/auth/repositories/buyer.repository";

dotenv.config();

initSentry();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/", router);

Sentry.setupExpressErrorHandler(app);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

async function startServer() {
  try {
    await connectDatabase();

    // Initialize database indexes
    await initializeDashboardUserIndexes();
    await initializeBuyerIndexes();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await closeDatabase();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  await closeDatabase();
  process.exit(0);
});

startServer();
