import { ObjectId } from 'mongodb';
import type { Product } from '../models/Product.js';
import type { CreateProductRequest, ListProductsQuery, ProductResponse, UpdateProductRequest } from '../interfaces/product.types.js';
import * as productRepo from '../repositories/product.repository.js';

function toResponse(product: Product, unitName?: string, unitIdOverride?: string): ProductResponse {
  const finalUnitId = unitIdOverride || (product.unitId ? String(product.unitId) : 'undefined');
  return {
    id: String(product._id),
    name: product.name,
    description: product.description,
    sku: product.sku,
    category: product.category,
    price: product.price,
    stock: product.stock,
    status: product.status,
    imageUrl: product.image?.url,
    imageType: product.image?.type,
    unit: {
      id: finalUnitId,
      name: unitName || 'Unknown Unit', // fallback
    },
    isFreeShipping: product.isFreeShipping ?? false,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function listProducts(query: ListProductsQuery): Promise<{ data: ProductResponse[]; total: number; limit: number; skip: number; }> {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const skip = Math.max(query.skip ?? 0, 0);

  const [products, total] = await Promise.all([
    productRepo.findProducts({ ...query, limit, skip }),
    productRepo.countProducts({ ...query }),
  ]);

  // Collect all unitIds
  // Ideally use aggregation with $lookup. For now, multiple queries is simpler for this structure.
  // Or fetch units by IDs (TODO: Add findUnitsByIds to unitRepo, or loop)
  // Let's loop for now (or optimize later if performance issue)
  const populated = await Promise.all(products.map(async (p) => {
    const u = await unitRepo.findUnitById(String(p.unitId));
    return toResponse(p, u?.name);
  }));

  return {
    data: populated,
    total,
    limit,
    skip,
  };
}

export async function getProductDetails(id: string): Promise<ProductResponse | null> {
  const product = await productRepo.findProductByIdAny(id);
  if (!product) return null;

  let uName = 'Unknown Unit';
  let uId = String(product.unitId || 'undefined');

  if (product.unitId) {
    const unit = await unitRepo.findUnitById(String(product.unitId));
    if (unit) {
      uName = unit.name;
      uId = String(unit._id);
    }
  } else {
    const defaultUnit = await unitRepo.findUnitByName('kg');
    if (defaultUnit) {
      uName = defaultUnit.name;
      uId = String(defaultUnit._id);
    }
  }

  return toResponse(product, uName, uId);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export class DuplicateSkuError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateSkuError';
  }
}

import * as unitRepo from '../../unit/repositories/unit.repository.js';

function validateStatus(status: unknown): Product['status'] {
  const allowed: Array<Product['status']> = ['active', 'inactive'];
  const resolved = (typeof status === 'string' ? status : 'active') as Product['status'];
  if (!allowed.includes(resolved)) {
    throw new Error(`Invalid status. Must be one of: ${allowed.join(', ')}`);
  }
  return resolved;
}

async function validateUnitExists(unitId: string): Promise<ObjectId> {
  const normalized = unitId.trim();
  if (!normalized) throw new Error('Unit ID is required');

  const unit = await unitRepo.findUnitById(normalized);
  if (!unit) {
    throw new Error(`Unit with ID '${normalized}' does not exist.`);
  }
  return new ObjectId(unit._id);
}

async function getOrCreateDefaultUnit(): Promise<ObjectId> {
  const defaultName = 'kg';
  let unit = await unitRepo.findUnitByName(defaultName);
  if (!unit) {
    unit = await unitRepo.createUnit(defaultName);
  }
  return new ObjectId(unit._id);
}

export async function createProduct(
  input: CreateProductRequest,
  uploadedFile?: { url: string; originalName?: string; mimeType?: string; size?: number },
): Promise<ProductResponse> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const sku = typeof input.sku === 'string' ? input.sku.trim() : '';

  if (!name) throw new Error('name is required');
  if (!sku) throw new Error('sku is required');

  if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price < 0) {
    throw new Error('price is required and must be a number >= 0');
  }
  if (typeof input.stock !== 'number' || !Number.isFinite(input.stock) || input.stock < 0) {
    throw new Error('stock is required and must be a number >= 0');
  }

  const status = validateStatus(input.status);

  let unitId: ObjectId;
  if (input.unitId && input.unitId.trim().length > 0) {
    unitId = await validateUnitExists(input.unitId);
  } else {
    unitId = await getOrCreateDefaultUnit();
  }

  const productToCreate: Omit<Product, '_id' | 'createdAt' | 'updatedAt'> = {
    name,
    description: typeof input.description === 'string' ? input.description : undefined,
    sku,
    category: typeof input.category === 'string' ? input.category : undefined,
    price: input.price,
    stock: input.stock,
    status,
    unitId,
    isFreeShipping: input.isFreeShipping ?? false,
  };

  if (uploadedFile) {
    productToCreate.image = {
      type: 'file',
      url: uploadedFile.url,
      originalName: uploadedFile.originalName,
      mimeType: uploadedFile.mimeType,
      size: uploadedFile.size,
    };
  } else if (typeof input.imageUrl === 'string' && input.imageUrl.trim().length > 0) {
    const imageUrl = input.imageUrl.trim();
    if (!isHttpUrl(imageUrl) && !imageUrl.startsWith('/uploads/')) {
      throw new Error('Invalid imageUrl. Must be http(s) URL or /uploads/...');
    }
    productToCreate.image = { type: 'url', url: imageUrl };
  }

  try {
    const created = await productRepo.createProduct(productToCreate);
    // Fetch the unit explicitly to ensure name is available
    const unit = await unitRepo.findUnitById(String(unitId));
    return toResponse(created, unit?.name, String(unit?._id));
  } catch (error: any) {
    // Mongo duplicate key error
    if (error && (error.code === 11000 || error.codeName === 'DuplicateKey')) {
      throw new DuplicateSkuError('SKU already exists');
    }
    throw error;
  }
}

export async function editProduct(
  id: string,
  update: UpdateProductRequest,
  uploadedFile?: { url: string; originalName?: string; mimeType?: string; size?: number },
): Promise<ProductResponse | null> {
  // allow both ObjectId and legacy string ids

  const updateData: Partial<Product> = {};

  if (typeof update.name === 'string') updateData.name = update.name;
  if (typeof update.description === 'string') updateData.description = update.description;
  if (typeof update.sku === 'string') updateData.sku = update.sku;
  if (typeof update.category === 'string') updateData.category = update.category;

  if (typeof update.price === 'number') updateData.price = update.price;
  if (typeof update.stock === 'number') updateData.stock = update.stock;
  if (typeof update.status === 'string') updateData.status = validateStatus(update.status);
  if (update.unitId) updateData.unitId = await validateUnitExists(update.unitId);
  if (typeof update.isFreeShipping === 'boolean') updateData.isFreeShipping = update.isFreeShipping;

  if (uploadedFile) {
    updateData.image = {
      type: 'file',
      url: uploadedFile.url,
      originalName: uploadedFile.originalName,
      mimeType: uploadedFile.mimeType,
      size: uploadedFile.size,
    };
  } else if (typeof update.imageUrl === 'string' && update.imageUrl.trim().length > 0) {
    const imageUrl = update.imageUrl.trim();
    if (!isHttpUrl(imageUrl) && !imageUrl.startsWith('/uploads/')) {
      throw new Error('Invalid imageUrl. Must be http(s) URL or /uploads/...');
    }
    updateData.image = { type: 'url', url: imageUrl };
  }

  const updated = await productRepo.updateProductByIdAny(id, updateData);
  if (updated) {
    const unit = await unitRepo.findUnitById(String(updated.unitId));
    return toResponse(updated, unit?.name, String(unit?._id));
  }
  return null;
}

export async function deleteProduct(id: string): Promise<boolean | null> {
  // allow both ObjectId and legacy string ids
  return await productRepo.deleteProductByIdAny(id);
}
