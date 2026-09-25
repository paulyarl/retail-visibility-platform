/**
 * PlaceCityEnrichmentContent — the seed city shelf's lower enrichment band.
 * Pins two contracts the reorg touched: the FAQPage JSON-LD stays server-
 * rendered here (the CollectionPage block lives in PlaceCityHero), and the
 * packet narrative no longer renders as an "About {city}" section — it leads
 * the hero instead.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlaceCityEnrichmentContent from './PlaceCityEnrichmentContent';

const enrichment = {
  market: { city: 'Kansas City', state: 'MO', locationName: 'Kansas City, MO' },
  effective: {
    metaTitle: 'Places in Kansas City, MO',
    description: 'Meta description.',
    keywords: [],
    schemaTypeHint: null,
    secondaryCategories: [],
  },
  overridden: { description: false, metaTitle: false, keywords: false },
  enrichedAt: '2026-01-01T00:00:00Z',
  bodyCopy: 'Kansas City narrative that now leads the hero.',
  topCategories: [],
  shopperGuide: 'Start with a category that fits what you need.',
  faq: [{ question: 'How current are the business details?', answer: 'Listings change.' }],
  areaBreakdown: [
    { area_name: 'Downtown and River Market', description: 'Central business area.', strong_categories: ['restaurants'] },
  ],
  context: { metro_context: 'Kansas City sits at the center of a metro area.' },
} as any;

const render = (over: any = {}, props: any = {}) =>
  renderToStaticMarkup(
    createElement(PlaceCityEnrichmentContent, {
      enrichment: { ...enrichment, ...over },
      city: 'Kansas City',
      state: 'MO',
      ...props,
    }),
  );

describe('PlaceCityEnrichmentContent', () => {
  it('keeps the FAQPage JSON-LD server-rendered', () => {
    const html = render();
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('How current are the business details?');
  });

  it('emits no FAQPage JSON-LD when the packet carries no FAQ', () => {
    const html = render({ faq: [] });
    expect(html).not.toContain('FAQPage');
    // The other sections still render.
    expect(html).toContain('Shopping in Kansas City, MO');
  });

  it('no longer renders the About section — the narrative leads the hero', () => {
    const html = render();
    expect(html).not.toContain('About Kansas City, MO');
    expect(html).not.toContain('Kansas City narrative that now leads the hero.');
  });

  it('renders nothing when the packet has only the hero narrative', () => {
    const html = render({
      shopperGuide: null,
      faq: [],
      areaBreakdown: [],
      context: null,
    });
    expect(html).toBe('');
  });

  it('renders the remaining sections (shopper guide, areas, metro)', () => {
    const html = render();
    expect(html).toContain('Shopping in Kansas City, MO');
    expect(html).toContain('Browse by Area');
    expect(html).toContain('Downtown and River Market');
    expect(html).toContain('Metro Area');
  });

  it('hot-links area strong_categories that resolve to a live shelf in this market', () => {
    const html = render(
      {},
      {
        shelfIndex: [
          {
            category: 'restaurants',
            slug: 'restaurants',
            placeCount: 900,
            cities: [{ city: 'Kansas City', state: 'MO', placeCount: 31 }],
          },
        ],
      },
    );
    expect(html).toContain('href="/place/category/restaurants?city=Kansas%20City&amp;state=MO"');
    expect(html).toContain('>31</span>');
  });
});
