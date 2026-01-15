import type { ProductStatus } from '../models/Product.js';

export interface ProductResponse {
  id: string;
  name: string;
  description?: string;
  sku: string;
  category?: string;
  price: number;
  stock: number;
  status: ProductStatus;
  imageUrl?: string;
  imageType?: 'url' | 'file';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  sku: string;
  category?: string;
  price: number;
  stock: number;
  status?: ProductStatus;
  imageUrl?: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  sku?: string;
  category?: string;
  price?: number;
  stock?: number;
  status?: ProductStatus;
  imageUrl?: string;
}

export interface ListProductsQuery {
  q?: string;
  category?: string;
  status?: ProductStatus;
  limit?: number;
  skip?: number;
}
