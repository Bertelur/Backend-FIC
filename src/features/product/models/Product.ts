import { ObjectId } from 'mongodb';

export type ProductStatus = 'active' | 'inactive';

export interface ProductImage {
  type: 'url' | 'file' | 'cloudinary';
  url: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  cloudinaryPublicId?: string;
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
  unitId: ObjectId; // Reference to 'units' collection
  isFreeShipping?: boolean; // new flag
  createdAt: Date;
  updatedAt: Date;
}
