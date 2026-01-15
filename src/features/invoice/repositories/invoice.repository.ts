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

export async function listInvoices(
  filter: { userId?: ObjectId },
  limit: number,
  skip: number,
): Promise<Invoice[]> {
  const collection = getCollection();
  const q: any = {};
  if (filter.userId) q.userId = filter.userId;
  return await collection.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
}

export async function countInvoices(filter: { userId?: ObjectId }): Promise<number> {
  const collection = getCollection();
  const q: any = {};
  if (filter.userId) q.userId = filter.userId;
  return await collection.countDocuments(q);
}

export async function initializeInvoiceIndexes(): Promise<void> {
  const collection = getCollection();
  await collection.createIndex({ paymentExternalId: 1 }, { unique: true });
  await collection.createIndex({ xenditInvoiceId: 1 }, { unique: true });
  await collection.createIndex({ userId: 1 });
  await collection.createIndex({ createdAt: -1 });
}
