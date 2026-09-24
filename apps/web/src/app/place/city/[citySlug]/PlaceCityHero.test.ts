/**
 * PlaceCityHero — server-rendered seed city shelf hero. Pins the copy
 * contract the reorg introduced: the packet narrative (bodyCopy) leads the
 * Overview panel and the shorter meta description is only a fallback, so the
 * hero never reads as the dry meta blurb when enrichment exists.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlaceCityHero from './PlaceCityHero';

const enrichment = {
  market: { city: 'Kansas City', state: 'MO', locationName: 'Kansas City, MO' },
  effective: {
    metaTitle: 'Places in Kansas City, MO',
    description: 'Dry meta description.',
    keywords: [],
    schemaTypeHint: null,
    secondaryCategories: [],
  },
  overridden: { description: false, metaTitle: false, keywords: false },
  enrichedAt: '2026-01-01T00:00:00Z',
  bodyCopy: "Kansas City's business landscape spans a large metro area.",
  topCategories: ['restaurants', 'grocery stores'],
  shopperGuide: null,
  faq: null,
  areaBreakdown: null,
  context: null,
} as any;

const baseProps = {
  citySlug: 'kansas-city-mo',
  city: 'Kansas City',
  state: 'MO',
  total: 1,
  enrichment,
};

describe('PlaceCityHero', () => {
  it('leads the Overview with the packet narrative, not the meta description', () => {
    const html = renderToStaticMarkup(createElement(PlaceCityHero, baseProps));
    expect(html).toContain('business landscape spans a large metro area.');
    // The description may only appear inside the CollectionPage JSON-LD — never
    // as the rendered Overview copy.
    expect(html).not.toContain('>Dry meta description.<');
  });

  it('falls back to effective.description when no narrative was composed', () => {
    const html = renderToStaticMarkup(
      createElement(PlaceCityHero, {
        ...baseProps,
        enrichment: { ...enrichment, bodyCopy: null },
      }),
    );
    expect(html).toContain('Dry meta description.');
  });

  it('renders breadcrumb, title, count, top categories, and CollectionPage JSON-LD', () => {
    const html = renderToStaticMarkup(createElement(PlaceCityHero, baseProps));
    expect(html).toContain('Places in Kansas City, MO');
    expect(html).toContain('1 business listed from public information');
    expect(html).toContain('Top categories in Kansas City');
    expect(html).toContain('grocery stores');
    expect(html).toContain('CollectionPage');
    expect(html).toContain('/place/city/kansas-city-mo');
  });

  it('pluralizes the count and omits it when no total is known', () => {
    const plural = renderToStaticMarkup(
      createElement(PlaceCityHero, { ...baseProps, total: 7 }),
    );
    expect(plural).toContain('7 businesses listed from public information');

    const unknown = renderToStaticMarkup(
      createElement(PlaceCityHero, { ...baseProps, total: 0 }),
    );
    expect(unknown).not.toContain('listed from public information');
  });

  it('never renders a stale baked business count from legacy packet copy', () => {
    const html = renderToStaticMarkup(
      createElement(PlaceCityHero, {
        ...baseProps,
        enrichment: {
          ...enrichment,
          bodyCopy: null,
          effective: {
            ...enrichment.effective,
            description:
              'Discover 0 local businesses in Kansas City, MO, listed on VisibleShelf from public information.',
          },
        },
      }),
    );
    expect(html).toContain('Discover local businesses in Kansas City, MO');
    expect(html).not.toContain('0 local businesses');
  });

  it('renders without a packet (graceful-absent)', () => {
    const html = renderToStaticMarkup(
      createElement(PlaceCityHero, { ...baseProps, enrichment: null }),
    );
    expect(html).toContain('Places in Kansas City, MO');
    expect(html).not.toContain('Overview');
    expect(html).not.toContain('CollectionPage');
  });
});
