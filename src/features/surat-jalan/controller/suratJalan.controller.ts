import type { Request, Response, NextFunction } from "express";
import {
  generateSuratJalanPDF,
  type SuratJalanData,
} from "../../../utils/pdfGenerator.js";

export const generateSuratJalan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { date, recipientName, recipientAddress, items, grandTotal } =
      req.body;

    // Validate required fields
    if (!date || !recipientName || !recipientAddress || !items || !grandTotal) {
      res.status(400).json({
        success: false,
        message:
          "Missing required fields: date, recipientName, recipientAddress, items, grandTotal",
      });
      return;
    }

    const data: SuratJalanData = {
      date,
      recipientName,
      recipientAddress,
      items,
      grandTotal,
    };

    const pdfBuffer = await generateSuratJalanPDF(data);

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="surat-jalan-${Date.now()}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
