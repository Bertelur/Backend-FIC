import { ObjectId } from 'mongodb';

export interface CartItem {
  productId: string; // keep as string for API simplicity
  quantity: number;
}

export interface Cart {
  _id?: ObjectId;
  userId: ObjectId;
  items: CartItem[];
  activeCheckoutExternalId?: string;
  activeCheckoutCreatedAt?: Date;
  activeCheckoutProductIds?: string[];
  activeCheckouts?: Array<{
    externalId: string;
    createdAt: Date;
    productIds: string[];
  }>;
  createdAt: Date;
  updatedAt: Date;
}
