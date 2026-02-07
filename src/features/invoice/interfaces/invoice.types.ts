export interface InvoiceResponse {
  id: string;
  paymentExternalId: string;
  xenditInvoiceId: string;
  userId?: string;
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

export interface ListInvoicesQuery {
  userId?: string;
  search?: string;
  status?: string;
  paymentMethod?: string;
  from?: string; // ISO date or YYYY-MM-DD
  to?: string;
  limit?: number;
  skip?: number;
}
