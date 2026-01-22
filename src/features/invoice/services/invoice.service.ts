import { ObjectId } from 'mongodb';
import ExcelJS from 'exceljs';
import { getDatabase } from '../../../config/database.js';
import type { Invoice } from '../models/Invoice.js';
import type { InvoiceResponse, ListInvoicesQuery } from '../interfaces/invoice.types.js';
import * as invoiceRepo from '../repositories/invoice.repository.js';
import type { Payment } from '../../payment/models/Payment.js';
import { getPaymentsOverviewAggregate } from '../../payment/repositories/payment.repository.js';
import { findPaidPaymentsByUserId } from '../../payment/repositories/payment.repository.js';

function toResponse(invoice: Invoice): InvoiceResponse {
  return {
    id: invoice._id!.toString(),
    paymentExternalId: invoice.paymentExternalId,
    xenditInvoiceId: invoice.xenditInvoiceId,
    userId: invoice.userId?.toString(),
    amount: invoice.amount,
    currency: invoice.currency,
    status: invoice.status,
    paidAt: invoice.paidAt,
    paymentMethod: invoice.paymentMethod,
    invoiceUrl: invoice.invoiceUrl,
    customer: invoice.customer,
    items: invoice.items,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export async function ensureInvoiceForPaidPayment(payment: Payment): Promise<InvoiceResponse | null> {
  if (payment.status !== 'paid') return null;

  // Idempotent: if already created, return it.
  const existing = await invoiceRepo.findInvoiceByPaymentExternalId(payment.externalId);
  if (existing) return toResponse(existing);

  try {
    const created = await invoiceRepo.createInvoice({
      paymentExternalId: payment.externalId,
      xenditInvoiceId: payment.xenditInvoiceId,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      status: 'paid',
      paidAt: payment.paidAt,
      paymentMethod: payment.paymentMethod,
      invoiceUrl: payment.invoiceUrl,
      customer: payment.customer,
      items: payment.items,
      shippingAddress: payment.shippingAddress,
    });
    return toResponse(created);
  } catch (error: any) {
    // In case of race condition, unique index will throw duplicate.
    if (error && (error.code === 11000 || error.codeName === 'DuplicateKey')) {
      const after = await invoiceRepo.findInvoiceByPaymentExternalId(payment.externalId);
      return after ? toResponse(after) : null;
    }
    throw error;
  }
}

export async function listInvoicesForDashboard(query: ListInvoicesQuery): Promise<{ data: InvoiceResponse[]; total: number; limit: number; skip: number; }> {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const skip = Math.max(query.skip ?? 0, 0);

  const userId = query.userId && ObjectId.isValid(query.userId) ? new ObjectId(query.userId) : undefined;

  // Self-healing: if filtering by a specific user, backfill invoices for their paid payments.
  if (userId) {
    const paidPayments = await findPaidPaymentsByUserId(userId, 200);
    if (paidPayments.length > 0) {
      await Promise.all(paidPayments.map((p) => ensureInvoiceForPaidPayment(p)));
    }
  }

  const [invoices, total] = await Promise.all([
    invoiceRepo.listInvoices({ userId }, limit, skip),
    invoiceRepo.countInvoices({ userId }),
  ]);

  return {
    data: invoices.map(toResponse),
    total,
    limit,
    skip,
  };
}

export async function listInvoicesForBuyer(userId: string, query: Pick<ListInvoicesQuery, 'limit' | 'skip'>): Promise<{ data: InvoiceResponse[]; total: number; limit: number; skip: number; }> {
  if (!ObjectId.isValid(userId)) {
    return { data: [], total: 0, limit: Math.min(Math.max(query.limit ?? 20, 1), 100), skip: Math.max(query.skip ?? 0, 0) };
  }
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const skip = Math.max(query.skip ?? 0, 0);

  const oid = new ObjectId(userId);

  // Self-healing: ensure invoices exist for all of this buyer's paid payments.
  const paidPayments = await findPaidPaymentsByUserId(oid, 200);
  if (paidPayments.length > 0) {
    await Promise.all(paidPayments.map((p) => ensureInvoiceForPaidPayment(p)));
  }

  const [invoices, total] = await Promise.all([
    invoiceRepo.listInvoices({ userId: oid }, limit, skip),
    invoiceRepo.countInvoices({ userId: oid }),
  ]);

  return {
    data: invoices.map(toResponse),
    total,
    limit,
    skip,
  };
}

export async function getInvoiceDetails(id: string): Promise<InvoiceResponse | null> {
  if (!ObjectId.isValid(id)) return null;
  const invoice = await invoiceRepo.findInvoiceById(new ObjectId(id));
  return invoice ? toResponse(invoice) : null;
}

function pctGrowth(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  // If previous is 0, show 100% growth when current > 0 (common dashboard convention).
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export interface InvoicesOverviewResponse {
  range: { from: string; to: string };
  totals: {
    invoices: { count: number; amount: number; growthPctCount: number | null; growthPctAmount: number | null };
    paid: { count: number; amount: number; growthPctCount: number | null; growthPctAmount: number | null };
    pending: { count: number; amount: number; growthPctCount: number | null; growthPctAmount: number | null };
    withdrawal: {
      amount: number;
      count: number;
      nextWithdrawalInDays: number | null;
      nextWithdrawalAt: string | null;
      growthPctAmount: number | null;
    };
  };
}

export async function getInvoicesOverview(input?: {
  from?: Date;
  to?: Date;
  settlementDays?: number;
}): Promise<InvoicesOverviewResponse> {
  const now = new Date();
  const to = input?.to ?? now;
  const from = input?.from ?? new Date(to.getTime() - 60 * 24 * 60 * 60 * 1000); // default 60 days
  const settlementDays = Math.max(0, Math.floor(input?.settlementDays ?? 3));
  const withdrawableCutoff = new Date(now.getTime() - settlementDays * 24 * 60 * 60 * 1000);

  const durationMs = Math.max(0, to.getTime() - from.getTime());
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - durationMs);

  const [currentAgg, prevAgg] = await Promise.all([
    getPaymentsOverviewAggregate({ from, to, withdrawableCutoff }),
    getPaymentsOverviewAggregate({ from: prevFrom, to: prevTo, withdrawableCutoff }),
  ]);

  const nextWithdrawalAt = currentAgg.minPendingWithdrawalPaidAt
    ? new Date(currentAgg.minPendingWithdrawalPaidAt.getTime() + settlementDays * 24 * 60 * 60 * 1000)
    : null;

  const nextWithdrawalInDays = nextWithdrawalAt
    ? Math.max(0, Math.ceil((nextWithdrawalAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      invoices: {
        count: currentAgg.totalInvoicesCount,
        amount: currentAgg.totalAmount,
        growthPctCount: pctGrowth(currentAgg.totalInvoicesCount, prevAgg.totalInvoicesCount),
        growthPctAmount: pctGrowth(currentAgg.totalAmount, prevAgg.totalAmount),
      },
      paid: {
        count: currentAgg.paidCount,
        amount: currentAgg.paidAmount,
        growthPctCount: pctGrowth(currentAgg.paidCount, prevAgg.paidCount),
        growthPctAmount: pctGrowth(currentAgg.paidAmount, prevAgg.paidAmount),
      },
      pending: {
        count: currentAgg.pendingCount,
        amount: currentAgg.pendingAmount,
        growthPctCount: pctGrowth(currentAgg.pendingCount, prevAgg.pendingCount),
        growthPctAmount: pctGrowth(currentAgg.pendingAmount, prevAgg.pendingAmount),
      },
      withdrawal: {
        amount: currentAgg.withdrawableAmount,
        count: currentAgg.withdrawableCount,
        nextWithdrawalInDays,
        nextWithdrawalAt: nextWithdrawalAt ? nextWithdrawalAt.toISOString() : null,
        growthPctAmount: pctGrowth(currentAgg.withdrawableAmount, prevAgg.withdrawableAmount),
      },
    },
  };
}

function isoDateOnly(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function safeFilenamePart(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function exportInvoicesExcelReport(input?: {
  userId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}): Promise<{ buffer: Buffer; filename: string; count: number; generatedAt: Date; }> {
  const limit = Math.min(Math.max(input?.limit ?? 5000, 1), 20000);

  const userId = input?.userId && ObjectId.isValid(input.userId) ? new ObjectId(input.userId) : undefined;
  const from = input?.from;
  const to = input?.to;

  const invoices = await invoiceRepo.listInvoicesForExport({ userId, from, to }, limit);

  // Backfill customer info from buyer profile for older invoices where customer was not stored.
  const missingCustomerUserIds = Array.from(
    new Set(
      invoices
        .filter((i) => !i.customer && i.userId)
        .map((i) => (i.userId as ObjectId).toString()),
    ),
  )
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  const buyerById = new Map<string, { email?: string; username?: string }>();
  if (missingCustomerUserIds.length > 0) {
    const db = getDatabase();
    const buyers = await db
      .collection<{ _id: ObjectId; email?: string; username?: string }>('buyers')
      .find(
        { _id: { $in: missingCustomerUserIds } } as any,
        { projection: { email: 1, username: 1 } as any },
      )
      .toArray();

    for (const b of buyers) {
      buyerById.set(b._id.toString(), { email: b.email, username: b.username });
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Backend-FIC';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Invoices');
  ws.columns = [
    { header: 'Created At', key: 'createdAt', width: 22 },
    { header: 'Paid At', key: 'paidAt', width: 22 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Payment Method', key: 'paymentMethod', width: 16 },
    { header: 'Payment External ID', key: 'paymentExternalId', width: 26 },
    { header: 'Xendit Invoice ID', key: 'xenditInvoiceId', width: 26 },
    { header: 'Invoice URL', key: 'invoiceUrl', width: 40 },
    { header: 'User ID', key: 'userId', width: 26 },
    { header: 'Customer Name', key: 'customerName', width: 22 },
    { header: 'Customer Email', key: 'customerEmail', width: 26 },
    { header: 'Customer Phone', key: 'customerPhone', width: 18 },
    { header: 'Items', key: 'items', width: 50 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const inv of invoices) {
    const buyer = inv.userId ? buyerById.get(inv.userId.toString()) : undefined;

    const customerName = inv.customer
      ? [inv.customer.givenNames, inv.customer.surname].filter(Boolean).join(' ')
      : (buyer?.username ?? '');

    const items = inv.items
      ? inv.items
        .map((it) => {
          const unit = Number.isFinite(it.price) ? `@${it.price}` : '';
          return `${it.name} x${it.quantity}${unit}`;
        })
        .join('; ')
      : '';

    ws.addRow({
      createdAt: inv.createdAt ? inv.createdAt.toISOString() : '',
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : '',
      status: inv.status,
      amount: inv.amount,
      currency: inv.currency,
      paymentMethod: inv.paymentMethod ?? '',
      paymentExternalId: inv.paymentExternalId,
      xenditInvoiceId: inv.xenditInvoiceId,
      invoiceUrl: inv.invoiceUrl ?? '',
      userId: inv.userId?.toString() ?? '',
      customerName,
      customerEmail: inv.customer?.email ?? (buyer?.email ?? ''),
      customerPhone: inv.customer?.mobileNumber ?? '',
      items,
    } as any);
  }

  const generatedAt = new Date();
  const fromPart = from ? isoDateOnly(from) : 'all';
  const toPart = to ? isoDateOnly(to) : 'all';
  const userPart = userId ? `user_${userId.toString()}` : 'all_users';
  const filename = safeFilenamePart(`invoices_${userPart}_${fromPart}_to_${toPart}.xlsx`);

  const raw = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);

  return { buffer, filename, count: invoices.length, generatedAt };
}

function safeDiv(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

export interface SalesReportResponse {
  range: { from?: string; to?: string; dateField: invoiceRepo.InvoiceReportDateField };
  totals: {
    ordersCount: number;
    totalSalesAmount: number;
    totalOrderItemsQty: number;
    avgUnitsPerOrder: number;
    avgSalesPerOrder: number;
    avgSalesPerItem: number;
  };
  items: Array<{
    productId?: string;
    sku?: string;
    name: string;
    ordersCount: number;
    quantity: number;
    salesAmount: number;
    avgUnitPrice: number;
  }>;
}

export async function getSalesReport(input?: {
  userId?: string;
  from?: Date;
  to?: Date;
  dateField?: invoiceRepo.InvoiceReportDateField;
  limit?: number;
}): Promise<SalesReportResponse> {
  const dateField: invoiceRepo.InvoiceReportDateField = input?.dateField ?? 'paidAt';
  const userId = input?.userId && ObjectId.isValid(input.userId) ? new ObjectId(input.userId) : undefined;
  const limit = Math.min(Math.max(input?.limit ?? 5000, 1), 20000);

  const [totalsAgg, itemsAgg] = await Promise.all([
    invoiceRepo.getInvoicesSalesTotalsAggregate({ userId, from: input?.from, to: input?.to, dateField }),
    invoiceRepo.getInvoicesItemBreakdown({ userId, from: input?.from, to: input?.to, dateField, limit }),
  ]);

  const avgUnitsPerOrder = safeDiv(totalsAgg.totalOrderItemsQty, totalsAgg.ordersCount);
  const avgSalesPerOrder = safeDiv(totalsAgg.totalSalesAmount, totalsAgg.ordersCount);
  const avgSalesPerItem = safeDiv(totalsAgg.totalSalesAmount, totalsAgg.totalOrderItemsQty);

  return {
    range: {
      from: input?.from ? input.from.toISOString() : undefined,
      to: input?.to ? input.to.toISOString() : undefined,
      dateField,
    },
    totals: {
      ordersCount: totalsAgg.ordersCount,
      totalSalesAmount: totalsAgg.totalSalesAmount,
      totalOrderItemsQty: totalsAgg.totalOrderItemsQty,
      avgUnitsPerOrder,
      avgSalesPerOrder,
      avgSalesPerItem,
    },
    items: itemsAgg.map((r) => ({
      productId: r.productId,
      sku: r.sku,
      name: r.name,
      ordersCount: r.ordersCount,
      quantity: r.quantity,
      salesAmount: r.salesAmount,
      avgUnitPrice: safeDiv(r.salesAmount, r.quantity),
    })),
  };
}

export async function exportSalesReportExcel(input?: {
  userId?: string;
  from?: Date;
  to?: Date;
  dateField?: invoiceRepo.InvoiceReportDateField;
  limit?: number;
}): Promise<{ buffer: Buffer; filename: string; generatedAt: Date; }> {
  const report = await getSalesReport(input);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Backend-FIC';
  workbook.created = new Date();

  const wsSummary = workbook.addWorksheet('Summary');
  wsSummary.columns = [
    { header: 'Metric', key: 'metric', width: 28 },
    { header: 'Value', key: 'value', width: 22 },
  ];
  wsSummary.getRow(1).font = { bold: true };

  wsSummary.addRow({ metric: 'Date Field', value: report.range.dateField });
  wsSummary.addRow({ metric: 'From', value: report.range.from ?? '' });
  wsSummary.addRow({ metric: 'To', value: report.range.to ?? '' });
  wsSummary.addRow({ metric: 'Orders Count', value: report.totals.ordersCount });
  wsSummary.addRow({ metric: 'Total Sales', value: report.totals.totalSalesAmount });
  wsSummary.addRow({ metric: 'Total Order Items (Qty)', value: report.totals.totalOrderItemsQty });
  wsSummary.addRow({ metric: 'Avg Units / Order', value: report.totals.avgUnitsPerOrder });
  wsSummary.addRow({ metric: 'Avg Sales / Order', value: report.totals.avgSalesPerOrder });
  wsSummary.addRow({ metric: 'Avg Sales / Item', value: report.totals.avgSalesPerItem });

  const wsItems = workbook.addWorksheet('Items');
  wsItems.columns = [
    { header: 'Product ID', key: 'productId', width: 26 },
    { header: 'SKU', key: 'sku', width: 18 },
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Orders Count', key: 'ordersCount', width: 14 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Sales Amount', key: 'salesAmount', width: 14 },
    { header: 'Avg Unit Price', key: 'avgUnitPrice', width: 14 },
  ];
  wsItems.getRow(1).font = { bold: true };
  wsItems.views = [{ state: 'frozen', ySplit: 1 }];

  for (const r of report.items) {
    wsItems.addRow({
      productId: r.productId ?? '',
      sku: r.sku ?? '',
      name: r.name,
      ordersCount: r.ordersCount,
      quantity: r.quantity,
      salesAmount: r.salesAmount,
      avgUnitPrice: r.avgUnitPrice,
    } as any);
  }

  const generatedAt = new Date();
  const fromPart = report.range.from ? isoDateOnly(new Date(report.range.from)) : 'all';
  const toPart = report.range.to ? isoDateOnly(new Date(report.range.to)) : 'all';
  const userPart = input?.userId ? `user_${input.userId}` : 'all_users';
  const filename = safeFilenamePart(`sales_report_${userPart}_${report.range.dateField}_${fromPart}_to_${toPart}.xlsx`);

  const raw = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
  return { buffer, filename, generatedAt };
}
