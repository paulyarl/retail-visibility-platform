import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ShelfSlotsPreview, { SAMPLE_SHELF_ITEMS, ShelfSlotsContent } from './ShelfSlotsPreview';

describe('ShelfSlotsPreview', () => {
  // The default export is mount-gated: `useEffect` never fires under
  // renderToStaticMarkup, so SSR output must be only the hidden placeholder —
  // keeping the illustrative sample items out of crawled markup.
  const html = renderToStaticMarkup(createElement(ShelfSlotsPreview));

  it('renders only an aria-hidden placeholder in SSR (sample items kept out of crawled markup)', () => {
    expect(html).toContain('aria-hidden="true"');
    for (const item of SAMPLE_SHELF_ITEMS) {
      expect(html).not.toContain(item.name.replace(/&/g, '&amp;'));
    }
    expect(html).not.toContain('Illustrative preview');
  });

  it('renders the owner-facing shelf framing shared with /place/about once mounted', () => {
    const body = renderToStaticMarkup(createElement(ShelfSlotsContent));
    expect(body).toContain('Example shelf — claim to make it yours');
    expect(body).toContain('Illustrative preview');
  });

  it('shows all 5 filled sample slots with prices and stock (not empty placeholders)', () => {
    const body = renderToStaticMarkup(createElement(ShelfSlotsContent));
    for (const item of SAMPLE_SHELF_ITEMS) {
      // `&` is HTML-escaped in the rendered markup.
      expect(body).toContain(item.name.replace(/&/g, '&amp;'));
      expect(body).toContain(item.price);
    }
    expect(body).toContain('#1');
    expect(body).toContain('#5');
    expect(body).toContain('In Stock');
  });

  it('applies a caller-supplied className', () => {
    const withClass = renderToStaticMarkup(
      createElement(ShelfSlotsPreview, { className: 'w-full max-w-sm' }),
    );
    expect(withClass).toContain('w-full max-w-sm');
  });
});
