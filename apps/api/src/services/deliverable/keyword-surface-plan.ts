/**
 * Keyword Surface Plan — route a business's real-world identity tokens to the
 * profile fields that legitimately carry them.
 *
 * The class this serves: multi-name / immigrant-owned storefronts whose
 * identity does not fit a single name field. Their workaround is a second
 * (duplicate) Google profile with a keyword-bearing name — a policy violation
 * that splits reviews and risks suspension. The owner's instinct is right (the
 * tokens matter); the tool is wrong (the name field is the one place they
 * cannot go). This plan names the observed tokens and maps each to a field
 * designed for it — categories, services, products, description, attributes.
 *
 * Pure over its inputs: deterministic extraction only, no inference. The
 * analyst hop (KEYWORD_SURFACE_PLAN_PROMPT) writes the prose.
 *
 * See: AGENTS.md "Keyword surface plan (A8)".
 */

/**
 * Structural noise, not identity tokens. Note "merkato" is deliberately NOT
 * here — it is a distinctive trade term (Addis Ababa's market), not a generic
 * category word like "store"/"mart".
 */
const TOKEN_STOPWORDS = new Set([
  'llc', 'inc', 'co', 'corp', 'ltd', 'company', 'the', 'and', 'of', 'a', 'an',
  'store', 'shop', 'mart', 'market',
]);

export interface ObservedAttribute {
  platform?: string;
  key?: string | null;
  label?: string | null;
}

export interface AlternateProfileRef {
  platform?: string | null;
  name?: string | null;
}

export interface KeywordSurfaceInput {
  businessName?: string | null;
  category?: string | null;
  secondaryCategories?: string[];
  /** `nap_consistency.name_variations` — names the audit observed elsewhere. */
  nameVariations?: string[];
  /** `platforms.*.displayed_name` — the name each profile actually renders. */
  platformDisplayedNames?: string[];
  /** `platforms.google.additional_categories`. */
  additionalCategories?: string[];
  observedAttributes?: ObservedAttribute[];
  /** `website.product_categories_visible`. */
  productCategories?: string[];
  /** A second live listing for the same business (audit `alternate_profiles[]`). */
  alternateProfiles?: AlternateProfileRef[];
  hasDuplicateListing?: boolean;
}

export type KeywordPlacementField =
  | 'name'
  | 'categories'
  | 'services'
  | 'products'
  | 'description'
  | 'attributes';

export interface KeywordPlacement {
  field: KeywordPlacementField;
  label: string;
  tokens: string[];
  guidance: string;
}

export interface KeywordSurfacePlan {
  canonicalName: string | null;
  /** Every observed real-world name except the canonical one, deduped. */
  alternateNames: string[];
  /** Identity tokens extracted from the observed names + category vocabulary. */
  tokens: string[];
  placements: KeywordPlacement[];
  hasDuplicateListing: boolean;
  /** Names carried by a second live listing, when one was observed. */
  alternateProfileNames: string[];
}

const dedupe = (xs: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const v = (x ?? '').trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
};

/**
 * Split names into lowercased identity tokens, dropping structural noise and
 * numeric fragments. First-seen order is preserved.
 */
export function extractIdentityTokens(names: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    if (!name) continue;
    for (const raw of String(name).toLowerCase().split(/[^a-z0-9]+/)) {
      if (!raw || raw.length < 2) continue;
      if (/^\d+$/.test(raw)) continue;
      if (TOKEN_STOPWORDS.has(raw)) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      out.push(raw);
    }
  }
  return out;
}

export function buildKeywordSurfacePlan(input: KeywordSurfaceInput): KeywordSurfacePlan {
  const canonicalName = (input.businessName ?? '').trim() || null;
  const alternateProfileNames = dedupe((input.alternateProfiles ?? []).map((p) => p.name));

  const observedNames = dedupe([
    ...(input.nameVariations ?? []),
    ...(input.platformDisplayedNames ?? []),
    ...alternateProfileNames,
  ]);
  const alternateNames = observedNames.filter(
    (n) => n.toLowerCase() !== (canonicalName ?? '').toLowerCase(),
  );

  const categoryTokens = dedupe([
    input.category,
    ...(input.secondaryCategories ?? []),
    ...(input.additionalCategories ?? []),
  ]);

  const tokens = extractIdentityTokens([
    canonicalName,
    ...observedNames,
    ...categoryTokens,
  ]);

  const attributeLabels = dedupe((input.observedAttributes ?? []).map((a) => a.label));
  const productTerms = dedupe(input.productCategories ?? []);

  const placements: KeywordPlacement[] = [
    {
      field: 'name',
      label: 'Business name',
      tokens: canonicalName ? [canonicalName] : [],
      guidance:
        'Keep the real-world name only. Never add category or location words to a name to win search — that is the guideline a second listing breaks, and it is the one field where the tokens must not go.',
    },
    {
      field: 'categories',
      label: 'Primary + additional categories',
      tokens: categoryTokens,
      guidance:
        'One primary category plus every additional category the business genuinely serves. Shelf and specialty tokens live here.',
    },
    {
      field: 'services',
      label: 'Services / service menu',
      tokens,
      guidance:
        'Turn each identity token into a named service or menu entry — a specialty, a language served, a cut or preparation offered. Services are indexed and searchable.',
    },
    {
      field: 'products',
      label: 'Products',
      tokens: productTerms.length ? productTerms : tokens,
      guidance:
        'List the actual products under their real names. Product names are indexed and answer specific searches.',
    },
    {
      field: 'description',
      label: 'Business description',
      tokens,
      guidance:
        "Write the description in the owner's own words, naming the community, the specialties, and the languages served.",
    },
    {
      field: 'attributes',
      label: 'Attributes',
      tokens: attributeLabels,
      guidance:
        'Set every true attribute — payment methods, fulfillment, accessibility. Each one is a filter a customer can search by.',
    },
  ];

  return {
    canonicalName,
    alternateNames,
    tokens,
    placements,
    hasDuplicateListing: Boolean(input.hasDuplicateListing),
    alternateProfileNames,
  };
}

/**
 * Render the placements as the multi-line block the analyst prompt consumes:
 * `Field — token, token — guidance`.
 */
export function formatKeywordPlacements(plan: KeywordSurfacePlan): string {
  return plan.placements
    .map((p) => {
      const tokens = p.tokens.length ? p.tokens.join(', ') : '(none observed)';
      return `- ${p.label}: ${tokens}\n    ${p.guidance}`;
    })
    .join('\n');
}

/** The duplicate-listing context line, or '' when none was observed. */
export function formatDuplicateListingNote(plan: KeywordSurfacePlan): string {
  if (!plan.hasDuplicateListing) return '';
  const names = plan.alternateProfileNames.length
    ? plan.alternateProfileNames.join(', ')
    : plan.alternateNames.join(', ');
  return (
    'A second live listing for this business was observed'
    + (names ? ` (${names})` : '')
    + '. That second listing is almost always an attempt to get keyword-bearing '
    + 'names into search — the instinct is right, the tool is wrong. This plan is '
    + 'the legal version of what that listing was trying to do: one profile, every '
    + 'token, in the fields designed to carry them.'
  );
}
