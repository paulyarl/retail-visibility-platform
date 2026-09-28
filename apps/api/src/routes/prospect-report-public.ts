/**
 * Prospect Report — Public Routes
 *
 *   GET /api/public/marketing/prospect-report/:token      — signed-token DTO
 *   GET /api/public/marketing/prospect-report/:token/pdf  — branded PDF (Phase 6)
 *   GET /api/public/r/pr-scan/:code                       — short-link resolve + scan
 *
 * The report is addressed by an HMAC-signed capability token
 * (prospectId.tier.chapterList.flags) — no auth, no publish state. The tier
 * and chapter set are inside the signature: a `free` link can never serve a
 * `full` body and the owner can't add chapters by editing the URL (§5.1a).
 *
 * Short links: mkt_prospect_report_links rows mint one 6-char code per share
 * action; the row's channel drives the prospect_report_{channel} scan surface
 * (kept outside report_delivery_* and claim_invite_* — report clicks must
 * never register as seed-delivery or claim scans, G-2/§5.2a).
 *
 * Spec: docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPEC.md §5
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { trackQrScanEvent, type QrSurfaceType } from '../services/QrAnalyticsService';
import { logger } from '../logger';
import prospectReportService from '../services/ProspectReportService';

const router = Router();

const VALID_CHANNELS = new Set(['phone', 'email', 'social', 'in_person', 'text', 'banner']);

const CHANNEL_SURFACE: Record<string, QrSurfaceType> = {
  phone: 'prospect_report_phone',
  email: 'prospect_report_email',
  social: 'prospect_report_social',
  in_person: 'prospect_report_in_person',
  text: 'prospect_report_text',
  banner: 'prospect_report_banner',
};

/**
 * Resolve the report DTO for a verified token, applying the tier clamp and
 * chapter selection server-side (§5.1a). Shared by the JSON and PDF routes.
 */
async function buildReportFromToken(token: string) {
  const decoded = prospectReportService.verifyToken(token);
  if (!decoded) return null;
  return prospectReportService.assembleReport(
    decoded.prospectId,
    decoded.chapters,
    decoded.tier,
    { includePagePlan: decoded.includePagePlan },
  );
}

// ─── Report DTO ──────────────────────────────────────────────────────────

router.get('/marketing/prospect-report/:token', async (req: Request, res: Response) => {
  try {
    const report = await buildReportFromToken(req.params.token);
    if (!report) return res.status(404).json({ error: 'not_found' });
    res.json(report);
  } catch (error) {
    logger.error('Prospect report fetch failed', undefined, {
      error: (error as Error).message,
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── PDF ─────────────────────────────────────────────────────────────────
// Side-effect-free: never mints a links row; the caller passes ?qr={code}
// (a code minted by the share endpoint) so the PDF embeds that channel's
// tracked /r/pr/{code} QR.

router.get('/marketing/prospect-report/:token/pdf', async (req: Request, res: Response) => {
  try {
    const report = await buildReportFromToken(req.params.token);
    if (!report) return res.status(404).json({ error: 'not_found' });
    const qrCode = typeof req.query.qr === 'string' && /^[A-Z2-9]{6}$/i.test(req.query.qr)
      ? req.query.qr.toUpperCase()
      : undefined;
    const { generateProspectReportPdf } = await import(
      '../services/intelligence/ProspectReportPdfService'
    );
    const { pdfBuffer, filename } = await generateProspectReportPdf({ report, qrCode });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Prospect report PDF failed', undefined, {
      error: (error as Error).message,
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── Short-link resolve + track (§5.2a) ──────────────────────────────────

/**
 * GET /api/public/r/pr-scan/:code
 *
 * Resolves a mkt_prospect_report_links code, records a qr_scan_events row
 * under prospect_report_{row.channel} (productId = business_prospect_id),
 * and returns the report URL for the /r/pr/[code] redirect page.
 *
 * Tenant resolution (G-1): linked seed's tenant → minting campaign's
 * tenant_id → 'platform' fallback — the seed-report fallback pattern.
 */
router.get('/r/pr-scan/:code', async (req: Request, res: Response) => {
  const { code } = req.params;

  let link: Awaited<ReturnType<typeof prospectReportService.resolveLinkCode>> = null;
  try {
    link = await prospectReportService.resolveLinkCode(code);
  } catch {
    // Resolution failure — still record the scan below
  }

  const surface: QrSurfaceType =
    link && VALID_CHANNELS.has(link.channel)
      ? CHANNEL_SURFACE[link.channel]
      : 'prospect_report_in_person';

  // Tenant: linked seed's tenant → minting campaign's tenant → 'platform'.
  let tenantId = 'platform';
  try {
    if (link) {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT COALESCE(dps.tenant_id, mc.tenant_id) AS tenant_id
        FROM mkt_campaigns_list mc
        LEFT JOIN directory_seed_campaign_links dscl
          ON dscl.campaign_id = mc.id AND dscl.link_role = 'primary'
        LEFT JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
        WHERE mc.id = ${link.campaignId}
        LIMIT 1
      `;
      if (rows[0]?.tenant_id) tenantId = rows[0].tenant_id;
    }
  } catch {
    // Tenant resolution failure — platform attribution
  }

  try {
    await trackQrScanEvent({
      tenantId,
      surface,
      consumer: 'merchant',
      productId: link?.prospectId ?? undefined,
      source: `prospect_report_${link?.channel ?? 'unknown'}`,
      referrer: req.get('referer') ?? undefined,
      userAgent: req.get('user-agent') ?? undefined,
      geoCountry: (req as any).geoCountry ?? undefined,
      geoCity: (req as any).geoCity ?? undefined,
    });
  } catch {
    // Scan tracking failure — don't block the redirect
  }

  if (!link) {
    return res.status(404).json({ error: 'not_found' });
  }

  res.json({ success: true, url: `/prospect-report/${link.token}` });
});

export default router;
