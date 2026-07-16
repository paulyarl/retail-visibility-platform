/**
 * Post-Payment Fulfillment Coordinator
 *
 * Shared utility that handles stock decrement and digital fulfillment
 * after a successful payment, regardless of payment provider.
 *
 * Used by: stripe.ts, paypal.ts, square.ts, StripeWebhookHandler.ts
 */

import { prisma } from '../prisma';
import { getStockService } from './StockService';
import { digitalFulfillmentService } from './digital-assets';
import { orderReceiptEmailService } from './OrderReceiptEmailService';
import { serviceFulfillmentService } from './ServiceFulfillmentService';
import { logger } from '../logger';

export class PostPaymentFulfillment {
  /**
   * Run all post-payment fulfillment steps for an order:
   * 1. Decrement stock for physical/hybrid items
   * 2. Fulfill digital products (creates access grants, sends emails)
   * 3. Fulfill service products (creates bookings, sends confirmations)
   * 4. Send order receipt email
   *
   * All steps are independent and fail-safe — one failing won't block the others.
   */
  static async run(orderId: string, options?: { baseUrl?: string }): Promise<void> {
    const baseUrl = options?.baseUrl || process.env.API_BASE_URL || process.env.WEB_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

    // 1. Decrement stock (skips digital/service items internally)
    try {
      const stockService = getStockService(prisma);
      await stockService.decrementStockForOrder(orderId);
      console.log(`[PostPaymentFulfillment] Stock decremented for order ${orderId}`);
    } catch (stockError) {
      logger.error(`[PostPaymentFulfillment] Stock decrement failed for order ${orderId}:`, undefined, { error: { name: (stockError as any)?.name || 'Error', message: (stockError as any)?.message || String(stockError), stack: (stockError as any)?.stack } });
    }

    // 2. Fulfill digital products (skips physical/service items internally)
    try {
      const hasDigital = await digitalFulfillmentService.hasDigitalProducts(orderId);
      if (hasDigital) {
        console.log(`[PostPaymentFulfillment] Fulfilling digital products for order ${orderId}`);
        const result = await digitalFulfillmentService.fulfillOrder(orderId, baseUrl);
        console.log(`[PostPaymentFulfillment] Digital fulfillment result:`, {
          success: result.success,
          grants: result.accessGrants.length,
          errors: result.errors.length,
        });
      }
    } catch (digitalError) {
      logger.error(`[PostPaymentFulfillment] Digital fulfillment failed for order ${orderId}:`, undefined, { error: { name: (digitalError as any)?.name || 'Error', message: (digitalError as any)?.message || String(digitalError), stack: (digitalError as any)?.stack } });
    }

    // 3. Fulfill service products (creates bookings, sends confirmations)
    try {
      const hasService = await serviceFulfillmentService.hasServiceProducts(orderId);
      if (hasService) {
        console.log(`[PostPaymentFulfillment] Fulfilling service products for order ${orderId}`);
        const result = await serviceFulfillmentService.fulfillOrder(orderId);
        console.log(`[PostPaymentFulfillment] Service fulfillment result:`, {
          success: result.success,
          bookings: result.bookings.length,
          errors: result.errors.length,
        });
      }
    } catch (serviceError) {
      logger.error(`[PostPaymentFulfillment] Service fulfillment failed for order ${orderId}:`, undefined, { error: { name: (serviceError as any)?.name || 'Error', message: (serviceError as any)?.message || String(serviceError), stack: (serviceError as any)?.stack } });
    }

    // 4. Send order receipt email (type-aware, includes download links for digital items)
    try {
      await orderReceiptEmailService.sendReceiptEmail(orderId, baseUrl);
      console.log(`[PostPaymentFulfillment] Receipt email sent for order ${orderId}`);
    } catch (receiptError) {
      logger.error(`[PostPaymentFulfillment] Receipt email failed for order ${orderId}:`, undefined, { error: { name: (receiptError as any)?.name || 'Error', message: (receiptError as any)?.message || String(receiptError), stack: (receiptError as any)?.stack } });
    }
  }
}
