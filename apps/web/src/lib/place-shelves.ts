import type { PlaceCategory } from '@/services/PlacesBrowsePublicService';
import {
  shelfRefToSurface,
  type DirectoryShelfSurface,
} from '@/services/DirectoryPresencePublicService';
import { parsePlaceCitySlug } from '@/utils/slug';

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

/** Capitalize each word of a slug or space-joined name ('fort wayne' → 'Fort Wayne'). */
function titleize(text: string): string {
  return text
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Display label for a "{city}-{state}" shelf slug ('indianapolis-in' → 'Indianapolis, IN'). */
function cityShelfLabel(slug: string): string {
  const { city, state } = parsePlaceCitySlug(slug);
  return titleize(city) + (state ? `, ${state.toUpperCase()}` : '');
}

export interface ReferrerShelf {
  /** Canonical surface key — 'place_category', 'place_city', 'directory_*'. */
  surface: DirectoryShelfSurface;
  /** Display label — canonical category name when the shelf index resolves it. */
  label: string;
  /** URL back to the shelf (market-scoped when the listing's market resolves). */
  href: string;
  /**
   * Category label to substitute for the hero subtitle — only set when the
   * referrer is a /place/category shelf, where the label is provably one of
   * the seed's own shelf filings. Other surfaces (city, directory, store
   * type) get the back link but keep the primary category as the subtitle.
   */
  categoryLabel: string | null;
}

/**
 * Resolve a `?shelf=<surface>/<type>/<slug>` attribution ref to the shopper-
 * facing shelf it came from — the label and return href the place entry page
 * shows so the referral context survives the click-through.
 *
 * Returns null for missing/malformed refs and surfaces the entry page doesn't
 * render a back target for.
 */
export function resolveReferrerShelf(
  shelfRef: string | null | undefined,
  opts: { shelves?: PlaceCategory[]; city?: string | null; state?: string | null } = {},
): ReferrerShelf | null {
  if (!shelfRef) return null;
  const mapped = shelfRefToSurface(shelfRef.trim());
  if (!mapped) return null;

  const { surface, ref } = mapped;
  const { shelves = [], city, state } = opts;

  switch (surface) {
    case 'place_category': {
      const shelf = shelves.find((s) => s.slug === ref);
      const label = shelf?.category || titleize(ref);
      // Scope the return link to the listing's market when the shelf is live
      // there — reproduces the city-filtered view the shopper typically came
      // from; otherwise the plain national shelf.
      const market =
        shelf && city
          ? resolveShelfForLabel(shelf.category, city, state ?? undefined, shelves)
          : null;
      const href = market ? shelfHrefFor(market.slug, city!, state ?? undefined) : shelfHrefFor(ref);
      return { surface, label, href, categoryLabel: label };
    }
    case 'place_city':
      return { surface, label: cityShelfLabel(ref), href: `/place/city/${ref}`, categoryLabel: null };
    case 'directory_category':
      return {
        surface,
        label: titleize(ref),
        href: `/directory/categories/${ref}`,
        categoryLabel: null,
      };
    case 'directory_location':
      return {
        surface,
        label: cityShelfLabel(ref),
        href: `/directory/location/${ref}`,
        categoryLabel: null,
      };
    case 'directory_store_type':
      return { surface, label: titleize(ref), href: `/directory/stores/${ref}`, categoryLabel: null };
    case 'directory_home':
      return { surface, label: 'Directory', href: '/directory', categoryLabel: null };
    default:
      return null;
  }
}

export interface SecondaryShelf {
  label: string;
  /** Live shelf href — null when the label doesn't resolve to a shelf with
   *  listings (chip renders as plain text, same degrade as shelf chips). */
  href: string | null;
}

/**
 * Resolve a seed's secondary category labels to their live shelves. A seed is
 * filed on every secondary shelf it lists, so the label should always resolve
 * — but encoding mismatches degrade to an unlinked chip rather than a dead
 * end. Market scope when the shelf is live in the listing's city, national
 * otherwise (the same two-step resolve as resolveReferrerShelf).
 */
export function resolveSecondaryShelves(
  labels: string[],
  opts: {
    shelves?: PlaceCategory[];
    city?: string | null;
    state?: string | null;
    /** Label to exclude (e.g. the displayed category) — case-insensitive. */
    exclude?: string | null;
  } = {},
): SecondaryShelf[] {
  const { shelves = [], city, state, exclude } = opts;
  const excludeKey = exclude?.trim().toLowerCase() || null;
  const seen = new Set<string>();
  const out: SecondaryShelf[] = [];

  for (const raw of labels) {
    const label = (raw || '').trim();
    const key = label.toLowerCase();
    if (!key || key === excludeKey || seen.has(key)) continue;
    seen.add(key);

    const market = city
      ? resolveShelfForLabel(label, city, state ?? undefined, shelves)
      : null;
    const national = market ?? resolveShelfForLabel(label, undefined, undefined, shelves);
    out.push({
      label,
      href: market
        ? shelfHrefFor(market.slug, city!, state ?? undefined)
        : national
          ? shelfHrefFor(national.slug)
          : null,
    });
  }
  return out;
}

/** Normalize a consolidated listing's secondary categories to display labels.
 *  Prefers the route-normalized `categories[]` entries ({name,isPrimary});
 *  falls back to the raw `secondary_categories` strings/objects. */
export function secondaryCategoryNames(listing: {
  categories?: Array<{ name?: string; isPrimary?: boolean }> | null;
  secondaryCategories?: Array<string | { name?: string }> | null;
}): string[] {
  const fromNormalized = (listing.categories ?? [])
    .filter((c) => c && !c.isPrimary && c.name)
    .map((c) => c.name as string);
  if (fromNormalized.length > 0) return fromNormalized;
  return (listing.secondaryCategories ?? [])
    .map((c) => (typeof c === 'string' ? c : c?.name || ''))
    .filter(Boolean);
}
