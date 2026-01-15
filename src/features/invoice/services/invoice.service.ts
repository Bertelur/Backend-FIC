import { ObjectId } from 'mongodb';
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
