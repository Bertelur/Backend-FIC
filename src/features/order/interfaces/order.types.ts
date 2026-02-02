import { ObjectId } from 'mongodb';
import { Address } from '../../auth/interfaces/auth.types.js';

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'ready_for_pickup' // for pickup
  | 'completed'
  | 'cancelled';

export type ShippingMethod = 'shipping' | 'pickup';

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  unit: string; // The unit selected (base or custom)
  totalPrice: number;
  imageUrl?: string;
}

export interface OrderLog {
  status: OrderStatus;
  timestamp: Date;
  note?: string;
  by?: string; // userId or 'system'
}

export interface Order {
  _id?: ObjectId | string;
  userId: ObjectId | string; // Buyer
  items: OrderItem[];
  totalAmount: number;
  shippingMethod: ShippingMethod;
  shippingAddress?: Address;
  status: OrderStatus;
  logs: OrderLog[];
  createdAt: Date;
  updatedAt: Date;
  paymentDeadline?: Date; // Deadline for payment confirmation (createdAt + 2 hours)
  deliveryConfirmationDeadline?: Date; // Deadline for customer confirmation (shippedAt + 12 hours)
  paymentConfirmedAt?: Date; // When payment was confirmed
  shippedAt?: Date; // When order was marked as shipped
}

export interface CreateOrderRequest {
  items: {
    productId: string;
    quantity: number;
    unit?: string; // Optional/Ignored (inferred from Product)
  }[];
  shippingMethod: ShippingMethod;
  shippingAddress?: Address; // Required if method is shipping
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  note?: string;
}

export interface ListOrdersQuery {
  status?: OrderStatus;
  userId?: string;
  limit?: number;
  skip?: number;
}
