/**
 * TikTok Shop Webhook Handler
 * Phase 2B: TikTok Shop Integration
 *
 * Receives TikTok Shop webhook events for:
 * - Order placement from TikTok Shop
 * - Product approval status changes
 * - Stock updates
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { unifiedConfig } from '../config/unifiedConfig';

const router = Router();

const TIKTOK_APP_SECRET = unifiedConfig.tiktokAppSecret;

/**
 * Verify TikTok webhook signature
 */
function verifyWebhookSignature(req: Request): boolean {
  if (!TIKTOK_APP_SECRET) {
    logger.warn('TIKTOK_APP_SECRET not set — skipping webhook signature verification');
    return true;
  }

  const signature = req.get('X-TikTok-Signature');
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', TIKTOK_APP_SECRET)
    .update((req as any).rawBody || JSON.stringify(req.body))
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Receive TikTok Shop webhook events
 */
router.post('/tiktok/webhooks', async (req: Request, res: Response) => {
  try {
    if (!verifyWebhookSignature(req)) {
      logger.warn('TikTok webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { type, data } = req.body;

    if (!type) {
      return res.status(200).json({ received: true });
    }

    switch (type) {
      case 'ORDER_STATUS_CHANGE':
        await handleOrderStatusChange(data);
        break;
      case 'PRODUCT_APPROVAL':
        await handleProductApproval(data);
        break;
      case 'STOCK_UPDATE':
        await handleStockUpdate(data);
        break;
      default:
        logger.info('TikTok webhook: unhandled type', undefined, { type });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('TikTok webhook processing error', undefined, {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle order status changes from TikTok Shop
 */
async function handleOrderStatusChange(data: any): Promise<void> {
  try {
    const orderId = data?.order_id;
    const tenantId = data?.seller_id || data?.shop_id;
    const status = data?.order_status;

    logger.info('TikTok webhook: order status change', undefined, { orderId, tenantId, status });

    if (!orderId || !tenantId) return;

    const existingOrder = await prisma.orders.findFirst({
      where: {
        source: 'tiktok_shop',
        source_id: orderId,
      },
    });

    if (existingOrder) {
      const statusMap: Record<string, string> = {
        'UNPAID': 'pending',
        'PAID': 'paid',
        'SHIPPED': 'shipped',
        'DELIVERED': 'delivered',
        'CANCELLED': 'cancelled',
      };
      const mappedStatus = statusMap[status] || 'pending';
      await prisma.orders.update({
        where: { id: existingOrder.id },
        data: { order_status: mappedStatus as any },
      });
      logger.info('TikTok webhook: updated order status', undefined, { orderId, status: mappedStatus });
    } else {
      const items = data?.line_items || [];
      const subtotalCents = items.reduce((sum: number, li: any) => {
        const priceCents = Number(li.sale_price_cents || li.price_cents || 0);
        return sum + priceCents * (li.quantity || 1);
      }, 0);
      const shippingCents = Number(data?.shipping_cents || 0);
      const taxCents = Number(data?.tax_cents || 0);
      const totalCents = subtotalCents + shippingCents + taxCents;

      const { generateOrderId, generateOrderNumber } = await import('../lib/id-generator');
      const customerId = data?.buyer?.id || 'GUEST';

      await prisma.orders.create({
        data: {
          id: generateOrderId(tenantId, customerId),
          order_number: await generateOrderNumber(tenantId),
          tenant_id: tenantId,
          customer_email: data?.buyer?.email || null,
          customer_name: data?.buyer?.name || null,
          subtotal_cents: subtotalCents,
          shipping_cents: shippingCents,
          tax_cents: taxCents,
          total_cents: totalCents,
          currency: data?.currency || 'USD',
          order_status: 'draft',
          source: 'tiktok_shop',
          source_id: orderId,
          shipping_address_line1: data?.shipping_address?.street1 || null,
          shipping_city: data?.shipping_address?.city || null,
          shipping_state: data?.shipping_address?.state || null,
          shipping_postal_code: data?.shipping_address?.zip || null,
          shipping_country: data?.shipping_address?.country || 'US',
          metadata: {
            tiktok_order_id: orderId,
            tiktok_status: status,
          },
        },
      });
      logger.info('TikTok webhook: created order from TikTok Shop', undefined, { orderId });
    }
  } catch (error) {
    logger.error('TikTok webhook: handleOrderStatusChange failed', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle product approval status changes
 */
async function handleProductApproval(data: any): Promise<void> {
  try {
    const productId = data?.product_id;
    const status = data?.approval_status;
    const tenantId = data?.seller_id || data?.shop_id;

    logger.info('TikTok webhook: product approval', undefined, { productId, status, tenantId });

    if (!productId || !tenantId) return;

    const item = await prisma.inventory_items.findFirst({
      where: { id: productId, tenant_id: tenantId },
    });

    if (item) {
      const metadata = item.metadata as any || {};
      await prisma.inventory_items.update({
        where: { id: item.id },
        data: {
          metadata: {
            ...metadata,
            tiktok_approval_status: status,
            tiktok_approval_updated_at: new Date().toISOString(),
          },
        },
      });
    }
  } catch (error) {
    logger.error('TikTok webhook: handleProductApproval failed', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle stock updates from TikTok Shop
 */
async function handleStockUpdate(data: any): Promise<void> {
  try {
    const skuId = data?.sku_id;
    const stockQuantity = data?.stock_quantity;
    const tenantId = data?.seller_id || data?.shop_id;

    logger.info('TikTok webhook: stock update', undefined, { skuId, stockQuantity, tenantId });

    if (!skuId || !tenantId || stockQuantity === undefined) return;

    const item = await prisma.inventory_items.findFirst({
      where: {
        OR: [{ sku: skuId }, { id: skuId }],
        tenant_id: tenantId,
      },
    });

    if (item) {
      await prisma.inventory_items.update({
        where: { id: item.id },
        data: { stock: stockQuantity },
      });
      logger.info('TikTok webhook: updated stock', undefined, { itemId: item.id, stock: stockQuantity });
    }
  } catch (error) {
    logger.error('TikTok webhook: handleStockUpdate failed', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default router;
