import { describe, it, expect, vi } from 'vitest';

vi.mock('../../marketing/MarketingReceiptPdfService', () => ({
  loadPlatformBranding: vi.fn(async () => ({
    platformName: 'VisibleShelf',
    primaryColor: '#0284c7',
    logoUrl: null,
  })),
}));

vi.mock('../../../prisma', () => ({ prisma: {} }));

vi.mock('../../../config/unifiedConfig', () => ({
  unifiedConfig: { frontendUrl: 'https://visibleshelf.example' },
}));

import { generateProspectReportPdf } from '../ProspectReportPdfService';

const report = {
  report_kind: 'business_visibility',
  business_prospect_id: 'bpr-raja',
  business_name: 'Raja Bazaar',
  prepared_at: '2026-09-30T00:00:00Z',
  website_url: 'https://rajabazaar.example',
  tier: 'free',
  short_version: {
    lead: 'Your site works, but a stale ordering banner is costing you orders.',
    bullets: ['Reachable storefront'],
  },
  chapters: [
    {
      chapter_id: 'website',
      title: 'Your website',
      audited_at: '2026-09-29T00:00:00Z',
      category: 'Middle Eastern Grocery Store',
      summary: 's',
      verdict: 'Your website is live on your own domain.',
      already_working: ['Clear product categories'],
      costing_customers: [
        { headline: 'Stale ordering schedule', cost: 'Lost orders', evidence: 'Homepage banner', tier: 'now' },
        { headline: 'Certification not prominent', cost: null, evidence: null, tier: 'worth_fixing' },
      ],
      expectations: [
        { field: 'hours', expected_text: 'today', actual_text: 'a stale widget', note: null },
      ],
      competitive_frame: ['Live ordering windows'],
      fix: { headline: 'A focused refresh', scope_notes: 'Keep the domain.', page_plan: ['Home', 'Ordering'] },
    },
  ],
  locked_chapters: [
    { chapter_id: 'repair', title: 'Your public profiles', finding_count: 4, teaser: 'Your public profiles — 4 findings inside' },
  ],
  data_quality: {
    verified: ['Site reachable'],
    couldnt_check: ['WhatsApp response time'],
    limitations: ['Public storefront only'],
  },
  cta: { kind: 'claim', label: 'Claim your listing', url: 'https://visibleshelf.example/q/ABC123' },
} as any;

describe('generateProspectReportPdf', () => {
  it('produces a PDF buffer with a stable filename', async () => {
    const { pdfBuffer, filename } = await generateProspectReportPdf({ report });
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(filename).toBe('visibility-report-raja-bazaar.pdf');
  });

  it('renders without a QR code (qr omitted)', async () => {
    const { pdfBuffer } = await generateProspectReportPdf({ report });
    expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('embeds the QR when a share code is supplied', async () => {
    const { pdfBuffer } = await generateProspectReportPdf({ report, qrCode: 'K7M2XN' });
    expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');
    // QR-embedded PDF is materially larger than the no-QR render
    const { pdfBuffer: noQr } = await generateProspectReportPdf({ report });
    expect(pdfBuffer.length).toBeGreaterThan(noQr.length);
  });
});
