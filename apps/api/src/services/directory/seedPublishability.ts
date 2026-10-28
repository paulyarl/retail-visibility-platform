/**
 * Seed publishability — the "enrich before publish" gate (spec §4.8).
 *
 * A directory seed earns a public, indexable `/place/{slug}` page only when
 * it carries copy that is not the NAP-derived template, a usable street
 * address, and a resolved category. The same predicate feeds three surfaces
 * so they cannot drift:
 *
 *   - `DirectoryPresenceSeedService.publishSeed` (the write gate)
 *   - the public sitemap producer (discovery)
 *   - the place page's `robots` metadata (indexation)
 *
 * The duplicate check is not in the SQL predicate: it needs a comparison
 * against the rest of the live seed set, so `getSeedPublishReadiness` runs it
 * separately at publish time. The sitemap already excludes suppressed
 * duplicates once cleanup resolves them.
 */

import { DISCLOSURE_SENTENCE } from './SeedSeoComposer';

export type SeedPublishabilityBlocker =
  | 'seed_suppressed'
  | 'missing_description'
  | 'template_description'
  | 'missing_address'
  | 'junk_address'
  | 'missing_category'
  | 'duplicate_seed';

export interface SeedPublishabilityFacts {
  status?: string | null;
  businessName?: string | null;
  description?: string | null;
  address?: string | null;
  category?: string | null;
}

export interface SeedPublishability {
  publishable: boolean;
  blockers: SeedPublishabilityBlocker[];
}

/** Template copy stays short: name + category + optional city/state + the
 *  disclosure. Narratives are longer, and a narrative that opens with the
 *  business name still carries more than one clause. */
const TEMPLATE_MAX_LENGTH = 220;

export function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * True when the description is only the deterministic composer template:
 *
 *   "Royal African Market LLC is a African Grocery Store. Listed on
 *    VisibleShelf from public information (address, phone)."
 *
 * The old composer appended an owner-directed claim CTA after the
 * disclosure; that variant is still template copy (and still thin), so the
 * disclosure check is deliberately a `includes`, not `endsWith`.
 */
export function isTemplateDescription(
  description: string | null | undefined,
  businessName: string | null | undefined,
  category: string | null | undefined,
): boolean {
  const d = normalizeWhitespace(description);
  const name = normalizeWhitespace(businessName);
  const cat = normalizeWhitespace(category);
  if (!d || !name) return false;
  if (d.length > TEMPLATE_MAX_LENGTH) return false;

  const lower = d.toLowerCase();
  if (!lower.includes(DISCLOSURE_SENTENCE.trim().toLowerCase())) return false;

  const prefix = `${name.toLowerCase()} is `;
  if (!lower.startsWith(prefix)) return false;
  // A missing category is itself a blocker; the short name + disclosure shape
  // is still enough to call the copy template.
  if (!cat) return true;
  return (
    lower.startsWith(`${prefix}a ${cat.toLowerCase()}`) ||
    lower.startsWith(`${prefix}an ${cat.toLowerCase()}`)
  );
}

/**
 * Addresses that cannot anchor a real listing page: placeholders from the
 * discovery scan, city-only values, or anything without a street number.
 * `"unverified (46208 Exa result, 5.0)"` is the canonical example.
 */
export function isJunkAddress(address: string | null | undefined): boolean {
  const a = normalizeWhitespace(address);
  if (!a) return true;
  if (!/\d/.test(a)) return true;
  return /(unverified|street not captured|exa result|search\)|\([^)]*county\))/i.test(a);
}

export function evaluateSeedPublishability(facts: SeedPublishabilityFacts): SeedPublishability {
  const blockers: SeedPublishabilityBlocker[] = [];

  if (facts.status === 'suppressed') blockers.push('seed_suppressed');

  const description = normalizeWhitespace(facts.description);
  if (!description) {
    blockers.push('missing_description');
  } else if (isTemplateDescription(description, facts.businessName, facts.category)) {
    blockers.push('template_description');
  }

  const address = normalizeWhitespace(facts.address);
  if (!address) {
    blockers.push('missing_address');
  } else if (isJunkAddress(address)) {
    blockers.push('junk_address');
  }

  const category = normalizeWhitespace(facts.category);
  if (!category || category.toLowerCase() === 'unknown') {
    blockers.push('missing_category');
  }

  return { publishable: blockers.length === 0, blockers };
}

/**
 * SQL mirror of `evaluateSeedPublishability` for the sitemap and the
 * consolidated listing read. Assumes the listing alias exposes
 * `description`, `business_name`, `address`, and the seed alias exposes
 * `category`. Keep the two implementations in lockstep — the unit tests pin
 * the JS side; the SQL is exercised by the sitemap contract tests.
 */
export function seedPublishableSql(listingAlias = 'dll', seedAlias = 'dps'): string {
  const l = listingAlias;
  const s = seedAlias;
  return `(
    ${l}.description IS NOT NULL
    AND btrim(${l}.description) <> ''
    AND ${s}.category IS NOT NULL
    AND btrim(${s}.category) <> ''
    AND lower(btrim(${s}.category)) <> 'unknown'
    AND ${l}.address IS NOT NULL
    AND ${l}.address ~ '[0-9]'
    AND ${l}.address !~* '(unverified|street not captured|exa result|search\\)|\\([^)]*county\\))'
    AND NOT (
      length(btrim(${l}.description)) <= ${TEMPLATE_MAX_LENGTH}
      AND (
        ${l}.description ILIKE (${l}.business_name || ' is a ' || ${s}.category || '%')
        OR ${l}.description ILIKE (${l}.business_name || ' is an ' || ${s}.category || '%')
      )
    )
  )`;
}
