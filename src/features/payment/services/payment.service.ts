import { getInvoice } from '../../../config/xendit.js';
import type { CreatePaymentRequest, PaymentResponse } from '../interfaces/payment.types.js';
import * as paymentRepo from '../repositories/payment.repository.js';
import { ObjectId } from 'mongodb';
import * as invoiceService from '../../invoice/services/invoice.service.js';
import type { InvoiceResponse } from '../../invoice/interfaces/invoice.types.js';
import { getDatabase, getMongoClient } from '../../../config/database.js';
import type { Payment } from '../models/Payment.js';
import * as productsRepo from '../../product/repositories/product.repository.js';
import * as cartRepo from '../../cart/repositories/cart.repository.js';

async function releaseReservedStockIfNeeded(payment: Payment): Promise<void> {
  if (!payment.stockReservedAt || payment.stockReleasedAt) return;
  if (payment.status !== 'expired' && payment.status !== 'failed') return;

  const releases = (payment.items ?? [])
    .filter((i) => typeof i.productId === 'string' && i.productId.length > 0 && typeof i.quantity === 'number' && i.quantity > 0)
    .map((i) => ({
      productId: i.productId as string,
      productIdType: i.productIdType,
      quantity: i.quantity,
    }));

  const client = getMongoClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const db = getDatabase();
      const collection = db.collection<Payment>('payments');

      const fresh = await collection.findOne({ externalId: payment.externalId }, { session });
      if (!fresh) return;
      if (!fresh.stockReservedAt || fresh.stockReleasedAt) return;

      if (releases.length > 0) {
        await productsRepo.releaseStockAny(releases, session);
      }

      await collection.updateOne(
        { externalId: payment.externalId, $or: [{ stockReleasedAt: { $exists: false } }, { stockReleasedAt: null }] } as any,
        { $set: { stockReleasedAt: new Date(), updatedAt: new Date() } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  if (payment.userId) {
    await cartRepo.clearCartCheckoutIfMatches(payment.userId, payment.externalId);
  }
}

export async function createInvoice(
  paymentData: CreatePaymentRequest,
  userId?: ObjectId,
  opts?: { stockReservedAt?: Date; externalId?: string },
): Promise<PaymentResponse> {
  // Generate unique external ID
  const externalId = opts?.externalId || `PAYMENT-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // If customer info is not provided by client (common in cart checkout),
  // try to fill minimally from buyer profile so invoices/reports are usable.
  let resolvedCustomer = paymentData.customer;
  if (!resolvedCustomer && userId) {
    const db = getDatabase();
    const buyer = await db
      .collection<{ _id: ObjectId; email?: string; username?: string }>('buyers')
      .findOne(
        { _id: userId },
        { projection: { email: 1, username: 1 } as any },
      );

    const email = typeof buyer?.email === 'string' ? buyer.email.trim() : '';
    const username = typeof buyer?.username === 'string' ? buyer.username.trim() : '';
    if (email) {
      resolvedCustomer = {
        givenNames: username || email,
        email,
      };
    }
  }

  // Prepare invoice data for Xendit
  const invoiceData: any = {
    externalId,
    amount: paymentData.amount,
    currency: paymentData.currency || 'IDR',
    description: paymentData.description || 'Payment',
    invoiceDuration: paymentData.invoiceDuration || 86400, // 24 hours default
  };

  if (resolvedCustomer) {
    invoiceData.customer = {
      givenNames: resolvedCustomer.givenNames,
      surname: resolvedCustomer.surname,
      email: resolvedCustomer.email,
      mobileNumber: resolvedCustomer.mobileNumber,
    };
  }

  if (paymentData.items && paymentData.items.length > 0) {
    invoiceData.items = paymentData.items.map(({ productIdType, ...rest }) => rest);
  }

  if (paymentData.successRedirectUrl) {
    invoiceData.successRedirectUrl = paymentData.successRedirectUrl;
  }

  if (paymentData.failureRedirectUrl) {
    invoiceData.failureRedirectUrl = paymentData.failureRedirectUrl;
  }

  // Create invoice in Xendit
  const Invoice = getInvoice();
  const xenditInvoice = await Invoice.createInvoice({
    data: invoiceData,
  });

  // Save payment record to database
  if (!xenditInvoice.id) {
    throw new Error('Failed to create invoice: No invoice ID returned from Xendit');
  }

  const payment = await paymentRepo.createPayment({
    externalId,
    xenditInvoiceId: xenditInvoice.id,
    userId,
    amount: paymentData.amount,
    currency: paymentData.currency || 'IDR',
    status: 'pending',
    stockReservedAt: opts?.stockReservedAt,
    description: paymentData.description,
    invoiceUrl: xenditInvoice.invoiceUrl,
    expiryDate: xenditInvoice.expiryDate ? new Date(xenditInvoice.expiryDate) : undefined,
    customer: resolvedCustomer,
    items: paymentData.items,
  });

  return {
    id: payment._id!.toString(),
    externalId: payment.externalId,
    status: payment.status,
    amount: payment.amount,
    invoiceUrl: payment.invoiceUrl,
    expiryDate: payment.expiryDate,
    created: payment.createdAt,
  };
}

export async function getInvoiceById(externalId: string): Promise<PaymentResponse | null> {
  const payment = await paymentRepo.findPaymentByExternalId(externalId);

  if (!payment) {
    return null;
  }

  // Get latest status from Xendit
  try {
    const Invoice = getInvoice();
    const xenditInvoice = await Invoice.getInvoiceById({
      invoiceId: payment.xenditInvoiceId,
    });

    // Update payment status if changed
    // Map Xendit status to our status
    const statusMap: Record<string, 'pending' | 'paid' | 'expired' | 'failed'> = {
      PENDING: 'pending',
      PAID: 'paid',
      EXPIRED: 'expired',
      SETTLED: 'paid',
    };
    const mappedStatus = statusMap[xenditInvoice.status] || 'failed';

    if (mappedStatus !== payment.status) {
      const updatedPayment = await paymentRepo.updatePaymentStatus(
        externalId,
        mappedStatus,
        xenditInvoice.updated && mappedStatus === 'paid' ? new Date(xenditInvoice.updated) : undefined,
        xenditInvoice.paymentMethod,
      );

      if (updatedPayment) {
        if (updatedPayment.status === 'paid') {
          await invoiceService.ensureInvoiceForPaidPayment(updatedPayment);
          if (updatedPayment.userId) {
            await cartRepo.finalizeCheckoutIfMatches(updatedPayment.userId, updatedPayment.externalId);
          }
        }

        if (updatedPayment.status === 'expired' || updatedPayment.status === 'failed') {
          await releaseReservedStockIfNeeded(updatedPayment);
        }
        return {
          id: updatedPayment._id!.toString(),
          externalId: updatedPayment.externalId,
          status: updatedPayment.status,
          amount: updatedPayment.amount,
          invoiceUrl: updatedPayment.invoiceUrl,
          expiryDate: updatedPayment.expiryDate,
          created: updatedPayment.createdAt,
        };
      }
    }
  } catch (error) {
    console.error('Error fetching invoice from Xendit:', error);
  }

  return {
    id: payment._id!.toString(),
    externalId: payment.externalId,
    status: payment.status,
    amount: payment.amount,
    invoiceUrl: payment.invoiceUrl,
    expiryDate: payment.expiryDate,
    created: payment.createdAt,
  };
}

export async function getCheckoutResultForUser(
  userId: ObjectId,
  externalIdRaw: string,
): Promise<{ payment: PaymentResponse; invoice: InvoiceResponse | null }> {
  const externalId = String(externalIdRaw ?? '').trim();
  if (!externalId) throw new Error('External ID is required');

  const existing = await paymentRepo.findPaymentByExternalId(externalId);
  if (!existing || !existing.userId || String(existing.userId) !== String(userId)) {
    throw new Error('Payment not found');
  }

  // Refresh from Xendit (this may update status in DB).
  const refreshed = await getInvoiceById(externalId);
  if (!refreshed) throw new Error('Payment not found');

  // Always re-read the DB doc so we have userId/payloads even if status didn't change.
  const after = await paymentRepo.findPaymentByExternalId(externalId);
  if (!after || !after.userId || String(after.userId) !== String(userId)) {
    throw new Error('Payment not found');
  }

  if (after.status !== 'paid') {
    return { payment: refreshed, invoice: null };
  }

  const invoice = await invoiceService.ensureInvoiceForPaidPayment(after);
  if (after.userId) {
    await cartRepo.finalizeCheckoutIfMatches(after.userId, after.externalId);
  }

  return { payment: refreshed, invoice };
}

export async function handleWebhook(webhookData: any): Promise<void> {
  const xenditInvoiceId = webhookData?.id;
  const statusRaw = webhookData?.status;
  const externalId = webhookData?.external_id || webhookData?.externalId;

  let payment = typeof xenditInvoiceId === 'string' ? await paymentRepo.findPaymentByXenditId(xenditInvoiceId) : null;
  if (!payment && typeof externalId === 'string') {
    payment = await paymentRepo.findPaymentByExternalId(externalId);
  }

  if (!payment) {
    console.warn(
      `Payment not found for webhook. xenditInvoiceId=${String(xenditInvoiceId)} externalId=${String(externalId)}`,
    );
    return;
  }

  // Map Xendit status to our status
  const statusMap: Record<string, 'pending' | 'paid' | 'expired' | 'failed'> = {
    PENDING: 'pending',
    ACTIVE: 'pending',
    PAID: 'paid',
    SETTLED: 'paid',
    EXPIRED: 'expired',
    FAILED: 'failed',
    CANCELLED: 'failed',
    VOIDED: 'failed',
  };

  const normalizedStatus = typeof statusRaw === 'string' ? statusRaw.toUpperCase() : '';
  const mappedStatus = statusMap[normalizedStatus] || 'failed';

  const paidAtRaw = webhookData?.paid_at || webhookData?.paidAt;
  const paidAt = paidAtRaw ? new Date(paidAtRaw) : undefined;

  const paymentMethod = webhookData?.payment_method || webhookData?.paymentMethod;
  const paymentChannel = webhookData?.payment_channel || webhookData?.paymentChannel;
  const paymentMethodStored =
    typeof paymentMethod === 'string' && typeof paymentChannel === 'string'
      ? `${paymentMethod}:${paymentChannel}`
      : typeof paymentMethod === 'string'
        ? paymentMethod
        : undefined;

  // Update payment status
  const updated = await paymentRepo.updatePaymentStatus(
    payment.externalId,
    mappedStatus,
    mappedStatus === 'paid' ? paidAt : undefined,
    paymentMethodStored,
  );

  const finalPayment = updated ?? payment;
  if (finalPayment.status === 'paid') {
    await invoiceService.ensureInvoiceForPaidPayment(finalPayment);
    if (finalPayment.userId) {
      await cartRepo.finalizeCheckoutIfMatches(finalPayment.userId, finalPayment.externalId);
    }
  }

  if (finalPayment.status === 'expired' || finalPayment.status === 'failed') {
    await releaseReservedStockIfNeeded(finalPayment);
  }
}

export async function getPaymentsByUserId(
  userId: ObjectId,
  limit: number = 10,
  skip: number = 0,
  opts?: { refresh?: boolean },
): Promise<PaymentResponse[]> {
  let payments = await paymentRepo.findPaymentsByUserId(userId, limit, skip);

  // Optional: refresh statuses from Xendit for better UX when webhook is delayed.
  if (opts?.refresh) {
    const Invoice = getInvoice();
    const statusMap: Record<string, 'pending' | 'paid' | 'expired' | 'failed'> = {
      PENDING: 'pending',
      ACTIVE: 'pending',
      PAID: 'paid',
      SETTLED: 'paid',
      EXPIRED: 'expired',
      FAILED: 'failed',
      CANCELLED: 'failed',
      VOIDED: 'failed',
    };

    const refreshed = await Promise.all(
      payments.map(async (payment) => {
        // Only refresh if it isn't already terminal paid/expired/failed? We'll refresh everything lightly.
        try {
          const xenditInvoice = await Invoice.getInvoiceById({ invoiceId: payment.xenditInvoiceId });
          const normalizedStatus = typeof xenditInvoice.status === 'string' ? xenditInvoice.status.toUpperCase() : '';
          const mappedStatus = statusMap[normalizedStatus] || 'failed';
          if (mappedStatus === payment.status) return payment;

          const paidAtCandidate = (xenditInvoice as any).paidAt || (xenditInvoice as any).paid_at || xenditInvoice.updated;
          const paidAt = mappedStatus === 'paid' && paidAtCandidate ? new Date(paidAtCandidate) : undefined;

          const updated = await paymentRepo.updatePaymentStatus(
            payment.externalId,
            mappedStatus,
            mappedStatus === 'paid' ? paidAt : undefined,
            (xenditInvoice as any).paymentMethod,
          );

          const finalPayment = updated ?? payment;
          if (finalPayment.status === 'paid') {
            await invoiceService.ensureInvoiceForPaidPayment(finalPayment);
          }
          if (finalPayment.status === 'expired' || finalPayment.status === 'failed') {
            await releaseReservedStockIfNeeded(finalPayment);
          }
          return finalPayment;
        } catch {
          return payment;
        }
      }),
    );

    payments = refreshed;
  }

  // Backfill invoices for already-paid payments (idempotent).
  const paidPayments = payments.filter((p) => p.status === 'paid');
  if (paidPayments.length > 0) {
    await Promise.all(paidPayments.map((p) => invoiceService.ensureInvoiceForPaidPayment(p)));
  }

  return payments.map((payment) => ({
    id: payment._id!.toString(),
    externalId: payment.externalId,
    status: payment.status,
    amount: payment.amount,
    invoiceUrl: payment.invoiceUrl,
    expiryDate: payment.expiryDate,
    created: payment.createdAt,
  }));
}

export async function getAllPayments(
  limit: number = 20,
  skip: number = 0,
  status?: 'pending' | 'paid' | 'expired' | 'failed',
): Promise<{ payments: PaymentResponse[]; total: number; limit: number; skip: number }> {
  const result = await paymentRepo.findAllPayments(limit, skip, status);

  return {
    payments: result.payments.map((payment) => ({
      id: payment._id!.toString(),
      externalId: payment.externalId,
      status: payment.status,
      amount: payment.amount,
      invoiceUrl: payment.invoiceUrl,
      expiryDate: payment.expiryDate,
      created: payment.createdAt,
    })),
    total: result.total,
    limit,
    skip,
  };
}
