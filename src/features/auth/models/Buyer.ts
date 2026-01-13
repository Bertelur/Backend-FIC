import { Collection } from "mongodb";
import { getDatabase } from "../../../config/database";
import { Buyer } from "../interfaces/auth.types";

const COLLECTION_NAME = "buyers";

export function getBuyerCollection(): Collection<Buyer> {
  const db = getDatabase();
  return db.collection<Buyer>(COLLECTION_NAME);
}

export async function createBuyerIndexes(): Promise<void> {
  const collection = getBuyerCollection();
  await collection.createIndex({ email: 1 }, { unique: true });
  await collection.createIndex({ username: 1 }, { unique: true });
}
