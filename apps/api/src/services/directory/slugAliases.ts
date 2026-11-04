/**
 * Slug aliases — the deterministic half of dead-slug insurance
 * (migration 375, `slug_aliases` table).
 *
 * The fuzzy variant resolver (seedSlugVariants.ts) INFERS old slugs from
 * name/geo tokens — it cannot cover a full rename to different tokens. Every
 * slug write path (updateSlug, the seed fields rename) records the vacated
 * slug here instead: resolution becomes bookkeeping, not inference.
 *
 * Writer invariants:
 *   - vacating a slug → UPSERT old_slug → tenant_id (latest rename wins)
 *   - assigning a slug → DELETE its alias row (a live owner supersedes any
 *     stale alias — slug recycling)
 * Reader invariant: the alias target must still be LIVE on the requested
 * surface or the lookup returns null — a dead target stays a 404, never a
 * dangling redirect.
 */

import { getDirectPool } from '../../utils/db-pool';
import { logger } from '../../logger';
import type { SlugSurface } from './seedSlugVariants';

/** Record that `tenantId` vacated `oldSlug`. No-op for empty/equal slugs. */
export async function recordSlugAlias(tenantId: string, oldSlug: string | null | undefined, newSlug?: string): Promise<void> {
  const old = (oldSlug ?? '').trim().toLowerCase();
  const next = (newSlug ?? '').trim().toLowerCase();
  if (!tenantId || !old || old === next) return;
  try {
    await getDirectPool().query(
      `INSERT INTO slug_aliases (old_slug, tenant_id, replaced_at)
       VALUES ($1, $2, now())
       ON CONFLICT (old_slug) DO UPDATE
         SET tenant_id = EXCLUDED.tenant_id, replaced_at = now()`,
      [old, tenantId],
    );
  } catch (error) {
    // Alias writes must never break the rename itself — the fuzzy resolver
    // is the backstop when no trail exists.
    logger.warn('[slugAliases] Failed to record slug alias', undefined, { tenantId, oldSlug: old, error });
  }
}

/** Drop alias rows for `slug` — a slug being assigned live supersedes stale aliases. */
export async function clearSlugAliasFor(slug: string | null | undefined): Promise<void> {
  const s = (slug ?? '').trim().toLowerCase();
  if (!s) return;
  try {
    await getDirectPool().query(`DELETE FROM slug_aliases WHERE old_slug = $1`, [s]);
  } catch (error) {
    logger.warn('[slugAliases] Failed to clear slug alias', undefined, { slug: s, error });
  }
}

/** Alias → live record lookup, per surface. Multiple/ambiguous rows → null. */
const ALIAS_TARGET_QUERIES: Record<SlugSurface, string> = {
  place: `SELECT dll.slug
            FROM slug_aliases a
            JOIN directory_presence_seeds dps ON dps.tenant_id = a.tenant_id
            JOIN directory_listings_list dll ON dll.id = dps.listing_id
           WHERE a.old_slug = $1
             AND dll.is_published = true
             AND dll.listing_origin = 'directory_seed'
             AND dps.status IN ('published', 'invited', 'claimed')
             AND dll.slug IS NOT NULL
           LIMIT 2`,
  directory: `SELECT dll.slug
            FROM slug_aliases a
            JOIN directory_listings_list dll ON dll.tenant_id = a.tenant_id
           WHERE a.old_slug = $1
             AND dll.is_published = true
             AND COALESCE(dll.listing_origin, 'claimed') <> 'directory_seed'
             AND dll.slug IS NOT NULL
           LIMIT 2`,
  tenant: `SELECT t.slug
            FROM slug_aliases a
            JOIN tenants t ON t.id = a.tenant_id
           WHERE a.old_slug = $1
             AND t.slug IS NOT NULL
             AND COALESCE(t.org_standing_mode, 'independent') <> 'directory_seed'
             AND COALESCE(t.directory_visible, true) = true
           LIMIT 2`,
};

/**
 * The live slug a recorded alias resolves to on `surface`, or null (no alias,
 * dead target, or ambiguous). Never returns the requested slug itself.
 */
export async function resolveSlugAlias(requestedSlug: string, surface: SlugSurface): Promise<string | null> {
  const s = requestedSlug.trim().toLowerCase();
  if (!s) return null;
  try {
    const { rows } = await getDirectPool().query(ALIAS_TARGET_QUERIES[surface], [s]);
    if (rows.length !== 1) return null;
    const slug = rows[0]?.slug;
    return typeof slug === 'string' && slug && slug !== s ? slug : null;
  } catch (error) {
    // Pre-migration the table may not exist — degrade to fuzzy-only rather
    // than killing the rescue path.
    logger.warn('[slugAliases] Alias resolution failed', undefined, { slug: s, surface, error });
    return null;
  }
}
