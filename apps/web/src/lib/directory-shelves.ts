/**
 * Directory-shelf resolution for enrichment taxonomy labels on the
 * /directory/categories surface — the claimed-listings counterpart to
 * place-shelves.ts.
 *
 * The shelf index is GET /api/directory/mv/categories: platform_categories
 * INNER JOINed to published directory_listings_list counts, so it only
 * carries shelves that hold at least one claimed listing. A label resolves
 * on an exact trimmed, lowercased name match — same semantics as
 * resolveShelfForLabel — and a positive storeCount keeps the link gate
 * honest even if a caller feeds an unfiltered list.
 */
export interface DirectoryShelfIndexEntry {
  name: string;
  slug: string;
  storeCount: number;
}

export interface DirectoryShelfLink {
  slug: string;
  count: number;
}

export function resolveDirectoryShelfForLabel(
  label: string,
  shelves: DirectoryShelfIndexEntry[],
): DirectoryShelfLink | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;

  const shelf = shelves.find((s) => s.name?.trim().toLowerCase() === key);
  if (!shelf?.slug || !(shelf.storeCount > 0)) return null;

  return { slug: shelf.slug, count: shelf.storeCount };
}

/** Public shelf URL for a directory category (national surface — no market). */
export function directoryShelfHrefFor(slug: string): string {
  return `/directory/categories/${slug}`;
}
