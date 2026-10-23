import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { productCanonicalUrl, shopProfileCanonicalUrl } from '../seo-canonical';

const ORIGINAL_WEB_URL = process.env.NEXT_PUBLIC_WEB_URL;

describe('productCanonicalUrl', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_WEB_URL = 'https://visibleshelf.com';
  });

  afterAll(() => {
    if (ORIGINAL_WEB_URL === undefined) delete process.env.NEXT_PUBLIC_WEB_URL;
    else process.env.NEXT_PUBLIC_WEB_URL = ORIGINAL_WEB_URL;
  });

  it('uses the custom domain when the tenant has one', () => {
    expect(
      productCanonicalUrl({ kind: 'custom', host: 'baraka.example.com' }, 'pid-ULCW-79au4s1v'),
    ).toBe('https://baraka.example.com/products/pid-ULCW-79au4s1v');
  });

  it('uses the platform subdomain when that is the canonical level', () => {
    expect(
      productCanonicalUrl(
        { kind: 'subdomain', host: 'baraka-international-market' },
        'pid-ULCW-79au4s1v',
      ),
    ).toBe('https://baraka-international-market.visibleshelf.com/products/pid-ULCW-79au4s1v');
  });

  it('falls back to the platform origin for a path-only tenant', () => {
    expect(productCanonicalUrl({ kind: 'path', host: null }, 'pid-1')).toBe(
      'https://visibleshelf.com/products/pid-1',
    );
  });

  it('falls back to the platform origin when the lookup failed', () => {
    expect(productCanonicalUrl(null, 'pid-1')).toBe('https://visibleshelf.com/products/pid-1');
    expect(productCanonicalUrl(undefined, 'pid-1')).toBe('https://visibleshelf.com/products/pid-1');
  });

  it('encodes the product id', () => {
    expect(productCanonicalUrl({ kind: 'path', host: null }, 'pid with space')).toBe(
      'https://visibleshelf.com/products/pid%20with%20space',
    );
  });
});

describe('shopProfileCanonicalUrl', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_WEB_URL = 'https://visibleshelf.com';
  });

  afterAll(() => {
    if (ORIGINAL_WEB_URL === undefined) delete process.env.NEXT_PUBLIC_WEB_URL;
    else process.env.NEXT_PUBLIC_WEB_URL = ORIGINAL_WEB_URL;
  });

  it('canonicalizes the shop profile to the storefront home on a custom domain', () => {
    expect(
      shopProfileCanonicalUrl({ kind: 'custom', host: 'baraka.example.com' }, 'baraka'),
    ).toBe('https://baraka.example.com/');
  });

  it('canonicalizes to the subdomain storefront home', () => {
    expect(
      shopProfileCanonicalUrl({ kind: 'subdomain', host: 'baraka-international-market' }, 'baraka'),
    ).toBe('https://baraka-international-market.visibleshelf.com/');
  });

  it('canonicalizes to the platform path form when there is no tenant host', () => {
    expect(shopProfileCanonicalUrl({ kind: 'path', host: null }, 'baraka-international-market')).toBe(
      'https://visibleshelf.com/tenant/baraka-international-market',
    );
  });

  it('never returns the shop profile itself', () => {
    const url = shopProfileCanonicalUrl({ kind: 'path', host: null }, 'baraka');
    expect(url).not.toContain('/shops/');
  });
});
