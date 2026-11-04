/**
 * Seed slug-variant resolution — the `/place/{slug}` 404 recovery path.
 *
 * Dead /place slugs are almost always old spellings of a live seed: the bare
 * business name, the name plus a geo suffix ('…-indianapolis-in'), a legal
 * name ('…-llc'), or a stitched name-variant
 * ('…-llc-jokkymore-d-chef-food-services'). Google keeps recrawling those
 * URLs after a republish; a 308 to the live canonical slug is how the equity
 * comes home.
 *
 * A dead slug resolves ONLY when exactly one live seed can explain it —
 * zero matches stays 404, two or more stays 404 (a wrong 308 consolidates
 * equity onto the wrong business and is worse than no redirect).
 *
 * "Explains" is token-based. Each candidate contributes bases (slugified
 * business_name + name_variants) and an allowed-residual vocabulary (all
 * name tokens, city/state geo tokens incl. code⇄name expansion, legal-entity
 * tokens). The dead slug matches a base when:
 *
 *   - it equals the base ('jokkymore-african-market'), or
 *   - it covers every base token and the extras are all explainable
 *     (geo/legal/variant stitching, any order), or
 *   - its tokens are a ≥2-token subset of the base (a truncated old slug).
 *
 * The fetch prefilter is deliberately cheap — any ≥3-char slug token
 * appearing (case-insensitively) in the raw name or name_variants. The SQL
 * does NO normalization: tokens arrive already slug-clean, so a plain ILIKE
 * substring match is the entire recall layer — slugify lives only in JS.
 */

import { getDirectPool } from '../../utils/db-pool';
import { slugify } from '../../utils/slug';
import { expandStateSlugTokens } from '../../lib/usStateSlugTokens';

export interface SeedSlugCandidate {
  slug: string | null;
  businessName: string | null;
  nameVariants: string[];
  city: string | null;
  state: string | null;
}

/**
 * Public surfaces a dead slug can be rescued on:
 *   - place     → /place/{slug}     — unclaimed directory seeds
 *   - directory → /directory/{slug} — claimed listings (indexable storefronts)
 *   - tenant    → /tenant/{slug}    — path-tier storefronts
 * Each queries its OWN source table — no MVs; the live record is the truth.
 */
export type SlugSurface = 'place' | 'directory' | 'tenant';

export const SLUG_SURFACES: readonly SlugSurface[] = ['place', 'directory', 'tenant'];

/** Tokens old slugs legitimately carry that aren't name or geo. */
const GLUE_TOKENS = new Set([
  'llc', 'inc', 'co', 'ltd', 'corp', 'corporation', 'company', 'llp', 'lp',
  'dba', 'plc', 'group', 'enterprise', 'enterprises', 'holdings',
  'and', 'the', 'of',
]);

const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugTokens(slug: string): string[] {
  return slug.split('-').filter(Boolean);
}

function candidateCoversSlug(requested: string, c: SeedSlugCandidate): boolean {
  const bases = new Set<string>();
  const nameTokens = new Set<string>();
  const addBase = (name: string | null | undefined) => {
    const b = slugify(name ?? '');
    if (!b) return;
    bases.add(b);
    for (const t of slugTokens(b)) nameTokens.add(t);
  };
  addBase(c.businessName);
  for (const v of c.nameVariants ?? []) addBase(v);
  if (bases.size === 0) return false;

  if (bases.has(requested)) return true;

  const sToks = slugTokens(requested);
  const allowed = new Set<string>([
    ...nameTokens,
    ...slugTokens(slugify(c.city ?? '')),
    ...expandStateSlugTokens(c.state),
    ...GLUE_TOKENS,
  ]);

  for (const b of bases) {
    const bToks = slugTokens(b);
    const sExtra = sToks.filter((t) => !bToks.includes(t));
    // Dead slug = base + explainable residual (geo/legal/variant stitching).
    if (sExtra.length > 0 && bToks.every((t) => sToks.includes(t)) && sExtra.every((t) => allowed.has(t))) {
      return true;
    }
    // Dead slug is a truncated form of the name (≥2 tokens, all in the base).
    if (sToks.length >= 2 && sToks.length < bToks.length && sToks.every((t) => bToks.includes(t))) {
      return true;
    }
  }
  return false;
}

/**
 * The live seed slug a dead slug should 308 to, or null. `requestedSlug` must
 * already be normalized slug form; a candidate whose slug IS the request is
 * never returned (that would be a redirect loop, not a variant).
 */
export function matchSeedSlugVariant(
  requestedSlug: string,
  candidates: SeedSlugCandidate[],
): string | null {
  const s = requestedSlug.trim().toLowerCase();
  if (!SLUG_SHAPE.test(s)) return null;
  const hits = candidates.filter((c) => c.slug && c.slug !== s && candidateCoversSlug(s, c));
  return hits.length === 1 ? hits[0].slug! : null;
}

const CANDIDATE_LIMIT = 250;

const SURFACE_QUERIES: Record<SlugSurface, string> = {
  // /place — live published seeds; mirrors the places shelf filter exactly
  // (suppressed seeds never win a redirect).
  place: `SELECT dll.slug, dll.business_name, COALESCE(dps.name_variants, '{}') AS name_variants,
            dps.city, dps.state
       FROM directory_presence_seeds dps
       JOIN directory_listings_list dll ON dll.id = dps.listing_id
      WHERE dll.is_published = true
        AND dll.listing_origin = 'directory_seed'
        AND dps.status IN ('published', 'invited', 'claimed')
        AND dll.slug IS NOT NULL
        AND (
          dll.business_name ILIKE ANY($1::text[])
          OR EXISTS (
            SELECT 1 FROM unnest(dps.name_variants) v
             WHERE v ILIKE ANY($1::text[])
          )
        )
      LIMIT ${CANDIDATE_LIMIT}`,

  // /directory — claimed listings on the source table (formerly-seeded ones
  // keep their dps row → name_variants/geo still reachable).
  directory: `SELECT dll.slug, dll.business_name, COALESCE(dps.name_variants, '{}') AS name_variants,
            COALESCE(dll.city, dps.city) AS city, COALESCE(dll.state, dps.state) AS state
       FROM directory_listings_list dll
       LEFT JOIN directory_presence_seeds dps ON dps.listing_id = dll.id
      WHERE dll.is_published = true
        AND COALESCE(dll.listing_origin, 'claimed') <> 'directory_seed'
        AND dll.slug IS NOT NULL
        AND (
          dll.business_name ILIKE ANY($1::text[])
          OR EXISTS (
            SELECT 1 FROM unnest(dps.name_variants) v
             WHERE v ILIKE ANY($1::text[])
          )
        )
      LIMIT ${CANDIDATE_LIMIT}`,

  // /tenant — live tenants by slug/name on the tenants source table. Seed
  // tenants are excluded (their /tenant page is a noindex claim-preview, not
  // a storefront); hidden tenants never win a redirect. Formerly-seeded
  // tenants keep variant/geo recall via the dps join.
  tenant: `SELECT t.slug, t.name AS business_name, COALESCE(dps.name_variants, '{}') AS name_variants,
            dps.city, dps.state
       FROM tenants t
       LEFT JOIN directory_presence_seeds dps ON dps.tenant_id = t.id
      WHERE t.slug IS NOT NULL
        AND COALESCE(t.org_standing_mode, 'independent') <> 'directory_seed'
        AND COALESCE(t.directory_visible, true) = true
        AND (
          t.name ILIKE ANY($1::text[])
          OR EXISTS (
            SELECT 1 FROM unnest(dps.name_variants) v
             WHERE v ILIKE ANY($1::text[])
          )
        )
      LIMIT ${CANDIDATE_LIMIT}`,
};

/**
 * Live records on `surface` plausibly related to the dead slug — the
 * candidate set `matchSeedSlugVariant` disambiguates. Recall layer only:
 * ILIKE substring on raw name/variant text, precision stays in JS.
 */
export async function fetchLiveSlugCandidates(
  requestedSlug: string,
  surface: SlugSurface = 'place',
): Promise<SeedSlugCandidate[]> {
  const tokens = slugTokens(requestedSlug.trim().toLowerCase()).filter((t) => t.length >= 3);
  if (tokens.length === 0) return [];
  const patterns = tokens.map((t) => `%${t}%`);

  const pool = getDirectPool();
  const { rows } = await pool.query(SURFACE_QUERIES[surface], [patterns]);

  return rows.map((r: any) => ({
    slug: r.slug ?? null,
    businessName: r.business_name ?? null,
    nameVariants: Array.isArray(r.name_variants) ? r.name_variants : [],
    city: r.city ?? null,
    state: r.state ?? null,
  }));
}

/** @deprecated use fetchLiveSlugCandidates(requestedSlug, 'place') */
export const fetchLiveSeedSlugCandidates = (requestedSlug: string) =>
  fetchLiveSlugCandidates(requestedSlug, 'place');
