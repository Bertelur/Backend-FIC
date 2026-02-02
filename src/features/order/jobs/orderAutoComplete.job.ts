import * as orderRepo from '../repositories/order.repository.js';
import { OrderLog } from '../interfaces/order.types.js';

export async function processAutoCompleteOrders(): Promise<void> {
  try {
    const expiredOrders = await orderRepo.findShippedOrdersPastDeliveryDeadline();

    for (const order of expiredOrders) {
      try {
        // Update order status to completed
        const logEntry: OrderLog = {
          status: 'completed',
          timestamp: new Date(),
          note: 'Auto-completed: Delivery confirmation deadline expired',
          by: 'system',
        };

        await orderRepo.updateOrderStatus(String(order._id), 'completed', logEntry);
        console.log(`Auto-completed order ${order._id} due to delivery confirmation deadline expiration`);
      } catch (error) {
        console.error(`Failed to auto-complete order ${order._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing auto-complete orders:', error);
  }
}
