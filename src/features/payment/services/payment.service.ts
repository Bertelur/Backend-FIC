import { getInvoice } from '../../../config/xendit.js';
import type { CreatePaymentRequest, PaymentResponse } from '../interfaces/payment.types.js';
import * as paymentRepo from '../repositories/payment.repository.js';
import { ObjectId } from 'mongodb';

export async function createInvoice(
  paymentData: CreatePaymentRequest,
  userId?: ObjectId,
): Promise<PaymentResponse> {
  // Generate unique external ID
  const externalId = `PAYMENT-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Prepare invoice data for Xendit
  const invoiceData: any = {
    externalId,
    amount: paymentData.amount,
    currency: paymentData.currency || 'IDR',
    description: paymentData.description || 'Payment',
    invoiceDuration: paymentData.invoiceDuration || 86400, // 24 hours default
  };

  if (paymentData.customer) {
    invoiceData.customer = {
      givenNames: paymentData.customer.givenNames,
      surname: paymentData.customer.surname,
      email: paymentData.customer.email,
      mobileNumber: paymentData.customer.mobileNumber,
    };
  }

  if (paymentData.items && paymentData.items.length > 0) {
    invoiceData.items = paymentData.items;
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
    description: paymentData.description,
    invoiceUrl: xenditInvoice.invoiceUrl,
    expiryDate: xenditInvoice.expiryDate ? new Date(xenditInvoice.expiryDate) : undefined,
    customer: paymentData.customer,
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
  await paymentRepo.updatePaymentStatus(
    payment.externalId,
    mappedStatus,
    mappedStatus === 'paid' ? paidAt : undefined,
    paymentMethodStored,
  );
}

export async function getPaymentsByUserId(
  userId: ObjectId,
  limit: number = 10,
  skip: number = 0,
): Promise<PaymentResponse[]> {
  const payments = await paymentRepo.findPaymentsByUserId(userId, limit, skip);

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
