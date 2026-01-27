import { Collection } from 'mongodb';
import { getDatabase } from '../../../config/database.js';
import { Order } from '../interfaces/order.types.js';

const COLLECTION_NAME = 'orders';

export function getOrderCollection(): Collection<Order> {
  const db = getDatabase();
  return db.collection<Order>(COLLECTION_NAME);
}

export async function createOrderIndexes(): Promise<void> {
  const collection = getOrderCollection();
  await collection.createIndex({ userId: 1 });
  await collection.createIndex({ status: 1 });
  await collection.createIndex({ createdAt: -1 });
}
