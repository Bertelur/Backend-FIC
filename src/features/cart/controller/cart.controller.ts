import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import * as cartService from '../services/cart.service.js';
import type { AddCartItemRequest, UpdateCartItemRequest, CheckoutCartRequest } from '../interfaces/cart.types.js';

function getBuyerId(req: Request): ObjectId {
  const userId = (req as any).user?.userId;
  if (!userId || !ObjectId.isValid(String(userId))) {
    throw new Error('Invalid userId');
  }
  return new ObjectId(String(userId));
}

export async function getMyCart(req: Request, res: Response): Promise<void> {
  try {
    const userId = getBuyerId(req);
    const cart = await cartService.getMyCart(userId);
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    res.status(400).json({ error: 'Bad Request', message: error instanceof Error ? error.message : 'Failed to get cart' });
  }
}

export async function addCartItem(req: Request, res: Response): Promise<void> {
  try {
    const userId = getBuyerId(req);
    const body = req.body as AddCartItemRequest;
    const result = await cartService.addItem(userId, (body as any).productId, (body as any).quantity);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add item';
    const status = message.includes('not found')
      ? 404
      : message.includes('Checkout in progress') || message.includes('Insufficient stock') || message.includes('active checkout')
        ? 409
        : 400;
    res
      .status(status)
      .json({ error: status === 404 ? 'Not Found' : status === 409 ? 'Conflict' : 'Bad Request', message });
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
    const message = error instanceof Error ? error.message : 'Failed to update item';
    const status = message.includes('not found')
      ? 404
      : message.includes('Checkout in progress') || message.includes('Insufficient stock') || message.includes('active checkout')
        ? 409
        : 400;
    res
      .status(status)
      .json({ error: status === 404 ? 'Not Found' : status === 409 ? 'Conflict' : 'Bad Request', message });
  }
}

export async function removeCartItem(req: Request, res: Response): Promise<void> {
  try {
    const userId = getBuyerId(req);
    const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
    const result = await cartService.removeItem(userId, String(productId));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove item';
    const status = message.includes('Checkout in progress') || message.includes('active checkout') ? 409 : 400;
    res.status(status).json({ error: status === 409 ? 'Conflict' : 'Bad Request', message });
  }
}

export async function clearCart(req: Request, res: Response): Promise<void> {
  try {
    const userId = getBuyerId(req);
    const result = await cartService.clearCart(userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear cart';
    const status = message.includes('Checkout in progress') || message.includes('active checkout') ? 409 : 400;
    res.status(status).json({ error: status === 409 ? 'Conflict' : 'Bad Request', message });
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
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to checkout cart';
    const status = message.includes('not found')
      ? 404
      : message.includes('Checkout in progress') || message.includes('Insufficient stock') || message.includes('active checkout')
        ? 409
        : 400;
    res
      .status(status)
      .json({ error: status === 404 ? 'Not Found' : status === 409 ? 'Conflict' : 'Bad Request', message });
  }
}
