import { ClientSession, ObjectId } from 'mongodb';
import { getDatabase } from '../../../config/database.js';
import type { Product } from '../models/Product.js';
import type { ListProductsQuery } from '../interfaces/product.types.js';

const COLLECTION_NAME = 'products';

function isDebugEnabled(): boolean {
  const v = process.env.PRODUCT_DEBUG;
  return v === '1' || v === 'true' || v === 'yes';
}

function normalizeId(id: string): string {
  return String(id).trim();
}

function getCollection() {
  const db = getDatabase();
  return db.collection<Product>(COLLECTION_NAME);
}

export async function findProducts(query: ListProductsQuery): Promise<Product[]> {
  const collection = getCollection();

  const filter: any = {};
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.unitId) {
    try {
      filter.unitId = new ObjectId(query.unitId);
    } catch {
      filter.unitId = query.unitId;
    }
  }

  if (query.q) {
    const q = query.q.trim();
    if (q.length > 0) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
    }
  }

  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const skip = Math.max(query.skip ?? 0, 0);

  return await collection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
}

export async function reserveStockExact(
  reservations: Array<{ id: ObjectId | string; quantity: number }>,
  session: ClientSession
): Promise<void> {
  if (reservations.length === 0) return;

  const collection = getCollection();

  for (const reservation of reservations) {
    if (reservation.quantity <= 0) continue;

    const result = await collection.updateOne(
      { _id: reservation.id as any, stock: { $gte: reservation.quantity } } as any,
      { $inc: { stock: -reservation.quantity } },
      { session }
    );

    if (result.modifiedCount !== 1) {
      throw new Error('Insufficient stock');
    }
  }
}

export async function releaseStockAny(
  releases: Array<{ productId: string; productIdType?: 'objectId' | 'string'; quantity: number }>,
  session?: ClientSession
): Promise<void> {
  if (releases.length === 0) return;

  const collection = getCollection();

  for (const release of releases) {
    if (!release.productId || release.quantity <= 0) continue;

    let exactId: ObjectId | string | undefined;

    if (release.productIdType === 'objectId' && ObjectId.isValid(release.productId)) {
      exactId = new ObjectId(release.productId);
    } else if (release.productIdType === 'string') {
      exactId = release.productId;
    } else {
      const product = await findProductByIdAny(release.productId);
      exactId = product?._id;
    }

    if (!exactId) continue;

    const options = session ? { session } : {};
    await collection.updateOne({ _id: exactId as any } as any, { $inc: { stock: release.quantity } }, options);
  }
}

export async function countProducts(query: ListProductsQuery): Promise<number> {
  const collection = getCollection();

  const filter: any = {};
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.unitId) {
    try {
      filter.unitId = new ObjectId(query.unitId);
    } catch {
      filter.unitId = query.unitId;
    }
  }

  if (query.q) {
    const q = query.q.trim();
    if (q.length > 0) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
    }
  }

  return await collection.countDocuments(filter);
}

export async function findProductById(id: ObjectId): Promise<Product | null> {
  const collection = getCollection();
  return await collection.findOne({ _id: id });
}

export async function findProductByIdAny(id: string): Promise<Product | null> {
  const collection = getCollection();

  const normalizedId = normalizeId(id);

  if (ObjectId.isValid(normalizedId)) {
    const byObjectId = await collection.findOne({ _id: new ObjectId(normalizedId) });
    if (byObjectId) {
      if (isDebugEnabled()) {
        console.log(`[product] findByIdAny hit ObjectId ns=${collection.namespace} id=${normalizedId}`);
      }
      return byObjectId;
    }
  }

  const byString = await collection.findOne({ _id: normalizedId as any });
  if (!byString && isDebugEnabled()) {
    console.log(
      `[product] findByIdAny miss ns=${collection.namespace} id=${normalizedId} isValidObjectId=${ObjectId.isValid(normalizedId)}`,
    );
  }
  return byString;
}

export async function createProduct(productData: Omit<Product, '_id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const collection = getCollection();

  const now = new Date();
  const product: Product = {
    ...productData,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(product);
  product._id = result.insertedId;

  return product;
}

export async function updateProductById(id: ObjectId, update: Partial<Product>): Promise<Product | null> {
  const collection = getCollection();

  const now = new Date();
  const result = await collection.updateOne({ _id: id }, { $set: { ...update, updatedAt: now } });
  if (result.matchedCount !== 1) return null;
  return await collection.findOne({ _id: id });
}

export async function updateProductByIdAny(id: string, update: Partial<Product>): Promise<Product | null> {
  const collection = getCollection();

  const normalizedId = normalizeId(id);

  const now = new Date();

  if (ObjectId.isValid(normalizedId)) {
    const oid = new ObjectId(normalizedId);
    const resultByObjectId = await collection.updateOne(
      { _id: oid },
      { $set: { ...update, updatedAt: now } },
    );

    if (resultByObjectId.matchedCount === 1) {
      if (isDebugEnabled()) {
        console.log(`[product] updateByIdAny hit ObjectId ns=${collection.namespace} id=${normalizedId}`);
      }
      return await collection.findOne({ _id: oid });
    }
  }

  const resultByString = await collection.updateOne(
    { _id: normalizedId as any },
    { $set: { ...update, updatedAt: now } },
  );

  if (resultByString.matchedCount === 1) {
    if (isDebugEnabled()) {
      console.log(`[product] updateByIdAny hit string ns=${collection.namespace} id=${normalizedId}`);
    }
    return await collection.findOne({ _id: normalizedId as any });
  }

  if (isDebugEnabled()) {
    console.log(
      `[product] updateByIdAny miss ns=${collection.namespace} id=${normalizedId} isValidObjectId=${ObjectId.isValid(normalizedId)}`,
    );
  }

  // Safety-net: if GET-by-id works but update missed due to unexpected _id typing,
  // update using the exact stored _id value.
  const existing = await findProductByIdAny(normalizedId);
  if (!existing) return null;

  const resultByExactId = await collection.updateOne(
    { _id: existing._id as any },
    { $set: { ...update, updatedAt: now } },
  );

  if (resultByExactId.matchedCount !== 1) return null;

  const exactValue = await collection.findOne({ _id: existing._id as any });
  if (isDebugEnabled()) {
    console.log(
      `[product] updateByIdAny fallback ns=${collection.namespace} id=${normalizedId} storedIdType=${typeof (existing as any)._id}`,
    );
  }

  return exactValue;
}

export async function deleteProductById(id: ObjectId): Promise<boolean> {
  const collection = getCollection();
  const result = await collection.deleteOne({ _id: id });
  return result.deletedCount === 1;
}

export async function deleteProductByIdAny(id: string): Promise<boolean> {
  const collection = getCollection();

  const normalizedId = normalizeId(id);

  if (ObjectId.isValid(normalizedId)) {
    const resultByObjectId = await collection.deleteOne({ _id: new ObjectId(normalizedId) });
    if (resultByObjectId.deletedCount === 1) {
      if (isDebugEnabled()) {
        console.log(`[product] deleteByIdAny hit ObjectId ns=${collection.namespace} id=${normalizedId}`);
      }
      return true;
    }
  }

  const resultByString = await collection.deleteOne({ _id: normalizedId as any });
  if (resultByString.deletedCount === 1) {
    if (isDebugEnabled()) {
      console.log(`[product] deleteByIdAny hit string ns=${collection.namespace} id=${normalizedId}`);
    }
    return true;
  }

  if (isDebugEnabled()) {
    console.log(
      `[product] deleteByIdAny miss ns=${collection.namespace} id=${normalizedId} isValidObjectId=${ObjectId.isValid(normalizedId)}`,
    );
  }

  // Safety-net: if GET-by-id works but delete missed due to unexpected _id typing,
  // delete using the exact stored _id value.
  const existing = await findProductByIdAny(normalizedId);
  if (!existing) return false;

  const resultByExactId = await collection.deleteOne({ _id: existing._id as any });
  if (isDebugEnabled()) {
    console.log(
      `[product] deleteByIdAny fallback ns=${collection.namespace} id=${normalizedId} deleted=${resultByExactId.deletedCount === 1}`,
    );
  }
  return resultByExactId.deletedCount === 1;
}

export async function initializeProductIndexes(): Promise<void> {
  const collection = getCollection();
  await collection.createIndex({ sku: 1 }, { unique: true });
  await collection.createIndex({ category: 1 });
  await collection.createIndex({ status: 1 });
  await collection.createIndex({ createdAt: -1 });
}

export async function findProductsByIdsAny(ids: string[]): Promise<Product[]> {
  const collection = getCollection();
  const uniqueIds = Array.from(new Set(ids.map((s) => String(s).trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const orFilters: any[] = [];
  for (const id of uniqueIds.slice(0, 100)) {
    if (ObjectId.isValid(id)) {
      orFilters.push({ _id: new ObjectId(id) });
    }
    orFilters.push({ _id: id });
  }

  return await collection.find({ $or: orFilters }).toArray();
}

export async function bulkUpdateCategory(
  oldCategory: string,
  newCategory: string,
): Promise<{ matchedCount: number; modifiedCount: number }> {
  const collection = getCollection();
  const now = new Date();
  const result = await collection.updateMany(
    { category: oldCategory },
    { $set: { category: newCategory, updatedAt: now } },
  );
  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}
