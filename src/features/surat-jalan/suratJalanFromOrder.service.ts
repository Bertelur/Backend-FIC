import type { Order } from '../order/interfaces/order.types.js';
import type { SuratJalanData } from '../../utils/pdfGenerator.js';
import * as orderRepo from '../order/repositories/order.repository.js';
import * as buyerRepo from '../auth/repositories/buyer.repository.js';

const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function formatDateForSuratJalan(date: Date): string {
  const d = date;
  const dayName = DAY_NAMES_ID[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${dayName}, ${day}/${month}/${year}`;
}

function formatAddress(addr: Order['shippingAddress']): string {
  if (!addr) return '';
  const parts = [
    addr.street,
    addr.city,
    addr.province,
    addr.postalCode ? addr.postalCode : '',
    addr.phone ? addr.phone : '',
  ].filter(Boolean);
  return parts.join(', ');
}

function formatNumberIdr(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Build Surat Jalan payload from an order. Fetches buyer for recipient name if needed.
 */
export async function buildSuratJalanFromOrder(order: Order): Promise<SuratJalanData> {
  const date = formatDateForSuratJalan(new Date());

  let recipientName = 'Pelanggan';
  if (order.userId) {
    const buyer = await buyerRepo.findBuyerById(String(order.userId));
    if (buyer) {
      recipientName = buyer.username?.trim() || buyer.email?.trim() || recipientName;
    }
  }

  const recipientAddress = formatAddress(order.shippingAddress) || 'Alamat tidak diisi';

  const items = (order.items || []).map((item) => ({
    quantity: `${item.quantity} ${item.unit || ''}`.trim(),
    name: item.name,
    price: formatNumberIdr(item.price),
    total: formatNumberIdr(item.totalPrice),
  }));

  const grandTotal = formatNumberIdr(order.totalAmount);

  return {
    date,
    recipientName,
    recipientAddress,
    items,
    grandTotal,
  };
}

/**
 * Load order by id and build Surat Jalan payload. Returns null if order not found.
 */
export async function getSuratJalanPayloadFromOrderId(orderId: string): Promise<SuratJalanData | null> {
  const order = await orderRepo.findOrderById(orderId);
  if (!order) return null;
  return buildSuratJalanFromOrder(order);
}
