import { prisma } from '../prisma';
import { logger } from '../logger';

/**
 * Seed SEO vocabulary as a fallback for tenant-authored SEO fields.
 *
 * A tenant that came from a directory seed already has analyst-composed SEO
 * content: the seed composer writes the narrative into
 * `directory_listings_list.description` and the vocabulary into
 * `directory_listings_list.keywords` (category, store format, profile
 * synonyms/subcategories, origin tags).
 *
 * Two owner-facing surfaces read their own copies and started empty:
 *   - the business profile's `seo_tags` (schema keywords)
 *   - `directory_settings_list.seo_description` / `seo_keywords` (directory
 *     search description + keywords)
 *
 * Both now fall back to the seed's composed values, per field, so a seeded
 * tenant sees (and can keep) what the platform already derived instead of
 * looking incomplete. Read-time only: nothing is written back. Saving persists
 * the values onto the owner's own row, which then wins.
 */

/** Matches the ceiling the composer applies to listing keywords. */
export const PROFILE_SEO_TAGS_LIMIT = 20;

/** The directory settings panel allows 10 keywords. */
export const DIRECTORY_SEO_KEYWORDS_LIMIT = 10;

export type SeoTagsSource = 'profile' | 'directory_seed';
export type DirectorySeoSource = 'settings' | 'directory_seed';

export interface ResolvedProfileSeoTags {
  tags: string[];
  source: SeoTagsSource;
}

export interface ResolvedDirectorySeo {
  description: { value: string; source: DirectorySeoSource };
  keywords: { value: string[]; source: DirectorySeoSource };
}

/**
 * Coerce listing keywords into owner-facing tags: drop the internal `key:value`
 * prefix (`neighborhood:Shaw` → `shaw`, `origin_country:Ethiopia` → `ethiopia`),
 * trim, lowercase (the SEO page's convention), dedupe, cap.
 */
export function normalizeSeedSeoTags(
  keywords: readonly string[] | null | undefined,
  limit: number = PROFILE_SEO_TAGS_LIMIT,
): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const raw of keywords ?? []) {
    if (typeof raw !== 'string') continue;
    const term = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw;
    const tag = term.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= limit) break;
  }

  return tags;
}

interface SeedListingSeo {
  keywords: string[];
  description: string | null;
}

/** The seed's composed SEO content, via its listing (or the tenant's listing). */
export async function resolveSeedListingSeo(tenantId: string): Promise<SeedListingSeo> {
  const empty: SeedListingSeo = { keywords: [], description: null };
  if (!tenantId) return empty;

  const seed = await prisma.directory_presence_seeds.findUnique({
    where: { tenant_id: tenantId },
    select: { listing_id: true },
  });

  if (seed?.listing_id) {
    const listing = await prisma.directory_listings_list.findUnique({
      where: { id: seed.listing_id },
      select: { keywords: true, description: true },
    });
    if (listing) {
      return {
        keywords: normalizeSeedSeoTags(listing.keywords),
        description: listing.description?.trim() || null,
      };
    }
  }

  const listing = await prisma.directory_listings_list.findFirst({
    where: { tenant_id: tenantId },
    select: { keywords: true, description: true },
  });

  return listing
    ? {
        keywords: normalizeSeedSeoTags(listing.keywords),
        description: listing.description?.trim() || null,
      }
    : empty;
}

/** The seed's composed keyword vocabulary. */
export async function resolveSeedSeoTags(tenantId: string): Promise<string[]> {
  const listing = await resolveSeedListingSeo(tenantId);
  return listing.keywords;
}

/**
 * The profile's own tags when it has any, otherwise the seed's. Never throws —
 * a missing seed/listing must not fail a profile read.
 */
export async function resolveProfileSeoTags(
  tenantId: string,
  profileSeoTags: unknown,
): Promise<ResolvedProfileSeoTags> {
  const own = Array.isArray(profileSeoTags)
    ? profileSeoTags.filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '')
    : [];

  if (own.length > 0) return { tags: own, source: 'profile' };

  try {
    const fallback = await resolveSeedSeoTags(tenantId);
    if (fallback.length > 0) return { tags: fallback, source: 'directory_seed' };
  } catch (error: any) {
    logger.warn('[SeedSeoFallback] Seed tag lookup failed', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
  }

  return { tags: [], source: 'profile' };
}

/**
 * Directory settings description/keywords, falling back per field to the seed's
 * composed narrative and vocabulary. Never throws.
 */
export async function resolveDirectorySeo(
  tenantId: string,
  settings: { description?: string | null; keywords?: string[] | null },
): Promise<ResolvedDirectorySeo> {
  const ownDescription = settings.description?.trim() || '';
  const ownKeywords = Array.isArray(settings.keywords)
    ? settings.keywords.filter((kw): kw is string => typeof kw === 'string' && kw.trim() !== '')
    : [];

  const resolved: ResolvedDirectorySeo = {
    description: { value: ownDescription, source: 'settings' },
    keywords: { value: ownKeywords, source: 'settings' },
  };

  if (ownDescription && ownKeywords.length > 0) return resolved;

  try {
    const seed = await resolveSeedListingSeo(tenantId);
    if (!ownDescription && seed.description) {
      resolved.description = { value: seed.description, source: 'directory_seed' };
    }
    if (ownKeywords.length === 0 && seed.keywords.length > 0) {
      resolved.keywords = {
        value: seed.keywords.slice(0, DIRECTORY_SEO_KEYWORDS_LIMIT),
        source: 'directory_seed',
      };
    }
  } catch (error: any) {
    logger.warn('[SeedSeoFallback] Seed listing lookup failed', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
  }

  return resolved;
}
