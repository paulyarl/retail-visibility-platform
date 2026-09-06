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
 * so that scans are recorded in `qr_scan_events` with surface='claim_invite'
 * before the merchant lands on the claim page.
 *
 * Spec: docs/LocalBiz/seed_funnel_benchmark_gates_sprint_plan.md §4 W10
 */

import QRCode from 'qrcode';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { loadPlatformBranding } from './marketing/MarketingReceiptPdfService';

const API_BASE_URL =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const DEFAULT_QR_SIZE = 512;

export interface ClaimInviteQrKit {
  seedId: string;
  token: string;
  qrUrl: string;
  claimUrl: string;
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
      token: string;
      expires_at: Date | null;
      business_name: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
    }>
  >`
    SELECT
      dct.token,
      dct.expires_at,
      dl.business_name,
      dl.address,
      dl.city,
      dl.state,
      dl.postal_code
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
  const qrUrl = `${API_BASE_URL}/api/public/qr/claim/${token}`;
  const claimUrl = `${API_BASE_URL.replace(/\/api$/, '')}/place/claim/${token}`;

  const addressLines: string[] = [];
  if (row.business_name) addressLines.push(row.business_name);
  if (row.address) addressLines.push(row.address);
  const cityState = [row.city, row.state].filter(Boolean).join(', ');
  if (cityState) addressLines.push(cityState);
  if (row.postal_code) addressLines.push(row.postal_code);

  return {
    seedId,
    token,
    qrUrl,
    claimUrl,
    businessName: row.business_name || 'Business Owner',
    addressLines,
    expiresAt: row.expires_at,
  };
}

/**
 * Generate a PNG QR code for the claim invite.
 */
export async function generateClaimInvitePng(seedId: string): Promise<GeneratedQrPng> {
  const kit = await resolveClaimInviteKit(seedId);
  if (!kit) throw new Error('no_active_claim_token');

  const pngBuffer = await QRCode.toBuffer(kit.qrUrl, {
    width: DEFAULT_QR_SIZE,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  });

  const safeName = kit.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const filename = `claim-qr-${safeName}.png`;

  logger.info('ClaimInviteQrKitService.generateClaimInvitePng', undefined, { seedId, qrUrl: kit.qrUrl });
  return { pngBuffer, filename };
}

/**
 * Generate a 4x6" postcard PDF with the claim-invite QR code.
 */
export async function generateClaimInvitePostcard(seedId: string): Promise<GeneratedClaimPostcard> {
  const kit = await resolveClaimInviteKit(seedId);
  if (!kit) throw new Error('no_active_claim_token');

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
  const qrDataUrl = await QRCode.toDataURL(kit.qrUrl, {
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
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Claim Invite', pageWidth - margin, margin + 0.05, { align: 'right' });

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const safeName = kit.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const filename = `claim-postcard-${safeName}.pdf`;

  logger.info('ClaimInviteQrKitService.generateClaimInvitePostcard', undefined, { seedId, qrUrl: kit.qrUrl });
  return { pdfBuffer, filename };
}

/**
 * Resolve the kit metadata (for JSON responses / preview).
 */
export async function getClaimInviteKitMeta(seedId: string): Promise<ClaimInviteQrKit | null> {
  return resolveClaimInviteKit(seedId);
}
