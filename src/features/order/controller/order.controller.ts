import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth.js';
import * as orderService from '../services/order.service.js';
import * as buyerRepo from '../../auth/repositories/buyer.repository.js';
import { CreateOrderRequest, UpdateOrderStatusRequest } from '../interfaces/order.types.js';
import { SHIPPING_BANDS, getShippingCostForDistanceKm } from '../shippingPricing.js';

export async function getShippingPricing(_req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json({ success: true, data: { bands: SHIPPING_BANDS } });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get shipping pricing',
    });
  }
}

export async function calculateShipping(req: Request, res: Response): Promise<void> {
  try {
    const distanceKm = typeof req.body?.distanceKm === 'number' ? req.body.distanceKm : Number(req.body?.distanceKm);
    const costIdr = getShippingCostForDistanceKm(distanceKm);
    res.status(200).json({ success: true, data: { costIdr } });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to calculate shipping',
    });
  }
}

export async function createOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const payload: CreateOrderRequest = req.body;
    if (!payload.items || payload.items.length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'Items are required' });
      return;
    }
    if (!payload.shippingMethod) {
      res.status(400).json({ error: 'Bad Request', message: 'Shipping method is required' });
      return;
    }
    if (payload.shippingMethod === 'shipping' && !payload.shippingAddress) {
      res.status(400).json({ error: 'Bad Request', message: 'Shipping address is required for shipping method' });
      return;
    }

    const order = await orderService.createOrder(userId, payload);
    const { _id, ...rest } = order as any;

    res.status(201).json({ success: true, data: { id: String(_id), ...rest } });
  } catch (error) {
    res.status(400).json({
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Failed to create order',
    });
  }
}

export async function listOrders(req: AuthRequest, res: Response): Promise<void> {
  try {
    const query: any = { ...req.query };

    // If user is not admin/staff, force userId filter to their own
    if (req.user?.role !== 'super-admin' && req.user?.role !== 'staff') {
      query.userId = req.user?.userId;
    }

    const orders = await orderService.listOrders(query);
    const userIds = Array.from(new Set((orders as any[]).map((o) => String(o.userId)).filter(Boolean)));
    const buyerMap = new Map<string, { username?: string; email?: string }>();
    await Promise.all(
      userIds.map(async (uid) => {
        const buyer = await buyerRepo.findBuyerById(uid);
        if (buyer) buyerMap.set(uid, { username: buyer.username, email: buyer.email });
      }),
    );
    const apiOrders = (orders as any[]).map(({ _id, userId, ...rest }) => {
      const uid = String(userId);
      const buyer = buyerMap.get(uid);
      const customerName = buyer?.username || buyer?.email || undefined;
      const customerEmail = buyer?.email;
      return {
        id: String(_id),
        userId: uid,
        ...rest,
        ...(customerName && { customerName }),
        ...(customerEmail && { customerEmail }),
      };
    });
    res.status(200).json({ success: true, data: apiOrders });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to list orders',
    });
  }
}

export async function getOrderById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const order = await orderService.getOrderById(id);

    if (!order) {
      res.status(404).json({ error: 'Not Found', message: 'Order not found' });
      return;
    }

    // Access control
    if (req.user?.role !== 'super-admin' && req.user?.role !== 'staff') {
      if (String(order.userId) !== req.user?.userId) {
        res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to view this order' });
        return;
      }
    }

    const { _id, ...rest } = order as any;
    res.status(200).json({ success: true, data: { id: String(_id), ...rest } });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get order',
    });
  }
}

export async function updateOrderStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { status, note } = req.body as UpdateOrderStatusRequest;
    const userId = req.user?.userId;
    const role = req.user?.role || (req.user?.type === 'buyer' ? 'buyer' : 'unknown');

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!status) {
      res.status(400).json({ error: 'Bad Request', message: 'Status is required' });
      return;
    }

    const updated = await orderService.updateOrderStatus(id, status, userId, role, note);
    const { _id, ...rest } = updated as any;
    res.status(200).json({ success: true, data: { id: String(_id), ...rest } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update order status';
    // If it's a validation error (logic), return 400. If 404, return 404.
    if (message === 'Order not found') {
      res.status(404).json({ error: 'Not Found', message });
    } else {
      res.status(400).json({ error: 'Bad Request', message });
    }
  }
}
