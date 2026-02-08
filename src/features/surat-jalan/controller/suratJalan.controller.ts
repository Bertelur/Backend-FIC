import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../../middleware/auth.js";
import {
  generateSuratJalanPDF,
  type SuratJalanData,
} from "../../../utils/pdfGenerator.js";
import { getSuratJalanPayloadFromOrderId } from "../suratJalanFromOrder.service.js";
import * as orderRepo from "../../order/repositories/order.repository.js";

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

/** GET /surat-jalan/from-order/:orderId - Get Surat Jalan payload for an order (for pre-fill or preview). */
export const getFromOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orderId = String(req.params.orderId ?? "").trim();
    if (!orderId) {
      res.status(400).json({ success: false, message: "Order id is required" });
      return;
    }
    const order = await orderRepo.findOrderById(orderId);
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }
    if (req.user?.role !== "super-admin" && req.user?.role !== "staff") {
      if (String(order.userId) !== req.user?.userId) {
        res.status(403).json({ success: false, message: "Forbidden" });
        return;
      }
    }
    const data = await getSuratJalanPayloadFromOrderId(orderId);
    if (!data) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/** POST /surat-jalan/generate-from-order/:orderId - Generate PDF from order and return as download. */
export const generateFromOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orderId = String(req.params.orderId ?? "").trim();
    if (!orderId) {
      res.status(400).json({ success: false, message: "Order id is required" });
      return;
    }
    const order = await orderRepo.findOrderById(orderId);
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }
    if (req.user?.role !== "super-admin" && req.user?.role !== "staff") {
      if (String(order.userId) !== req.user?.userId) {
        res.status(403).json({ success: false, message: "Forbidden" });
        return;
      }
    }
    const data = await getSuratJalanPayloadFromOrderId(orderId);
    if (!data) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }
    const pdfBuffer = await generateSuratJalanPDF(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="surat-jalan-order-${orderId}-${Date.now()}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
