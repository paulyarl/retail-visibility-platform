/**
 * Faire Webhook Routes
 *
 * Mounted as preMiddleware in routeRegistry.ts (before JSON parsing)
 * for signature verification using raw body.
 *
 * POST /api/webhooks/faire — Faire order confirmation callback
 *   Updates affiliate_clicks.status to 'converted' when an order is placed.
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import wholesaleMatchingService from '../../services/WholesaleMatchingService';
import { logger } from '../../logger';
import { unifiedConfig } from '../../config/unifiedConfig';

const router = express.Router();

/**
 * Verify Faire webhook signature.
 * Faire uses HMAC-SHA256 with the webhook secret.
 */
function verifyFaireSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['x-faire-signature'] as string | undefined;
    const webhookSecret = unifiedConfig.faireWebhookSecret;

    if (!webhookSecret) {
      logger.error('Faire webhook secret not configured', undefined, {
        envVar: 'FAIRE_WEBHOOK_SECRET',
      });
      return res.status(500).json({ success: false, error: 'webhook_not_configured' });
    }

    if (!signature) {
      return res.status(400).json({ success: false, error: 'missing_signature' });
    }

    const rawBody = req.body as Buffer;

    if (!verifyFaireSignature(rawBody, signature, webhookSecret)) {
      logger.warn('Faire webhook signature verification failed', undefined);
      return res.status(401).json({ success: false, error: 'invalid_signature' });
    }

    try {
      const event = JSON.parse(rawBody.toString('utf-8'));

      // Handle order confirmation — update affiliate click status
      if (event.type === 'order_created' || event.type === 'order_confirmed') {
        const clickId = event.data?.click_id || event.click_id;

        if (clickId) {
          const commissionAmount = event.data?.commission_amount || event.commission_amount;
          await wholesaleMatchingService.trackAffiliateClick(
            clickId,
            'converted',
            commissionAmount ? Number(commissionAmount) : undefined
          );

          logger.info('Faire webhook: affiliate click converted', undefined, {
            clickId,
            eventType: event.type,
          });
        }
      }

      res.json({ success: true, received: true });
    } catch (error) {
      logger.error('Faire webhook processing failed', undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ success: false, error: 'webhook_processing_failed' });
    }
  }
);

export default router;
