/**
 * PostalMailerPdfService — renders a 4x6" postcard PDF from a PostalMailerPayload.
 */

import QRCode from 'qrcode';
import { loadPlatformBranding } from './MarketingReceiptPdfService';
import type { PostalMailerPayload } from './PostalMailerService';

export interface GeneratedPostcard {
  pdfBuffer: Buffer;
  filename: string;
}

/**
 * Generate a 4x6 inch postcard PDF for the given payload.
 */
export async function generatePostcardPdf(payload: PostalMailerPayload): Promise<GeneratedPostcard> {
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
  const headlineLines = doc.splitTextToSize(payload.headline, pageWidth - 2 * margin);
  let yPos = margin + logoHeight + 0.35;
  doc.text(headlineLines, pageWidth / 2, yPos, { align: 'center' });
  yPos += (headlineLines.length * 0.22) + 0.12;

  // ── Body ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  const bodyLines = doc.splitTextToSize(payload.body, pageWidth - 2 * margin);
  doc.text(bodyLines, pageWidth / 2, yPos, { align: 'center' });
  yPos += bodyLines.length * 0.16 + 0.3;

  // ── QR code ───────────────────────────────────────────────────────────
  const qrSize = 1.4;
  const qrX = (pageWidth - qrSize) / 2;
  const qrDataUrl = await QRCode.toDataURL(payload.qrUrl, {
    width: 400,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  doc.addImage(qrDataUrl, 'PNG', qrX, yPos, qrSize, qrSize);
  yPos += qrSize + 0.08;

  // ── CTA label ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(branding.primaryColor);
  doc.text(payload.ctaLabel, pageWidth / 2, yPos, { align: 'center' });
  yPos += 0.22;

  // ── Mailing address block (bottom right) ──────────────────────────────
  const addressX = pageWidth - margin;
  const addressY = pageHeight - 0.15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  for (let i = 0; i < payload.addressLines.length; i++) {
    const line = payload.addressLines[payload.addressLines.length - 1 - i];
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

  // ── Archetype badge (top right, subtle) ───────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(payload.archetype, pageWidth - margin, margin + 0.05, { align: 'right' });

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return { pdfBuffer, filename: payload.filename };
}
