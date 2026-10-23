import { describe, it, expect } from 'vitest';

import {
  MAX_CATEGORY_SLUG_LENGTH,
  buildPlacesSitemap,
  escapeXml,
  formatLastmod,
  isExcludedCategorySlug,
  renderUrlset,
  resolveSitemapBaseUrl,
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
