/**
 * MarketIntelBanner — the house creative in the banner slots. Pins the §12.3
 * content contract per surface and that the slot is never empty (fallback copy
 * when the surface has no market-intel teaser).
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarketIntelBanner } from './MarketIntelBanner';

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
