/**
 * PlaceNationalPanel — /place home national narrative band. Renders the
 * national location packet's intro, measured coverage stats, and top-market
 * links into the seed city shelves. Renders nothing when the packet carries
 * neither copy nor coverage (graceful-absent contract).
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlaceNationalPanel from './PlaceNationalPanel';

const nationalEnrichment = {
  market: { city: '__all__', state: '__all__', locationName: 'United States' },
  effective: {
    metaTitle: 'Places Nationwide',
    description: 'Fallback description.',
    keywords: [],
    schemaTypeHint: null,
    secondaryCategories: [],
  },
  overridden: { description: false, metaTitle: false, keywords: false },
  enrichedAt: '2026-01-01T00:00:00Z',
  bodyCopy: 'VisibleShelf tracks local businesses across the country.',
  topCategories: [],
  shopperGuide: null,
  faq: null,
  areaBreakdown: null,
  context: {
    national_coverage: {
      totalStates: 3,
      totalCities: 12,
      totalListings: 340,
      states: [],
      topCities: [
        { city: 'Indianapolis', state: 'IN', listingCount: 42 },
        { city: 'Columbus', state: 'OH', listingCount: 30 },
      ],
    },
  },
} as any;

describe('PlaceNationalPanel', () => {
  it('renders the intro, coverage stats, and top-market shelf links', () => {
    const html = renderToStaticMarkup(
      createElement(PlaceNationalPanel, { enrichment: nationalEnrichment }),
    );

    expect(html).toContain('VisibleShelf tracks local businesses');
    expect(html).toContain('340 places listed');
    expect(html).toContain('12 markets');
    expect(html).toContain('3 states covered');
    // Top markets link into the seed city shelves (canonical {city}-{state}).
    expect(html).toContain('/place/city/indianapolis-in');
    expect(html).toContain('/place/city/columbus-oh');
  });

  it('overrides packet stats and chip counts with live coverage, re-sorts and drops empty markets', () => {
    const enrichment = {
      ...nationalEnrichment,
      context: {
        national_coverage: {
          totalStates: 3,
          totalCities: 12,
          totalListings: 340,
          topCities: [
            { city: 'Indianapolis', state: 'IN', listingCount: 1 },
            { city: 'Columbus', state: 'OH', listingCount: 30 },
            { city: 'Ghostburg', state: 'IN', listingCount: 9 },
          ],
        },
      },
    } as any;
    const liveCoverage = {
      totalPlaces: 144,
      totalCities: 11,
      totalStates: 2,
      cityCounts: {
        'indianapolis|in': 46,
        'columbus|oh': 1,
        // ghostburg absent → live count 0 → chip dropped
      },
    };
    const html = renderToStaticMarkup(
      createElement(PlaceNationalPanel, { enrichment, liveCoverage }),
    );

    expect(html).toContain('144 places listed');
    expect(html).toContain('11 markets');
    expect(html).toContain('2 states covered');
    // Indianapolis sorts first on the live count, not the stale packet order.
    expect(html.indexOf('/place/city/indianapolis-in')).toBeLessThan(
      html.indexOf('/place/city/columbus-oh'),
    );
    expect(html).toContain('46');
    expect(html).not.toContain('Ghostburg');
  });

  it('falls back to effective.description when bodyCopy is absent', () => {
    const html = renderToStaticMarkup(
      createElement(PlaceNationalPanel, {
        enrichment: { ...nationalEnrichment, bodyCopy: null },
      }),
    );
    expect(html).toContain('Fallback description.');
  });

  it('renders nothing when the packet carries no copy and no coverage', () => {
    const html = renderToStaticMarkup(
      createElement(PlaceNationalPanel, {
        enrichment: {
          ...nationalEnrichment,
          bodyCopy: null,
          effective: { ...nationalEnrichment.effective, description: '' },
          context: null,
        },
      }),
    );
    expect(html).toBe('');
  });
});
