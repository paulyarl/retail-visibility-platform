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
 * Generic retail nouns that suffix nearly every shelf label. Stripped (in any
 * position) when computing a label's "head" for alias matching — "halal
 * market" and "halal grocery store" share the head "halal".
 */
const SHELF_TAIL_NOUNS = new Set([
  'store', 'stores', 'market', 'markets', 'grocery', 'groceries',
  'supermarket', 'supermarkets', 'food', 'foods', 'shop', 'shops',
  'retail', 'mart', 'bodega', 'deli', 'place',
]);

const SHELF_NOISE_WORDS = new Set(['and', 'the', 'of', 'or', 'at', '&']);

/** Light plural folding for alias matching — not a stemmer, just the
 *  suffixes shelf names actually use. Note 'ies' must run before the bare
 *  's' rule, and 'es' is intentionally absent — it mangles 'stores'→'stor'. */
function foldPlural(token: string): string {
  if (token.endsWith('ies') && token.length > 3) return `${token.slice(0, -3)}y`;
  if (token.endsWith('s') && token.length > 1 && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

/**
 * Normalize a shelf label for alias matching: lowercase, drop punctuation,
 * parentheticals, `[language]` tags and noise words, fold plurals. Returns
 * the full normalized token list (tail nouns kept — they're meaningful for
 * exact-ish matching) plus the "head" tokens (tail nouns stripped).
 */
function normalizeShelfLabel(label: string): { tokens: string[]; head: string[] } {
  const cleaned = label
    .toLowerCase()
    .replace(/\s*\[[^\]]*\]\s*$/, ' ')       // language annotations — never display text
    .replace(/\s*\([^)]*\)\s*/g, ' ')        // qualifiers ("(probable)", "(unverified)")
    .replace(/[&/\\,;:+–—_-]+/g, ' ')        // separators → spaces
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return { tokens: [], head: [] };
  const tokens = cleaned
    .split(' ')
    .map(foldPlural)
    .filter((t) => t && !SHELF_NOISE_WORDS.has(t));
  const head = tokens.filter((t) => !SHELF_TAIL_NOUNS.has(t));
  return { tokens, head };
}

/** Same-tail match: normalized token lists identical (order-insensitive). */
function sameTokens(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((t) => set.has(t));
}

/** Head-subset alias: shelf head ⊆ label head AND first tokens align.
 *  "Somali East African Halal market" → head {somali,east,african,halal}
 *  contains {somali} with matching first token → Somali Grocery Store.
 *  "Latin American grocery" head {latin,american} vs shelf {american} —
 *  first tokens differ → refused (latin american ≠ american grocery). */
function headSubsetMatch(labelHead: string[], shelfHead: string[]): boolean {
  if (!labelHead.length || !shelfHead.length) return false;
  if (labelHead[0] !== shelfHead[0]) return false;
  const labelSet = new Set(labelHead);
  return shelfHead.every((t) => labelSet.has(t));
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
 * Matching ladder (conservative → lenient):
 *   1. Exact match on the trimmed, lowercased name.
 *   2. Normalized match — punctuation/parentheticals/noise/plurals folded,
 *      token order ignored ("Halal Grocery" ≡ "halal grocery store").
 *   3. Head-subset alias — the shelf's head tokens must all appear in the
 *      label's head AND share its first token; longest matching head wins,
 *      only when unique. Ambiguity stays cold — a wrong link is worse than
 *      a plain-text chip.
 */
export function resolveShelfForLabel(
  label: string,
  city: string | undefined,
  state: string | undefined,
  shelves: PlaceCategory[],
): ShelfLink | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;

  // 1. Exact match — the canonical fast path.
  let shelf = shelves.find((s) => s.category.trim().toLowerCase() === key);

  if (!shelf) {
    const { tokens, head } = normalizeShelfLabel(key);
    if (tokens.length > 0) {
      // 2. Normalized token-equality (tail nouns compared too — "halal meat
      // market" and "halal grocery store" are genuinely different shelves).
      shelf = shelves.find((s) => {
        const st = normalizeShelfLabel(s.category);
        return sameTokens(tokens, st.tokens);
      });
    }
    if (!shelf && head.length > 0) {
      // 3. Head-subset alias — most specific (longest head) unique winner.
      let best: { shelf: PlaceCategory; headLen: number } | null = null;
      let ambiguous = false;
      for (const s of shelves) {
        const sh = normalizeShelfLabel(s.category).head;
        if (!headSubsetMatch(head, sh)) continue;
        if (!best || sh.length > best.headLen) {
          best = { shelf: s, headLen: sh.length };
          ambiguous = false;
        } else if (sh.length === best.headLen) {
          ambiguous = true;
        }
      }
      if (best && !ambiguous) shelf = best.shelf;
    }
  }

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
