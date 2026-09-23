/**
 * BannerSlot — the reserved banner inventory. The contract that matters is that
 * the slot occupies its exact IAB box whether or not a creative is present, so
 * filling/emptying it never shifts the page.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BannerSlot, BANNER_SIZES } from './BannerSlot';

describe('BannerSlot', () => {
  it('reserves the 300x600 box for the tall variant', () => {
    const html = renderToStaticMarkup(createElement(BannerSlot, { variant: 'tall' }));
    expect(html).toContain('data-banner-slot="tall"');
    expect(html).toContain('width:300px');
    expect(html).toContain('height:600px');
    expect(html).toContain('Tall banner — 300×600');
  });

  it('reserves the 300x250 box for the square variant', () => {
    const html = renderToStaticMarkup(createElement(BannerSlot, { variant: 'square' }));
    expect(html).toContain('data-banner-slot="square"');
    expect(html).toContain('height:250px');
    expect(html).toContain('Square banner — 300×250');
  });

  it('keeps the same reserved height when a creative fills it', () => {
    const empty = renderToStaticMarkup(createElement(BannerSlot, { variant: 'square' }));
    const filled = renderToStaticMarkup(
      createElement(BannerSlot, { variant: 'square' }, createElement('p', null, 'Creative')),
    );

    expect(filled).toContain('height:250px');
    expect(filled).toContain('Creative');
    // The placeholder is gone, the footprint is not.
    expect(filled).not.toContain('Square banner — 300×250');
    expect(empty).not.toContain('Creative');
  });

  it('labels the slot, defaulting to Sponsored', () => {
    const sponsored = renderToStaticMarkup(createElement(BannerSlot, { variant: 'tall' }));
    expect(sponsored).toContain('Sponsored');

    const ad = renderToStaticMarkup(
      createElement(BannerSlot, { variant: 'tall', label: 'Advertisement' }),
    );
    expect(ad).toContain('Advertisement');
    expect(ad).not.toContain('Sponsored');
  });

  it('exposes the canonical sizes', () => {
    expect(BANNER_SIZES.tall).toMatchObject({ width: 300, height: 600 });
    expect(BANNER_SIZES.square).toMatchObject({ width: 300, height: 250 });
  });
});
