/**
 * Shelf-match helpers for the public /place category browse endpoints
 * (multi-category shelf placement spec §3.1).
 *
 * A published seed listing is a member of shelf S (a category name resolved
 * from a categorySlug) when its primary category equals S (case-insensitive)
 * OR one of its `secondary_categories` equals S. Secondaries are UI-selected
 * from platform_categories, so they are always canonical names; the primary
 * additionally supports the name-derived-slug fallback for categories that
 * are not registered in platform_categories.
 */

/** Normalize a category name to its URL slug (same inline rule the routes use). */
export function categoryNameToSlug(name: string | null | undefined): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * SQL predicate: the listing belongs to the shelf whose canonical category
 * name is bound to parameter `${paramIdx}`. Matches the seed's primary
 * category (case-insensitive) or any non-null entry in the listing's
 * `secondary_categories` array.
 */
export function shelfNameMatchSql(paramIdx: number): string {
  const p = `$${paramIdx}`;
  return `(
    LOWER(dps.category) = LOWER(${p})
    OR EXISTS (
      SELECT 1 FROM unnest(dll.secondary_categories) AS sc
      WHERE sc IS NOT NULL AND LOWER(sc) = LOWER(${p})
    )
  )`;
}

/**
 * SQL predicate matching the primary category's name-derived slug against a
 * raw slug — the fallback path for categories not registered in
 * platform_categories (primary only; secondaries are always canonical).
 */
export function shelfSlugFallbackSql(paramIdx: number): string {
  const p = `$${paramIdx}`;
  return `LOWER(REPLACE(REPLACE(LOWER(dps.category), '[^a-z0-9 ]', ''), ' ', '-')) = LOWER(${p})`;
}

export interface ResolvedShelf {
  /** Canonical platform_categories name, when the slug is registered. */
  name: string | null;
  slug: string;
}

/**
 * Resolve a category slug to its canonical platform_categories name.
 * Returns null when the slug is not registered (callers fall back to the
 * name-slug normalization of the primary category).
 */
export async function resolveShelfBySlug(
  pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> },
  categorySlug: string,
): Promise<ResolvedShelf | null> {
  const result = await pool.query(
    `SELECT name, slug FROM platform_categories WHERE slug = $1 LIMIT 1`,
    [categorySlug],
  );
  const row = result.rows[0];
  if (!row?.name) return null;
  return { name: String(row.name), slug: String(row.slug || categorySlug) };
}
