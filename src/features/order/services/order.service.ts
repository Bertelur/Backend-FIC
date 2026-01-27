import { ObjectId } from 'mongodb';
import { CreateOrderRequest, Order, OrderItem, OrderLog, OrderStatus } from '../interfaces/order.types.js';
import * as orderRepo from '../repositories/order.repository.js';
import * as productRepo from '../../product/repositories/product.repository.js';
import * as unitRepo from '../../unit/repositories/unit.repository.js';

export async function createOrder(
  userId: string,
  request: CreateOrderRequest
): Promise<Order> {
  const items: OrderItem[] = [];
  let totalAmount = 0;

  for (const itemRequest of request.items) {
    const product = await productRepo.findProductByIdAny(itemRequest.productId);
    if (!product) {
      throw new Error(`Product not found: ${itemRequest.productId}`);
    }

    if (product.stock < itemRequest.quantity) {
      throw new Error(`Insufficient stock for product: ${product.name}`);
    }

    // Determine price based on unit
    const price = product.price;

    // Fetch unit name
    const unitDoc = await unitRepo.findUnitById(String(product.unitId));
    const unitName = unitDoc ? unitDoc.name : 'unknown';

    const totalPrice = price * itemRequest.quantity;
    totalAmount += totalPrice;

    items.push({
      productId: String(product._id),
      sku: product.sku,
      name: product.name,
      price,
      quantity: itemRequest.quantity,
      unit: unitName,
      totalPrice,
      imageUrl: product.image?.url,
    });

    // Decrease stock (simplistic approach, ideally use transaction)
    await productRepo.updateProductByIdAny(String(product._id), {
      stock: product.stock - itemRequest.quantity
    });
  }

  const now = new Date();
  const initialLog: OrderLog = {
    status: 'pending',
    timestamp: now,
    note: 'Order created',
    by: userId,
  };

  const newOrder: Omit<Order, '_id'> = {
    userId: new ObjectId(userId),
    items,
    totalAmount,
    shippingMethod: request.shippingMethod,
    shippingAddress: request.shippingAddress,
    status: 'pending',
    logs: [initialLog],
    createdAt: now,
    updatedAt: now,
  };

  return await orderRepo.createOrder(newOrder);
}

export async function listOrders(query: any) {
  return await orderRepo.findOrders(query);
}

export async function getOrderById(id: string): Promise<Order | null> {
  return await orderRepo.findOrderById(id);
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  userId: string,
  role: string, // 'super-admin', 'staff', 'buyer'
  note?: string
): Promise<Order> {
  const order = await orderRepo.findOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // State Machine Validation
  const currentStatus = order.status;

  // Rules based on user request:
  // Shipping Flow: pending -> processing -> shipped -> delivered -> completed
  // Pickup Flow: pending -> processing -> ready_for_pickup -> completed (manual verification)

  // Permission Checks & Transitions
  let valid = false;

  if (role === 'buyer') {
    // Buyer can only mark 'delivered' (verification)
    if (currentStatus === 'shipped' && newStatus === 'delivered') valid = true;
    // Buyer can cancel if pending? Maybe. Request didn't specify. Let's allow canceling if pending.
    if (currentStatus === 'pending' && newStatus === 'cancelled') valid = true;
  } else {
    // Admin/Staff
    if (currentStatus === 'pending' && newStatus === 'processing') valid = true;
    if (currentStatus === 'pending' && newStatus === 'cancelled') valid = true;

    if (order.shippingMethod === 'shipping') {
      if (currentStatus === 'processing' && newStatus === 'shipped') valid = true;
      // Admin can force complete? Typically 'delivered' -> 'completed'.
      if (currentStatus === 'delivered' && newStatus === 'completed') valid = true;
      // Admin cancelling during processing
      if (currentStatus === 'processing' && newStatus === 'cancelled') valid = true;
    } else {
      // Pickup
      if (currentStatus === 'processing' && newStatus === 'ready_for_pickup') valid = true;
      if (currentStatus === 'ready_for_pickup' && newStatus === 'completed') valid = true;
      // Cancel
      if (currentStatus === 'processing' && newStatus === 'cancelled') valid = true;
    }
  }

  if (!valid) {
    throw new Error(`Invalid status transition from '${currentStatus}' to '${newStatus}' for role '${role}'`);
  }

  const logEntry: OrderLog = {
    status: newStatus,
    timestamp: new Date(),
    note,
    by: userId,
  };

  const updated = await orderRepo.updateOrderStatus(orderId, newStatus, logEntry);
  if (!updated) throw new Error('Failed to update order status');

  return updated;
}
