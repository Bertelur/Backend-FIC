import { ObjectId } from 'mongodb';

export type ProductStatus = 'active' | 'inactive';

export interface ProductImage {
  type: 'url' | 'file';
  url: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
}

export interface Product {
  _id?: ObjectId | string;
  name: string;
  description?: string;
  sku: string;
  category?: string;
  price: number;
  stock: number;
  status: ProductStatus;
  image?: ProductImage;
  createdAt: Date;
  updatedAt: Date;
}
