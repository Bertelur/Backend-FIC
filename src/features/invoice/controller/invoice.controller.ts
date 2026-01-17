import { Request, Response } from 'express';
import * as invoiceService from '../services/invoice.service.js';
import type { ListInvoicesQuery } from '../interfaces/invoice.types.js';

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export async function getInvoices(req: Request, res: Response): Promise<void> {
  try {
    const userId = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
    const limit = parseNumber(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit);
    const skip = parseNumber(Array.isArray(req.query.skip) ? req.query.skip[0] : req.query.skip);

    const result = await invoiceService.listInvoicesForDashboard({
      userId: typeof userId === 'string' ? userId : undefined,
      limit,
      skip,
    } satisfies ListInvoicesQuery);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch invoices',
    });
  }
}

export async function getMyInvoices(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User authentication required' });
      return;
    }

    const limit = parseNumber(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit);
    const skip = parseNumber(Array.isArray(req.query.skip) ? req.query.skip[0] : req.query.skip);

    const result = await invoiceService.listInvoicesForBuyer(String(userId), { limit, skip });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch invoices',
    });
  }
}

export async function getInvoiceDetails(req: Request, res: Response): Promise<void> {
  try {
    const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = typeof idRaw === 'string' ? idRaw.trim() : String(idRaw ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'Bad Request', message: 'Invoice id is required' });
      return;
    }

    const invoice = await invoiceService.getInvoiceDetails(id);
    if (!invoice) {
      res.status(404).json({ error: 'Not Found', message: 'Invoice not found' });
      return;
    }

    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get invoice',
    });
  }
}

export async function exportInvoicesExcel(req: Request, res: Response): Promise<void> {
  try {
    const userId = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
    const limit = parseNumber(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit);

    const fromRaw = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const toRaw = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const startDateRaw = Array.isArray(req.query.startDate) ? req.query.startDate[0] : req.query.startDate;
    const endDateRaw = Array.isArray(req.query.endDate) ? req.query.endDate[0] : req.query.endDate;

    const from = parseDate(fromRaw ?? startDateRaw);
    const to = parseDate(toRaw ?? endDateRaw);

    if (from && to && from.getTime() > to.getTime()) {
      res.status(400).json({ error: 'Bad Request', message: '`from` must be <= `to`' });
      return;
    }

    const result = await invoiceService.exportInvoicesExcelReport({
      userId: typeof userId === 'string' ? userId : undefined,
      from,
      to,
      limit: typeof limit === 'number' ? limit : undefined,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).send(result.buffer);
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to export invoices',
    });
  }
}

export async function exportMyInvoicesExcel(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User authentication required' });
      return;
    }

    const limit = parseNumber(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit);
    const fromRaw = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const toRaw = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const startDateRaw = Array.isArray(req.query.startDate) ? req.query.startDate[0] : req.query.startDate;
    const endDateRaw = Array.isArray(req.query.endDate) ? req.query.endDate[0] : req.query.endDate;

    const from = parseDate(fromRaw ?? startDateRaw);
    const to = parseDate(toRaw ?? endDateRaw);

    if (from && to && from.getTime() > to.getTime()) {
      res.status(400).json({ error: 'Bad Request', message: '`from` must be <= `to`' });
      return;
    }

    const result = await invoiceService.exportInvoicesExcelReport({
      userId: String(userId),
      from,
      to,
      limit: typeof limit === 'number' ? limit : undefined,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).send(result.buffer);
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to export invoices',
    });
  }
}

function parseDateField(value: unknown): 'createdAt' | 'paidAt' | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (v === 'createdAt' || v === 'paidAt') return v;
  return undefined;
}

export async function getSalesReport(req: Request, res: Response): Promise<void> {
  try {
    const userId = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
    const limit = parseNumber(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit);

    const fromRaw = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const toRaw = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const startDateRaw = Array.isArray(req.query.startDate) ? req.query.startDate[0] : req.query.startDate;
    const endDateRaw = Array.isArray(req.query.endDate) ? req.query.endDate[0] : req.query.endDate;
    const dateFieldRaw = Array.isArray(req.query.dateField) ? req.query.dateField[0] : req.query.dateField;

    const from = parseDate(fromRaw ?? startDateRaw);
    const to = parseDate(toRaw ?? endDateRaw);
    const dateField = parseDateField(dateFieldRaw) ?? 'paidAt';

    if (from && to && from.getTime() > to.getTime()) {
      res.status(400).json({ error: 'Bad Request', message: '`from` must be <= `to`' });
      return;
    }

    const report = await invoiceService.getSalesReport({
      userId: typeof userId === 'string' ? userId : undefined,
      from,
      to,
      dateField,
      limit: typeof limit === 'number' ? limit : undefined,
    });

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get sales report',
    });
  }
}

export async function exportSalesReportExcel(req: Request, res: Response): Promise<void> {
  try {
    const userId = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
    const limit = parseNumber(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit);

    const fromRaw = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const toRaw = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const startDateRaw = Array.isArray(req.query.startDate) ? req.query.startDate[0] : req.query.startDate;
    const endDateRaw = Array.isArray(req.query.endDate) ? req.query.endDate[0] : req.query.endDate;
    const dateFieldRaw = Array.isArray(req.query.dateField) ? req.query.dateField[0] : req.query.dateField;

    const from = parseDate(fromRaw ?? startDateRaw);
    const to = parseDate(toRaw ?? endDateRaw);
    const dateField = parseDateField(dateFieldRaw) ?? 'paidAt';

    if (from && to && from.getTime() > to.getTime()) {
      res.status(400).json({ error: 'Bad Request', message: '`from` must be <= `to`' });
      return;
    }

    const result = await invoiceService.exportSalesReportExcel({
      userId: typeof userId === 'string' ? userId : undefined,
      from,
      to,
      dateField,
      limit: typeof limit === 'number' ? limit : undefined,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).send(result.buffer);
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to export sales report',
    });
  }
}

export async function getMySalesReport(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User authentication required' });
      return;
    }

    const limit = parseNumber(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit);
    const fromRaw = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const toRaw = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const startDateRaw = Array.isArray(req.query.startDate) ? req.query.startDate[0] : req.query.startDate;
    const endDateRaw = Array.isArray(req.query.endDate) ? req.query.endDate[0] : req.query.endDate;
    const dateFieldRaw = Array.isArray(req.query.dateField) ? req.query.dateField[0] : req.query.dateField;

    const from = parseDate(fromRaw ?? startDateRaw);
    const to = parseDate(toRaw ?? endDateRaw);
    const dateField = parseDateField(dateFieldRaw) ?? 'paidAt';

    if (from && to && from.getTime() > to.getTime()) {
      res.status(400).json({ error: 'Bad Request', message: '`from` must be <= `to`' });
      return;
    }

    const report = await invoiceService.getSalesReport({
      userId: String(userId),
      from,
      to,
      dateField,
      limit: typeof limit === 'number' ? limit : undefined,
    });

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get sales report',
    });
  }
}

export async function exportMySalesReportExcel(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User authentication required' });
      return;
    }

    const limit = parseNumber(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit);
    const fromRaw = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const toRaw = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const startDateRaw = Array.isArray(req.query.startDate) ? req.query.startDate[0] : req.query.startDate;
    const endDateRaw = Array.isArray(req.query.endDate) ? req.query.endDate[0] : req.query.endDate;
    const dateFieldRaw = Array.isArray(req.query.dateField) ? req.query.dateField[0] : req.query.dateField;

    const from = parseDate(fromRaw ?? startDateRaw);
    const to = parseDate(toRaw ?? endDateRaw);
    const dateField = parseDateField(dateFieldRaw) ?? 'paidAt';

    if (from && to && from.getTime() > to.getTime()) {
      res.status(400).json({ error: 'Bad Request', message: '`from` must be <= `to`' });
      return;
    }

    const result = await invoiceService.exportSalesReportExcel({
      userId: String(userId),
      from,
      to,
      dateField,
      limit: typeof limit === 'number' ? limit : undefined,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).send(result.buffer);
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to export sales report',
    });
  }
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

export async function getInvoicesOverview(req: Request, res: Response): Promise<void> {
  try {
    const fromRaw = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const toRaw = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const settlementDaysRaw = Array.isArray(req.query.settlementDays)
      ? req.query.settlementDays[0]
      : req.query.settlementDays;

    const from = parseDate(fromRaw);
    const to = parseDate(toRaw);
    const settlementDays = parseNumber(settlementDaysRaw);

    const overview = await invoiceService.getInvoicesOverview({
      from,
      to,
      settlementDays: typeof settlementDays === 'number' ? settlementDays : undefined,
    });

    res.status(200).json({ success: true, data: overview });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get invoices overview',
    });
  }
}
