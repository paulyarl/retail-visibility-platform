/**
 * Clover Webhook Routes — POS_STOCK_SYNC_SPEC §5.
 *
 * Mounted as preMiddleware in routeRegistry.ts (before JSON parsing) so
 * the X-Clover-Auth HMAC can verify the raw body — same shape as
 * webhooks/faire.ts.
 *
 * POST /api/webhooks/clover — Clover inventory/order/payment mutation
 *   events. Payloads are signal-only ({merchants: {mid: [{objectId,
 *   type, ts}]}}) — this endpoint only enqueues dirty rows into
 *   pos_dirty_items; the pos-dirty-flush job does the actual stock
 *   re-pull. Item events ('I:' objectIds) mark one item; order/payment
 *   events mark the whole integration dirty (NULL pos_item_id).
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../prisma';
import { logger } from '../../logger';

const router = express.Router();

function verifyCloverSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

router.post(
  '/',
  express.raw({ type: () => true }),
  async (req: Request, res: Response) => {
    const secret = process.env.CLOVER_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('[Clover Webhook] CLOVER_WEBHOOK_SECRET not configured', undefined);
      return res.status(500).json({ success: false, error: 'webhook_not_configured' });
    }

    const signature = req.headers['x-clover-auth'] as string | undefined;
    const rawBody = req.body as Buffer;
    const rawText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : '';

    if (!signature) {
      // Unsigned POST — Clover's URL-verification ping arrives without an
      // X-Clover-Auth signature. Acknowledge it (the dashboard needs a 200)
      // but never enqueue anything: an unsigned request can carry no
      // trustworthy event data.
      logger.info('[Clover Webhook] unsigned request (verification ping)', undefined, {
        bodyPreview: rawText.slice(0, 200),
        headers: JSON.stringify(req.headers).slice(0, 2000),
      });
      return res.json({ success: true, verified: true });
    }
    if (!verifyCloverSignature(rawBody, signature, secret)) {
      logger.warn('[Clover Webhook] signature verification failed', undefined);
      return res.status(401).json({ success: false, error: 'invalid_signature' });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, error: 'invalid_json' });
    }

    // {merchants: {merchantId: [{objectId, type, ts}, ...]}}
    const merchants = payload?.merchants && typeof payload.merchants === 'object'
      ? payload.merchants
      : {};
    const merchantIds = Object.keys(merchants);
    if (merchantIds.length === 0) {
      return res.json({ success: true, enqueued: 0 });
    }

    const integrations = await prisma.clover_integrations_list.findMany({
      where: { merchant_id: { in: merchantIds }, status: 'active', mode: 'production' },
      select: { id: true, merchant_id: true },
    });
    const byMerchant = new Map(integrations.map((i: any) => [i.merchant_id, i.id]));

    const rows: Array<{ id: string; provider: string; integration_id: string; pos_item_id: string | null }> = [];
    for (const [merchantId, events] of Object.entries(merchants)) {
      const integrationId = byMerchant.get(merchantId);
      if (!integrationId || !Array.isArray(events)) continue;
      let wholeIntegration = false;
      const itemIds = new Set<string>();
      for (const ev of events as any[]) {
        const objectId: string = ev?.objectId || '';
        if (objectId.startsWith('I:')) itemIds.add(objectId.slice(2));
        else wholeIntegration = true; // orders/payments/etc — affected items unknown
      }
      if (wholeIntegration || itemIds.size === 0) {
        rows.push({ id: crypto.randomBytes(12).toString('hex'), provider: 'clover', integration_id: integrationId, pos_item_id: null });
      } else {
        for (const itemId of itemIds) {
          rows.push({ id: crypto.randomBytes(12).toString('hex'), provider: 'clover', integration_id: integrationId, pos_item_id: itemId });
        }
      }
    }

    if (rows.length > 0) {
      // createMany + count (raw — no prisma model yet; migration 377).
      const values = rows
        .map((r) => `('${r.id}','${r.provider}','${r.integration_id}',${r.pos_item_id ? `'${r.pos_item_id}'` : 'NULL'})`)
        .join(',');
      await prisma.$executeRawUnsafe(
        `INSERT INTO pos_dirty_items (id, provider, integration_id, pos_item_id) VALUES ${values}`,
      );
    }

    logger.info('[Clover Webhook] dirty items enqueued', undefined, {
      enqueued: rows.length,
      merchants: merchantIds.length,
    });
    return res.json({ success: true, enqueued: rows.length });
  },
);

export default router;
