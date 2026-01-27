import { Collection } from 'mongodb';
import { getDatabase } from '../../../config/database.js';
import { Unit } from '../interfaces/unit.types.js';

const COLLECTION_NAME = 'units';

export function getUnitCollection(): Collection<Unit> {
  const db = getDatabase();
  return db.collection<Unit>(COLLECTION_NAME);
}

export async function createUnitIndexes(): Promise<void> {
  const collection = getUnitCollection();
  await collection.createIndex({ name: 1 }, { unique: true });
}
