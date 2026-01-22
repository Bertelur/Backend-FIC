import type { Address } from '../../auth/interfaces/auth.types.js';

export interface CreatePaymentRequest {
  amount: number;
  currency?: string;
  description?: string;
  invoiceDuration?: number;
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
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  shippingAddress?: Address;
}

export interface PaymentResponse {
  id: string;
  externalId: string;
  status: string;
  amount: number;
  invoiceUrl?: string;
  expiryDate?: Date;
  created: Date;
}

export interface PaymentWebhook {
  id: string;
  externalId: string;
  status: string;
  amount: number;
  paidAt?: Date;
  paymentMethod?: string;
}
