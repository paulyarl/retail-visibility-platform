/**
 * FlyerCardArtService — renders print-ready art for flyer QR card packs
 * (spec §4.3 card packs, Phase 3).
 *
 * One double-sided business card (3.5" × 2"):
 *   - FRONT (customer): QR → /flyer/{slug}?src=qr-customer — the stable
 *     always-current specials target. Scans land on live specials.
 *   - BACK (merchant): QR → /t/{tenantId}/settings/flyers — composer for
 *     managing specials + reordering cards.
 *
 * Output is a 2-page PDF (front art, back art) the print vendor replicates
 * for the pack run — mirrors the ClaimInviteQrKitService jsPDF pattern.
 * Platform holds no inventory; the vendor dropships (spec §10).
 */

import QRCode from 'qrcode';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { unifiedConfig } from '../config/unifiedConfig';

const WEB_BASE_URL = (
  unifiedConfig.frontendUrl ||
  unifiedConfig.webUrl ||
  'https://app.visibleshelf.com'
).replace(/\/+$/, '');

// Standard US business card with 1/8" bleed → 3.75" × 2.25" trim-to-bleed
const CARD_W = 3.75;
const CARD_H = 2.25;

export interface FlyerCardArtContext {
  tenantId: string;
  businessName: string;
  slug: string | null;
  customerQrUrl: string;
  merchantQrUrl: string;
}

export interface GeneratedFlyerCardArt {
  pdfBuffer: Buffer;
  filename: string;
  customerQrUrl: string;
  merchantQrUrl: string;
}

/** Resolve the render context — null when the tenant can't carry a stable URL. */
export async function resolveFlyerCardArtContext(tenantId: string): Promise<FlyerCardArtContext | null> {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  });
  if (!tenant) return null;

  // Slug URL is the always-current target; id fallback for slugless tenants
  const customerQrUrl = `${WEB_BASE_URL}/flyer/${tenant.slug ?? tenantId}?src=qr-customer`;
  const merchantQrUrl = `${WEB_BASE_URL}/t/${tenantId}/settings/flyers?src=qr-merchant`;

  return {
    tenantId,
    businessName: tenant.name,
    slug: tenant.slug,
    customerQrUrl,
    merchantQrUrl,
  };
}

/** Two-page PDF: page 1 = customer side, page 2 = merchant side. */
export async function generateFlyerCardPdf(tenantId: string): Promise<GeneratedFlyerCardArt | null> {
  const ctx = await resolveFlyerCardArtContext(tenantId);
  if (!ctx) return null;

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'in', format: [CARD_W, CARD_H] });

  const [customerQr, merchantQr] = await Promise.all([
    QRCode.toDataURL(ctx.customerQrUrl, { width: 600, margin: 1, errorCorrectionLevel: 'H' }),
    QRCode.toDataURL(ctx.merchantQrUrl, { width: 600, margin: 1, errorCorrectionLevel: 'H' }),
  ]);

  // ── Page 1: CUSTOMER side ──────────────────────────────────────────────
  const qrSize = 1.6;
  const qrX = (CARD_W - qrSize) / 2;
  const margin = 0.15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  const nameLines = doc.splitTextToSize(ctx.businessName, CARD_W - 2 * margin);
  doc.text(nameLines, CARD_W / 2, margin + 0.12, { align: 'center' });

  doc.addImage(customerQr, 'PNG', qrX, margin + 0.28, qrSize, qrSize, undefined, 'SLOW');

  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.setFont('helvetica', 'normal');
  doc.text('Scan for this week\'s specials', CARD_W / 2, CARD_H - margin - 0.06, { align: 'center' });

  // ── Page 2: MERCHANT side ──────────────────────────────────────────────
  doc.addPage([CARD_W, CARD_H]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Manage your specials', CARD_W / 2, margin + 0.1, { align: 'center' });

  const backQrSize = 1.15;
  doc.addImage(merchantQr, 'PNG', (CARD_W - backQrSize) / 2, margin + 0.22, backQrSize, backQrSize, undefined, 'SLOW');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(90, 90, 90);
  doc.text('Scan to update specials or reorder cards', CARD_W / 2, CARD_H - margin - 0.18, { align: 'center' });
  doc.text(ctx.customerQrUrl, CARD_W / 2, CARD_H - margin - 0.06, { align: 'center' });

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const safeName = ctx.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);

  logger.info('FlyerCardArtService.generateFlyerCardPdf', undefined, {
    tenantId,
    customerQrUrl: ctx.customerQrUrl,
  });

  return {
    pdfBuffer,
    filename: `flyer-card-${safeName}.pdf`,
    customerQrUrl: ctx.customerQrUrl,
    merchantQrUrl: ctx.merchantQrUrl,
  };
}
