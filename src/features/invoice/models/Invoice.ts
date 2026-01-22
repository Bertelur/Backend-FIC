import { ObjectId } from 'mongodb';
import type { Address } from '../../auth/interfaces/auth.types.js';

export interface Invoice {
  _id?: ObjectId;
  paymentExternalId: string;
  xenditInvoiceId: string;
  userId?: ObjectId;
  amount: number;
  currency: string;
  status: 'paid';
  paidAt?: Date;
  paymentMethod?: string;
  invoiceUrl?: string;
  customer?: {
    givenNames: string;
    surname?: string;
    email: string;
    mobileNumber?: string;
  };
  shippingAddress?: Address;
  items?: Array<{
    productId?: string;
    sku?: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
