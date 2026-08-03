/**
 * MarketingReceiptPdfService — shared receipt PDF generator for Marketing Ops.
 *
 * Extracted from the inline jsPDF generator in marketing-ops-public.ts
 * (lines 327-499) so both the public ptoken-gated receipt route and the
 * authenticated portal receipt route (Phase 2) can use the same renderer.
 *
 * Per MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md §6.5.
 *
 * Phase 1: exact extraction of the existing jsPDF layout (no QR block yet —
 * QR embedding with customer branding is Phase 2 §6.5 steps 2-5).
 */

import { prisma } from '../../prisma';
import MarketingServiceCategoryService from '../MarketingServiceCategoryService';
import type { RequestCtx } from '../../context';

export interface ReceiptBranding {
  platformName: string;
  logoUrl?: string | null;
  primaryColor: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactWebsite: string;
}

export interface ReceiptPdfInput {
  campaignId: string;
  revenueId?: string;
  ctx?: RequestCtx;
}

export interface GeneratedReceipt {
  pdfBuffer: Buffer;
  filename: string;
  revenueId: string;
}

/**
 * Load platform branding from platform_settings_list.
 * Falls back to defaults if no row exists.
 */
export async function loadPlatformBranding(): Promise<ReceiptBranding> {
  const platformSettings = await prisma.platform_settings_list.findFirst();
  return {
    platformName: platformSettings?.platform_name || 'Visible Shelf',
    logoUrl: platformSettings?.logo_url,
    primaryColor: (platformSettings?.theme_colors as any)?.primary || '#0066ff',
    contactEmail: platformSettings?.contact_email || 'billing@visibleshelf.store',
    contactPhone: platformSettings?.contact_phone || '(913) 703-6157',
    contactAddress: platformSettings?.contact_address || '',
    contactWebsite: platformSettings?.contact_website || 'https://visibleshelf.store',
  };
}

/**
 * Generate a receipt PDF for a campaign's most recent revenue record.
 *
 * Usage:
 *   const { pdfBuffer, filename } = await MarketingReceiptPdfService.generate({ campaignId, revenueId, ctx });
 *   res.setHeader('Content-Type', 'application/pdf');
 *   res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
 *   res.send(pdfBuffer);
 */
export async function generateReceiptPdf(input: ReceiptPdfInput): Promise<GeneratedReceipt> {
  const campaign = await prisma.mkt_campaigns_list.findUnique({ where: { id: input.campaignId } });
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const revenueRecords = await prisma.marketing_revenue.findMany({
    where: { campaign_id: input.campaignId, ...(input.revenueId ? { id: input.revenueId } : {}) },
    orderBy: { recorded_at: 'desc' },
    take: 1,
  });

  if (revenueRecords.length === 0) {
    throw new Error('No payment records found');
  }

  const revenue = revenueRecords[0];
  const branding = await loadPlatformBranding();

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // ── Header: logo + platform name ──────────────────────────────────────
  let logoWidth = 0;
  const logoHeight = 15;
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
        doc.addImage(logoDataUri, 'PNG', margin, yPos - 5, logoWidth, logoHeight);
        yPos += 12;
      }
    } catch {
      // Continue without logo
    }
  }

  doc.setFontSize(24);
  doc.setTextColor(branding.primaryColor);
  const textX = logoWidth > 0 ? margin + logoWidth + 5 : margin;
  doc.text(branding.platformName, textX, yPos);

  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('PAYMENT RECEIPT', pageWidth - margin - 50, 20, { align: 'left' });

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`#${revenue.id}`, pageWidth - margin - 50, 28, { align: 'left' });

  // ── From / Bill To ────────────────────────────────────────────────────
  yPos = 50;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('From:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  yPos += 5;
  doc.text(branding.platformName, margin, yPos);
  yPos += 5;
  if (branding.contactEmail) doc.text(branding.contactEmail, margin, yPos);

  yPos = 50;
  const toX = pageWidth / 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', toX, yPos);
  doc.setFont('helvetica', 'normal');
  yPos += 5;
  doc.text(campaign.business_name ?? '', toX, yPos);

  // ── Divider ───────────────────────────────────────────────────────────
  yPos = Math.max(yPos, 75) + 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const serviceCategoryLabel = await MarketingServiceCategoryService.getLabel(
    revenue.service_category || '',
    input.ctx,
  );

  // ── Info rows ─────────────────────────────────────────────────────────
  const infoRows: [string, string][] = [
    ['Receipt ID:', revenue.id],
    ['Campaign ID:', campaign.id],
    ['Business:', campaign.business_name ?? ''],
    ['Service:', serviceCategoryLabel],
    ['Payment Date:', formatDate(revenue.recorded_at)],
    ['Payment Method:', revenue.gateway_type || 'N/A'],
    ['Transaction ID:', revenue.gateway_transaction_id || 'N/A'],
    ['Source:', revenue.source],
  ];

  for (const [label, value] of infoRows) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 40, yPos);
    yPos += 6;
  }

  // ── Line items ────────────────────────────────────────────────────────
  yPos += 10;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin + 2, yPos + 5);
  doc.text('Amount', pageWidth - margin - 20, yPos + 5, { align: 'right' });
  yPos += 12;

  doc.setFont('helvetica', 'normal');
  doc.text(`${serviceCategoryLabel} — ${campaign.business_name}`, margin + 2, yPos);
  doc.text(formatPrice(revenue.amount_cents), pageWidth - margin - 20, yPos, { align: 'right' });
  yPos += 8;

  if (revenue.discount_cents > 0) {
    yPos += 5;
    doc.text('Discount Applied:', margin + 2, yPos);
    doc.text(`-${formatPrice(revenue.discount_cents)}`, pageWidth - margin - 20, yPos, { align: 'right' });
    yPos += 8;
  }

  // ── Total ─────────────────────────────────────────────────────────────
  yPos += 5;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Total Paid:', margin + 2, yPos);
  doc.text(formatPrice(revenue.amount_cents), pageWidth - margin - 20, yPos, { align: 'right' });

  // ── Footer ────────────────────────────────────────────────────────────
  yPos = doc.internal.pageSize.getHeight() - 30;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for your business!', margin, yPos);
  yPos += 10;
  if (branding.contactPhone) {
    doc.text(`Phone: ${branding.contactPhone}  |  Email: ${branding.contactEmail}`, margin, yPos);
  } else {
    doc.text(`Email: ${branding.contactEmail}`, margin, yPos);
  }

  const filename = `marketing-receipt-${revenue.id}.pdf`;
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return { pdfBuffer, filename, revenueId: revenue.id };
}

/**
 * MarketingReceiptPdfService — namespace export.
 * The functions above are standalone; this object provides a named-service
 * handle for callers who prefer that style (matches the codebase's mixed
 * convention of both singleton instances and function-module exports).
 */
export const MarketingReceiptPdfService = {
  generate: generateReceiptPdf,
  loadBranding: loadPlatformBranding,
};

export default MarketingReceiptPdfService;
