import { ObjectId } from 'mongodb';

export interface Payment {
  _id?: ObjectId;
  externalId: string;
  xenditInvoiceId: string;
  userId?: ObjectId;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  stockReservedAt?: Date;
  stockReleasedAt?: Date;
  description?: string;
  invoiceUrl?: string;
  expiryDate?: Date;
  paidAt?: Date;
  paymentMethod?: string;
  customer?: {
    givenNames: string;
    surname?: string;
    email: string;
    mobileNumber?: string;
  };
  items?: Array<{
    productId?: string;
    productIdType?: 'objectId' | 'string';
    sku?: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
