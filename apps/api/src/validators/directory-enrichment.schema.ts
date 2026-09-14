/**
 * Directory Enrichment Output Schemas
 *
 * Validates AI-produced enrichment packets for the directory_enrichment
 * campaign lane (docs/LocalBiz/DIRECTORY_ENRICHMENT_CAMPAIGNS_SPRINT_PLAN.md).
 *
 * Two task shapes:
 *   - category_enrichment: scope='category' campaigns → upserts a
 *     directory_category_enrichment row for (category, city, state), or the
 *     national ('__all__', '__all__') row when the campaign city is '__all__'.
 *   - location_enrichment: scope='city' campaigns → upserts the
 *     ('__location__', city, state) row.
 *
 * Used by:
 *   - The external-import endpoint (validates pasted JSON before storing
 *     an execution + audit, then auto-applies the packet).
 *   - The prompt suffix (appended to the enrichment templates' exported
 *     prompt text for external agents).
 *   - The post-run hook in MarketingExecutionService.executeSingle() and the
 *     post-import hook in MarketingPromptService.importExternalResult().
 *
 * Both schemas .passthrough() so forward-compatible fields don't fail import.
 */

import { z } from 'zod';

export const CATEGORY_ENRICHMENT_SCHEMA_NAME = 'category_enrichment';
export const LOCATION_ENRICHMENT_SCHEMA_NAME = 'location_enrichment';

/**
 * Accept a string[] OR a comma-separated string (LLMs frequently emit
 * "a, b, c" instead of a JSON array) and normalize to a trimmed,
 * non-empty string array.
 */
const stringArray = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return val;
  },
  z.array(z.string().min(1)),
);

const emptyToUndef = (v: unknown) => (v === '' || v === null ? undefined : v);

// ─── Shared sub-schemas ─────────────────────────────────────────────────

/**
 * FAQ entry — a single question/answer pair for the public page FAQ
 * section. Consumed by the page renderer (visible FAQ block) and by
 * FAQPage schema.org structured data.
 */
const faqEntrySchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
}).passthrough();

// ─── Category Enrichment Packet ─────────────────────────────────────────

export const categoryEnrichmentSchema = z.object({
  // Optional echoes — the campaign's category/city/state are authoritative;
  // these are validated when present but the applier ignores them for the
  // upsert key (campaign fields win, sentinel values included).
  category_key: z.string().min(1).optional(),
  category_name: z.string().min(1).optional(),

  // ── SEO packet (consumed by category page renderer) ──
  // Field names map to directory_category_enrichment columns.
  meta_title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  keywords: stringArray,
  secondary_categories: stringArray.optional(),
  schema_type_hint: z.preprocess(emptyToUndef, z.string().max(100).optional()),
  body_copy: z.preprocess(emptyToUndef, z.string().max(5000).optional()),

  // ── Category overview (consumed by category page "About this category" section) ──
  // Definitional: what this category IS, what businesses in it do, who they serve.
  // Distinct from body_copy (page intro) and shopper_guide (how to choose).
  category_overview: z.preprocess(emptyToUndef, z.string().max(5000).optional()),

  // ── Category hierarchy (consumed by category page breadcrumbs + drill-down + related) ──
  // Structural taxonomy — where this category sits in the category tree.
  super_categories: stringArray.optional(),    // breadcrumbs: Retail › Food › Grocery
  sub_categories: stringArray.optional(),       // drill-down: West African, Afro-Caribbean
  adjacent_categories: stringArray.optional(),  // siblings: Asian grocery, Latin American grocery

  // ── Shopper guidance (consumed by category page guidance section) ──
  // "What to look for" guidance — distinct from body_copy (intro copy).
  shopper_guide: z.preprocess(emptyToUndef, z.string().max(5000).optional()),

  // ── FAQ entries (consumed by category page FAQ section + FAQ schema) ──
  faq: z.array(faqEntrySchema).optional(),

  // ── Reusable category-in-market context (multiple consumers) ──
  // All context fields → seed/business audit.
  // category_profile → seed only (structural, no business/city names).
  context: z.object({
    category_summary: z.string().min(1),
    keywords: stringArray.optional(),
    secondary_categories: stringArray.optional(),
    category_notes: z.preprocess(emptyToUndef, z.string().max(5000).optional()),

    // ── Category profile (structural, no business/city names) ──
    // Qualitative + quantitative dimensions of the category as a business type.
    // Consumed by the seed to understand the business model.
    category_profile: z.object({
      // Qualitative dimensions
      business_model: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
      typical_products: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
      customer_base: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
      online_presence_pattern: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
      // Quantitative dimensions (qualitative descriptors, NOT specific numbers)
      competitive_landscape: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
      typical_scale: z.preprocess(emptyToUndef, z.string().max(1000).optional()),
    }).passthrough().optional(),

    // ── Category signals (what strong looks like, category-scope) ──
    // Lighter than gold standard — category-level patterns, not platform-by-platform.
    category_signals: stringArray.optional(),

    // ── Market density (qualitative, this city) ──
    market_density: z.preprocess(emptyToUndef, z.string().max(1000).optional()),

    // ── Prospect signals (what to look for when prospecting) ──
    prospect_signals: stringArray.optional(),
  }).passthrough().optional(),
}).passthrough();

export type CategoryEnrichmentOutput = z.infer<typeof categoryEnrichmentSchema>;

// ─── Location Enrichment Packet ─────────────────────────────────────────

export const locationEnrichmentSchema = z.object({
  // Optional echoes — campaign city/state are authoritative for the upsert key.
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  location_name: z.string().min(1).optional(),

  // ── SEO packet (consumed by location page renderer) ──
  meta_title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  keywords: stringArray,
  secondary_categories: stringArray.optional(),
  schema_type_hint: z.preprocess(emptyToUndef, z.string().max(100).optional()),
  body_copy: z.preprocess(emptyToUndef, z.string().max(5000).optional()),

  // AI-suggested top categories for the location. Per the merge contract,
  // this field is AI-only — there is no aggregate equivalent — and is used
  // to describe the location's strongest categories when non-empty.
  top_categories: stringArray.optional(),

  // ── Shopper guidance (consumed by location page guidance section) ──
  // "What to look for" guidance — distinct from body_copy (intro copy).
  shopper_guide: z.preprocess(emptyToUndef, z.string().max(5000).optional()),

  // ── FAQ entries (consumed by location page FAQ section + FAQ schema) ──
  faq: z.array(faqEntrySchema).optional(),

  // ── Structured area breakdown ──
  // Consumed by location page "Browse by Area" section + downstream
  // category enrichments (geographic context for where categories concentrate).
  area_breakdown: z.array(
    z.object({
      area_name: z.string().min(1),
      description: z.string().min(1),
      strong_categories: stringArray.optional(),
    }).passthrough(),
  ).optional(),

  // ── Reusable city market context (multiple consumers) ──
  // Place-specific fields (market_summary, notable_areas, area_breakdown,
  // market_gaps, metro_dynamics) → seed only.
  // Structural field (city_profile) → category enrichment + seed.
  context: z.object({
    market_summary: z.string().min(1),
    top_categories: stringArray.optional(),
    secondary_categories: stringArray.optional(),
    keywords: stringArray.optional(),
    notable_areas: stringArray.optional(),
    market_notes: z.preprocess(emptyToUndef, z.string().max(5000).optional()),

    // ── City profile (structural, no place names) ──
    // Shared with category enrichment to ground category copy in the city's
    // structural characteristics WITHOUT bleeding place-specific sentiment.
    // No named areas, corridors, or neighborhoods — those stay seed-only.
    city_profile: z.object({
      metro_description: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
      major_industries: stringArray.optional(),
      growth_trajectory: z.preprocess(emptyToUndef, z.string().max(1000).optional()),
      demographic_character: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
      market_character: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
    }).passthrough().optional(),

    // ── Market gaps (analyst-facing, consumed by prospecting) ──
    // Categories with unmet demand in this city — what to prospect first.
    market_gaps: z.array(
      z.object({
        category: z.string().min(1),
        signal: z.string().min(1),
        area: z.preprocess(emptyToUndef, z.string().max(500).optional()),
      }).passthrough(),
    ).optional(),

    // ── Metro context (shopper-facing, rendered on location page) ──
    // Where this city sits in its metro area — helps shoppers understand
    // the broader area and where else to look.
    metro_context: z.preprocess(emptyToUndef, z.string().max(5000).optional()),

    // ── Metro dynamics (analyst-facing, consumed by the seed) ──
    // Nearby cities with their character, business scene, and dynamics.
    metro_dynamics: z.array(
      z.object({
        city: z.string().min(1),
        state: z.preprocess(emptyToUndef, z.string().max(10).optional()),
        relationship: z.string().min(1),
        character: z.string().min(1),
        business_scene: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
        notes: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
      }).passthrough(),
    ).optional(),
  }).passthrough().optional(),
}).passthrough();

export type LocationEnrichmentOutput = z.infer<typeof locationEnrichmentSchema>;

// ─── Prompt suffixes (appended to exported prompt text) ─────────────────

export const CATEGORY_ENRICHMENT_PROMPT_SUFFIX = `

Return your response as JSON matching this exact schema:
{
  "category_key": "<normalized category key, lowercase, spaces replaced with underscores, e.g. 'african_grocery'>",
  "category_name": "<display name>",
  "meta_title": "<SEO title, <= 70 chars — category + city + state for market pages; category only for national ('__all__')>",
  "description": "<meta description, <= 300 chars, browse-oriented local-SEO copy>",
  "keywords": ["<keyword>", ...],
  "secondary_categories": ["<closely related category a shopper might also browse>", ...],
  "schema_type_hint": "<schema.org type hint, e.g. CollectionPage>",
  "body_copy": "<1-2 short paragraphs of visible on-page copy for the category page top>",
  "category_overview": "<1-2 paragraphs: what this category IS — what businesses in it do, who they serve, definitional. For shoppers who don't know the category>",
  "super_categories": ["<containing category>", ...],
  "sub_categories": ["<specialization within this category>", ...],
  "adjacent_categories": ["<sibling category at same level>", ...],
  "shopper_guide": "<1-2 paragraphs of 'what to look for' guidance for shoppers browsing this category>",
  "faq": [
    {"question": "<question>", "answer": "<answer>"},
    ...
  ],
  "context": {
    "category_summary": "<analyst-facing summary of this category in this market>",
    "keywords": ["<category-level search term>", ...],
    "secondary_categories": ["<same set as top-level secondary_categories>", ...],
    "category_notes": "<optional free-text notes for downstream work>",
    "category_profile": {
      "business_model": "<qualitative: e.g. 'typically independent, family-owned, single-location'>",
      "typical_products": "<qualitative: e.g. 'pantry staples, fresh produce, frozen foods, spices'>",
      "customer_base": "<qualitative: e.g. 'diaspora communities, cuisine explorers, restaurants'>",
      "online_presence_pattern": "<qualitative: e.g. 'varies widely — many rely on Google/Yelp only'>",
      "competitive_landscape": "<qualitative: e.g. 'sparse in most US cities, concentrated in metro areas with large diaspora'>",
      "typical_scale": "<qualitative: e.g. 'single-location, small team'>"
    },
    "category_signals": ["<signal that indicates a strong business in this category>", ...],
    "market_density": "<qualitative density in this city: e.g. 'sparse — few dedicated stores'>",
    "prospect_signals": ["<signal to look for when prospecting businesses in this category>", ...]
  }
}

Return ONLY the JSON object, no markdown fences, no commentary.`;

export const LOCATION_ENRICHMENT_PROMPT_SUFFIX = `

Return your response as JSON matching this exact schema:
{
  "city": "<city name>",
  "state": "<2-letter state code>",
  "location_name": "<display name, e.g. 'Columbus, OH'>",
  "meta_title": "<SEO title, <= 70 chars>",
  "description": "<meta description, <= 300 chars, local-SEO copy for the location page>",
  "keywords": ["<keyword>", ...],
  "secondary_categories": ["<category strong in this location>", ...],
  "schema_type_hint": "<schema.org type hint, e.g. WebPage>",
  "top_categories": ["<category>", ...],
  "body_copy": "<1-2 short paragraphs of visible on-page copy for the location page top>",
  "shopper_guide": "<1-2 paragraphs of 'what to look for' guidance for shoppers browsing businesses in this city>",
  "faq": [
    {"question": "<question>", "answer": "<answer>"},
    ...
  ],
  "area_breakdown": [
    {"area_name": "<name>", "description": "<what this area is known for>", "strong_categories": ["<category>", ...]},
    ...
  ],
  "context": {
    "market_summary": "<analyst-facing summary of this city's business landscape>",
    "top_categories": ["<category>", ...],
    "secondary_categories": ["<category>", ...],
    "keywords": ["<city-level search term>", ...],
    "notable_areas": ["<named area or corridor>", ...],
    "market_notes": "<optional free-text notes for downstream work>",
    "city_profile": {
      "metro_description": "<qualitative: e.g. 'major Midwest metro, state capital'>",
      "major_industries": ["<industry>", ...],
      "growth_trajectory": "<qualitative: e.g. 'growing tech and logistics sector'>",
      "demographic_character": "<qualitative: e.g. 'diverse, large immigrant communities'>",
      "market_character": "<1-2 sentences: overall business market character>"
    },
    "market_gaps": [
      {"category": "<category with unmet demand>", "signal": "<why this is a gap>", "area": "<optional area>"},
      ...
    ],
    "metro_context": "<shopper-facing: where this city sits in its metro area, what suburbs surround it, where shoppers might also look>",
    "metro_dynamics": [
      {"city": "<nearby city>", "state": "<2-letter state>", "relationship": "<e.g. northern suburb>", "character": "<e.g. affluent, fast-growing>", "business_scene": "<optional: dominant business types>", "notes": "<optional: income, growth, demographics>"},
      ...
    ]
  }
}

Return ONLY the JSON object, no markdown fences, no commentary.`;
