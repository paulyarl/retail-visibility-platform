/**
 * Hybrid Fulfillment Coordinator
 * Coordinates digital + physical (+ service) fulfillment for hybrid orders.
 * Determines when all components are complete and auto-transitions the order.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export class HybridFulfillmentCoordinator {
  /**
   * Check if a hybrid order is fully fulfilled (all digital delivered AND all physical fulfilled).
   * If so, transition the order to fulfilled/delivered.
   */
  async checkHybridFulfillmentComplete(orderId: string): Promise<boolean> {
    console.log('[HybridCoordinator] Checking fulfillment for order:', orderId);

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        order_items: true,
      },
    });

    if (!order) {
      console.warn('[HybridCoordinator] Order not found:', orderId);
      return false;
    }

    // Only applicable to hybrid or mixed-type orders
    const productTypes = order.order_items.map(item =>
      item.product_type || 'physical'
    );
    const uniqueTypes = [...new Set(productTypes)];

    if (uniqueTypes.length <= 1) {
      // Single-type order — not a hybrid, skip
      return false;
    }

    const hasDigital = uniqueTypes.includes('digital');
    const hasPhysical = uniqueTypes.includes('physical');
    const hasService = uniqueTypes.includes('service');

    if (!hasDigital && !hasService) {
      // Physical-only mixed (e.g. different physical items) — not hybrid
      return false;
    }

    // Check digital items: all must have digital_delivery_status = 'delivered'
    const digitalItems = order.order_items.filter(
      item => item.product_type === 'digital' || item.product_type === 'hybrid'
    );
    const allDigitalDelivered = digitalItems.every(
      item => item.digital_delivery_status === 'delivered'
    );

    // Check physical items: all must have fulfillment complete
    // Physical fulfillment is tracked at the order level via fulfillment_status
    const hasPhysicalItems = order.order_items.some(item => item.product_type === 'physical');
    const physicalFulfilled =
      !hasPhysicalItems ||
      order.fulfillment_status === 'fulfilled' ||
      order.fulfillment_status === 'partially_fulfilled' && order.fulfilled_at !== null;

    // Check service items: all must have status = 'completed'
    let allServicesCompleted = true;
    if (hasService) {
      const serviceBookings = await prisma.service_bookings.findMany({
        where: { order_id: orderId },
      });
      allServicesCompleted =
        serviceBookings.length > 0 &&
        serviceBookings.every(booking => booking.status === 'completed');
    }

    const allComplete = allDigitalDelivered && physicalFulfilled && allServicesCompleted;

    if (allComplete) {
      console.log('[HybridCoordinator] All components fulfilled, transitioning order:', orderId);
      await prisma.orders.update({
        where: { id: orderId },
        data: {
          fulfillment_status: 'fulfilled',
          order_status: 'delivered',
          fulfilled_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Send notification
      try {
        const { getOrderNotificationService } = await import('./OrderNotificationService');
        await getOrderNotificationService().notifyOrderFulfilled({
          tenantId: order.tenant_id,
          orderId: order.id,
          orderNumber: order.order_number,
          customerEmail: order.customer_email,
          customerName: order.customer_name || undefined,
          amount: order.total_cents,
        });
      } catch (notifError) {
        logger.error('[HybridCoordinator] Failed to send fulfillment notification:', undefined, { error: { name: (notifError as any)?.name || 'Error', message: (notifError as any)?.message || String(notifError), stack: (notifError as any)?.stack } });
      }

      return true;
    }

    console.log('[HybridCoordinator] Order not yet fully fulfilled:', {
      orderId,
      allDigitalDelivered,
      physicalFulfilled,
      allServicesCompleted,
    });

    return false;
  }
}

export const hybridFulfillmentCoordinator = new HybridFulfillmentCoordinator();
