/**
 * Sitemap URL assembly — pure functions, no DB and no request objects.
 *
 * The producer route (`routes/directory-presence-public.ts`) owns the SQL; this
 * module owns everything that turns rows into a document, so the URL rules are
 * unit-testable and reusable when `/sitemap.xml` splits into per-surface files
 * (docs/LocalBiz/PLACES_SEO_INDEXING_SPEC.md §4.8).
 */

export type SitemapChangefreq = 'daily' | 'weekly' | 'monthly';

export interface SitemapEntry {
  loc: string;
  /** `YYYY-MM-DD`, or null/undefined to omit the tag entirely. */
  lastmod?: string | null;
  changefreq?: SitemapChangefreq;
  priority?: number;
}

/** Derived shelf slugs longer than this are operator free-text, not shelves. */
export const MAX_CATEGORY_SLUG_LENGTH = 60;

/**
 * Resolve the sitemap's absolute origin from config. Returns null when the value
 * is unusable — empty, non-http(s), or the API host — because a sitemap that
 * stamps `api.` URLs is rejected wholesale and Google caches the rejection.
 */
export function resolveSitemapBaseUrl(webUrl: string | null | undefined): string | null {
  const raw = (webUrl ?? '').trim().replace(/\/+$/, '');
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.hostname.toLowerCase().startsWith('api.')) return null;
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

/**
 * Filter for derived shelf slugs (spec §4.6). Composite operator labels —
 * `international-supermarket-…-per-directory-…` — produce near-duplicate pages
 * that dilute the real shelves. `-unverified` variants are legitimate and kept.
 */
export function isExcludedCategorySlug(slug: string | null | undefined): boolean {
  const trimmed = (slug ?? '').trim();
  if (!trimmed) return true;
  return trimmed.length > MAX_CATEGORY_SLUG_LENGTH || trimmed.toLowerCase().includes('per-directory');
}

/** `<lastmod>` is optional — NULL or an Invalid Date must omit it, never throw. */
export function formatLastmod(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderUrl(entry: SitemapEntry): string {
  const lines = [`    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
  if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (typeof entry.priority === 'number') lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  return `  <url>\n${lines.join('\n')}\n  </url>`;
}

export function renderUrlset(entries: SitemapEntry[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(renderUrl),
    '</urlset>',
  ].join('\n');
}

export interface SeedSitemapRow {
  slug: string;
  updatedAt?: Date | string | null;
}

export interface ClaimedSitemapRow {
  slug: string;
  updatedAt?: Date | string | null;
}

/** A city slug is already resolved to the canonical `{city}-{state}` form. */
export interface CitySitemapRow {
  slug: string;
}

export interface CategorySitemapRow {
  slug: string;
}

export interface PlacesSitemapInput {
  baseUrl: string;
  categories: CategorySitemapRow[];
  cities: CitySitemapRow[];
  seeds: SeedSitemapRow[];
  claimed: ClaimedSitemapRow[];
}

export interface PlacesSitemapResult {
  entries: SitemapEntry[];
  /** Slugs dropped by the §4.6 filter — logged so the operator can see the cost. */
  excludedCategorySlugs: string[];
}

const segment = (value: string) => encodeURIComponent(value);

export function buildPlacesSitemap(input: PlacesSitemapInput): PlacesSitemapResult {
  const { baseUrl, categories, cities, seeds, claimed } = input;
  const entries: SitemapEntry[] = [];

  entries.push({ loc: `${baseUrl}/place`, changefreq: 'daily', priority: 1 });
  entries.push({ loc: `${baseUrl}/directory`, changefreq: 'daily', priority: 0.9 });

  const excludedCategorySlugs: string[] = [];
  const seenCategories = new Set<string>();
  for (const row of categories) {
    const slug = (row.slug ?? '').trim();
    if (isExcludedCategorySlug(slug)) {
      if (slug) excludedCategorySlugs.push(slug);
      continue;
    }
    // The SQL is DISTINCT on the label, but two labels can derive the same slug.
    if (seenCategories.has(slug)) continue;
    seenCategories.add(slug);
    entries.push({
      loc: `${baseUrl}/place/category/${segment(slug)}`,
      changefreq: 'weekly',
      priority: 0.8,
    });
  }

  const seenCities = new Set<string>();
  for (const row of cities) {
    const slug = (row.slug ?? '').trim();
    if (!slug || seenCities.has(slug)) continue;
    seenCities.add(slug);
    entries.push({
      loc: `${baseUrl}/place/city/${segment(slug)}`,
      changefreq: 'weekly',
      priority: 0.8,
    });
  }

  // Seeds live at /place/{slug}; claimed tenants at /directory/{slug}. The two
  // sets are disjoint by `listing_origin`, and the layout redirects run the
  // other way for each — so emitting either on the wrong surface would put a
  // 308 in the sitemap, which Google treats as a canonicalization defect.
  const seenSeeds = new Set<string>();
  for (const row of seeds) {
    const slug = (row.slug ?? '').trim();
    if (!slug || seenSeeds.has(slug)) continue;
    seenSeeds.add(slug);
    entries.push({
      loc: `${baseUrl}/place/${segment(slug)}`,
      lastmod: formatLastmod(row.updatedAt),
      changefreq: 'monthly',
      priority: 0.6,
    });
  }

  const seenClaimed = new Set<string>();
  for (const row of claimed) {
    const slug = (row.slug ?? '').trim();
    if (!slug || seenClaimed.has(slug) || seenSeeds.has(slug)) continue;
    seenClaimed.add(slug);
    entries.push({
      loc: `${baseUrl}/directory/${segment(slug)}`,
      lastmod: formatLastmod(row.updatedAt),
      changefreq: 'monthly',
      priority: 0.6,
    });
  }

  return { entries, excludedCategorySlugs };
}
