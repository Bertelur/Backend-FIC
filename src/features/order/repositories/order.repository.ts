import { ObjectId } from 'mongodb';
import { getOrderCollection } from '../models/Order.js';
import { ListOrdersQuery, Order, OrderStatus } from '../interfaces/order.types.js';

/** Order statuses that count as "sales" for combined reports. */
export const SALES_ORDER_STATUSES: OrderStatus[] = [
  'processing',
  'shipped',
  'delivered',
  'ready_for_pickup',
  'completed',
];

export type OrderReportDateField = 'createdAt' | 'updatedAt';

export interface OrdersSalesTotalsAggregate {
  ordersCount: number;
  totalSalesAmount: number;
  totalOrderItemsQty: number;
}

export interface OrdersItemBreakdownRow {
  productId?: string;
  sku?: string;
  name: string;
  ordersCount: number;
  quantity: number;
  salesAmount: number;
}

function buildOrderDateMatch(dateField: OrderReportDateField, from?: Date, to?: Date): any {
  if (!from && !to) return {};
  const q: any = {};
  if (from) q.$gte = from;
  if (to) q.$lte = to;
  return { [dateField]: q };
}

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

export async function getOrdersSalesTotalsAggregate(input: {
  from?: Date;
  to?: Date;
  dateField?: OrderReportDateField;
}): Promise<OrdersSalesTotalsAggregate> {
  const collection = getOrderCollection();
  const dateField: OrderReportDateField = input.dateField ?? 'createdAt';

  const match: any = {
    status: { $in: SALES_ORDER_STATUSES },
    ...buildOrderDateMatch(dateField, input.from, input.to),
  };

  const result = await collection
    .aggregate([
      { $match: match },
      {
        $addFields: {
          itemsQty: {
            $sum: {
              $map: {
                input: { $ifNull: ['$items', []] },
                as: 'i',
                in: { $ifNull: ['$$i.quantity', 0] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          ordersCount: { $sum: 1 },
          totalSalesAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
          totalOrderItemsQty: { $sum: { $ifNull: ['$itemsQty', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          ordersCount: 1,
          totalSalesAmount: 1,
          totalOrderItemsQty: 1,
        },
      },
    ])
    .toArray();

  return (
    (result[0] as OrdersSalesTotalsAggregate | undefined) ?? {
      ordersCount: 0,
      totalSalesAmount: 0,
      totalOrderItemsQty: 0,
    }
  );
}

export async function getOrdersItemBreakdown(input: {
  from?: Date;
  to?: Date;
  dateField?: OrderReportDateField;
  limit?: number;
}): Promise<OrdersItemBreakdownRow[]> {
  const collection = getOrderCollection();
  const dateField: OrderReportDateField = input.dateField ?? 'createdAt';
  const limit = Math.min(Math.max(input.limit ?? 5000, 1), 20000);

  const match: any = {
    status: { $in: SALES_ORDER_STATUSES },
    ...buildOrderDateMatch(dateField, input.from, input.to),
  };

  return await collection
    .aggregate([
      { $match: match },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: {
            productId: '$items.productId',
            sku: '$items.sku',
            name: '$items.name',
          },
          orderIds: { $addToSet: '$_id' },
          quantity: { $sum: { $ifNull: ['$items.quantity', 0] } },
          salesAmount: { $sum: { $ifNull: ['$items.totalPrice', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          productId: { $toString: '$_id.productId' },
          sku: '$_id.sku',
          name: '$_id.name',
          ordersCount: { $size: '$orderIds' },
          quantity: 1,
          salesAmount: 1,
        },
      },
      { $sort: { salesAmount: -1 } },
      { $limit: limit },
    ])
    .toArray() as any;
}
