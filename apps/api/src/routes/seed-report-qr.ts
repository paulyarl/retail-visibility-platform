/**
 * Seed Report QR Redirect
 *
 *   GET /api/public/r/seed/:seedId/:channel — seed-id fallback variant
 *
 * Where :channel is one of:
 *   phone    — phone follow-up (operator sends link after call)
 *   email    — email introduction + claim link
 *   social   — DM/social-shared link
 *   in_person — printed card QR for walk-in delivery
 *
 * Records a qr_scan_events row (surface='report_delivery_{channel}'),
 * then 302s to the report preview page (/seed-report/{seedId}).
 *
 * The scan is recorded even if the seed/report is invalid — the scan
 * itself is the analytics signal (warm lead), not the claim outcome.
 *
 * The short-code variant (/r/{shortCode}/{channel}) is handled by a
 * Next.js redirect page on the web app that calls this endpoint's
 * resolve+track logic, then redirects to /seed-report/{seedId}.
 *
 * Mirrors the directory-claim-qr.ts pattern but with report-delivery
 * surfaces and a different redirect destination.
 *
 * Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md §13.6
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { trackQrScanEvent, type QrSurfaceType } from '../services/QrAnalyticsService';
import { logger } from '../logger';
import { unifiedConfig } from '../config/unifiedConfig';

const router = Router();

const WEB_URL = (
  unifiedConfig.get('WEB_URL') ||
  unifiedConfig.get('NEXT_PUBLIC_WEB_URL') ||
  unifiedConfig.webUrl ||
  'https://app.visibleshelf.com'
).replace(/\/+$/, '');

type ReportDeliveryChannel = 'phone' | 'email' | 'social' | 'in_person' | 'text';

const VALID_CHANNELS = new Set<ReportDeliveryChannel>(['phone', 'email', 'social', 'in_person', 'text']);

const SURFACE_MAP: Record<ReportDeliveryChannel, QrSurfaceType> = {
  phone: 'report_delivery_phone',
  email: 'report_delivery_email',
  social: 'report_delivery_social',
  in_person: 'report_delivery_in_person',
  text: 'report_delivery_text',
};

/**
 * Shared scan-record + redirect. Records a QR scan event (consumer='merchant')
 * and 302s to the report preview page. The scan is recorded even if the
 * seed is invalid — the scan itself is the analytics signal.
 */
async function recordReportScanAndRedirect(
  surface: QrSurfaceType,
  seedId: string,
  channel: string,
  req: Request,
  res: Response,
): Promise<void> {
  let tenantId = 'platform';

  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT tenant_id FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (rows[0]?.tenant_id) tenantId = rows[0].tenant_id;
  } catch {
    // Resolution failure — still record the scan with platform attribution
  }

  try {
    await trackQrScanEvent({
      tenantId,
      surface,
      consumer: 'merchant',
      productId: seedId, // §5.4 — seed attribution for report viewed/unviewed tracking
      source: `qr_code_${channel || 'unknown'}`,
      referrer: req.get('referer') ?? undefined,
      userAgent: req.get('user-agent') ?? undefined,
      geoCountry: (req as any).geoCountry ?? undefined,
      geoCity: (req as any).geoCity ?? undefined,
    });
  } catch {
    // Scan tracking failure — don't block the redirect
  }

  // §5.3.2 lifecycle: write the *view* side of the delivery so the funnel and
  // cadence see delivered → viewed. Best-effort, never blocks the redirect.
  if (seedId && VALID_CHANNELS.has(channel as ReportDeliveryChannel)) {
    try {
      const { default: reportDelivery } = await import(
        '../services/intelligence/SeedReportDeliveryService'
      );
      await reportDelivery.recordViewFromScan(seedId, channel as ReportDeliveryChannel);
    } catch {
      // View write-back failure — the scan row is still recorded
    }
  }

  res.redirect(302, `${WEB_URL}/seed-report/${seedId}`);
}

// ─── Route handlers ──────────────────────────────────────────────────────

// Seed-id fallback variant: /api/public/r/seed/:seedId/:channel
router.get('/r/seed/:seedId/:channel', async (req: Request, res: Response) => {
  const { seedId, channel } = req.params;
  if (!VALID_CHANNELS.has(channel as ReportDeliveryChannel)) {
    return res.status(400).json({ error: 'invalid_channel' });
  }

  await recordReportScanAndRedirect(
    SURFACE_MAP[channel as ReportDeliveryChannel],
    seedId,
    channel,
    req,
    res,
  );
});

// ─── Resolve + track endpoint for Next.js short-URL redirect pages ────────

/**
 * GET /api/public/r/report-scan/:shortCode?surface=in_person|text|email|social|phone
 *
 * Resolves a 6-char claim short code to the seed_id AND records a
 * qr_scan_events row with the matching report delivery surface in one
 * request. Returns { seedId } so the Next.js redirect page can redirect to
 * /seed-report/{seedId}.
 *
 * The short code is the same `directory_claim_tokens.short_code` used by
 * the claim invite — the report is delivered alongside the claim token.
 * The scan is recorded even if the code is invalid (warm-lead analytics).
 */
router.get('/r/report-scan/:shortCode', async (req: Request, res: Response) => {
  const { shortCode } = req.params;
  const { surface } = req.query;

  // Validate surface — fall back to in_person for unrecognized values
  const validSurfaces: Record<string, QrSurfaceType> = {
    in_person: 'report_delivery_in_person',
    text: 'report_delivery_text',
    email: 'report_delivery_email',
    social: 'report_delivery_social',
    phone: 'report_delivery_phone',
  };
  const resolvedSurface = validSurfaces[surface as string] || 'report_delivery_in_person';

  let seedId: string | null = null;
  let tenantId = 'platform';

  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT dct.seed_id, dps.tenant_id
      FROM directory_claim_tokens dct
      JOIN directory_presence_seeds dps ON dps.id = dct.seed_id
      WHERE dct.short_code = ${shortCode}
        AND dct.consumed_at IS NULL
        AND (dct.expires_at IS NULL OR dct.expires_at > now())
      LIMIT 1
    `;
    if (rows[0]) {
      seedId = rows[0].seed_id;
      tenantId = rows[0].tenant_id || 'platform';
    }
  } catch {
    // Resolution failure — still record the scan
  }

  // Record the scan event
  try {
    await trackQrScanEvent({
      tenantId,
      surface: resolvedSurface,
      consumer: 'merchant',
      productId: seedId ?? undefined, // §5.4 — seed attribution for view tracking
      source: `qr_code_${surface || 'unknown'}`,
      referrer: req.get('referer') ?? undefined,
      userAgent: req.get('user-agent') ?? undefined,
      geoCountry: (req as any).geoCountry ?? undefined,
      geoCity: (req as any).geoCity ?? undefined,
    });
  } catch {
    // Scan tracking failure — don't block the response
  }

  if (!seedId) {
    return res.status(404).json({ error: 'not_found' });
  }

  // §5.3.2 lifecycle: write the view side of the delivery (best-effort).
  try {
    const channel = (Object.keys(validSurfaces) as ReportDeliveryChannel[]).find(
      (c) => validSurfaces[c] === resolvedSurface,
    );
    if (channel) {
      const { default: reportDelivery } = await import(
        '../services/intelligence/SeedReportDeliveryService'
      );
      await reportDelivery.recordViewFromScan(seedId, channel);
    }
  } catch {
    // View write-back failure — the scan row is still recorded
  }

  res.json({ success: true, seedId });
});

export default router;
