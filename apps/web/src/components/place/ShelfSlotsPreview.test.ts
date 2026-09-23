import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ShelfSlotsPreview, { SAMPLE_SHELF_ITEMS } from './ShelfSlotsPreview';

describe('ShelfSlotsPreview', () => {
  const html = renderToStaticMarkup(createElement(ShelfSlotsPreview));

  it('renders the owner-facing shelf framing shared with /place/about', () => {
    expect(html).toContain('Your Store&#x27;s Active Shelf Preview');
    expect(html).toContain('5 of 5 Slots Active');
  });

  it('shows all 5 filled sample slots with prices and stock (not empty placeholders)', () => {
    for (const item of SAMPLE_SHELF_ITEMS) {
      // `&` is HTML-escaped in the rendered markup.
      expect(html).toContain(item.name.replace(/&/g, '&amp;'));
      expect(html).toContain(item.price);
    }
    expect(html).toContain('#1');
    expect(html).toContain('#5');
    expect(html).toContain('In Stock');
  });

  it('applies a caller-supplied className', () => {
    const withClass = renderToStaticMarkup(
      createElement(ShelfSlotsPreview, { className: 'w-full max-w-sm' }),
    );
    expect(withClass).toContain('w-full max-w-sm');
  });
});
