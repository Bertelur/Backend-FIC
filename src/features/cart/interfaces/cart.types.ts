export interface CartItemResponse {
  productId: string;
  quantity: number;
  // optional enriched snapshot
  name?: string;
  sku?: string;
  price?: number;
  imageUrl?: string;
}

export interface CartResponse {
  userId: string;
  items: CartItemResponse[];
  totalQuantity: number;
  totalAmount: number;
}

export interface AddCartItemRequest {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface CheckoutCartRequest {
  productIds?: string[];
  currency?: string;
  invoiceDuration?: number;
  description?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  forceNew?: boolean;
}
