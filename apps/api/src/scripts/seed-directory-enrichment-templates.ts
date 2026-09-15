/**
 * Seed script: Directory Enrichment Directive Templates
 *
 * Seeds the two task-optimized directive prompts for the
 * directory_enrichment campaign lane
 * (docs/LocalBiz/DIRECTORY_ENRICHMENT_CAMPAIGNS_SPRINT_PLAN.md):
 *
 *   - Category Market Enrichment (scope='category',
 *     output_schema='category_enrichment') — produces the SEO packet for a
 *     category market row, or a national ('__all__') packet when the
 *     campaign city is the '__all__' sentinel.
 *   - Location Market Enrichment (scope='city',
 *     output_schema='location_enrichment') — produces the SEO packet for the
 *     ('__location__', city, state) row.
 *
 * Both support dual execution: internal AI run via /prompts/executions, or
 * copy-paste to an external AI and import via /prompts/executions/external.
 * Validated output auto-applies to directory_category_enrichment.
 *
 * Idempotent — deterministic IDs + SEED_VERSION_MARKER presence check.
 * Re-run against both local and prd Doppler configs after editing.
 *
 * Usage (from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/seed-directory-enrichment-templates.ts
 *   doppler run --config prd  -- npx tsx src/scripts/seed-directory-enrichment-templates.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';
import {
  CATEGORY_ENRICHMENT_SCHEMA_NAME,
  LOCATION_ENRICHMENT_SCHEMA_NAME,
  CATEGORY_SET_ENRICHMENT_SCHEMA_NAME,
} from '../validators/directory-enrichment.schema';

// Bump this marker when the template bodies change — the seed checks for the
// marker's presence in the stored body, not the absence of an old section
// (AGENTS.md idempotency discipline).
const SEED_VERSION_MARKER = 'ENRICHMENT_DIRECTIVE_V11';

const CATEGORY_TEMPLATE = {
  id: 'mpt-category-enrichment-default',
  name: 'Enrichment: Category Market SEO',
  promptType: 'enrichment' as const,
  scope: 'category' as const,
  body: `<!-- ${SEED_VERSION_MARKER} -->
You are a local-SEO copywriter producing a directory enrichment packet for a business-category page on VisibleShelf, a public directory of local businesses.

CATEGORY: {{category}}
CITY: {{city}}
STATE: {{state}}

=== OBJECTIVE ===
Produce the SEO + content packet that will power the public category page for this category in this market.

If CITY is "__all__", this is a NATIONAL category page — write city-agnostic copy (no city name in the title, description, or body copy; describe the category and what shoppers should look for). Otherwise, write market-scoped copy for {{city}}, {{state}}.

=== TONE ===
Uniform platform voice — the same register used on every public surface (business listings, category pages, location pages): warm and professional, like a knowledgeable local speaking to a neighbor. Welcoming and plain-spoken, never casual or promotional: no exclamation marks, no superlatives, no sales calls to action. The platform writes about categories and places from public information — never as or for a business. Applies to every shopper-facing field: description, body_copy, category_overview, shopper_guide, faq.

=== WHAT GOOD LOOKS LIKE ===
- meta_title: <= 70 chars. Pattern: "{Category} in {City}, {ST} — VisibleShelf Places" for market pages; "{Category} — VisibleShelf Places" for national. Front-load the category noun.
- description: <= 300 chars meta description. Browse-oriented: who is listed, that listings come from public information, and 1-2 related terms shoppers search.
- keywords: 8-15 search terms — the category name, synonyms, "near me" variants, related product/service terms. No keyword stuffing, no competitor brand names.
- secondary_categories: 3-6 closely related category names relevant in this market that a shopper might also browse (real categories, not invented niches).
- schema_type_hint: the schema.org type that best fits the page — typically "CollectionPage" for a category listing page.
- body_copy: 1-2 short paragraphs (<= 5000 chars total) of visible on-page copy for the top of the category page — what shoppers find on this page and how listings are sourced. Warm and factual, per the TONE section. Definitional "what is this category" content belongs in category_overview, not here.
- category_overview: 1-2 paragraphs (<= 5000 chars) of definitional content — what this category IS, what businesses in it do, who they serve. For shoppers who don't know the category (e.g. "African grocery stores sell pantry staples, fresh produce, frozen foods, and specialty products from African countries"). Distinct from body_copy (page intro) and shopper_guide (how to choose). This is "what is this category."
- super_categories: 2-4 containing categories that this one belongs to (e.g. "grocery stores", "food retail", "retail"). Used for breadcrumbs on the category page.
- sub_categories: 2-6 specializations within this category (e.g. "West African grocery", "Afro-Caribbean grocery", "pan-African grocery"). Used for drill-down on the category page. Return an empty array if the category has no meaningful sub-specializations.
- adjacent_categories: 2-5 sibling categories at the same taxonomy level (e.g. "Asian grocery store", "Latin American grocery store", "Middle Eastern grocery store"). Used for "Related categories" on the category page.
- shopper_guide: 1-2 short paragraphs (<= 5000 chars) of shopper guidance — what to look for when browsing businesses in this category, what makes a listing worth visiting, what to check (hours, website, product scope, reviews). Warm, helpful, per the TONE section. Distinct from body_copy (which is intro copy); this is "how to choose" guidance.
- faq: 3-6 question/answer pairs shoppers might have about this category. Each answer 1-3 sentences, warm and factual, per the TONE section. Used for an FAQ section + FAQ schema on the page.

=== REUSABLE CONTEXT (multiple consumers) ===
Produce a context object consumed by business audit campaigns (the seed) for category-specific market awareness. All context fields → seed only. This context does NOT bleed onto the location surface.

- context.category_summary: 1-2 paragraphs describing what this category looks like in this market — market size, competitive density, notable patterns, community context. For national ('__all__') campaigns, describe the category's national landscape.
- context.keywords: category-level search terms for downstream use — exclude "near me" variants and page-level phrasing from the SEO keywords.
- context.secondary_categories: the same set as the SEO packet's secondary_categories, for downstream use.
- context.category_notes: optional free-text notes useful for downstream work (e.g. "strong in immigrant communities on the north side", "limited to a handful of independent stores").
- context.category_profile: STRUCTURAL category characteristics (NO business names, NO city names). Qualitative + quantitative dimensions of the category as a business type. Fields: { business_model (qualitative: e.g. "typically independent, family-owned, single-location"), typical_products (qualitative: what they sell), customer_base (qualitative: who they serve), online_presence_pattern (qualitative: e.g. "varies widely — many rely on Google/Yelp only"), competitive_landscape (qualitative: e.g. "sparse in most US cities, concentrated in metro areas with large diaspora"), typical_scale (qualitative: e.g. "single-location, small team") }. Use qualitative descriptors, NOT specific revenue figures or employee counts.
- context.category_signals: 3-6 signals that indicate a strong business in this category — category-scope patterns, not platform-by-platform checklists (e.g. "published hours with daily coverage", "clear category positioning", "community presence"). Lighter than a gold standard; helps the seed audit know what to look for.
- context.market_density: qualitative density assessment for this category in this city (e.g. "sparse — few dedicated stores", "moderate — several established businesses", "dense — competitive market"). For national campaigns, describe the category's typical density across US cities. Use qualitative descriptors, NOT specific counts.
- context.prospect_signals: 3-5 signals to look for when prospecting businesses in this category (e.g. "businesses with 'international grocery' in their Google category", "businesses near existing international markets", "businesses with incomplete online presence — high opportunity"). Helps prospecting queue prioritization.

=== RULES ===
- Write for shoppers, not operators. No internal jargon, no "campaign", no "enrichment".
- Do NOT invent business counts, ratings, or specific business names.
- Do NOT include claims about business quality ("best", "top-rated") — the directory lists from public information.
- Category name in copy should use natural casing (e.g. "African grocery stores").
- You may draw on general knowledge about this category and market. Do not fabricate specific business names, counts, or ratings. If you are genuinely uncertain whether a category is strong in this market, omit it rather than guess.

=== OUTPUT REQUIREMENT ===
Respond with a SINGLE JSON object only. No markdown fences, no commentary.`,
  variables: ['category', 'city', 'state'],
  outputSchema: {
    name: CATEGORY_ENRICHMENT_SCHEMA_NAME,
    description: 'Category market enrichment packet — meta title, description, keywords, secondary categories, schema type hint, visible body copy.',
  },
  isDefault: true,
};

const LOCATION_TEMPLATE = {
  id: 'mpt-location-enrichment-default',
  name: 'Enrichment: Location Market SEO',
  promptType: 'enrichment' as const,
  scope: 'city' as const,
  body: `<!-- ${SEED_VERSION_MARKER} -->
You are a local-SEO copywriter producing a directory enrichment packet for a location (city) page on VisibleShelf, a public directory of local businesses.

CITY: {{city}}
STATE: {{state}}

=== OBJECTIVE ===
Produce the SEO + content packet that will power the public location page for {{city}}, {{state}} — a page that aggregates all published business listings in this city across categories.

=== TONE ===
Uniform platform voice — the same register used on every public surface (business listings, category pages, location pages): warm and professional, like a knowledgeable local speaking to a neighbor. Welcoming and plain-spoken, never casual or promotional: no exclamation marks, no superlatives, no sales calls to action. The platform writes about places and businesses from public information — never as or for a business. Applies to every shopper-facing field: description, body_copy, shopper_guide, faq, area_breakdown, context.metro_context.

=== WHAT GOOD LOOKS LIKE ===
- meta_title: <= 70 chars. Pattern: "Local Businesses in {City}, {ST} — VisibleShelf Directory". Front-load the place.
- description: <= 300 chars meta description. What the page offers: a browsable index of local businesses in the city, listed from public information.
- keywords: 8-15 search terms — "{city} businesses", "local shops {city}", categories likely strong in this market, "near me" variants. No keyword stuffing.
- secondary_categories: 3-6 category names likely to be strong in this location's business mix (generic, e.g. "restaurants", "grocery stores").
- top_categories: 3-8 category names most representative of this city's business landscape — used to describe what the location is known for. Prefer real, common categories over invented niches.
- schema_type_hint: usually "WebPage".
- body_copy: 1-2 short paragraphs (<= 5000 chars total) of visible on-page copy for the top of the location page — what the city's local business scene looks like, how listings are sourced, what shoppers can browse. Warm and factual, per the TONE section.
- shopper_guide: 1-2 short paragraphs (<= 5000 chars) of shopper guidance — what to look for when browsing businesses in this city, how to find what you need, any city-specific shopping context. Distinct from body_copy (which is intro copy); this is "how to browse" guidance.
- faq: 3-6 question/answer pairs shoppers might have about businesses in this city. Each answer 1-3 sentences, warm and factual, per the TONE section. Used for an FAQ section + FAQ schema on the page.
- area_breakdown: 3-6 named areas, corridors, or neighborhoods in this city with a short description and the categories strong there. Used for a "Browse by Area" section on the page.

=== REUSABLE CONTEXT (multiple consumers) ===
Produce a context object with multiple consumers:
- Business audit campaigns (the seed) consume ALL context fields for market awareness.
- Category enrichment campaigns consume context.city_profile ONLY (structural city characteristics, no place names) to ground category copy in the city's market without bleeding place-specific sentiment.
- The location page renders context.metro_context as a shopper-facing "Metro Area" section.
Place-specific fields (market_summary, notable_areas, market_gaps, metro_dynamics) do NOT bleed onto the category surface — only city_profile is shared.

- context.market_summary: 1-2 paragraphs describing this city's business landscape — major industries, well-known commercial districts, categories the city is known for, community and cultural context that shapes the local market.
- context.top_categories: 3-8 representative categories (same set as the SEO packet's top_categories).
- context.secondary_categories: supporting categories for downstream use.
- context.keywords: city-level search terms for downstream use.
- context.notable_areas: named areas (simplified list — the structured area_breakdown is the page-rendered version).
- context.market_notes: optional free-text notes useful for downstream work (e.g. "strong tech corridor on the north side", "large immigrant communities drive specialty grocery demand").
- context.city_profile: STRUCTURAL city characteristics (NO place names — no neighborhoods, corridors, or districts). This is shared with category enrichment to ground category copy in the city's market. Fields: { metro_description (qualitative, e.g. "major Midwest metro, state capital"), major_industries (string[]), growth_trajectory (qualitative, e.g. "growing tech and logistics sector"), demographic_character (qualitative, e.g. "diverse, large immigrant communities"), market_character (1-2 sentences: overall business market character) }. Use qualitative descriptors, NOT specific population counts or income figures.
- context.market_gaps: 2-5 categories with unmet demand in this city — what to prospect first. Each entry: { category, signal, area }. The signal explains why this is a gap (e.g. "large West African community, few dedicated stores"). The area is optional (e.g. "south side"). Use general knowledge — do not fabricate counts or specific business names.
- context.metro_context: 1-2 paragraphs (shopper-facing) describing where this city sits in its metro area — surrounding suburbs, how they relate, where shoppers might also look. Helps shoppers understand the broader area. Warm and factual, per the TONE section.
- context.metro_dynamics: 2-6 nearby cities/suburbs with their character and dynamics. Each entry: { city, state, relationship, character, business_scene, notes }. Use qualitative descriptors (e.g. "affluent", "fast-growing"), NOT specific income figures or population counts. relationship = how it relates to this city (e.g. "northern suburb"). character = overall feel (e.g. "affluent planned community"). business_scene = dominant business types (optional). notes = income level, growth, demographics (optional).

=== RULES ===
- Write for shoppers, not operators. No internal jargon, no "campaign", no "enrichment".
- Do NOT invent business counts, ratings, or specific business names — the page renders real aggregates separately.
- Do NOT include claims about business quality ("best", "top-rated").
- You may draw on general knowledge about this city's business landscape — major industries, well-known commercial districts, categories the city is known for. Do not fabricate specific business names, counts, or ratings. If you are genuinely uncertain whether a category is strong in this city, omit it rather than guess.

=== OUTPUT REQUIREMENT ===
Respond with a SINGLE JSON object only. No markdown fences, no commentary.`,
  variables: ['city', 'state'],
  outputSchema: {
    name: LOCATION_ENRICHMENT_SCHEMA_NAME,
    description: 'Location market enrichment packet — meta title, description, keywords, secondary/top categories, schema type hint, visible body copy.',
  },
  isDefault: true,
};

// Category Set Enrichment — the PG shelf sweep lane. A proving-ground
// "Enrich shelves" sweep fills every uncovered market it can deterministically
// (enrichMarket when a profile exists) and spawns ONE child campaign carrying
// the residual no-profile set in discovery_context.shelf_sweep.markets. This
// template renders that set via {{markets}} (auto-sourced from the sweep
// payload; falls back to a single-market instruction when absent) and returns
// one category_enrichment-shaped packet per market — each entry carries its
// own category_name/city/state, which route the apply loop.
const CATEGORY_SET_TEMPLATE = {
  id: 'mpt-category-set-enrichment-default',
  name: 'Enrichment: Category Set Market SEO',
  promptType: 'enrichment' as const,
  scope: 'category' as const,
  body: `<!-- ${SEED_VERSION_MARKER} -->
You are a local-SEO copywriter producing directory enrichment packets for business-category pages on VisibleShelf, a public directory of local businesses.

ANCHOR CATEGORY: {{category}}
ANCHOR MARKET: {{city}}, {{state}}

=== MARKETS TO ENRICH ===
Produce one packet for EACH market below (same order). Every packet powers the public category page for that category in that city.
{{markets}}

If the list above says there is no sweep set, produce a single packet for the anchor market (ANCHOR CATEGORY in ANCHOR MARKET).

=== OBJECTIVE ===
For each market, produce the SEO + content packet that will power the public category page for that category in that market. Each market is independent — copy must be specific to that category in that city, never templated boilerplate repeated across entries.

=== TONE ===
Uniform platform voice — the same register used on every public surface (business listings, category pages, location pages): warm and professional, like a knowledgeable local speaking to a neighbor. Welcoming and plain-spoken, never casual or promotional: no exclamation marks, no superlatives, no sales calls to action. The platform writes about categories and places from public information — never as or for a business. Applies to every shopper-facing field: description, body_copy, category_overview, shopper_guide, faq.

=== WHAT GOOD LOOKS LIKE (per market entry) ===
- category_name / city / state: echo the market exactly as listed under MARKETS TO ENRICH — these route the packet to that market's public page.
- meta_title: <= 70 chars. Pattern: "{Category} in {City}, {ST} — VisibleShelf Places". Front-load the category noun.
- description: <= 300 chars meta description. Browse-oriented: who is listed, that listings come from public information, and 1-2 related terms shoppers search.
- keywords: 8-15 search terms — the category name, synonyms, "near me" variants, related product/service terms. No keyword stuffing, no competitor brand names.
- secondary_categories: 3-6 closely related category names relevant in this market that a shopper might also browse (real categories, not invented niches).
- schema_type_hint: the schema.org type that best fits the page — typically "CollectionPage" for a category listing page.
- body_copy: 1-2 short paragraphs (<= 5000 chars total) of visible on-page copy for the top of the category page — what shoppers find on this page and how listings are sourced. Warm and factual, per the TONE section. Definitional "what is this category" content belongs in category_overview, not here.
- category_overview: 1-2 paragraphs (<= 5000 chars) of definitional content — what this category IS, what businesses in it do, who they serve. Distinct from body_copy (page intro) and shopper_guide (how to choose).
- super_categories: 2-4 containing categories (e.g. "grocery stores", "food retail", "retail"). Used for breadcrumbs.
- sub_categories: 2-6 specializations within this category (e.g. "West African grocery", "Afro-Caribbean grocery"). Return an empty array if none are meaningful.
- adjacent_categories: 2-5 sibling categories at the same taxonomy level. Used for "Related categories".
- shopper_guide: 1-2 short paragraphs (<= 5000 chars) of shopper guidance — what to look for when browsing businesses in this category, what makes a listing worth visiting, what to check (hours, website, product scope, reviews). Distinct from body_copy; this is "how to choose" guidance.
- faq: 3-6 question/answer pairs shoppers might have about this category. Each answer 1-3 sentences, warm and factual. Used for an FAQ section + FAQ schema.

=== REUSABLE CONTEXT (per market entry, multiple consumers) ===
Each market entry's context object is consumed by business audit campaigns (the seed) for category-specific market awareness. All context fields → seed only.

- context.category_summary: 1-2 paragraphs describing what this category looks like in this market — market size, competitive density, notable patterns, community context.
- context.keywords: category-level search terms for downstream use — exclude "near me" variants and page-level phrasing from the SEO keywords.
- context.secondary_categories: the same set as the packet's secondary_categories, for downstream use.
- context.category_notes: optional free-text notes useful for downstream work.
- context.category_profile: STRUCTURAL category characteristics (NO business names, NO city names). Fields: { business_model, typical_products, customer_base, online_presence_pattern, competitive_landscape, typical_scale } — all qualitative descriptors, NOT specific revenue figures or employee counts.
- context.category_signals: 3-6 signals that indicate a strong business in this category — category-scope patterns (e.g. "published hours with daily coverage", "community presence").
- context.market_density: qualitative density assessment for this category in this city (e.g. "sparse — few dedicated stores", "dense — competitive market"). Qualitative only.
- context.prospect_signals: 3-5 signals to look for when prospecting businesses in this category (e.g. "businesses with incomplete online presence — high opportunity").

=== RULES ===
- Write for shoppers, not operators. No internal jargon, no "campaign", no "enrichment", no "sweep".
- Do NOT invent business counts, ratings, or specific business names.
- Do NOT include claims about business quality ("best", "top-rated") — the directory lists from public information.
- Category name in copy should use natural casing (e.g. "African grocery stores").
- Every market gets its own copy — do NOT reuse paragraphs across entries. Categories that share a city may reference the same market conditions but with category-specific framing.
- You may draw on general knowledge about each category and market. Do not fabricate specific business names, counts, or ratings. If you are genuinely uncertain whether a category is strong in a market, describe the category generally rather than guess at local density.

=== OUTPUT REQUIREMENT ===
Respond with a SINGLE JSON object only. No markdown fences, no commentary.`,
  variables: ['category', 'city', 'state', 'markets'],
  outputSchema: {
    name: CATEGORY_SET_ENRICHMENT_SCHEMA_NAME,
    description: 'Category set enrichment — one category_enrichment-shaped packet per market, each carrying its own category_name/city/state for apply routing.',
  },
  isDefault: false,
};

const TEMPLATES = [CATEGORY_TEMPLATE, LOCATION_TEMPLATE, CATEGORY_SET_TEMPLATE];

async function main() {
  const service = MarketingPromptService.getInstance();

  for (const tpl of TEMPLATES) {
    const existing = await service.getTemplate(tpl.id);
    const markerPresent = existing?.body?.includes(SEED_VERSION_MARKER);

    if (existing && markerPresent) {
      await service.updateTemplate(tpl.id, {
        name: tpl.name,
        body: tpl.body,
        variables: tpl.variables,
        outputSchema: tpl.outputSchema,
      });
      logger.info(`Updated enrichment template: ${tpl.id}`, undefined, { id: tpl.id });
    } else if (existing) {
      // Exists but pre-marker version — update in place so the new body lands.
      await service.updateTemplate(tpl.id, {
        name: tpl.name,
        body: tpl.body,
        variables: tpl.variables,
        outputSchema: tpl.outputSchema,
      });
      logger.info(`Migrated pre-marker enrichment template: ${tpl.id}`, undefined, { id: tpl.id });
    } else {
      await service.createTemplate({
        id: tpl.id,
        name: tpl.name,
        promptType: tpl.promptType,
        scope: tpl.scope,
        body: tpl.body,
        variables: tpl.variables,
        outputSchema: tpl.outputSchema,
        isDefault: tpl.isDefault,
      });
      logger.info(`Created enrichment template: ${tpl.id}`, undefined, { id: tpl.id });
    }
  }
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: (err as Error).message });
  process.exit(1);
});
