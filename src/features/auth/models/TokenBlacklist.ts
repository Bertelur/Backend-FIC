import { Collection } from 'mongodb';
import { getDatabase } from '../../../config/database.js';

export interface TokenBlacklistEntry {
  _id?: string;
  token: string;
  expiresAt: Date;
}

const COLLECTION_NAME = 'token_blacklist';

export function getTokenBlacklistCollection(): Collection<TokenBlacklistEntry> {
  const db = getDatabase();
  return db.collection<TokenBlacklistEntry>(COLLECTION_NAME);
}

export async function createTokenBlacklistIndexes(): Promise<void> {
  const collection = getTokenBlacklistCollection();

  // Create TTL index on expiresAt to automatically delete expired tokens
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  // Create index on token for fast lookups
  await collection.createIndex({ token: 1 }, { unique: true });
}
