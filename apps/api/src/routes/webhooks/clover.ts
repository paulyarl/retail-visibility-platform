/**
 * Clover Webhook Routes — POS_STOCK_SYNC_SPEC §5.
 *
 * Mounted as preMiddleware in routeRegistry.ts (before JSON parsing) so
 * the X-Clover-Auth HMAC can verify the raw body — same shape as
 * webhooks/faire.ts.
 *
 * POST /api/webhooks/clover — Clover inventory/order/payment mutation
 *   events plus App-level events. Payloads are signal-only
 *   ({merchants: {mid: [{objectId, type, ts}]}}). Item events ('I:'
 *   objectIds) mark one item dirty; order/payment events mark the whole
 *   integration dirty (NULL pos_item_id); App events ('A:' objectIds) with
 *   an UNINSTALL/DELETE type disconnect the integration — that is the only
 *   signal we get when a merchant removes the app, since the token just
 *   starts 401ing otherwise and the UI keeps showing a stale Connected.
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../prisma';
import { logger } from '../../logger';

const router = express.Router();

/**
 * Verify the Clover auth code. Per Clover docs: X-Clover-Auth carries a
 * static per-app auth code (shown in App Settings → Webhooks after URL
 * validation), NOT an HMAC over the body. Compare constant-time.
 * CLOVER_WEBHOOK_SECRET holds that auth code.
 */
function verifyCloverSignature(_rawBody: Buffer, signature: string, secret: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(secret));
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
    const rawBody = req.body;
    // Body may arrive as a Buffer (raw) or an already-parsed object if an
    // upstream JSON middleware consumed it — handle both.
    const rawText = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : (typeof rawBody === 'object' && rawBody !== null ? JSON.stringify(rawBody) : '');

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
    if (!Buffer.isBuffer(rawBody) || !verifyCloverSignature(rawBody, signature, secret)) {
      logger.warn('[Clover Webhook] signature verification failed', undefined, {
        sigValue: signature,
        sigLen: signature?.length,
        secretLen: secret.length,
        secretPrefix: secret.slice(0, 8),
      });
      return res.status(401).json({ success: false, error: 'invalid_signature' });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawText);
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

      // App-level events: an uninstall means the grant is gone — disconnect
      // now (clear tokens) instead of letting polls 401 into 'token_expired'.
      // Log every app-level event so real payload shapes are observable
      // (INSTALL, UNINSTALL, and any type Clover adds later).
      const appEvents = (events as any[]).filter((ev) => (ev?.objectId || '').startsWith('A:'));
      if (appEvents.length > 0) {
        logger.info('[Clover Webhook] app events received', undefined, {
          merchantId,
          events: appEvents.map((ev) => ({ type: ev?.type, ts: ev?.ts })),
        });
      }

      const uninstalled = appEvents.some((ev) => {
        const type: string = (ev?.type || '').toUpperCase();
        return type === 'UNINSTALL' || type === 'DELETE';
      });
      if (uninstalled) {
        await prisma.clover_integrations_list.update({
          where: { id: integrationId },
          data: {
            status: 'disconnected',
            access_token: null,
            refresh_token: null,
            token_expires_at: null,
            last_sync_status: 'uninstalled',
          },
        });
        logger.info('[Clover Webhook] app uninstalled — integration disconnected', undefined, { merchantId });
        continue;
      }

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
