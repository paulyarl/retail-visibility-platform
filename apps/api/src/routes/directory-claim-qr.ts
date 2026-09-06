/**
 * Directory Claim QR Redirect
 *
 *   GET /api/public/qr/claim/:token
 *
 * Thin redirect that records a qr_scan_events row with surface='claim_invite',
 * then 302s to the claim page (/place/claim/{token}). Scan tracking stays out
 * of the claim flow entirely — this route is hit when the QR is scanned, not
 * when the claim page loads.
 *
 * The QR encodes the secret `token` string (not the row `id`), matching what
 * the public claim page /place/claim/[token] expects.
 *
 * Spec: docs/LocalBiz/seed_funnel_benchmark_gates_sprint_plan.md §4 W10
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { trackQrScanEvent } from '../services/QrAnalyticsService';
import { logger } from '../logger';

const router = Router();

const WEB_URL = process.env.WEB_URL || process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';

/**
 * GET /api/public/qr/claim/:token
 *
 * Records a QR scan event (surface='claim_invite', consumer='merchant') and
 * redirects to the claim page. The scan is recorded even if the token is
 * invalid or expired — the scan itself is the analytics signal (warm lead),
 * not the claim outcome.
 */
router.get('/qr/claim/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    // Resolve the tenant_id from the token's seed for scan attribution.
    // Best-effort: if the token is invalid, we still record the scan with
    // the platform tenant as the attribution target.
    let tenantId = 'platform';
    try {
      const seedRows = await prisma.$queryRaw<Array<{ tenant_id: string }>>`
        SELECT dps.tenant_id
        FROM directory_claim_tokens t
        JOIN directory_presence_seeds dps ON dps.id = t.seed_id
        WHERE t.token = ${token}
        LIMIT 1
      `;
      if (seedRows[0]?.tenant_id) {
        tenantId = seedRows[0].tenant_id;
      }
    } catch {
      // Token lookup failure — still record the scan
    }

    await trackQrScanEvent({
      tenantId,
      surface: 'claim_invite',
      consumer: 'merchant',
      source: 'qr_code',
      referrer: req.headers.referer || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    });

    // Redirect to the claim page — always 302, even if the token is invalid
    // (the claim page will show the appropriate error state)
    return res.redirect(302, `${WEB_URL}/place/claim/${token}`);
  } catch (error) {
    logger.error('[GET /api/public/qr/claim/:token] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
      token,
    });
    // On failure, still redirect to the claim page — scan tracking is
    // best-effort and must not block the claim flow
    return res.redirect(302, `${WEB_URL}/place/claim/${token}`);
  }
});

export default router;
