import { ObjectId } from 'mongodb';
import { getOrderCollection } from '../models/Order.js';
import { ListOrdersQuery, Order, OrderStatus } from '../interfaces/order.types.js';

export async function createOrder(order: Omit<Order, '_id'>): Promise<Order> {
  const collection = getOrderCollection();
  const result = await collection.insertOne(order as Order);
  return { ...order, _id: result.insertedId };
}

export async function findOrderById(id: string): Promise<Order | null> {
  const collection = getOrderCollection();
  return await collection.findOne({ _id: new ObjectId(id) });
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  logEntry: Order['logs'][number],
  updateFields?: Partial<Order>,
): Promise<Order | null> {
  const collection = getOrderCollection();
  const setFields: any = { status, updatedAt: new Date() };
  if (updateFields) {
    Object.assign(setFields, updateFields);
  }
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: setFields,
      $push: { logs: logEntry } as any,
    },
    { returnDocument: 'after' }
  );
  return result;
}

export async function findOrders(query: ListOrdersQuery): Promise<Order[]> {
  const collection = getOrderCollection();
  const filter: any = {};
  if (query.status) filter.status = query.status;
  if (query.userId) filter.userId = new ObjectId(query.userId); // userId stored as ObjectId if possible

  const limit = query.limit || 20;
  const skip = query.skip || 0;

  return await collection
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
}

export async function countOrders(query: ListOrdersQuery): Promise<number> {
  const collection = getOrderCollection();
  const filter: any = {};
  if (query.status) filter.status = query.status;
  if (query.userId) filter.userId = new ObjectId(query.userId);

  return await collection.countDocuments(filter);
}

export async function findPendingOrdersPastPaymentDeadline(): Promise<Order[]> {
  const collection = getOrderCollection();
  const now = new Date();
  return await collection
    .find({
      status: 'pending',
      paymentDeadline: { $exists: true, $lt: now },
    })
    .toArray();
}

export async function findShippedOrdersPastDeliveryDeadline(): Promise<Order[]> {
  const collection = getOrderCollection();
  const now = new Date();
  return await collection
    .find({
      status: 'shipped',
      deliveryConfirmationDeadline: { $exists: true, $lt: now },
    })
    .toArray();
}
