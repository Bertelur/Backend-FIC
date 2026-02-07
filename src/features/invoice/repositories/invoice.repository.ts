import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../config/database.js';
import type { Invoice } from '../models/Invoice.js';

const COLLECTION_NAME = 'invoices';

function getCollection() {
  const db = getDatabase();
  return db.collection<Invoice>(COLLECTION_NAME);
}

export async function createInvoice(data: Omit<Invoice, '_id' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
  const collection = getCollection();

  const now = new Date();
  const invoice: Invoice = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(invoice);
  invoice._id = result.insertedId;

  return invoice;
}

export async function findInvoiceById(id: ObjectId): Promise<Invoice | null> {
  const collection = getCollection();
  return await collection.findOne({ _id: id });
}

export async function findInvoiceByXenditInvoiceId(xenditInvoiceId: string): Promise<Invoice | null> {
  const collection = getCollection();
  return await collection.findOne({ xenditInvoiceId });
}

export async function findInvoiceByPaymentExternalId(paymentExternalId: string): Promise<Invoice | null> {
  const collection = getCollection();
  return await collection.findOne({ paymentExternalId });
}

export interface ListInvoicesFilter {
  userId?: ObjectId;
  search?: string;
  status?: string;
  paymentMethod?: string;
  from?: Date;
  to?: Date;
}

function buildListInvoicesFilter(filter: ListInvoicesFilter): any {
  const q: any = {};
  if (filter.userId) q.userId = filter.userId;
  if (filter.status) q.status = filter.status;
  if (filter.paymentMethod) q.paymentMethod = filter.paymentMethod;
  if (filter.search && filter.search.trim()) {
    const s = filter.search.trim();
    q.$or = [
      { paymentExternalId: { $regex: s, $options: 'i' } },
      { 'customer.email': { $regex: s, $options: 'i' } },
      { xenditInvoiceId: { $regex: s, $options: 'i' } },
    ];
  }
  if (filter.from || filter.to) {
    q.createdAt = {};
    if (filter.from) q.createdAt.$gte = filter.from;
    if (filter.to) q.createdAt.$lte = filter.to;
  }
  return q;
}

export async function listInvoices(
  filter: ListInvoicesFilter,
  limit: number,
  skip: number,
): Promise<Invoice[]> {
  const collection = getCollection();
  const q = buildListInvoicesFilter(filter);
  return await collection.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
}

export async function listInvoicesForExport(filter: {
  userId?: ObjectId;
  from?: Date;
  to?: Date;
}, limit: number): Promise<Invoice[]> {
  const collection = getCollection();
  const q: any = {};
  if (filter.userId) q.userId = filter.userId;

  if (filter.from || filter.to) {
    q.createdAt = {};
    if (filter.from) q.createdAt.$gte = filter.from;
    if (filter.to) q.createdAt.$lte = filter.to;
  }

  return await collection
    .find(q)
    .sort({ createdAt: -1 })
    .limit(Math.max(0, limit))
    .toArray();
}

export async function countInvoices(filter: ListInvoicesFilter): Promise<number> {
  const collection = getCollection();
  const q = buildListInvoicesFilter(filter);
  return await collection.countDocuments(q);
}

export async function initializeInvoiceIndexes(): Promise<void> {
  const collection = getCollection();
  await collection.createIndex({ paymentExternalId: 1 }, { unique: true });
  await collection.createIndex({ xenditInvoiceId: 1 }, { unique: true });
  await collection.createIndex({ userId: 1 });
  await collection.createIndex({ createdAt: -1 });
}

export type InvoiceReportDateField = 'createdAt' | 'paidAt';

export interface InvoicesSalesTotalsAggregate {
  ordersCount: number;
  totalSalesAmount: number;
  totalOrderItemsQty: number;
}

export interface InvoicesItemBreakdownRow {
  productId?: string;
  sku?: string;
  name: string;
  ordersCount: number;
  quantity: number;
  salesAmount: number;
}

function buildDateMatch(dateField: InvoiceReportDateField, from?: Date, to?: Date): any {
  if (!from && !to) return {};
  const q: any = {};
  if (from) q.$gte = from;
  if (to) q.$lte = to;
  return { [dateField]: q };
}

export async function getInvoicesSalesTotalsAggregate(input: {
  userId?: ObjectId;
  from?: Date;
  to?: Date;
  dateField?: InvoiceReportDateField;
}): Promise<InvoicesSalesTotalsAggregate> {
  const collection = getCollection();
  const dateField: InvoiceReportDateField = input.dateField ?? 'paidAt';

  const match: any = {
    ...(input.userId ? { userId: input.userId } : {}),
    ...buildDateMatch(dateField, input.from, input.to),
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
          totalSalesAmount: { $sum: { $ifNull: ['$amount', 0] } },
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
    (result[0] as InvoicesSalesTotalsAggregate | undefined) ?? {
      ordersCount: 0,
      totalSalesAmount: 0,
      totalOrderItemsQty: 0,
    }
  );
}

export async function getInvoicesItemBreakdown(input: {
  userId?: ObjectId;
  from?: Date;
  to?: Date;
  dateField?: InvoiceReportDateField;
  limit?: number;
}): Promise<InvoicesItemBreakdownRow[]> {
  const collection = getCollection();
  const dateField: InvoiceReportDateField = input.dateField ?? 'paidAt';
  const limit = Math.min(Math.max(input.limit ?? 5000, 1), 20000);

  const match: any = {
    ...(input.userId ? { userId: input.userId } : {}),
    ...buildDateMatch(dateField, input.from, input.to),
  };

  return await collection
    .aggregate([
      { $match: match },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          itemQty: { $ifNull: ['$items.quantity', 0] },
          itemPrice: { $ifNull: ['$items.price', 0] },
        },
      },
      {
        $group: {
          _id: {
            productId: '$items.productId',
            sku: '$items.sku',
            name: '$items.name',
          },
          invoiceIds: { $addToSet: '$_id' },
          quantity: { $sum: '$itemQty' },
          salesAmount: { $sum: { $multiply: ['$itemQty', '$itemPrice'] } },
        },
      },
      {
        $project: {
          _id: 0,
          productId: { $toString: '$_id.productId' },
          sku: '$_id.sku',
          name: '$_id.name',
          ordersCount: { $size: '$invoiceIds' },
          quantity: 1,
          salesAmount: 1,
        },
      },
      { $sort: { salesAmount: -1 } },
      { $limit: limit },
    ])
    .toArray() as any;
}
