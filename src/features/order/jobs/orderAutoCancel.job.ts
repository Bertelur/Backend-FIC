import { ObjectId } from 'mongodb';
import * as orderRepo from '../repositories/order.repository.js';
import { getDatabase } from '../../../config/database.js';
import { OrderLog } from '../interfaces/order.types.js';

export async function processAutoCancelOrders(): Promise<void> {
  try {
    const expiredOrders = await orderRepo.findPendingOrdersPastPaymentDeadline();

    for (const order of expiredOrders) {
      try {
        // Restore stock for each item
        const db = getDatabase();
        const productsCollection = db.collection('products');

        for (const item of order.items) {
          const productId = ObjectId.isValid(item.productId) ? new ObjectId(item.productId) : item.productId;
          await productsCollection.updateOne(
            { _id: new ObjectId(productId) },
            { $inc: { stock: item.quantity } }
          );
        }

        // Update order status to cancelled
        const logEntry: OrderLog = {
          status: 'cancelled',
          timestamp: new Date(),
          note: 'Auto-cancelled: Payment deadline expired',
          by: 'system',
        };

        await orderRepo.updateOrderStatus(String(order._id), 'cancelled', logEntry);
        console.log(`Auto-cancelled order ${order._id} due to payment deadline expiration`);
      } catch (error) {
        console.error(`Failed to auto-cancel order ${order._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing auto-cancel orders:', error);
  }
}
