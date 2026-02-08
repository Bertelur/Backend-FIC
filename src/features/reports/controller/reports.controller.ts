import type { Request, Response } from 'express';
import * as salesReportService from '../services/salesReport.service.js';

function parseDate(value: unknown): Date | undefined {
  if (value == null) return undefined;
  const s = Array.isArray(value) ? value[0] : value;
  if (typeof s !== 'string') return undefined;
  const d = new Date(s.trim());
  return isNaN(d.getTime()) ? undefined : d;
}

function parseNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const s = Array.isArray(value) ? value[0] : value;
  if (typeof s === 'number' && Number.isFinite(s)) return s;
  if (typeof s === 'string') {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseDateField(value: unknown): salesReportService.CombinedReportDateField | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === 'paidAt' || v === 'createdAt') return v;
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

    const report = await salesReportService.getCombinedSalesReport({
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
