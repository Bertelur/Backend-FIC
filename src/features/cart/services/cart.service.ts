import { ObjectId } from 'mongodb';
import type { Cart } from '../models/Cart.js';
import type { CartResponse, CartItemResponse, CheckoutCartRequest } from '../interfaces/cart.types.js';
import * as cartRepo from '../repositories/cart.repository.js';
import * as productRepo from '../../product/repositories/product.repository.js';
import * as paymentRepo from '../../payment/repositories/payment.repository.js';
import * as paymentService from '../../payment/services/payment.service.js';
import { getDatabase, getMongoClient } from '../../../config/database.js';

function clampQuantity(qty: unknown): number {
  const n = typeof qty === 'number' ? qty : typeof qty === 'string' ? Number(qty) : NaN;
  const normalized = Number.isFinite(n) ? Math.floor(n) : NaN;
  if (!Number.isFinite(normalized) || normalized < 1) throw new Error('quantity must be >= 1');
  return Math.min(normalized, 999);
}

function toCartResponse(cart: Cart, enrichedItems: CartItemResponse[]): CartResponse {
  const totalQuantity = enrichedItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const totalAmount = enrichedItems.reduce((sum, i) => sum + (i.quantity || 0) * (i.price ?? 0), 0);
  return {
    userId: cart.userId.toString(),
    items: enrichedItems,
    totalQuantity,
    totalAmount,
  };
}

function idsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (ObjectId.isValid(a) && ObjectId.isValid(b)) {
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }
  return false;
}

function isReserved(reserved: Set<string>, productId: string): boolean {
  if (reserved.has(productId)) return true;
  for (const r of reserved) {
    if (idsMatch(r, productId)) return true;
  }
  return false;
}

async function cleanupExpiredCheckoutIfNeeded(cart: Cart, userId: ObjectId): Promise<Cart> {
  const legacyExternalId = cart.activeCheckoutExternalId;
  const legacyCheckoutIds = Array.isArray(cart.activeCheckoutProductIds) ? cart.activeCheckoutProductIds : [];
  const legacyCreatedAt = cart.activeCheckoutCreatedAt;

  const entries = Array.isArray(cart.activeCheckouts) ? cart.activeCheckouts : [];
  const merged: Array<{ externalId: string; createdAt?: Date; productIds: string[] }>= [
    ...entries.map((e) => ({ externalId: e.externalId, createdAt: e.createdAt, productIds: e.productIds ?? [] })),
    ...(legacyExternalId
      ? [{ externalId: legacyExternalId, createdAt: legacyCreatedAt, productIds: legacyCheckoutIds }]
      : []),
  ];

  const externalIds = Array.from(new Set(merged.map((m) => m.externalId)));
  if (externalIds.length === 0) return cart;

  const payments = await paymentRepo.findPaymentsByExternalIds(externalIds);
  const paymentMap = new Map(payments.map((p) => [p.externalId, p]));

  const now = new Date();
  for (const m of merged) {
    const payment = paymentMap.get(m.externalId);
    if (!payment) {
      await cartRepo.clearCartCheckoutIfMatches(userId, m.externalId);
      continue;
    }

    const isPastExpiry = payment.expiryDate instanceof Date && now >= payment.expiryDate;
    if (payment.status === 'pending' && isPastExpiry) {
      try {
        await paymentService.getInvoiceById(m.externalId);
      } catch {
        // ignore
      }
    }

    const refreshed = (await paymentRepo.findPaymentByExternalId(m.externalId)) ?? payment;
    if (refreshed.status === 'paid') {
      await cartRepo.finalizeCheckoutIfMatches(userId, m.externalId);
      continue;
    }

    if (refreshed.status === 'expired' || refreshed.status === 'failed' || (refreshed.status === 'pending' && isPastExpiry)) {
      // Only remove it from "checkout" tracking (not from cart items) so user can retry checkout.
      await cartRepo.clearCartCheckoutIfMatches(userId, m.externalId);
      continue;
    }
  }

  return await cartRepo.getOrCreateCart(userId);
}

async function getPendingReservedProductIds(cart: Cart): Promise<Set<string> | null> {
  const entries = Array.isArray(cart.activeCheckouts) ? cart.activeCheckouts : [];
  const legacyExternalId = cart.activeCheckoutExternalId;
  const legacyProductIds = Array.isArray(cart.activeCheckoutProductIds) ? cart.activeCheckoutProductIds : [];

  const merged: Array<{ externalId: string; productIds: string[] }>= [
    ...entries.map((e) => ({ externalId: e.externalId, productIds: e.productIds ?? [] })),
    ...(legacyExternalId ? [{ externalId: legacyExternalId, productIds: legacyProductIds }] : []),
  ];

  const externalIds = Array.from(new Set(merged.map((m) => m.externalId)));
  if (externalIds.length === 0) return null;

  const payments = await paymentRepo.findPaymentsByExternalIds(externalIds);
  const paymentMap = new Map(payments.map((p) => [p.externalId, p]));

  const reserved = new Set<string>();
  for (const m of merged) {
    const p = paymentMap.get(m.externalId);
    if (!p || p.status !== 'pending') continue;
    const ids = (m.productIds?.length ? m.productIds : (p.items ?? []).map((i) => (typeof i.productId === 'string' ? i.productId : '')))
      .map((v) => String(v ?? '').trim())
      .filter((v) => v.length > 0);
    for (const id of ids) reserved.add(id);
  }

  return reserved.size > 0 ? reserved : null;
}

async function ensureProductNotInActiveCheckout(cart: Cart, productIdRaw: string): Promise<void> {
  const reserved = await getPendingReservedProductIds(cart);
  if (!reserved) return;

  const raw = String(productIdRaw ?? '').trim();
  if (!raw) return;

  if (isReserved(reserved, raw)) throw new Error('Checkout in progress');

  const product = await productRepo.findProductByIdAny(raw);
  const canonical = product?._id ? String(product._id) : undefined;
  if (canonical && isReserved(reserved, canonical)) throw new Error('Checkout in progress');
}

async function enrichCartItems(items: Array<{ productId: string; quantity: number }>): Promise<CartItemResponse[]> {
  const ids = items.map((i) => i.productId);
  const products = await productRepo.findProductsByIdsAny(ids);
  const map = new Map(products.map((p) => [String(p._id), p]));

  return items.map((i) => {
    const p = map.get(String(i.productId));
    return {
      productId: i.productId,
      quantity: i.quantity,
      name: p?.name,
      sku: p?.sku,
      price: p?.price,
      imageUrl: p?.image?.url,
    };
  });
}

export async function getMyCart(userId: ObjectId): Promise<CartResponse> {
  const cart = await cartRepo.getOrCreateCart(userId);
  const enriched = await enrichCartItems(cart.items);
  return toCartResponse(cart, enriched);
}

export async function addItem(userId: ObjectId, productIdRaw: string, quantityRaw: unknown): Promise<CartResponse> {
  const productId = String(productIdRaw ?? '').trim();
  if (!productId) throw new Error('productId is required');
  const quantity = clampQuantity(quantityRaw);

  let cart = await cartRepo.getOrCreateCart(userId);
  cart = await cleanupExpiredCheckoutIfNeeded(cart, userId);
  await ensureProductNotInActiveCheckout(cart, productId);

  const product = await productRepo.findProductByIdAny(productId);
  if (!product) throw new Error('Product not found');
  if (product.status !== 'active') throw new Error('Product is inactive');

  // Compare using canonical product id to avoid mismatch between stored cart id vs actual _id.
  const canonicalProductId = String(product._id);

  const existing = cart.items.find((i) => i.productId === productId);
  const existingCanonical = canonicalProductId !== productId ? cart.items.find((i) => i.productId === canonicalProductId) : undefined;
  const target = existing ?? existingCanonical;
  if (target) {
    target.quantity = Math.min(target.quantity + quantity, 999);
  } else {
    cart.items.push({ productId: canonicalProductId, quantity });
  }

  const updated = await cartRepo.updateCart(userId, { items: cart.items });
  const enriched = await enrichCartItems(updated.items);
  return toCartResponse(updated, enriched);
}

export async function updateItem(userId: ObjectId, productIdRaw: string, quantityRaw: unknown): Promise<CartResponse> {
  const productId = String(productIdRaw ?? '').trim();
  if (!productId) throw new Error('productId is required');
  const quantity = clampQuantity(quantityRaw);

  let cart = await cartRepo.getOrCreateCart(userId);
  cart = await cleanupExpiredCheckoutIfNeeded(cart, userId);
  await ensureProductNotInActiveCheckout(cart, productId);
  const existing = cart.items.find((i) => i.productId === productId);
  if (!existing) throw new Error('Cart item not found');
  existing.quantity = quantity;

  const updated = await cartRepo.updateCart(userId, { items: cart.items });
  const enriched = await enrichCartItems(updated.items);
  return toCartResponse(updated, enriched);
}

export async function removeItem(userId: ObjectId, productIdRaw: string): Promise<CartResponse> {
  const productId = String(productIdRaw ?? '').trim();
  if (!productId) throw new Error('productId is required');

  let cart = await cartRepo.getOrCreateCart(userId);
  cart = await cleanupExpiredCheckoutIfNeeded(cart, userId);
  await ensureProductNotInActiveCheckout(cart, productId);
  const nextItems = cart.items.filter((i) => i.productId !== productId);
  const updated = await cartRepo.updateCart(userId, { items: nextItems });
  const enriched = await enrichCartItems(updated.items);
  return toCartResponse(updated, enriched);
}

export async function clearCart(userId: ObjectId): Promise<CartResponse> {
  let cart = await cartRepo.getOrCreateCart(userId);
  cart = await cleanupExpiredCheckoutIfNeeded(cart, userId);
  const reserved = await getPendingReservedProductIds(cart);

  if (!reserved) {
    const updated = await cartRepo.updateCart(userId, { items: [] });
    return toCartResponse(updated, []);
  }

  // During an active checkout, only clear non-reserved items.
  const keep = cart.items.filter((i) => isReserved(reserved, i.productId));
  const updated = await cartRepo.updateCart(userId, { items: keep });
  const enriched = await enrichCartItems(updated.items);
  return toCartResponse(updated, enriched);
}

export async function checkoutCart(userId: ObjectId, input: CheckoutCartRequest) {
  let cart = await cartRepo.getOrCreateCart(userId);
  cart = await cleanupExpiredCheckoutIfNeeded(cart, userId);
  if (!cart.items || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  const mergedActive: Array<{ externalId: string; productIds: string[] }> = [
    ...(Array.isArray(cart.activeCheckouts)
      ? cart.activeCheckouts.map((e) => ({ externalId: e.externalId, productIds: e.productIds ?? [] }))
      : []),
    ...(cart.activeCheckoutExternalId
      ? [{ externalId: cart.activeCheckoutExternalId, productIds: cart.activeCheckoutProductIds ?? [] }]
      : []),
  ];
  const reservedNow = await getPendingReservedProductIds(cart);

  const products = await productRepo.findProductsByIdsAny(cart.items.map((i) => i.productId));
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const selection = Array.isArray(input.productIds)
    ? input.productIds.map((v) => String(v ?? '').trim()).filter((v) => v.length > 0)
    : [];

  const cartItemsToCheckout =
    selection.length === 0
      ? cart.items
      : cart.items.filter((ci) => selection.some((sel) => idsMatch(sel, ci.productId)));

  if (selection.length > 0) {
    const missing = selection.filter((sel) => !cart.items.some((ci) => idsMatch(sel, ci.productId)));
    if (missing.length > 0) {
      throw new Error(`Cart item not found: ${missing[0]}`);
    }
  }

  if (!cartItemsToCheckout || cartItemsToCheckout.length === 0) {
    throw new Error('No items selected');
  }

  const lineItems = cartItemsToCheckout.map((i) => {
    const p = productMap.get(String(i.productId));
    if (!p) throw new Error(`Product not found: ${i.productId}`);
    if (p.status !== 'active') throw new Error(`Product inactive: ${i.productId}`);
    return {
      productId: String(p._id),
      productIdType: (typeof p._id === 'string' ? 'string' : 'objectId') as 'string' | 'objectId',
      sku: p.sku,
      name: p.name,
      quantity: i.quantity,
      price: p.price,
    };
  });

  const checkoutProductIds = Array.from(new Set(lineItems.map((li) => li.productId)));

  if (reservedNow) {
    const overlaps = checkoutProductIds.some((id) => isReserved(reservedNow, id));
    if (overlaps) {
      // If selected items are already reserved by an active pending checkout,
      // return the existing pending payment instead of raising Conflict.
      // This is especially useful when the client retries checkout with forceNew.
      const overlappingExternalIds = mergedActive
        .filter((m) => (m.productIds ?? []).some((pid) => checkoutProductIds.some((c) => idsMatch(c, pid))))
        .map((m) => m.externalId);

      const candidates = Array.from(new Set(overlappingExternalIds)).filter((v) => v.length > 0);
      if (candidates.length > 0) {
        const payments = await paymentRepo.findPaymentsByExternalIds(candidates);
        const pending = payments
          .filter((p) => p.status === 'pending')
          .sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));

        if (pending.length > 0) {
          const fresh = await paymentService.getInvoiceById(pending[0].externalId);
          if (fresh) return { reused: true, payment: fresh };
          return {
            reused: true,
            payment: {
              id: pending[0]._id!.toString(),
              externalId: pending[0].externalId,
              status: pending[0].status,
              amount: pending[0].amount,
              invoiceUrl: pending[0].invoiceUrl,
              expiryDate: pending[0].expiryDate,
              created: pending[0].createdAt,
            },
          };
        }
      }

      // If we cannot find a pending payment to reuse, keep existing behavior.
      // (We avoid auto-cancelling here to prevent double-reserve issues.)
      if (!input.forceNew) throw new Error('Checkout in progress');
      // forceNew: don't return 409; surface as a bad request so UI can retry/refresh.
      throw new Error('Unable to create new checkout while a previous checkout is active');
    }
  }

  const reservations = lineItems.map((li) => {
    const p = productMap.get(String(li.productId));
    if (!p || !p._id) throw new Error('Product not found');
    return { id: p._id, quantity: li.quantity };
  });

  const amount = lineItems.reduce((sum, li) => sum + li.quantity * li.price, 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid cart total');

  const reservedAt = new Date();
  const externalId = `PAYMENT-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const client = getMongoClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const db = getDatabase();
      const carts = db.collection<Cart>('carts');

      const freshCart = await carts.findOne({ userId }, { session });
      const existingEntries = Array.isArray(freshCart?.activeCheckouts) ? freshCart!.activeCheckouts! : [];
      const legacyIds = Array.isArray(freshCart?.activeCheckoutProductIds) ? freshCart!.activeCheckoutProductIds! : [];
      const reservedInCart = new Set<string>([
        ...legacyIds,
        ...existingEntries.flatMap((e) => (Array.isArray(e.productIds) ? e.productIds : [])),
      ]);
      if (checkoutProductIds.some((id) => reservedInCart.has(id))) {
        throw new Error('Checkout in progress');
      }

      // Atomic reservation per product: decrement stock only if stock >= qty.
      await productRepo.reserveStockExact(reservations, session);

      await carts.updateOne(
        { userId },
        {
          $push: {
            activeCheckouts: { externalId, createdAt: reservedAt, productIds: checkoutProductIds },
          } as any,
          $set: {
            // Keep legacy pointers as "latest" checkout for backward compatibility
            activeCheckoutExternalId: externalId,
            activeCheckoutCreatedAt: reservedAt,
            activeCheckoutProductIds: checkoutProductIds,
            updatedAt: new Date(),
          },
        } as any,
        { session, upsert: true },
      );
    });
  } finally {
    await session.endSession();
  }

  let payment: any;
  try {
    payment = await paymentService.createInvoice(
      {
        amount,
        currency: input.currency,
        invoiceDuration: input.invoiceDuration,
        description: input.description ?? 'Cart checkout',
        successRedirectUrl: input.successRedirectUrl,
        failureRedirectUrl: input.failureRedirectUrl,
        items: lineItems,
      },
      userId,
      { stockReservedAt: reservedAt, externalId },
    );
  } catch (err) {
    // If Xendit invoice creation fails, release reserved stock and unlock cart.
    await productRepo.releaseStockAny(
      lineItems.map((li) => ({
        productId: li.productId,
        productIdType: li.productIdType,
        quantity: li.quantity,
      })),
    );
    await cartRepo.clearCartCheckoutIfMatches(userId, externalId);
    throw err;
  }

  return { reused: false, payment };
}
