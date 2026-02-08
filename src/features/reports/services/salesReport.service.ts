import { ObjectId } from 'mongodb';
import * as invoiceRepo from '../../invoice/repositories/invoice.repository.js';
import * as orderRepo from '../../order/repositories/order.repository.js';

/** Same shape as invoice report so Dashboard can reuse types and charts. */
export interface CombinedSalesReportResponse {
  range: { from?: string; to?: string; dateField: CombinedReportDateField };
  totals: {
    ordersCount: number;
    totalSalesAmount: number;
    totalOrderItemsQty: number;
    avgUnitsPerOrder: number;
    avgSalesPerOrder: number;
    avgSalesPerItem: number;
  };
  items: Array<{
    productId?: string;
    sku?: string;
    name: string;
    ordersCount: number;
    quantity: number;
    salesAmount: number;
    avgUnitPrice: number;
  }>;
}

export type CombinedReportDateField = 'paidAt' | 'createdAt';

function safeDiv(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Combined sales report: invoices (paid) + orders (processing, shipped, delivered, ready_for_pickup, completed).
 * Same response shape as invoice report so Dashboard can reuse types and charts.
 */
export async function getCombinedSalesReport(input?: {
  userId?: string;
  from?: Date;
  to?: Date;
  dateField?: CombinedReportDateField;
  limit?: number;
}): Promise<CombinedSalesReportResponse> {
  const dateField: CombinedReportDateField = input?.dateField ?? 'paidAt';
  const userId = input?.userId && ObjectId.isValid(input.userId) ? new ObjectId(input.userId) : undefined;
  const limit = Math.min(Math.max(input?.limit ?? 5000, 1), 20000);

  // Invoices: use dateField (paidAt or createdAt)
  const invoiceDateField: invoiceRepo.InvoiceReportDateField = dateField === 'paidAt' ? 'paidAt' : 'createdAt';
  // Orders: only have createdAt/updatedAt; use createdAt for both report dateField options
  const orderDateField: orderRepo.OrderReportDateField = 'createdAt';

  const [invTotals, invItems, orderTotals, orderItems] = await Promise.all([
    invoiceRepo.getInvoicesSalesTotalsAggregate({
      userId,
      from: input?.from,
      to: input?.to,
      dateField: invoiceDateField,
    }),
    invoiceRepo.getInvoicesItemBreakdown({
      userId,
      from: input?.from,
      to: input?.to,
      dateField: invoiceDateField,
      limit,
    }),
    orderRepo.getOrdersSalesTotalsAggregate({
      from: input?.from,
      to: input?.to,
      dateField: orderDateField,
    }),
    orderRepo.getOrdersItemBreakdown({
      from: input?.from,
      to: input?.to,
      dateField: orderDateField,
      limit,
    }),
  ]);

  const ordersCount = invTotals.ordersCount + orderTotals.ordersCount;
  const totalSalesAmount = invTotals.totalSalesAmount + orderTotals.totalSalesAmount;
  const totalOrderItemsQty = invTotals.totalOrderItemsQty + orderTotals.totalOrderItemsQty;

  const avgUnitsPerOrder = safeDiv(totalOrderItemsQty, ordersCount);
  const avgSalesPerOrder = safeDiv(totalSalesAmount, ordersCount);
  const avgSalesPerItem = safeDiv(totalSalesAmount, totalOrderItemsQty);

  // Merge items by productId + sku + name (use string key for grouping)
  const itemMap = new Map<
    string,
    { productId?: string; sku?: string; name: string; ordersCount: number; quantity: number; salesAmount: number }
  >();

  function addItem(
    productId: string | undefined,
    sku: string | undefined,
    name: string,
    ordersCount: number,
    quantity: number,
    salesAmount: number,
  ) {
    const key = `${productId ?? ''}|${sku ?? ''}|${name}`;
    const existing = itemMap.get(key);
    if (existing) {
      existing.ordersCount += ordersCount;
      existing.quantity += quantity;
      existing.salesAmount += salesAmount;
    } else {
      itemMap.set(key, { productId, sku, name, ordersCount, quantity, salesAmount });
    }
  }

  for (const r of invItems) {
    addItem(r.productId, r.sku, r.name, r.ordersCount, r.quantity, r.salesAmount);
  }
  for (const r of orderItems) {
    addItem(r.productId, r.sku, r.name, r.ordersCount, r.quantity, r.salesAmount);
  }

  const items = Array.from(itemMap.values())
    .map((r) => ({
      productId: r.productId ?? undefined,
      sku: r.sku,
      name: r.name,
      ordersCount: r.ordersCount,
      quantity: r.quantity,
      salesAmount: r.salesAmount,
      avgUnitPrice: safeDiv(r.salesAmount, r.quantity),
    }))
    .sort((a, b) => b.salesAmount - a.salesAmount)
    .slice(0, limit);

  return {
    range: {
      from: input?.from ? input.from.toISOString() : undefined,
      to: input?.to ? input.to.toISOString() : undefined,
      dateField,
    },
    totals: {
      ordersCount,
      totalSalesAmount,
      totalOrderItemsQty,
      avgUnitsPerOrder,
      avgSalesPerOrder,
      avgSalesPerItem,
    },
    items,
  };
}
