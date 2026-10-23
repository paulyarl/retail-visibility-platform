import { describe, it, expect } from 'vitest';

import {
  MAX_CATEGORY_SLUG_LENGTH,
  buildPlacesSitemap,
  buildProductEntries,
  buildStorefrontEntries,
  escapeXml,
  formatLastmod,
  isExcludedCategorySlug,
  renderSitemapIndex,
  renderUrlset,
  resolveSitemapBaseUrl,
  tenantCanonicalHome,
  tenantCanonicalOrigin,
} from '../sitemap';

describe('resolveSitemapBaseUrl (spec RC1)', () => {
  it('returns the configured origin without a trailing slash', () => {
    expect(resolveSitemapBaseUrl('https://visibleshelf.com')).toBe('https://visibleshelf.com');
    expect(resolveSitemapBaseUrl('https://visibleshelf.com/')).toBe('https://visibleshelf.com');
    expect(resolveSitemapBaseUrl('https://visibleshelf.com//')).toBe('https://visibleshelf.com');
    expect(resolveSitemapBaseUrl('  https://visibleshelf.com/  ')).toBe('https://visibleshelf.com');
  });

  it('keeps a non-empty base path, minus its trailing slash', () => {
    expect(resolveSitemapBaseUrl('https://visibleshelf.com/app/')).toBe('https://visibleshelf.com/app');
  });

  it('accepts localhost for development', () => {
    expect(resolveSitemapBaseUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('refuses the API host — a cross-domain sitemap is rejected wholesale', () => {
    expect(resolveSitemapBaseUrl('https://api.visibleshelf.com')).toBeNull();
    expect(resolveSitemapBaseUrl('https://api.visibleshelf.com/')).toBeNull();
  });

  it('refuses empty, non-http(s), and unparseable values', () => {
    expect(resolveSitemapBaseUrl('')).toBeNull();
    expect(resolveSitemapBaseUrl('   ')).toBeNull();
    expect(resolveSitemapBaseUrl(null)).toBeNull();
    expect(resolveSitemapBaseUrl(undefined)).toBeNull();
    expect(resolveSitemapBaseUrl('visibleshelf.com')).toBeNull();
    expect(resolveSitemapBaseUrl('ftp://visibleshelf.com')).toBeNull();
  });
});

describe('isExcludedCategorySlug (spec §4.6)', () => {
  it('keeps ordinary shelf slugs', () => {
    expect(isExcludedCategorySlug('grocery-store')).toBe(false);
    expect(isExcludedCategorySlug('african-grocery-store-unverified')).toBe(false);
  });

  it('keeps a slug at exactly the length ceiling', () => {
    const slug = 'a'.repeat(MAX_CATEGORY_SLUG_LENGTH);
    expect(isExcludedCategorySlug(slug)).toBe(false);
  });

  it('drops composite operator labels past the ceiling', () => {
    const slug = 'a'.repeat(MAX_CATEGORY_SLUG_LENGTH + 1);
    expect(isExcludedCategorySlug(slug)).toBe(true);
    expect(
      isExcludedCategorySlug(
        'international-supermarket-african-goods-store-per-directory-mixed-asian-mexican-and-african',
      ),
    ).toBe(true);
  });

  it('drops any label containing per-directory, case-insensitively', () => {
    expect(isExcludedCategorySlug('mixed-Per-Directory-goods')).toBe(true);
  });

  it('treats an empty slug as excluded', () => {
    expect(isExcludedCategorySlug('')).toBe(true);
    expect(isExcludedCategorySlug('   ')).toBe(true);
    expect(isExcludedCategorySlug(null)).toBe(true);
  });
});

describe('formatLastmod', () => {
  it('renders a date-only value', () => {
    expect(formatLastmod(new Date('2026-10-23T12:34:56Z'))).toBe('2026-10-23');
    expect(formatLastmod('2026-10-23T12:34:56Z')).toBe('2026-10-23');
  });

  it('omits the tag for NULL, empty, and invalid values instead of throwing', () => {
    expect(formatLastmod(null)).toBeNull();
    expect(formatLastmod(undefined)).toBeNull();
    expect(formatLastmod('')).toBeNull();
    expect(formatLastmod('not-a-date')).toBeNull();
    expect(formatLastmod(new Date('nope'))).toBeNull();
  });
});

describe('escapeXml', () => {
  it('escapes the five XML entities', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
  });
});

describe('renderUrlset', () => {
  it('emits the document envelope and one <url> per entry', () => {
    const xml = renderUrlset([{ loc: 'https://visibleshelf.com/place', priority: 1 }]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://visibleshelf.com/place</loc>');
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('omits <lastmod> when the value is null', () => {
    const xml = renderUrlset([{ loc: 'https://visibleshelf.com/place/x', lastmod: null }]);
    expect(xml).not.toContain('<lastmod>');
  });

  it('includes <lastmod> when present', () => {
    const xml = renderUrlset([{ loc: 'https://visibleshelf.com/place/x', lastmod: '2026-10-23' }]);
    expect(xml).toContain('<lastmod>2026-10-23</lastmod>');
  });
});

describe('buildPlacesSitemap', () => {
  const baseUrl = 'https://visibleshelf.com';

  it('leads with the two index pages', () => {
    const { entries } = buildPlacesSitemap({
      baseUrl,
      categories: [],
      cities: [],
      seeds: [],
      claimed: [],
    });
    expect(entries.map((e) => e.loc)).toEqual([
      `${baseUrl}/place`,
      `${baseUrl}/directory`,
    ]);
  });

  it('routes seeds to /place and claimed tenants to /directory', () => {
    const { entries } = buildPlacesSitemap({
      baseUrl,
      categories: [],
      cities: [],
      seeds: [{ slug: 'dreamcast-african-market', updatedAt: '2026-09-01T00:00:00Z' }],
      claimed: [{ slug: 'baraka-international-market', updatedAt: null }],
    });
    const locs = entries.map((e) => e.loc);
    expect(locs).toContain(`${baseUrl}/place/dreamcast-african-market`);
    expect(locs).toContain(`${baseUrl}/directory/baraka-international-market`);
    expect(locs).not.toContain(`${baseUrl}/place/baraka-international-market`);
    expect(locs).not.toContain(`${baseUrl}/directory/dreamcast-african-market`);
  });

  it('omits lastmod for a claimed row with no updated_at instead of failing the document', () => {
    const { entries } = buildPlacesSitemap({
      baseUrl,
      categories: [],
      cities: [],
      seeds: [],
      claimed: [{ slug: 'no-timestamp', updatedAt: null }],
    });
    const entry = entries.find((e) => e.loc.endsWith('/directory/no-timestamp'));
    expect(entry?.lastmod).toBeNull();
    expect(() => renderUrlset(entries)).not.toThrow();
  });

  it('filters composite category slugs and reports what it dropped', () => {
    const { entries, excludedCategorySlugs } = buildPlacesSitemap({
      baseUrl,
      categories: [
        { slug: 'grocery-store' },
        { slug: 'african-grocery-store-unverified' },
        { slug: 'x'.repeat(MAX_CATEGORY_SLUG_LENGTH + 5) },
      ],
      cities: [],
      seeds: [],
      claimed: [],
    });
    const locs = entries.map((e) => e.loc);
    expect(locs).toContain(`${baseUrl}/place/category/grocery-store`);
    expect(locs).toContain(`${baseUrl}/place/category/african-grocery-store-unverified`);
    expect(excludedCategorySlugs).toHaveLength(1);
    expect(excludedCategorySlugs[0]).toHaveLength(MAX_CATEGORY_SLUG_LENGTH + 5);
  });

  it('dedupes repeated slugs so the document has no duplicate <loc>', () => {
    const { entries } = buildPlacesSitemap({
      baseUrl,
      categories: [{ slug: 'grocery-store' }, { slug: 'grocery-store' }],
      cities: [{ slug: 'indianapolis-in' }, { slug: 'indianapolis-in' }],
      seeds: [{ slug: 'same-place' }, { slug: 'same-place' }],
      claimed: [{ slug: 'same-place' }],
    });
    const locs = entries.map((e) => e.loc);
    expect(new Set(locs).size).toBe(locs.length);
  });

  it('percent-encodes path segments', () => {
    const { entries } = buildPlacesSitemap({
      baseUrl,
      categories: [],
      cities: [{ slug: 'coeur-d-alene-id' }],
      seeds: [{ slug: 'place with space' }],
      claimed: [],
    });
    const locs = entries.map((e) => e.loc);
    expect(locs).toContain(`${baseUrl}/place/city/coeur-d-alene-id`);
    expect(locs).toContain(`${baseUrl}/place/place%20with%20space`);
  });
});

describe('tenantCanonicalOrigin / tenantCanonicalHome (spec §4.7)', () => {
  const baseUrl = 'https://visibleshelf.com';
  const apex = 'visibleshelf.com';

  it('prefers an active custom domain', () => {
    expect(
      tenantCanonicalOrigin({ baseUrl, apex, subdomain: 'baraka', customDomain: 'baraka.example.com' }),
    ).toBe('https://baraka.example.com');
    expect(
      tenantCanonicalHome({ baseUrl, apex, slug: 'baraka', subdomain: 'baraka', customDomain: 'baraka.example.com' }),
    ).toBe('https://baraka.example.com/');
  });

  it('falls back to the platform subdomain', () => {
    expect(tenantCanonicalOrigin({ baseUrl, apex, subdomain: 'baraka' })).toBe(
      'https://baraka.visibleshelf.com',
    );
    expect(tenantCanonicalHome({ baseUrl, apex, slug: 'baraka', subdomain: 'baraka' })).toBe(
      'https://baraka.visibleshelf.com/',
    );
  });

  it('falls back to the platform path form when the tenant has no host', () => {
    expect(tenantCanonicalOrigin({ baseUrl, apex })).toBe(baseUrl);
    expect(tenantCanonicalHome({ baseUrl, apex, slug: 'baraka-international-market' })).toBe(
      'https://visibleshelf.com/tenant/baraka-international-market',
    );
  });

  it('returns null for a home with no slug and no host', () => {
    expect(tenantCanonicalHome({ baseUrl, apex, slug: null })).toBeNull();
  });
});

describe('buildStorefrontEntries', () => {
  const baseUrl = 'https://visibleshelf.com';
  const apex = 'visibleshelf.com';

  it('emits one canonical home per tenant, deduped', () => {
    const entries = buildStorefrontEntries({
      baseUrl,
      apex,
      tenants: [
        { slug: 'baraka', subdomain: 'baraka' },
        { slug: 'baraka-dup', subdomain: 'baraka' },
        { slug: 'plain', subdomain: null },
        { slug: null, subdomain: null },
      ],
    });
    const locs = entries.map((e) => e.loc);
    expect(locs).toEqual([
      'https://baraka.visibleshelf.com/',
      'https://visibleshelf.com/tenant/plain',
    ]);
  });
});

describe('buildProductEntries', () => {
  const baseUrl = 'https://visibleshelf.com';
  const apex = 'visibleshelf.com';

  it("inherits the owning tenant's canonical origin", () => {
    const entries = buildProductEntries({
      baseUrl,
      apex,
      products: [
        { id: 'pid-1', subdomain: 'baraka' },
        { id: 'pid-2', customDomain: 'baraka.example.com' },
        { id: 'pid-3' },
      ],
    });
    expect(entries.map((e) => e.loc)).toEqual([
      'https://baraka.visibleshelf.com/products/pid-1',
      'https://baraka.example.com/products/pid-2',
      'https://visibleshelf.com/products/pid-3',
    ]);
  });

  it('carries lastmod and tolerates a null timestamp', () => {
    const entries = buildProductEntries({
      baseUrl,
      apex,
      products: [
        { id: 'pid-1', updatedAt: '2026-10-01T00:00:00Z' },
        { id: 'pid-2', updatedAt: null },
      ],
    });
    expect(entries[0].lastmod).toBe('2026-10-01');
    expect(entries[1].lastmod).toBeNull();
    expect(() => renderUrlset(entries)).not.toThrow();
  });

  it('dedupes and skips empty ids', () => {
    const entries = buildProductEntries({
      baseUrl,
      apex,
      products: [{ id: 'pid-1' }, { id: 'pid-1' }, { id: '' }],
    });
    expect(entries).toHaveLength(1);
  });
});

describe('renderSitemapIndex', () => {
  it('wraps child sitemaps in a <sitemapindex>', () => {
    const xml = renderSitemapIndex([
      { loc: 'https://visibleshelf.com/sitemaps/core.xml' },
      { loc: 'https://visibleshelf.com/sitemaps/products-1.xml', lastmod: '2026-10-23' },
    ]);
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://visibleshelf.com/sitemaps/core.xml</loc>');
    expect(xml).toContain('<lastmod>2026-10-23</lastmod>');
    expect(xml.match(/<sitemap>/g)).toHaveLength(2);
    expect(xml.trimEnd().endsWith('</sitemapindex>')).toBe(true);
  });
});

describe('buildPlacesSitemap — file split', () => {
  it('omits the index pages when includeIndexPages is false', () => {
    const { entries } = buildPlacesSitemap({
      baseUrl: 'https://visibleshelf.com',
      categories: [],
      cities: [],
      seeds: [{ slug: 'seed-one' }],
      claimed: [],
      includeIndexPages: false,
    });
    expect(entries.map((e) => e.loc)).toEqual(['https://visibleshelf.com/place/seed-one']);
  });
});
