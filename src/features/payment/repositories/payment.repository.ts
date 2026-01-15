import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../config/database.js';
import type { Payment } from '../models/Payment.js';

const COLLECTION_NAME = 'payments';

export async function createPayment(paymentData: Omit<Payment, '_id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
  const db = getDatabase();
  const collection = db.collection<Payment>(COLLECTION_NAME);

  const now = new Date();
  const payment: Payment = {
    ...paymentData,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(payment);
  payment._id = result.insertedId;

  return payment;
}

export async function findPaymentByExternalId(externalId: string): Promise<Payment | null> {
  const db = getDatabase();
  const collection = db.collection<Payment>(COLLECTION_NAME);

  return await collection.findOne({ externalId });
}

export async function findPaymentByXenditId(xenditInvoiceId: string): Promise<Payment | null> {
  const db = getDatabase();
  const collection = db.collection<Payment>(COLLECTION_NAME);

  return await collection.findOne({ xenditInvoiceId });
}

export async function updatePaymentStatus(
  externalId: string,
  status: Payment['status'],
  paidAt?: Date,
  paymentMethod?: string,
): Promise<Payment | null> {
  const db = getDatabase();
  const collection = db.collection<Payment>(COLLECTION_NAME);

  const updateData: Partial<Payment> = {
    status,
    updatedAt: new Date(),
  };

  if (paidAt) {
    updateData.paidAt = paidAt;
  }

  if (paymentMethod) {
    updateData.paymentMethod = paymentMethod;
  }

  const result = await collection.findOneAndUpdate(
    { externalId },
    { $set: updateData },
    { returnDocument: 'after' },
  );

  return (result as any)?.value ?? null;
}

export async function findPaymentsByUserId(userId: ObjectId, limit: number = 10, skip: number = 0): Promise<Payment[]> {
  const db = getDatabase();
  const collection = db.collection<Payment>(COLLECTION_NAME);

  return await collection
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .toArray();
}

export async function initializePaymentIndexes(): Promise<void> {
  const db = getDatabase();
  const collection = db.collection<Payment>(COLLECTION_NAME);

  await collection.createIndex({ externalId: 1 }, { unique: true });
  await collection.createIndex({ xenditInvoiceId: 1 }, { unique: true });
  await collection.createIndex({ userId: 1 });
  await collection.createIndex({ status: 1 });
  await collection.createIndex({ createdAt: -1 });
}
