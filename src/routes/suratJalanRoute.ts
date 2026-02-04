import { Router } from "express";
import { generateSuratJalan } from "../features/surat-jalan/controller/suratJalan.controller.js";

const router = Router();

// POST /api/surat-jalan/generate - Generate Surat Jalan PDF
router.post("/generate", generateSuratJalan);

export default router;
