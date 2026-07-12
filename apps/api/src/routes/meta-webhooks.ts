/**
 * Meta Commerce Webhook Handler
 * Phase 2A: Meta Commerce Integration
 *
 * Receives Meta Commerce webhook events for:
 * - Product approval status changes
 * - Catalog sync errors
 * - Order placement from Instagram Shopping / Facebook Shop
 *
 * Follows stripe-webhook.ts pattern for signature verification.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { unifiedConfig } from '../config/unifiedConfig';

const router = Router();

const META_APP_SECRET = unifiedConfig.metaAppSecret;

/**
 * Verify Meta webhook signature using X-Hub-Signature-256 header
 */
function verifyWebhookSignature(req: Request): boolean {
  if (!META_APP_SECRET) {
    logger.warn('META_APP_SECRET not set — skipping webhook signature verification');
    return true;
  }

  const signature = req.get('X-Hub-Signature-256');
  if (!signature) return false;

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', META_APP_SECRET)
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
 * Webhook verification challenge (Meta sends GET with hub.challenge)
 */
router.get('/meta/webhooks', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = req.query['hub.verify_token'];

  if (mode === 'subscribe' && challenge) {
    const expectedToken = unifiedConfig.metaWebhookVerifyToken;
    if (expectedToken && verifyToken === expectedToken) {
      logger.info('Meta webhook verification successful');
      return res.status(200).send(challenge as string);
    }
    logger.warn('Meta webhook verification failed — token mismatch');
    return res.status(403).json({ error: 'Verification token mismatch' });
  }

  res.status(400).json({ error: 'Missing required parameters' });
});

/**
 * Receive Meta Commerce webhook events
 */
router.post('/meta/webhooks', async (req: Request, res: Response) => {
  try {
    if (!verifyWebhookSignature(req)) {
      logger.warn('Meta webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { object, entry } = req.body;

    if (!entry || !Array.isArray(entry)) {
      return res.status(200).json({ received: true });
    }

    for (const item of entry) {
      const changes = item.changes || [];
      for (const change of changes) {
        const field = change.field;
        const value = change.value;

        switch (field) {
          case 'product_item':
            await handleProductUpdate(item.id, value);
            break;
          case 'product_feed_upload':
            await handleFeedUploadResult(item.id, value);
            break;
          case 'commerce_order':
            await handleCommerceOrder(item.id, value);
            break;
          default:
            logger.info('Meta webhook: unhandled field', undefined, { field });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Meta webhook processing error', undefined, {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle product approval status changes
 */
async function handleProductUpdate(tenantId: string, value: any): Promise<void> {
  try {
    const productId = value?.product_id || value?.id;
    const approvalStatus = value?.approval_status;
    const retailerId = value?.retailer_id;

    logger.info('Meta webhook: product update', undefined, { tenantId, productId, approvalStatus, retailerId });

    if (approvalStatus === 'rejected' && retailerId) {
      const item = await prisma.inventory_items.findFirst({
        where: {
          OR: [
            { sku: retailerId },
            { id: retailerId },
          ],
          tenant_id: tenantId,
        },
      });

      if (item) {
        const metadata = item.metadata as any || {};
        await prisma.inventory_items.update({
          where: { id: item.id },
          data: {
            metadata: {
              ...metadata,
              meta_approval_status: 'rejected',
              meta_rejection_reason: value?.rejection_reason || null,
              meta_rejection_updated_at: new Date().toISOString(),
            },
          },
        });
        logger.info('Meta webhook: marked product as rejected', undefined, { itemId: item.id, retailerId });
      }
    } else if (approvalStatus === 'approved' && retailerId) {
      const item = await prisma.inventory_items.findFirst({
        where: {
          OR: [
            { sku: retailerId },
            { id: retailerId },
          ],
          tenant_id: tenantId,
        },
      });

      if (item) {
        const metadata = item.metadata as any || {};
        await prisma.inventory_items.update({
          where: { id: item.id },
          data: {
            metadata: {
              ...metadata,
              meta_approval_status: 'approved',
              meta_approval_updated_at: new Date().toISOString(),
            },
          },
        });
        logger.info('Meta webhook: marked product as approved', undefined, { itemId: item.id, retailerId });
      }
    }
  } catch (error) {
    logger.error('Meta webhook: handleProductUpdate failed', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle feed upload results (batch sync outcome)
 */
async function handleFeedUploadResult(tenantId: string, value: any): Promise<void> {
  try {
    logger.info('Meta webhook: feed upload result', undefined, {
      tenantId,
      uploadId: value?.upload_id,
      errorCount: value?.error_count,
      warningCount: value?.warning_count,
    });

    const account = await prisma.meta_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
    });

    if (account) {
      await prisma.meta_oauth_accounts_list.update({
        where: { id: account.id },
        data: {
          updated_at: new Date(),
        },
      });
    }
  } catch (error) {
    logger.error('Meta webhook: handleFeedUploadResult failed', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle commerce orders from Instagram Shopping / Facebook Shop
 */
async function handleCommerceOrder(tenantId: string, value: any): Promise<void> {
  try {
    const orderId = value?.order_id;
    const channel = value?.channel || 'instagram';

    logger.info('Meta webhook: commerce order received', undefined, { tenantId, orderId, channel });

    if (!orderId) return;

    const existingOrder = await prisma.orders.findFirst({
      where: {
        tenant_id: tenantId,
        source: channel === 'instagram' ? 'instagram_shopping' : 'facebook_shop',
        source_id: orderId,
      },
    });

    if (existingOrder) {
      logger.info('Meta webhook: order already exists', undefined, { orderId });
      return;
    }

    const items = value?.line_items || [];
    const subtotalCents = items.reduce((sum: number, li: any) => {
      const priceCents = Number(li.price_subtotal_cents || li.price_cents || 0);
      return sum + priceCents * (li.quantity || 1);
    }, 0);

    const shippingCents = Number(value?.shipping_cents || 0);
    const taxCents = Number(value?.tax_cents || 0);
    const totalCents = subtotalCents + shippingCents + taxCents;

    const { generateOrderId, generateOrderNumber } = await import('../lib/id-generator');
    const customerId = value?.buyer?.id || 'GUEST';

    const order = await prisma.orders.create({
      data: {
        id: generateOrderId(tenantId, customerId),
        order_number: await generateOrderNumber(tenantId),
        tenant_id: tenantId,
        customer_email: value?.buyer?.email || null,
        customer_name: value?.buyer?.name || null,
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        tax_cents: taxCents,
        total_cents: totalCents,
        currency: value?.currency || 'USD',
        order_status: 'draft',
        source: channel === 'instagram' ? 'instagram_shopping' : 'facebook_shop',
        source_id: orderId,
        shipping_address_line1: value?.shipping_address?.street1 || null,
        shipping_city: value?.shipping_address?.city || null,
        shipping_state: value?.shipping_address?.state || null,
        shipping_postal_code: value?.shipping_address?.zip || null,
        shipping_country: value?.shipping_address?.country || 'US',
        metadata: {
          meta_order_id: orderId,
          channel,
          buyer_id: value?.buyer?.id,
        },
      },
    });

    logger.info('Meta webhook: created order from commerce event', undefined, {
      orderId: order.id,
      metaOrderId: orderId,
      channel,
    });
  } catch (error) {
    logger.error('Meta webhook: handleCommerceOrder failed', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default router;
