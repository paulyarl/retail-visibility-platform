import { prisma } from '../prisma';
import { CouponService } from './CouponService';
import { trackCouponEvent } from './CouponAnalyticsService';
import { logger } from '../logger';

/**
 * Record coupon redemption and track 'redeem' event after successful payment.
 * Reads coupon metadata from the order record (stored at checkout time).
 *
 * Called by checkout/{stripe,paypal,square}.ts after order status is set to 'paid'.
 */
export async function redeemOrderCoupon(orderId: string): Promise<void> {
  try {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        tenant_id: true,
        customer_email: true,
        discount_cents: true,
        metadata: true,
      },
    });

    if (!order) return;

    const meta = order.metadata as Record<string, any> | null;
    if (!meta?.coupon_id || !meta?.coupon_code) return;

    const discountCents = order.discount_cents || meta.discount_cents || 0;
    if (discountCents <= 0) return;

    const couponService = CouponService.getInstance();

    // Record redemption
    await couponService.redeemCoupon(order.tenant_id, meta.coupon_id, {
      orderId: order.id,
      customerEmail: order.customer_email || undefined,
      discountCents,
    });

    // Track redeem event
    await trackCouponEvent({
      tenantId: order.tenant_id,
      couponId: meta.coupon_id,
      couponCode: meta.coupon_code,
      eventType: 'redeem',
      surface: 'checkout',
      orderId: order.id,
      discountCents,
    });
  } catch (err) {
    logger.warn('[PostPaymentCouponRedemption] Failed to redeem coupon:', undefined, {
      orderId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
