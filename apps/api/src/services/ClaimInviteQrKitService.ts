/**
 * ClaimInviteQrKitService — generates downloadable QR artifacts for directory
 * claim invites.
 *
 *   - PNG: a high-resolution QR code encoding the tracked redirect URL
 *     `/api/public/qr/claim/{token}` (server-side, via the `qrcode` package).
 *   - PDF: a 4x6" postcard with the QR code, platform branding, and the
 *     business mailing address (reuses the jsPDF pattern from
 *     PostalMailerPdfService).
 *
 * The QR encodes the *tracked redirect URL*, not the claim page URL directly,
 * so that scans are recorded in `qr_scan_events` before the merchant lands on
 * the claim page. Three URL variants exist so delivery channel stays separable:
 *   - mail   → `/q/{shortCode}`   (surface='claim_invite')
 *   - walkin → `/qw/{shortCode}`  (surface='claim_invite_walkin')
 *   - social → `/qs/{shortCode}`  (surface='claim_invite_social')
 * The short-code variants use Next.js frontend redirect pages (mirrors the
 * /s/ coupon and /g/ gallery short-URL patterns) — the page calls a combined
 * resolve + track API endpoint, then redirects to /place/claim/{token}.
 * Legacy tokens without a short code fall back to the long-token API redirect
 * `/api/public/qr/claim/{token}[/walkin|/social]`.
 * The social variant is a tracked link for DM/social sharing — remote
 * prospects where a walk-in isn't possible.
 *
 * Spec: docs/LocalBiz/seed_funnel_benchmark_gates_sprint_plan.md §4 W10
 */

import QRCode from 'qrcode';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { loadPlatformBranding } from './marketing/MarketingReceiptPdfService';
import { unifiedConfig } from '../config/unifiedConfig';

// Public-facing base URL the QR encodes. The web origin wins: printed
// artifacts carry the branded public domain, and Next.js rewrites proxy
// /api/* to the API so https://<web>/api/public/qr/... still reaches the
// tracked redirect. API-origin vars remain as a fallback for environments
// where the rewrite isn't in play. Never default to localhost — a QR
// encoding it can never resolve when scanned from a phone. Same pattern as
// PostalMailerService.resolveQrDestination.
const QR_BASE_URL = (
  unifiedConfig.frontendUrl ||
  unifiedConfig.webUrl ||
  unifiedConfig.get('API_URL') ||
  unifiedConfig.get('API_BASE_URL') ||
  unifiedConfig.get('NEXT_PUBLIC_API_URL') ||
  unifiedConfig.get('NEXT_PUBLIC_API_BASE_URL') ||
  'https://app.visibleshelf.com'
)
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

// Human-facing claim links (/place/claim, /c) live on the web app, not the
// API host.
const WEB_BASE_URL = (
  unifiedConfig.frontendUrl ||
  unifiedConfig.webUrl ||
  'https://app.visibleshelf.com'
).replace(/\/+$/, '');

const DEFAULT_QR_SIZE = 512;

export type ClaimInviteQrVariant = 'mail' | 'walkin' | 'social';

export interface ClaimInviteQrKit {
  seedId: string;
  token: string;
  shortCode: string | null;
  qrUrl: string;
  qrUrlWalkin: string;
  qrUrlSocial: string;
  claimUrl: string;
  shortClaimUrl: string | null;
  businessName: string;
  addressLines: string[];
  expiresAt: Date | null;
}

export interface GeneratedQrPng {
  pngBuffer: Buffer;
  filename: string;
}

export interface GeneratedClaimPostcard {
  pdfBuffer: Buffer;
  filename: string;
}

/**
 * Resolve the active (unconsumed, unexpired) claim token + business info for a
 * seed. Returns null if no active token exists.
 */
async function resolveClaimInviteKit(seedId: string): Promise<ClaimInviteQrKit | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      token_id: string;
      token: string;
      short_code: string | null;
      expires_at: Date | null;
      business_name: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zip_code: string | null;
    }>
  >`
    SELECT
      dct.id AS token_id,
      dct.token,
      dct.short_code,
      dct.expires_at,
      dl.business_name,
      dl.address,
      dl.city,
      dl.state,
      dl.zip_code
    FROM directory_claim_tokens dct
    JOIN directory_presence_seeds dps ON dps.id = dct.seed_id
    JOIN directory_listings_list dl ON dl.id = dps.listing_id
    WHERE dct.seed_id = ${seedId}
      AND dct.consumed_at IS NULL
      AND (dct.expires_at IS NULL OR dct.expires_at > now())
    ORDER BY dct.created_at DESC
    LIMIT 1
  `;
  if (!rows[0] || !rows[0].token) return null;

  const row = rows[0];
  const token = row.token;
  // Lazily backfill a short_code on legacy tokens minted before migration 278.
  // The compact /q/{shortCode} URL has far fewer QR modules than the
  // long-token URL — critical for legibility at postcard print sizes.
  let shortCode = row.short_code ?? null;
  if (!shortCode) {
    try {
      const { default: DirectoryPresenceSeedService } = await import('./DirectoryPresenceSeedService');
      shortCode = await DirectoryPresenceSeedService.ensureClaimShortCode(row.token_id);
    } catch {
      // Best-effort — fall through to the long-token URL below.
    }
  }

  // Prefer the short-code QR tracked redirect when a short code exists —
  // fewer QR modules = more legible at small print sizes. The short-code
  // variant uses the /q/, /qw/, /qs/ frontend redirect pages (mirrors the
  // /s/ coupon and /g/ gallery short-URL patterns), which resolve the code,
  // record the scan event, then redirect to /place/claim/{token}. Falls back
  // to the long-token API redirect URL for legacy tokens without a short
  // code.
  const qrUrl = shortCode
    ? `${WEB_BASE_URL}/q/${shortCode}`
    : `${QR_BASE_URL}/api/public/qr/claim/${token}`;
  const qrUrlWalkin = shortCode
    ? `${WEB_BASE_URL}/qw/${shortCode}`
    : `${QR_BASE_URL}/api/public/qr/claim/${token}/walkin`;
  const qrUrlSocial = shortCode
    ? `${WEB_BASE_URL}/qs/${shortCode}`
    : `${QR_BASE_URL}/api/public/qr/claim/${token}/social`;
  const claimUrl = `${WEB_BASE_URL}/place/claim/${token}`;
  const shortClaimUrl = shortCode
    ? `${WEB_BASE_URL}/c/${shortCode}`
    : null;

  const addressLines: string[] = [];
  if (row.business_name) addressLines.push(row.business_name);
  if (row.address) addressLines.push(row.address);
  const cityState = [row.city, row.state].filter(Boolean).join(', ');
  if (cityState) addressLines.push(cityState);
  if (row.zip_code) addressLines.push(row.zip_code);

  return {
    seedId,
    token,
    shortCode,
    qrUrl,
    qrUrlWalkin,
    qrUrlSocial,
    claimUrl,
    shortClaimUrl,
    businessName: row.business_name || 'Business Owner',
    addressLines,
    expiresAt: row.expires_at,
  };
}

/** Pick the tracked URL for a delivery variant. */
function kitUrlForVariant(kit: ClaimInviteQrKit, variant: ClaimInviteQrVariant): string {
  if (variant === 'walkin') return kit.qrUrlWalkin;
  if (variant === 'social') return kit.qrUrlSocial;
  return kit.qrUrl;
}

/** Badge label printed on the postcard so print runs stay separable. */
function badgeForVariant(variant: ClaimInviteQrVariant): string {
  if (variant === 'walkin') return 'Claim Invite — Walk-in';
  if (variant === 'social') return 'Claim Invite — Social';
  return 'Claim Invite';
}

/**
 * Generate a PNG QR code for the claim invite.
 */
export async function generateClaimInvitePng(
  seedId: string,
  variant: ClaimInviteQrVariant = 'mail',
): Promise<GeneratedQrPng> {
  const kit = await resolveClaimInviteKit(seedId);
  if (!kit) throw new Error('no_active_claim_token');

  const qrUrl = kitUrlForVariant(kit, variant);
  const pngBuffer = await QRCode.toBuffer(qrUrl, {
    width: DEFAULT_QR_SIZE,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  });

  const safeName = kit.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const filename = `claim-qr-${safeName}${variant === 'mail' ? '' : `-${variant}`}.png`;

  logger.info('ClaimInviteQrKitService.generateClaimInvitePng', undefined, { seedId, qrUrl, variant });
  return { pngBuffer, filename };
}

/**
 * Generate a 4x6" postcard PDF with the claim-invite QR code.
 *
 * qrDataUrlOverride lets the admin QR designer (ClaimQrDesignerModal) ship a
 * client-rendered styled QR — logo overlay, dot/corner styles — into the same
 * postcard layout. When absent, falls back to the classic B/W qrcode render.
 */
export async function generateClaimInvitePostcard(
  seedId: string,
  variant: ClaimInviteQrVariant = 'mail',
  qrDataUrlOverride?: string,
): Promise<GeneratedClaimPostcard> {
  const kit = await resolveClaimInviteKit(seedId);
  if (!kit) throw new Error('no_active_claim_token');

  const qrUrl = kitUrlForVariant(kit, variant);

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'in', format: [4, 6] });
  const pageWidth = 4;
  const pageHeight = 6;
  const margin = 0.25;
  const branding = await loadPlatformBranding();

  // ── Header: platform name (logo if loadable) ───────────────────────────
  let logoWidth = 0;
  const logoHeight = 0.3;
  if (branding.logoUrl) {
    try {
      const logoResponse = await fetch(branding.logoUrl);
      if (logoResponse.ok) {
        const logoBuffer = await logoResponse.arrayBuffer();
        const logoBase64 = Buffer.from(logoBuffer).toString('base64');
        const contentType = logoResponse.headers.get('content-type') || 'image/png';
        const logoDataUri = `data:${contentType};base64,${logoBase64}`;
        const imgProps = doc.getImageProperties(logoDataUri);
        const aspectRatio = imgProps.width / imgProps.height;
        logoWidth = logoHeight * aspectRatio;
        doc.addImage(logoDataUri, 'PNG', margin, margin, logoWidth, logoHeight);
      }
    } catch {
      // Continue without logo
    }
  }

  doc.setFontSize(14);
  doc.setTextColor(branding.primaryColor);
  const brandX = logoWidth > 0 ? margin + logoWidth + 0.05 : margin;
  doc.setFont('helvetica', 'bold');
  doc.text(branding.platformName, brandX, margin + logoHeight / 2 + 0.04);

  // ── Headline ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  const headline = 'Claim Your Business Listing';
  const headlineLines = doc.splitTextToSize(headline, pageWidth - 2 * margin);
  let yPos = margin + logoHeight + 0.35;
  doc.text(headlineLines, pageWidth / 2, yPos, { align: 'center' });
  yPos += headlineLines.length * 0.22 + 0.12;

  // ── Body ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  const body = `${kit.businessName} is on ${branding.platformName}. Scan the code below to claim your listing and start managing your presence.`;
  const bodyLines = doc.splitTextToSize(body, pageWidth - 2 * margin);
  doc.text(bodyLines, pageWidth / 2, yPos, { align: 'center' });
  yPos += bodyLines.length * 0.16 + 0.3;

  // ── QR code ───────────────────────────────────────────────────────────
  const qrSize = 1.4;
  const qrX = (pageWidth - qrSize) / 2;
  const qrDataUrl = qrDataUrlOverride ?? await QRCode.toDataURL(qrUrl, {
    width: 400,
    margin: 1,
    errorCorrectionLevel: 'H',
  });
  doc.addImage(qrDataUrl, 'PNG', qrX, yPos, qrSize, qrSize);
  yPos += qrSize + 0.08;

  // ── CTA label ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(branding.primaryColor);
  doc.text('Scan to claim your listing', pageWidth / 2, yPos, { align: 'center' });
  yPos += 0.22;

  // ── Mailing address block (bottom right) ──────────────────────────────
  const addressX = pageWidth - margin;
  const addressY = pageHeight - 0.15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  for (let i = 0; i < kit.addressLines.length; i++) {
    const line = kit.addressLines[kit.addressLines.length - 1 - i];
    doc.text(line, addressX, addressY - i * 0.16, { align: 'right' });
  }

  // ── Return address (bottom left) ──────────────────────────────────────
  const returnLines = [branding.platformName];
  if (branding.contactEmail) returnLines.push(branding.contactEmail);
  if (branding.contactWebsite) returnLines.push(branding.contactWebsite);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  for (let i = 0; i < returnLines.length; i++) {
    doc.text(returnLines[i], margin, pageHeight - 0.15 - i * 0.12);
  }

  // ── Claim-invite badge (top right, subtle) ────────────────────────────
  // Labels the delivery channel so an operator printing both variants can
  // tell the mail postcard from the walk-in leave-behind at a glance.
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(badgeForVariant(variant), pageWidth - margin, margin + 0.05, { align: 'right' });

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const safeName = kit.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const filename = `claim-postcard-${safeName}${variant === 'mail' ? '' : `-${variant}`}.pdf`;

  logger.info('ClaimInviteQrKitService.generateClaimInvitePostcard', undefined, { seedId, qrUrl, variant });
  return { pdfBuffer, filename };
}

/**
 * Resolve the kit metadata (for JSON responses / preview).
 */
export async function getClaimInviteKitMeta(seedId: string): Promise<ClaimInviteQrKit | null> {
  return resolveClaimInviteKit(seedId);
}
