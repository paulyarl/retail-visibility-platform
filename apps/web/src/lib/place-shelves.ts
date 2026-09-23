import type { PlaceCategory } from '@/services/PlacesBrowsePublicService';

export interface ShelfLink {
  slug: string;
  count: number;
}

/**
 * Resolve an enrichment taxonomy label (sub-category or related category) to
 * the live shelf for a market.
 *
 * The packet's labels are taxonomy hints; the shelf index
 * (GET /api/public/directory/places) carries the canonical slug and the
 * per-market listing count. Only labels that actually hold published listings
 * here resolve — a chip linking into an empty shelf is a dead end, so those
 * callers render plain text instead.
 *
 * Matching is exact on the trimmed, lowercased name: 'Somali Grocery' and
 * 'Somali Grocery Store' are different labels and are not merged.
 */
export function resolveShelfForLabel(
  label: string,
  city: string | undefined,
  state: string | undefined,
  shelves: PlaceCategory[],
): ShelfLink | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;

  const shelf = shelves.find((s) => s.category.trim().toLowerCase() === key);
  if (!shelf) return null;

  const count = city
    ? (shelf.cities.find(
        (c) =>
          c.city.trim().toLowerCase() === city.trim().toLowerCase() &&
          (!state || !c.state || c.state.trim().toLowerCase() === state.trim().toLowerCase()),
      )?.placeCount ?? 0)
    : shelf.placeCount;

  return count > 0 ? { slug: shelf.slug, count } : null;
}

/**
 * Public shelf URL for a category, keeping the market context — the same
 * shape the seed admin page's categoryShelfHref uses.
 */
export function shelfHrefFor(slug: string, city?: string, state?: string): string {
  if (!city) return `/place/category/${slug}`;
  const stateQs = state ? `&state=${encodeURIComponent(state)}` : '';
  return `/place/category/${slug}?city=${encodeURIComponent(city)}${stateQs}`;
}
