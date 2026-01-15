import { Collection } from 'mongodb';
import { getDatabase } from '../../../config/database.js';
import { DashboardUser } from '../interfaces/auth.types.js';

const COLLECTION_NAME = 'dashboard_users';

export function getDashboardUserCollection(): Collection<DashboardUser> {
  const db = getDatabase();
  return db.collection<DashboardUser>(COLLECTION_NAME);
}

export async function createDashboardUserIndexes(): Promise<void> {
  const collection = getDashboardUserCollection();
  await collection.createIndex({ username: 1 }, { unique: true });
}
