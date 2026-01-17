import { Request, Response } from 'express';
import * as paymentService from '../services/payment.service.js';
import type { CreatePaymentRequest } from '../interfaces/payment.types.js';
import { ObjectId } from 'mongodb';

export async function createPayment(req: Request, res: Response): Promise<void> {
  try {
    const paymentData: CreatePaymentRequest = req.body;

    if (!paymentData.amount || paymentData.amount <= 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Amount is required and must be greater than 0',
      });
      return;
    }

    // Get user ID from token if available (you may need to adjust based on your auth middleware)
    const userId = (req as any).user?.userId ? new ObjectId((req as any).user.userId) : undefined;

    const result = await paymentService.createInvoice(paymentData, userId);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to create payment',
    });
  }
}

export async function getPayment(req: Request, res: Response): Promise<void> {
  try {
    const externalId = Array.isArray(req.params.externalId)
      ? req.params.externalId[0]
      : req.params.externalId;

    if (!externalId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'External ID is required',
      });
      return;
    }

    const payment = await paymentService.getInvoiceById(externalId);

    if (!payment) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Payment not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error('Error getting payment:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get payment',
    });
  }
}

export async function getMyPayments(req: Request, res: Response): Promise<void> {
  try {
    // Get user ID from token (you may need to adjust based on your auth middleware)
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
      return;
    }

    const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const skipParam = Array.isArray(req.query.skip) ? req.query.skip[0] : req.query.skip;
    const refreshParam = Array.isArray(req.query.refresh) ? req.query.refresh[0] : req.query.refresh;
    const limit = limitParam ? parseInt(limitParam as string) : 10;
    const skip = skipParam ? parseInt(skipParam as string) : 0;

    const refresh = refreshParam === 'true' || refreshParam === '1' || refreshParam === 'yes';

    const payments = await paymentService.getPaymentsByUserId(new ObjectId(userId), limit, skip, { refresh });

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        limit,
        skip,
        total: payments.length,
      },
    });
  } catch (error) {
    console.error('Error getting payments:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get payments',
    });
  }
}

export async function getCheckoutResult(req: Request, res: Response): Promise<void> {
  try {
    const userIdRaw = (req as any).user?.userId;
    if (!userIdRaw || !ObjectId.isValid(String(userIdRaw))) {
      res.status(401).json({ error: 'Unauthorized', message: 'User authentication required' });
      return;
    }

    const externalId = Array.isArray(req.params.externalId) ? req.params.externalId[0] : req.params.externalId;
    if (!externalId) {
      res.status(400).json({ error: 'Bad Request', message: 'External ID is required' });
      return;
    }

    const result = await paymentService.getCheckoutResultForUser(new ObjectId(String(userIdRaw)), String(externalId));

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get checkout result';
    const status = message.includes('not found') ? 404 : message.includes('required') ? 400 : 500;
    res.status(status).json({ error: status === 404 ? 'Not Found' : status === 400 ? 'Bad Request' : 'Internal Server Error', message });
  }
}

export async function webhook(req: Request, res: Response): Promise<void> {
  try {
    // Xendit webhook verification (Callback Token)
    // Set this in Xendit Dashboard and in your env as XENDIT_CALLBACK_TOKEN.
    const expectedToken = process.env.XENDIT_CALLBACK_TOKEN || process.env.XENDIT_WEBHOOK_TOKEN;
    const providedToken = req.get('x-callback-token');

    if (expectedToken && providedToken !== expectedToken) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook token',
      });
      return;
    }

    if (!expectedToken && process.env.NODE_ENV === 'production') {
      console.warn('XENDIT_CALLBACK_TOKEN is not set; webhook requests are not authenticated.');
    }

    const webhookData = req.body;

    await paymentService.handleWebhook(webhookData);

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to process webhook',
    });
  }
}

export async function getAllPayments(req: Request, res: Response): Promise<void> {
  try {
    const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const skipParam = Array.isArray(req.query.skip) ? req.query.skip[0] : req.query.skip;
    const statusParam = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;

    const limit = limitParam ? parseInt(limitParam as string) : 20;
    const skip = skipParam ? parseInt(skipParam as string) : 0;

    const validStatuses = ['pending', 'paid', 'expired', 'failed'];
    const status = statusParam && validStatuses.includes(statusParam as string)
      ? (statusParam as 'pending' | 'paid' | 'expired' | 'failed')
      : undefined;

    const result = await paymentService.getAllPayments(limit, skip, status);

    res.status(200).json({
      success: true,
      data: result.payments,
      pagination: {
        total: result.total,
        limit: result.limit,
        skip: result.skip,
      },
    });
  } catch (error) {
    console.error('Error getting all payments:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get payments',
    });
  }
}
