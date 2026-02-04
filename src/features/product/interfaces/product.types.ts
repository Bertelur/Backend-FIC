import type { ProductStatus } from '../models/Product.js';

export interface ProductResponse {
  id: string;
  name: string;
  description?: string;
  sku: string;
  category?: string;
  price: number;
  stock: number;
  status: 'active' | 'inactive';
  imageUrl?: string;
  imageType?: 'url' | 'file' | 'cloudinary';
  unit: {
    id: string;
    name: string;
  };
  isFreeShipping?: boolean;
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
  status?: 'active' | 'inactive';
  imageUrl?: string;
  unitId: string;
  isFreeShipping?: boolean;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  sku?: string;
  category?: string;
  price?: number;
  stock?: number;
  status?: 'active' | 'inactive';
  imageUrl?: string;
  unitId?: string;
  isFreeShipping?: boolean;
}

export interface ListProductsQuery {
  q?: string;
  category?: string;
  status?: ProductStatus;
  limit?: number;
  skip?: number;
}
