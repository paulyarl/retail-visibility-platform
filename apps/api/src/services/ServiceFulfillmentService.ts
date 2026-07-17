/**
 * Service Fulfillment Service
 * Handles automatic fulfillment of service products after payment — booking creation,
 * scheduling, status management, and notifications.
 */

import { prisma } from '../prisma';
import { generateBookingId } from '../lib/id-generator';
import { logger } from '../logger';

export interface ServiceBookingResult {
  success: boolean;
  bookings: Array<{
    bookingId: string;
    orderItemId: string;
    productName: string;
    status: string;
  }>;
  errors: Array<{
    orderItemId: string;
    error: string;
  }>;
}

export class ServiceFulfillmentService {
  /**
   * Check if an order contains service products
   */
  async hasServiceProducts(orderId: string): Promise<boolean> {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        order_items: {
          include: {
            inventory_items: true,
          },
        },
      },
    });

    if (!order) return false;

    return order.order_items.some(item => {
      const productType = item.product_type || (item.inventory_items as any)?.product_type;
      return productType === 'service' || productType === 'hybrid';
    });
  }

  /**
   * Fulfill service products for an order after successful payment.
   * Creates booking records and sends confirmation notifications.
   */
  async fulfillOrder(orderId: string): Promise<ServiceBookingResult> {
    console.log('[ServiceFulfillment] Processing order:', orderId);

    const result: ServiceBookingResult = {
      success: true,
      bookings: [],
      errors: [],
    };

    try {
      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        include: {
          order_items: {
            include: {
              inventory_items: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      for (const orderItem of order.order_items) {
        const item = orderItem.inventory_items;
        if (!item) continue;

        const productType = orderItem.product_type || (item as any).product_type;
        if (productType !== 'service' && productType !== 'hybrid') continue;

        console.log('[ServiceFulfillment] Processing service product:', {
          orderItemId: orderItem.id,
          productName: item.name,
          productType,
        });

        try {
          const bookingId = generateBookingId();
          const metadata = (orderItem.metadata as any) || {};
          const serviceBooking = metadata.service_booking || {};

          const booking = await prisma.service_bookings.create({
            data: {
              id: bookingId,
              order_id: order.id,
              order_item_id: orderItem.id,
              tenant_id: order.tenant_id,
              customer_email: order.customer_email,
              customer_name: order.customer_name || null,
              customer_phone: order.customer_phone || null,
              scheduled_date: serviceBooking.preferred_date
                ? new Date(serviceBooking.preferred_date)
                : null,
              scheduled_time: serviceBooking.preferred_time || null,
              duration_minutes: serviceBooking.duration_minutes || 60,
              provider_id: serviceBooking.provider_id || null,
              provider_name: serviceBooking.provider_name || null,
              service_location: serviceBooking.service_location || null,
              status: 'confirmed',
              notes: serviceBooking.notes || null,
            },
          });

          result.bookings.push({
            bookingId: booking.id,
            orderItemId: orderItem.id,
            productName: item.name || 'Service Product',
            status: booking.status,
          });

          console.log('[ServiceFulfillment] Booking created:', {
            bookingId: booking.id,
            orderItemId: orderItem.id,
          });
        } catch (error: any) {
          logger.error('[ServiceFulfillment] Failed to create booking:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
          result.errors.push({
            orderItemId: orderItem.id,
            error: error.message,
          });
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

      // Update order status for service-only orders
      if (result.bookings.length > 0 && result.errors.length === 0) {
        const allItems = order.order_items;
        const hasPhysical = allItems.some(item => {
          const pt = item.product_type || (item.inventory_items as any)?.product_type;
          return pt === 'physical';
        });
        const hasDigital = allItems.some(item => {
          const pt = item.product_type || (item.inventory_items as any)?.product_type;
          return pt === 'digital';
        });

        if (!hasPhysical && !hasDigital) {
          // Service-only order — set to scheduled
          await prisma.orders.update({
            where: { id: orderId },
            data: {
              order_status: 'scheduled',
              updated_at: new Date(),
            },
          });
          console.log('[ServiceFulfillment] Service-only order marked as scheduled:', orderId);
        } else {
          // Hybrid order — partially fulfilled
          await prisma.orders.update({
            where: { id: orderId },
            data: {
              fulfillment_status: 'partially_fulfilled',
              updated_at: new Date(),
            },
          });
          console.log('[ServiceFulfillment] Hybrid order marked as partially_fulfilled:', orderId);
        }

        // Send service_scheduled notification
        try {
          const { getOrderNotificationService } = await import('./OrderNotificationService');
          await getOrderNotificationService().notifyServiceScheduled({
            tenantId: order.tenant_id,
            orderId: order.id,
            orderNumber: order.order_number,
            customerEmail: order.customer_email,
            customerName: order.customer_name || undefined,
            amount: order.total_cents,
          });
        } catch (notifError) {
          logger.error('[ServiceFulfillment] Failed to send service_scheduled notification:', undefined, { error: { name: (notifError as any)?.name || 'Error', message: (notifError as any)?.message || String(notifError), stack: (notifError as any)?.stack } });
        }
      }

      console.log('[ServiceFulfillment] Order fulfillment complete:', {
        orderId,
        bookingsCreated: result.bookings.length,
        errors: result.errors.length,
      });

      return result;
    } catch (error: any) {
      logger.error('[ServiceFulfillment] Order fulfillment failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Cancel all service bookings for an order
   */
  async cancelBookings(orderId: string): Promise<void> {
    console.log('[ServiceFulfillment] Cancelling bookings for order:', orderId);

    await prisma.service_bookings.updateMany({
      where: {
        order_id: orderId,
        status: { notIn: ['cancelled', 'completed'] },
      },
      data: {
        status: 'cancelled',
        updated_at: new Date(),
      },
    });
  }

  /**
   * Get all service bookings for an order
   */
  async getOrderBookings(orderId: string) {
    return prisma.service_bookings.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Get all service bookings for a customer across all orders
   */
  async getCustomerBookings(customerEmail: string) {
    return prisma.service_bookings.findMany({
      where: { customer_email: customerEmail },
      orderBy: { scheduled_date: 'asc' },
    });
  }

  /**
   * Update a service booking (merchant management)
   */
  async updateBooking(
    bookingId: string,
    updates: {
      scheduledDate?: Date;
      scheduledTime?: string;
      durationMinutes?: number;
      providerId?: string;
      providerName?: string;
      serviceLocation?: string;
      status?: string;
      notes?: string;
    }
  ) {
    const data: any = { updated_at: new Date() };
    if (updates.scheduledDate !== undefined) data.scheduled_date = updates.scheduledDate;
    if (updates.scheduledTime !== undefined) data.scheduled_time = updates.scheduledTime;
    if (updates.durationMinutes !== undefined) data.duration_minutes = updates.durationMinutes;
    if (updates.providerId !== undefined) data.provider_id = updates.providerId;
    if (updates.providerName !== undefined) data.provider_name = updates.providerName;
    if (updates.serviceLocation !== undefined) data.service_location = updates.serviceLocation;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.notes !== undefined) data.notes = updates.notes;

    return prisma.service_bookings.update({
      where: { id: bookingId },
      data,
    });
  }

  /**
   * Assign a provider to a service booking
   */
  async assignProvider(bookingId: string, providerId: string, providerName: string) {
    return prisma.service_bookings.update({
      where: { id: bookingId },
      data: {
        provider_id: providerId,
        provider_name: providerName,
        updated_at: new Date(),
      },
    });
  }
}

export const serviceFulfillmentService = new ServiceFulfillmentService();
