/**
 * PlacesIndexHero — server-rendered header band for the /place home. It leads
 * the page (above the national coverage band and the category grid) and owns
 * the shelf counts the client grid used to render, so the title and counts stay
 * crawler-visible without hydration.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlacesIndexHero from './PlacesIndexHero';

describe('PlacesIndexHero', () => {
  it('renders the breadcrumb, title, browse copy, and search entry point', () => {
    const html = renderToStaticMarkup(createElement(PlacesIndexHero, {}));

    expect(html).toContain('Places Directory');
    expect(html).toContain('href="/directory"');
    expect(html).toContain('href="/place/search"');
    expect(html).toContain('Local businesses listed from public information.');
  });

  it('carries the shelf counts when the server read the categories', () => {
    const html = renderToStaticMarkup(
      createElement(PlacesIndexHero, { totalPlaces: 10, categoryCount: 7 }),
    );

    expect(html).toContain('10 places');
    expect(html).toContain('7 categories');
  });

  it('pluralizes a single place and category', () => {
    const html = renderToStaticMarkup(
      createElement(PlacesIndexHero, { totalPlaces: 1, categoryCount: 1 }),
    );

    expect(html).toContain('1 place<');
    expect(html).toContain('1 category<');
  });

  it('omits the counts when the shelf could not be read', () => {
    const html = renderToStaticMarkup(createElement(PlacesIndexHero, {}));

    expect(html).not.toContain('0 places');
    expect(html).not.toContain('0 categories');
  });
});
