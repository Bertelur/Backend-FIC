import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../config/database.js';
import type { Cart } from '../models/Cart.js';

const COLLECTION_NAME = 'carts';

function getCollection() {
  const db = getDatabase();
  return db.collection<Cart>(COLLECTION_NAME);
}

export async function getOrCreateCart(userId: ObjectId): Promise<Cart> {
  const collection = getCollection();

  const existing = await collection.findOne({ userId });
  if (existing) return existing;

  const now = new Date();
  const cart: Cart = {
    userId,
    items: [],
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(cart);
  cart._id = result.insertedId;
  return cart;
}

export async function updateCart(userId: ObjectId, update: Partial<Cart>): Promise<Cart> {
  const collection = getCollection();
  await collection.updateOne(
    { userId },
    { $set: { ...update, updatedAt: new Date() } },
    { upsert: true },
  );
  const cart = await collection.findOne({ userId });
  if (!cart) throw new Error('Cart not found');
  return cart;
}

export async function clearCartCheckout(userId: ObjectId): Promise<void> {
  const collection = getCollection();
  await collection.updateOne(
    { userId },
    {
      $set: {
        activeCheckoutExternalId: undefined,
        activeCheckoutCreatedAt: undefined,
        activeCheckoutProductIds: undefined,
        activeCheckouts: [],
        updatedAt: new Date(),
      },
    },
  );
}

export async function clearCartCheckoutIfMatches(userId: ObjectId, externalId: string): Promise<void> {
  const collection = getCollection();
  const now = new Date();
  await collection.updateOne(
    { userId },
    {
      $pull: { activeCheckouts: { externalId } } as any,
      $set: { updatedAt: now } as adny,
    } as any,
  );

  // Back-compat: clear legacy marker if it points to this checkout.
  await collection.updateOne(
    { userId, activeCheckoutExternalId: externalId },
    {
      $set: {
        activeCheckoutExternalId: undefined,
        activeCheckoutCreatedAt: undefined,
        activeCheckoutProductIds: undefined,
        updatedAt: now,
      },
    },
  );
}

export async function finalizeCheckoutIfMatches(userId: ObjectId, externalId: string): Promise<void> {
  const collection = getCollection();
  const now = new Date();

  // Prefer new array-based checkout tracking.
  const cart = await collection.findOne({ userId });
  const entry = cart?.activeCheckouts?.find((c) => c.externalId === externalId);
  const checkoutIds = Array.isArray(entry?.productIds) && entry!.productIds.length > 0
    ? entry!.productIds
    : Array.isArray(cart?.activeCheckoutProductIds)
      ? cart!.activeCheckoutProductIds!
      : [];

  if (checkoutIds.length > 0) {
    await collection.updateOne(
      { userId },
      {
        $pull: {
          items: { productId: { $in: checkoutIds } },
          activeCheckouts: { externalId },
        } as any,
        $set: { updatedAt: now } as any,
      } as any,
    );
  } else {
    await collection.updateOne(
      { userId },
      { $pull: { activeCheckouts: { externalId } } as any, $set: { updatedAt: now } as any } as any,
    );
  }

  // Back-compat: clear legacy marker if it points to this checkout.
  await collection.updateOne(
    { userId, activeCheckoutExternalId: externalId },
    {
      $set: {
        activeCheckoutExternalId: undefined,
        activeCheckoutCreatedAt: undefined,
        activeCheckoutProductIds: undefined,
        updatedAt: now,
      },
    },
  );
}

export async function initializeCartIndexes(): Promise<void> {
  const collection = getCollection();
  await collection.createIndex({ userId: 1 }, { unique: true });
  await collection.createIndex({ updatedAt: -1 });
}
