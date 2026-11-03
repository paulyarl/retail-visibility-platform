/**
 * /place/about — the pre-claim surface must carry the connect ladder
 * (CONNECT_LADDER_COPY_SPEC §2/§4.3): claim your page → connect your catalog
 * → see it live. The triad is three destinations reached through one step,
 * never three unrelated purchases.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlaceAboutClient from './PlaceAboutClient';
import { CONNECT_CONNECTIVE_LINE } from '@/lib/presence-modes';

const html = renderToStaticMarkup(createElement(PlaceAboutClient));

describe('/place/about connect ladder', () => {
  it('names the ladder as a sequence', () => {
    expect(html).toContain('Claim your page. Connect your inventory. See it live.');
  });

  it('connects the triad to the one step it starts from', () => {
    expect(html).toContain(CONNECT_CONNECTIVE_LINE);
  });

  it('names every connect path without replacing the verb', () => {
    expect(html).toContain('approve the Clover or Square connection, send your NRS pricebook, or add your items by hand');
    expect(html).toContain('Connect Your Inventory');
  });

  it('unlocks the free 5 slots with one path, not all four', () => {
    expect(html).toContain('connect on whichever you have — Clover, Square, NRS pricebook or manual entry');
    expect(html).toContain('your first 5 slots are free');
  });

  it('treats the item wizard and a self-curated CSV as manual paths, not POS-only features', () => {
    expect(html).toContain('the item wizard walks you through name, price, variants, photos and categories');
    expect(html).toContain('manual entry (item wizard, or your own CSV)');
  });

  it('frames the first five products as the outcome of connecting, not a standalone offer', () => {
    expect(html).toContain('Step 2 — Connect Preview');
    expect(html).toContain('This is what connecting looks like.');
  });

  it('keeps page-live and Google-live as two moments', () => {
    expect(html).toContain('Products on your page in minutes. On Google in days to weeks');
  });
});
