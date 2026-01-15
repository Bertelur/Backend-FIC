import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../config/database.js';
import type { Payment } from '../models/Payment.js';

const COLLECTION_NAME = 'payments';

export interface PaymentsOverviewAggregate {
  totalInvoicesCount: number;
  totalAmount: number;

  paidCount: number;
  paidAmount: number;

  pendingCount: number;
  pendingAmount: number;

  expiredCount: number;
  expiredAmount: number;

  failedCount: number;
  failedAmount: number;

  withdrawableCount: number;
  withdrawableAmount: number;

  pendingWithdrawalCount: number;
  pendingWithdrawalAmount: number;

  minPendingWithdrawalPaidAt?: Date;
}

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

export async function findPaymentsByExternalIds(externalIds: string[]): Promise<Payment[]> {
  const db = getDatabase();
  const collection = db.collection<Payment>(COLLECTION_NAME);

  const ids = (externalIds ?? []).map((v) => String(v ?? '').trim()).filter((v) => v.length > 0);
  if (ids.length === 0) return [];

  return await collection.find({ externalId: { $in: ids } }).toArray();
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

  const updateResult = await collection.updateOne({ externalId }, { $set: updateData });
  if (updateResult.matchedCount === 0) return null;

  return await collection.findOne({ externalId });
}

export async function markPaymentStockReleased(
  externalId: string,
  releasedAt: Date = new Date(),
  opts?: { session?: any },
): Promise<boolean> {
  const db = getDatabase();
  const collection = db.collection<Payment>(COLLECTION_NAME);

  const result = await collection.updateOne(
    {
      externalId,
      stockReservedAt: { $exists: true },
      $or: [{ stockReleasedAt: { $exists: false } }, { stockReleasedAt: null }],
    } as any,
    { $set: { stockReleasedAt: releasedAt, updatedAt: new Date() } },
    opts?.session ? { session: opts.session } : undefined,
  );

  return result.modifiedCount === 1;
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

export async function findPaidPaymentsByUserId(
  userId: ObjectId,
  limit: number = 200,
): Promise<Payment[]> {
  const db = getDatabase();
  const collection = db.collection<Payment>(COLLECTION_NAME);

  return await collection
    .find({ userId, status: 'paid' })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 500))
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

export async function getPaymentsOverviewAggregate(input: {
  from: Date;
  to: Date;
  withdrawableCutoff: Date;
}): Promise<PaymentsOverviewAggregate> {
  const db = getDatabase();
  const collection = db.collection<Payment>(COLLECTION_NAME);

  const from = input.from;
  const to = input.to;
  const cutoff = input.withdrawableCutoff;

  const result = await collection
    .aggregate([
      {
        $match: {
          createdAt: {
            $gte: from,
            $lt: to,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalInvoicesCount: { $sum: 1 },
          totalAmount: { $sum: '$amount' },

          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
          paidAmount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },

          pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },

          expiredCount: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
          expiredAmount: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, '$amount', 0] } },

          failedCount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          failedAmount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, '$amount', 0] } },

          withdrawableCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'paid'] },
                    { $ne: ['$paidAt', null] },
                    { $lte: ['$paidAt', cutoff] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          withdrawableAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'paid'] },
                    { $ne: ['$paidAt', null] },
                    { $lte: ['$paidAt', cutoff] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },

          pendingWithdrawalCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'paid'] },
                    { $ne: ['$paidAt', null] },
                    { $gt: ['$paidAt', cutoff] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          pendingWithdrawalAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'paid'] },
                    { $ne: ['$paidAt', null] },
                    { $gt: ['$paidAt', cutoff] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },

          minPendingWithdrawalPaidAt: {
            $min: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'paid'] },
                    { $ne: ['$paidAt', null] },
                    { $gt: ['$paidAt', cutoff] },
                  ],
                },
                '$paidAt',
                null,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalInvoicesCount: 1,
          totalAmount: 1,
          paidCount: 1,
          paidAmount: 1,
          pendingCount: 1,
          pendingAmount: 1,
          expiredCount: 1,
          expiredAmount: 1,
          failedCount: 1,
          failedAmount: 1,
          withdrawableCount: 1,
          withdrawableAmount: 1,
          pendingWithdrawalCount: 1,
          pendingWithdrawalAmount: 1,
          minPendingWithdrawalPaidAt: 1,
        },
      },
    ])
    .toArray();

  const first = result[0] as PaymentsOverviewAggregate | undefined;
  return (
    first ?? {
      totalInvoicesCount: 0,
      totalAmount: 0,
      paidCount: 0,
      paidAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      expiredCount: 0,
      expiredAmount: 0,
      failedCount: 0,
      failedAmount: 0,
      withdrawableCount: 0,
      withdrawableAmount: 0,
      pendingWithdrawalCount: 0,
      pendingWithdrawalAmount: 0,
      minPendingWithdrawalPaidAt: undefined,
    }
  );
}
