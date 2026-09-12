/**
 * Directory Claim QR Redirect
 *
 *   GET /api/public/qr/claim/:token         — mailed claim invite
 *   GET /api/public/qr/claim/:token/walkin  — hand-delivered (walk-in) invite
 *   GET /api/public/qr/claim/:token/social  — DM/social-shared invite link
 *   GET /api/public/qr/claim/:token/email   — email-shared invite link
 *   GET /api/public/qr/c/:shortCode          — short-code variant (mail)
 *   GET /api/public/qr/c/:shortCode/walkin   — short-code variant (walk-in)
 *   GET /api/public/qr/c/:shortCode/social   — short-code variant (social)
 *   GET /api/public/qr/c/:shortCode/email    — short-code variant (email)
 *   GET /api/public/qr/claim-scan/:shortCode?surface=mail|walkin|social|email
 *                                          — JSON resolve + track for /q/, /qw/,
 *                                            /qs/, /qe/ frontend redirect pages
 *
 * Thin redirect that records a qr_scan_events row, then 302s to the claim
 * page (/place/claim/{token}). Scan tracking stays out of the claim flow
 * entirely — this route is hit when the QR is scanned (or the tracked link
 * is tapped), not when the claim page loads.
 *
 * Three surfaces so delivery-channel attribution stays separable:
 *   - 'claim_invite'        — printed/mailed postcard QR
 *   - 'claim_invite_walkin' — leave-behind card QR handed over in person
 *   - 'claim_invite_social' — tracked link sent via DM / social (remote
 *                           prospects where a walk-in isn't possible)
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
import { unifiedConfig } from '../config/unifiedConfig';

const router = Router();

const WEB_URL = (
  unifiedConfig.get('WEB_URL') ||
  unifiedConfig.get('NEXT_PUBLIC_WEB_URL') ||
  unifiedConfig.webUrl
).replace(/\/+$/, '');

/**
 * Shared scan-record + redirect. Records a QR scan event (consumer='merchant')
 * and 302s to the claim page. The scan is recorded even if the token is
 * invalid or expired — the scan itself is the analytics signal (warm lead),
 * not the claim outcome.
 */
async function recordClaimScanAndRedirect(
  surface: 'claim_invite' | 'claim_invite_walkin' | 'claim_invite_social' | 'claim_invite_email',
  req: Request,
  res: Response,
): Promise<void> {
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
      surface,
      consumer: 'merchant',
      source: 'qr_code',
      referrer: req.headers.referer || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    });

    // Redirect to the claim page — always 302, even if the token is invalid
    // (the claim page will show the appropriate error state)
    res.redirect(302, `${WEB_URL}/place/claim/${token}`);
  } catch (error) {
    logger.error('[GET /api/public/qr/claim/:token] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
      token,
      surface,
    });
    // On failure, still redirect to the claim page — scan tracking is
    // best-effort and must not block the claim flow
    res.redirect(302, `${WEB_URL}/place/claim/${token}`);
  }
}

router.get('/qr/claim/:token', (req, res) =>
  recordClaimScanAndRedirect('claim_invite', req, res),
);

router.get('/qr/claim/:token/walkin', (req, res) =>
  recordClaimScanAndRedirect('claim_invite_walkin', req, res),
);

router.get('/qr/claim/:token/social', (req, res) =>
  recordClaimScanAndRedirect('claim_invite_social', req, res),
);

router.get('/qr/claim/:token/email', (req, res) =>
  recordClaimScanAndRedirect('claim_invite_email', req, res),
);

// ─── Short-code QR tracked redirects (migration 278) ─────────────────────
// Compact variants of the claim QR redirect. QR codes encoding the short
// URL have fewer modules → more legible at small print sizes. Resolves the
// 6-char short code to the underlying token, records the scan event, then
// 302s to /place/claim/{token} (same destination as the long-URL variant).

async function recordShortCodeScanAndRedirect(
  surface: 'claim_invite' | 'claim_invite_walkin' | 'claim_invite_social' | 'claim_invite_email',
  req: Request,
  res: Response,
): Promise<void> {
  const { shortCode } = req.params;

  let token: string | null = null;
  let tenantId = 'platform';

  try {
    // Resolve short code → token + tenant for scan attribution.
    const { default: DirectoryPresenceSeedService } = await import('../services/DirectoryPresenceSeedService');
    const resolved = await DirectoryPresenceSeedService.resolveClaimShortCode(shortCode);
    if (resolved) {
      token = resolved.token;
      tenantId = resolved.tenantId;
    }
  } catch {
    // Short code lookup failure — still record the scan with platform tenant
  }

  try {
    await trackQrScanEvent({
      tenantId,
      surface,
      consumer: 'merchant',
      source: 'qr_code',
      referrer: req.headers.referer || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    });
  } catch (error) {
    logger.error('[GET /api/public/qr/c/:shortCode] scan tracking error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
      shortCode,
      surface,
    });
  }

  // Redirect to the claim page. If the short code didn't resolve, redirect to
  // the claim page root (it will show an appropriate error state).
  const target = token ? `${WEB_URL}/place/claim/${token}` : `${WEB_URL}/place/claim/`;
  res.redirect(302, target);
}

router.get('/qr/c/:shortCode', (req, res) =>
  recordShortCodeScanAndRedirect('claim_invite', req, res),
);

router.get('/qr/c/:shortCode/walkin', (req, res) =>
  recordShortCodeScanAndRedirect('claim_invite_walkin', req, res),
);

router.get('/qr/c/:shortCode/social', (req, res) =>
  recordShortCodeScanAndRedirect('claim_invite_social', req, res),
);

router.get('/qr/c/:shortCode/email', (req, res) =>
  recordShortCodeScanAndRedirect('claim_invite_email', req, res),
);

// ─── Combined resolve + track endpoint for short frontend redirect pages ──
// GET /api/public/qr/claim-scan/:shortCode?surface=mail|walkin|social|email
//
// Used by the /q/, /qw/, /qs/, /qe/ Next.js server-component redirect pages. Unlike
// the /qr/c/:shortCode routes above (which 302 redirect), this returns JSON
// { success, token } so the frontend page can redirect to /place/claim/{token}
// after recording the scan. Combines resolution + scan tracking in one call
// so the frontend page makes a single API request.
//
// surface param maps to the qr_scan_events surface:
//   - mail   → 'claim_invite'
//   - walkin → 'claim_invite_walkin'
//   - social → 'claim_invite_social'
//   - email  → 'claim_invite_email'
// Unknown / missing surface → 400 (reject, do NOT silently default — a typo
// would cross-contaminate per-surface scan attribution).

const SURFACE_MAP: Record<string, 'claim_invite' | 'claim_invite_walkin' | 'claim_invite_social' | 'claim_invite_email'> = {
  mail: 'claim_invite',
  walkin: 'claim_invite_walkin',
  social: 'claim_invite_social',
  email: 'claim_invite_email',
};

router.get('/qr/claim-scan/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  const surfaceParam = (req.query.surface as string) || 'mail';
  const surface = SURFACE_MAP[surfaceParam];
  if (!surface) {
    return res.status(400).json({ success: false, error: 'invalid_surface' });
  }

  let token: string | null = null;
  let tenantId = 'platform';

  try {
    const { default: DirectoryPresenceSeedService } = await import('../services/DirectoryPresenceSeedService');
    const resolved = await DirectoryPresenceSeedService.resolveClaimShortCode(shortCode);
    if (resolved) {
      token = resolved.token;
      tenantId = resolved.tenantId;
    }
  } catch {
    // Short code lookup failure — still record the scan with platform tenant
  }

  try {
    await trackQrScanEvent({
      tenantId,
      surface,
      consumer: 'merchant',
      source: 'qr_code',
      referrer: req.headers.referer || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    });
  } catch (error) {
    logger.error('[GET /api/public/qr/claim-scan/:shortCode] scan tracking error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
      shortCode,
      surface,
    });
  }

  if (!token) {
    return res.status(404).json({ success: false, error: 'claim_link_not_found' });
  }

  return res.json({ success: true, token });
});

export default router;
