import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { PlaceListing } from '@/services/PlacesBrowsePublicService';

import PlacesIndexDirectory, { MAX_INDEXED_PLACE_LINKS } from './PlacesIndexDirectory';

function place(index: number): PlaceListing {
  return {
    id: `id-${index}`,
    businessName: `Business ${index}`,
    slug: `business-${index}`,
  } as unknown as PlaceListing;
}

describe('PlacesIndexDirectory (spec §4.4.2)', () => {
  it('renders city and listing anchors in the first HTML response', () => {
    const html = renderToStaticMarkup(
      createElement(PlacesIndexDirectory, {
        cities: [{ label: 'Indianapolis, IN', href: '/place/city/indianapolis-in' }],
        places: [place(1), place(2)],
      }),
    );

    expect(html).toContain('href="/place/city/indianapolis-in"');
    expect(html).toContain('href="/place/business-1"');
    expect(html).toContain('href="/place/business-2"');
    expect(html).toContain('Indianapolis, IN');
  });

  it('caps the number of server-rendered detail links', () => {
    const places = Array.from({ length: MAX_INDEXED_PLACE_LINKS + 5 }, (_, i) => place(i));
    const html = renderToStaticMarkup(
      createElement(PlacesIndexDirectory, { cities: [], places }),
    );

    const rendered = (html.match(/href="\/place\/business-/g) ?? []).length;
    expect(rendered).toBe(MAX_INDEXED_PLACE_LINKS);
  });

  it('keeps the A–Z list in the DOM while collapsed', () => {
    const html = renderToStaticMarkup(
      createElement(PlacesIndexDirectory, { cities: [], places: [place(1)] }),
    );

    expect(html).toContain('<details');
    expect(html).not.toContain('<details open');
    expect(html).toContain('href="/place/business-1"');
  });

  it('renders nothing when there is no inventory', () => {
    const html = renderToStaticMarkup(
      createElement(PlacesIndexDirectory, { cities: [], places: [] }),
    );
    expect(html).toBe('');
  });
});
