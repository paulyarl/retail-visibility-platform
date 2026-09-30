/**
 * MarketIntelBanner — the house creative in the banner slots. Pins the §12.3
 * content contract per surface and that the slot is never empty (fallback copy
 * when the surface has no market-intel teaser).
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarketIntelBanner, bannerQrOptions } from './MarketIntelBanner';
import { seedReportPromotable } from '@/services/SeedReportPreviewService';

const cityTeaser = {
  surfaceType: 'city',
  city: 'Kansas City',
  state: 'MO',
  hasIntelligence: true,
  cards: {
    marketGaps: { available: true, teaser: 'Unmet demand in Kansas City', count: 2 },
    metroDynamics: { available: true, teaser: 'Nearby suburbs and how they relate' },
    marketSummary: { available: true, teaser: 'Analyst brief on the market' },
    addYourBusiness: { available: true, teaser: 'Get listed' },
    fullReport: { available: true, teaser: 'Deep market analysis with recommendations' },
  },
} as any;

const categoryTeaser = {
  surfaceType: 'category',
  categorySlug: 'african-grocery-store',
  city: 'Kansas City',
  state: 'MO',
  hasIntelligence: true,
  cards: {
    categorySignals: { available: true, teaser: 'What strong looks like here', count: 4 },
    categoryProfile: { available: true, teaser: 'Business model and customer base' },
    marketDensity: { available: true, teaser: 'Sparse — few dedicated stores' },
    addYourBusiness: { available: true, teaser: 'Get listed' },
    fullReport: { available: false, teaser: 'Category brief in progress' },
  },
} as any;

const seedTeaser = {
  businessSlug: 'baraka-market',
  businessName: 'Baraka Market',
  hasAudit: true,
  publicNarrative: 'How we found this business.',
  cards: {
    growthOpportunities: { available: true, teaser: '3 actionable gaps identified' },
    howItStacksUp: { available: true, teaser: 'Meets 4 of 6 category signals' },
    fullReport: { available: true, teaser: 'The complete audit with recommendations' },
    claimBusiness: { available: true, teaser: 'Own this business? Claim it.' },
  },
} as any;

describe('MarketIntelBanner', () => {
  it('leads with the city report card and names the other cards', () => {
    const html = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'tall',
        surfaceType: 'city',
        teaser: cityTeaser,
      }),
    );

    expect(html).toContain('Full City Report');
    expect(html).toContain('Deep market analysis with recommendations');
    expect(html).toContain('Also inside');
    expect(html).toContain('Market Gaps');
    expect(html).toContain('Metro Dynamics');
    expect(html).toContain('Market Summary');
  });

  it('uses the category card set on the category surface', () => {
    const html = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'tall',
        surfaceType: 'category',
        teaser: categoryTeaser,
      }),
    );

    expect(html).toContain('Full Category Report');
    expect(html).toContain('Category Signals');
    expect(html).toContain('Market Density');
    expect(html).not.toContain('Full City Report');
  });

  it('omits the "also inside" list in the square variant', () => {
    const html = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'square',
        surfaceType: 'city',
        teaser: cityTeaser,
      }),
    );

    expect(html).toContain('Full City Report');
    expect(html).not.toContain('Also inside');
    expect(html).toContain('height:250px');
  });

  it('promotes the free report on the seed surface, not the paid unlock', () => {
    const html = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'tall',
        surfaceType: 'seed',
        teaser: seedTeaser,
        seedId: 'seed-1',
        seedReportReady: true,
      }),
    );

    expect(html).toContain('Your free business report');
    expect(html).toContain('documented the work in a free report');
    // The paid report card's teaser must not be reused as the free offer.
    expect(html).not.toContain('The complete audit with recommendations');
    expect(html).not.toContain('Full Audit Report');
  });

  it('links the seed CTA through its own tracked banner channel', () => {
    const html = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'square',
        surfaceType: 'seed',
        teaser: seedTeaser,
        seedId: 'seed-1',
        seedReportReady: true,
      }),
    );

    // Tracked redirect, never the destination — and its own surface, so banner
    // scans never land in the report_delivery_* funnel.
    expect(html).toContain('/api/public/r/seed/seed-1/banner');
    expect(html).toContain('See the report');
    expect(html).not.toContain('/seed-report/seed-1"');
  });

  it('prefers the /rb/{shortCode} short path when a claim code is active', () => {
    const html = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'square',
        surfaceType: 'seed',
        teaser: seedTeaser,
        seedId: 'seed-1',
        seedReportReady: true,
        reportShortCode: 'KUAKTH',
      }),
    );

    // Same resolve+track+redirect pattern as /r/, /rt/ & co. — surface
    // 'banner' records report_banner, outside the delivery funnel.
    expect(html).toContain('href="/rb/KUAKTH"');
    expect(html).not.toContain('/api/public/r/seed/');
  });

  it('renders no QR in the square variant (tall only)', () => {
    const square = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'square',
        surfaceType: 'seed',
        teaser: seedTeaser,
        seedId: 'seed-1',
        seedReportReady: true,
      }),
    );
    expect(square).not.toContain('Scan to open the report');
  });

  it('renders nothing while the report lane is unresolved', () => {
    const html = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'tall',
        surfaceType: 'seed',
        teaser: seedTeaser,
        seedId: 'seed-1',
      }),
    );

    // The lane check hasn't resolved yet (SSR never runs the effect) — the
    // boundary renders nothing rather than a CTA that could point at a
    // report the lane hasn't earned.
    expect(html).toBe('');
    expect(html).not.toContain('See the report');
    expect(html).not.toContain('/api/public/r/seed/');
  });

  it('renders nothing on the partial lane — report promotion is full-BA only', () => {
    const html = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'tall',
        surfaceType: 'seed',
        teaser: seedTeaser,
        seedId: 'seed-1',
        seedReportReady: false,
      }),
    );

    // The whole promo is suppressed, not just the CTA.
    expect(html).toBe('');
  });

  it('suppresses the seed promo when no seed id resolves', () => {
    const html = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'tall',
        surfaceType: 'seed',
        teaser: seedTeaser,
        seedReportReady: true,
      }),
    );

    // No seed id → no lane to resolve → nothing renders, no dead link.
    expect(html).toBe('');
    expect(html).not.toContain('/api/public/r/seed/');
    expect(html).not.toContain('<a');
  });

  it('renders the aggregate directory promo with no teaser and no QR', () => {
    const html = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'tall',
        surfaceType: 'directory',
        teaser: null,
      }),
    );

    // Aggregate surfaces have no per-surface report — generic offer copy,
    // a "Coming soon" CTA (no fabricated target), and never a QR (not a seed).
    expect(html).toContain('Free market report');
    expect(html).toContain('public data says about local businesses');
    expect(html).toContain('Get the report');
    expect(html).toContain('Coming soon');
    expect(html).not.toContain('Unlock');
    expect(html).not.toContain('Scan to open the report');
    expect(html).toContain('height:600px');
  });

  it('falls back to the default offer copy with no teaser, keeping the box', () => {
    const html = renderToStaticMarkup(
      createElement(MarketIntelBanner, { variant: 'tall', surfaceType: 'city', teaser: null }),
    );

    expect(html).toContain('Complete market analysis with recommendations');
    expect(html).toContain('height:600px');
    expect(html).toContain('Sponsored');
  });

  it('marks the CTA as coming soon until the report unlock is wired', () => {
    const unavailable = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'square',
        surfaceType: 'category',
        teaser: categoryTeaser,
      }),
    );
    expect(unavailable).toContain('Coming soon');

    const available = renderToStaticMarkup(
      createElement(MarketIntelBanner, {
        variant: 'square',
        surfaceType: 'city',
        teaser: cityTeaser,
      }),
    );
    expect(available).not.toContain('Coming soon');
  });
});

describe('seedReportPromotable', () => {
  it('requires a published preview on the full audit lane', () => {
    expect(seedReportPromotable(null)).toBe(false);
    expect(seedReportPromotable({ audit_lane: 'partial' } as any)).toBe(false);
    // Responses cached before audit_lane shipped carry no flag — they
    // resolve to partial (the safe side of the boundary).
    expect(seedReportPromotable({} as any)).toBe(false);
    expect(seedReportPromotable({ audit_lane: 'full' } as any)).toBe(true);
  });
});

describe('bannerQrOptions', () => {
  const url = 'https://visibleshelf.com/rb/KUAKTH';

  it('falls back to the default template when no design is persisted', () => {
    const opts = bannerQrOptions(url, null, null);
    expect(opts.template).toBe('default');
    expect(opts.data).toBe(url);
    expect(opts.logoUrl).toBeNull();
  });

  it('maps persisted storefront-QR style fields to engine options', () => {
    const opts = bannerQrOptions(url, {
      dotType: 'classy',
      cornerType: 'square',
      cornerDotType: 'square',
      customColorsEnabled: true,
      dotColor: '#111111',
      cornerColor: '#222222',
      cornerDotColor: '#333333',
      bgColor: '#fafafa',
      gradientEnabled: true,
      gradientStart: '#aa0000',
      gradientEnd: '#0000aa',
      gradientOnDots: true,
      gradientOnCorners: false,
      gradientOnCornerDots: false,
      logo: true,
      logoShape: 'circle',
    }, 'https://cdn.example.com/logo.png');

    // A persisted design is concrete — no template merge.
    expect(opts.template).toBeUndefined();
    expect(opts.dotType).toBe('classy');
    expect(opts.cornerType).toBe('square');
    expect(opts.cornerDotType).toBe('square');
    expect(opts.dotColor).toBe('#111111');
    expect(opts.cornerColor).toBe('#222222');
    expect(opts.cornerDotColor).toBe('#333333');
    expect(opts.bgColor).toBe('#fafafa');
    expect(opts.gradientEnabled).toBe(true);
    expect(opts.gradientStart).toBe('#aa0000');
    expect(opts.gradientEnd).toBe('#0000aa');
    expect(opts.gradientOnCorners).toBe(false);
    expect(opts.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(opts.logoShape).toBe('circle');
  });

  it('ignores persisted colors when custom colors are disabled', () => {
    const opts = bannerQrOptions(url, {
      dotType: 'dots',
      customColorsEnabled: false,
      dotColor: '#ff0000',
      bgColor: '#000000',
    }, null);

    // Same rule as the storefront preview pane — the toggle gates the colors.
    expect(opts.dotType).toBe('dots');
    expect(opts.dotColor).toBeUndefined();
    expect(opts.bgColor).toBeUndefined();
  });

  it('embeds no logo when the persisted design disables it', () => {
    const opts = bannerQrOptions(url, { logo: false }, 'https://cdn.example.com/logo.png');
    expect(opts.logoUrl).toBeNull();
  });
});
