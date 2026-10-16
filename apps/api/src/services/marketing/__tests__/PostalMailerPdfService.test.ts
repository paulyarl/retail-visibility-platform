import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../MarketingReceiptPdfService', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  loadPlatformBranding: vi.fn(async () => ({
    platformName: 'Visible Shelf',
    primaryColor: '#0f766e',
    contactEmail: 'hello@visibleshelf.example',
    contactWebsite: 'https://visibleshelf.example',
    logoUrl: 'https://cdn.example/logo.png',
  })),
}));

import QRCode from 'qrcode';
import { generatePostcardPdf } from '../PostalMailerPdfService';

const payload = {
  campaignId: 'mcamp-uvcasj3e',
  businessName: 'Arsema G Food Mart',
  addressLines: ['Arsema G Food Mart', '123 Main St', 'Madison, WI, 53703'],
  headline: 'Preview - your listings and your reviews',
  body: 'Pulled together a quick visibility snapshot. Thirty reviews are sitting without a response.',
  ctaLabel: 'Scan to see your free diagnostic',
  qrUrl: 'https://app.visibleshelf.example/preview/abc123',
  qrDestination: 'diagnostic_gallery' as const,
  archetype: 'review_gap',
  token: 'abc123',
  filename: 'postcard-mcamp-uvcasj3e-review_gap.pdf',
};

/**
 * A large source PNG is the regression trigger. jsPDF stores `addImage()` data
 * uncompressed unless the compression argument is supplied, and embeds it at
 * whatever resolution it is handed — so the 1200x1200 platform logo (drawn at
 * 0.3in) inflated the 4x6" postcard to ~12 MB and the mailer POST took 14s to
 * ship it.
 */
let logoPng: Buffer;

beforeEach(async () => {
  const dataUrl = await QRCode.toDataURL('https://cdn.example/logo.png', { width: 1200 });
  logoPng = Buffer.from(dataUrl.split(',')[1], 'base64');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(logoPng, { headers: { 'content-type': 'image/png' } })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generatePostcardPdf', () => {
  it('renders a 4x6" PDF with the campaign filename', async () => {
    const { pdfBuffer, filename } = await generatePostcardPdf(payload as any);
    expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(filename).toBe('postcard-mcamp-uvcasj3e-review_gap.pdf');
  });

  it('embeds the logo and the QR code', async () => {
    const { pdfBuffer } = await generatePostcardPdf(payload as any);
    expect(fetch).toHaveBeenCalledWith('https://cdn.example/logo.png');
    // Two image XObjects: the platform logo and the QR.
    const imageObjects = pdfBuffer.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? [];
    expect(imageObjects.length).toBe(2);
  });

  it('keeps the postcard small enough to print and mail', async () => {
    const { pdfBuffer } = await generatePostcardPdf(payload as any);
    // Uncompressed embedding puts this render at ~4.8 MB for the 1200px logo
    // alone (and ~12 MB with the production logo); without the logo downscale
    // it still lands near 1 MB.
    expect(pdfBuffer.length).toBeLessThan(512 * 1024);
  });
});
