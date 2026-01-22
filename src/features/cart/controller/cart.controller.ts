import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import * as cartService from '../services/cart.service.js';
import type { AddCartItemRequest, UpdateCartItemRequest, CheckoutCartRequest } from '../interfaces/cart.types.js';

class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

function getBuyerId(req: Request): ObjectId {
  const user = (req as any).user;
  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }
  const userId = user.userId;
  if (!userId || !ObjectId.isValid(String(userId))) {
    throw new UnauthorizedError('Invalid user token');
  }
  return new ObjectId(String(userId));
}

function handleError(res: Response, error: unknown, defaultMessage: string): void {
  if (error instanceof UnauthorizedError) {
    res.status(401).json({ error: 'Unauthorized', message: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : defaultMessage;
  const status = message.includes('not found')
    ? 404
    : message.includes('Checkout in progress') || message.includes('Insufficient stock') || message.includes('active checkout')
      ? 409
      : 400;
  res.status(status).json({
    error: status === 404 ? 'Not Found' : status === 409 ? 'Conflict' : 'Bad Request',
    message,
  });
}

export async function getMyCart(req: Request, res: Response): Promise<void> {
  try {
    const userId = getBuyerId(req);
    const cart = await cartService.getMyCart(userId);
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    handleError(res, error, 'Failed to get cart');
  }
}

export async function addCartItem(req: Request, res: Response): Promise<void> {
  try {
    const userId = getBuyerId(req);
    const body = req.body as AddCartItemRequest;
    const result = await cartService.addItem(userId, (body as any).productId, (body as any).quantity);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Failed to add item');
  }
}

export async function updateCartItem(req: Request, res: Response): Promise<void> {
  try {
    const userId = getBuyerId(req);
    const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
    const body = req.body as UpdateCartItemRequest;
    const result = await cartService.updateItem(userId, String(productId), (body as any).quantity);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Failed to update item');
  }
}

export async function removeCartItem(req: Request, res: Response): Promise<void> {
  try {
    const userId = getBuyerId(req);
    const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
    const result = await cartService.removeItem(userId, String(productId));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Failed to remove item');
  }
}

export async function clearCart(req: Request, res: Response): Promise<void> {
  try {
    const userId = getBuyerId(req);
    const result = await cartService.clearCart(userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Failed to clear cart');
  }
}

export async function checkoutCart(req: Request, res: Response): Promise<void> {
  try {
    const userId = getBuyerId(req);
    const body = (req.body ?? {}) as CheckoutCartRequest;
    const result = await cartService.checkoutCart(userId, {
      productIds: Array.isArray((body as any).productIds) ? (body as any).productIds : undefined,
      currency: (body as any).currency,
      invoiceDuration: (body as any).invoiceDuration,
      description: (body as any).description,
      successRedirectUrl: (body as any).successRedirectUrl,
      failureRedirectUrl: (body as any).failureRedirectUrl,
      forceNew: Boolean((body as any).forceNew),
      shippingAddress: (body as any).shippingAddress,
      additionalNotes: (body as any).additionalNotes,
      deliveryMethod: (body as any).deliveryMethod,
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Failed to checkout cart');
  }
}
