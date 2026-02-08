import { Router } from "express";
import {
  generateSuratJalan,
  getFromOrder,
  generateFromOrder,
} from "../features/surat-jalan/controller/suratJalan.controller.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = Router();

// Must be before /:id if any - from-order and generate-from-order
router.get(
  "/from-order/:orderId",
  authenticateToken,
  requireRole("super-admin", "staff"),
  getFromOrder
);
router.post(
  "/generate-from-order/:orderId",
  authenticateToken,
  requireRole("super-admin", "staff"),
  generateFromOrder
);

// POST /api/v1/surat-jalan/generate - Generate Surat Jalan PDF (dashboard staff only)
router.post("/generate", authenticateToken, requireRole("super-admin", "staff"), generateSuratJalan);

export default router;
