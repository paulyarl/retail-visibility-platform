/**
 * DirectoryMerchantCtaBand — the owner band that closes the directory home.
 *
 * Regression: the merchant card sent visitors to /register → /auth/signup →
 * the signup wizard, which treats an already-seeded merchant as brand new. The
 * directory is built from public business information, so the band must lead
 * with "find your place page and claim it" and carry the add/suggest pair the
 * /place shelves close with.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import DirectoryMerchantCtaBand from './DirectoryMerchantCtaBand';

function render(source?: string) {
  return renderToStaticMarkup(
    createElement(DirectoryMerchantCtaBand, source === undefined ? {} : { source }),
  );
}

describe('DirectoryMerchantCtaBand', () => {
  it('is seed-aware — it tells merchants they may already be listed', () => {
    const html = render();

    expect(html).toContain('Are you a merchant?');
    expect(html).toContain('may already be listed');
    expect(html).toContain('Claim yours free');
  });

  it('leads with the claim path, never the signup wizard', () => {
    const html = render();

    expect(html).toContain('href="/place/search"');
    expect(html).toContain('Find your listing');
    expect(html).not.toContain('/register');
    expect(html).not.toContain('/auth/signup');
    expect(html).not.toContain('Get Started');
  });

  it('keeps the how-it-works card pointing at the directory explainer', () => {
    const html = render();

    expect(html).toContain('How does this work?');
    expect(html).toContain('href="/directory/about"');
  });

  it('carries the add and suggest paths with the band source', () => {
    const html = render('/directory');

    expect(html).toContain('href="/directory/add-business?source=%2Fdirectory"');
    expect(html).toContain('href="/directory/suggest?source=%2Fdirectory"');
    expect(html).toContain('Add your business');
    expect(html).toContain('Suggest a business');
  });

  it('defaults the source to the directory home', () => {
    expect(render()).toContain('source=%2Fdirectory');
  });
});
