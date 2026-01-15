import { ObjectId } from 'mongodb';

export interface Payment {
  _id?: ObjectId;
  externalId: string;
  xenditInvoiceId: string;
  userId?: ObjectId;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
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
    name: string;
    quantity: number;
    price: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
