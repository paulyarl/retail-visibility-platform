/**
 * DirectoryBusinessSearch — merchant "find your listing" entry.
 *
 * Merchant flows search the directory (claimed tenants + unclaimed seeds), not
 * /place/search (unclaimed, non-tenant seeds only — claiming flips
 * `listing_origin` and removes the row from that result set).
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import DirectoryBusinessSearch from './DirectoryBusinessSearch';

describe('DirectoryBusinessSearch', () => {
  it('submits a GET search to the directory', () => {
    const html = renderToStaticMarkup(createElement(DirectoryBusinessSearch));

    expect(html).toContain('action="/directory"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).not.toContain('/place/search');
  });

  it('labels the submit action for merchants', () => {
    const html = renderToStaticMarkup(
      createElement(DirectoryBusinessSearch, { label: 'Find your store' }),
    );

    expect(html).toContain('Find your store');
  });

  it('renders the hero variant with the on-violet field styling', () => {
    const html = renderToStaticMarkup(
      createElement(DirectoryBusinessSearch, { variant: 'hero' }),
    );

    expect(html).toContain('bg-white/10');
    expect(html).toContain('text-violet-700');
  });
});
