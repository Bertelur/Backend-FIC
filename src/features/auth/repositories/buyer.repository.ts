import { getBuyerCollection, createBuyerIndexes } from '../models/Buyer.js';
import { Buyer } from '../interfaces/auth.types.js';

export async function initializeBuyerIndexes(): Promise<void> {
  await createBuyerIndexes();
}

export async function createBuyer(buyer: Omit<Buyer, '_id' | 'createdAt' | 'updatedAt'>): Promise<Buyer> {
  const collection = getBuyerCollection();
  const now = new Date();
  const newBuyer: Omit<Buyer, '_id'> = {
    ...buyer,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(newBuyer as Buyer);
  return { ...newBuyer, _id: result.insertedId.toString() };
}

export async function findBuyerByEmail(email: string): Promise<Buyer | null> {
  const collection = getBuyerCollection();
  return await collection.findOne({ email });
}

export async function findBuyerByUsername(username: string): Promise<Buyer | null> {
  const collection = getBuyerCollection();
  return await collection.findOne({ username });
}

export async function findBuyerByEmailOrUsername(emailOrUsername: string): Promise<Buyer | null> {
  const collection = getBuyerCollection();
  return await collection.findOne(
    {
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    },
    {
      projection: {
        _id: 1,
        email: 1,
        username: 1,
        password: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  );
}

export async function findBuyerById(id: string): Promise<Buyer | null> {
  const collection = getBuyerCollection();
  return await collection.findOne({ _id: id });
}

export async function findAllBuyers(): Promise<Buyer[]> {
  const collection = getBuyerCollection();
  return await collection.find({}).toArray();
}

export async function countBuyers(): Promise<number> {
  const collection = getBuyerCollection();
  return await collection.countDocuments();
}
