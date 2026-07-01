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
      console.error(`[PostPaymentFulfillment] Stock decrement failed for order ${orderId}:`, stockError);
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
      console.error(`[PostPaymentFulfillment] Digital fulfillment failed for order ${orderId}:`, digitalError);
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
      console.error(`[PostPaymentFulfillment] Service fulfillment failed for order ${orderId}:`, serviceError);
    }

    // 4. Send order receipt email (type-aware, includes download links for digital items)
    try {
      await orderReceiptEmailService.sendReceiptEmail(orderId, baseUrl);
      console.log(`[PostPaymentFulfillment] Receipt email sent for order ${orderId}`);
    } catch (receiptError) {
      console.error(`[PostPaymentFulfillment] Receipt email failed for order ${orderId}:`, receiptError);
    }
  }
}
