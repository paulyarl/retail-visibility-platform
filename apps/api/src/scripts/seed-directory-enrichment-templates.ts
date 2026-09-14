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
} from '../validators/directory-enrichment.schema';

// Bump this marker when the template bodies change — the seed checks for the
// marker's presence in the stored body, not the absence of an old section
// (AGENTS.md idempotency discipline).
const SEED_VERSION_MARKER = 'ENRICHMENT_DIRECTIVE_V5';

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

=== WHAT GOOD LOOKS LIKE ===
- meta_title: <= 70 chars. Pattern: "{Category} in {City}, {ST} — VisibleShelf Places" for market pages; "{Category} — VisibleShelf Places" for national. Front-load the category noun.
- description: <= 300 chars meta description. Browse-oriented: who is listed, that listings come from public information, and 1-2 related terms shoppers search.
- keywords: 8-15 search terms — the category name, synonyms, "near me" variants, related product/service terms. No keyword stuffing, no competitor brand names.
- secondary_categories: 3-6 closely related category names a shopper might also browse (real categories, not invented niches).
- schema_type_hint: the schema.org type that best fits the page — usually "CollectionPage"; use "Store" only for single-business categories.
- body_copy: 1-2 short paragraphs (<= 5000 chars total) of visible on-page copy for the top of the category page — what the category is, what shoppers find here, how listings are sourced. Plain, factual, no hype.
- shopper_guide: 1-2 short paragraphs (<= 5000 chars) of shopper guidance — what to look for when browsing businesses in this category, what makes a listing worth visiting, what to check (hours, website, product scope, reviews). Plain, helpful, no hype. Distinct from body_copy (which is intro copy); this is "how to choose" guidance.
- faq: 3-6 question/answer pairs shoppers might have about this category. Each answer 1-3 sentences, plain and factual. Used for an FAQ section + FAQ schema on the page.

=== REUSABLE CONTEXT (analyst-facing) ===
Produce a context object that will be consumed by business audit campaigns (the seed) to give them category-specific market awareness. This is analyst-facing context, not shopper-facing copy. It does NOT bleed onto the location surface — only the seed consumes it.

- context.category_summary: 1-2 paragraphs describing what this category looks like in this market — market size, competitive density, notable patterns, community context. For national ('__all__') campaigns, describe the category's national landscape.
- context.keywords: category-level search terms for downstream use.
- context.secondary_categories: related categories strong in this market, for downstream use.
- context.category_notes: optional free-text notes useful for downstream work (e.g. "strong in immigrant communities on the north side", "limited to 2-3 independent stores").

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

=== WHAT GOOD LOOKS LIKE ===
- meta_title: <= 70 chars. Pattern: "Local Businesses in {City}, {ST} — VisibleShelf Directory". Front-load the place.
- description: <= 300 chars meta description. What the page offers: a browsable index of local businesses in the city, listed from public information.
- keywords: 8-15 search terms — "{city} businesses", "local shops {city}", categories likely strong in this market, "near me" variants. No keyword stuffing.
- secondary_categories: 3-6 category names likely to be strong in this location's business mix (generic, e.g. "restaurants", "grocery stores").
- top_categories: 3-8 category names most representative of this city's business landscape — used to describe what the location is known for. Prefer real, common categories over invented niches.
- schema_type_hint: usually "WebPage".
- body_copy: 1-2 short paragraphs (<= 5000 chars total) of visible on-page copy for the top of the location page — what the city's local business scene looks like, how listings are sourced, what shoppers can browse. Plain, factual, no hype.
- shopper_guide: 1-2 short paragraphs (<= 5000 chars) of shopper guidance — what to look for when browsing businesses in this city, how to find what you need, any city-specific shopping context. Distinct from body_copy (which is intro copy); this is "how to browse" guidance.
- faq: 3-6 question/answer pairs shoppers might have about businesses in this city. Each answer 1-3 sentences, plain and factual. Used for an FAQ section + FAQ schema on the page.
- area_breakdown: 3-6 named areas, corridors, or neighborhoods in this city with a short description and the categories strong there. Used for a "Browse by Area" section on the page.

=== REUSABLE CONTEXT (analyst-facing) ===
Produce a context object that will be consumed by business audit campaigns (the seed) to give them city-level market awareness. This is analyst-facing context, not shopper-facing copy. It does NOT bleed onto the category surface — only the seed consumes it.

- context.market_summary: 1-2 paragraphs describing this city's business landscape — major industries, well-known commercial districts, categories the city is known for, community and cultural context that shapes the local market.
- context.top_categories: 3-8 representative categories (same set as the SEO packet's top_categories).
- context.secondary_categories: supporting categories for downstream use.
- context.keywords: city-level search terms for downstream use.
- context.notable_areas: named areas (simplified list — the structured area_breakdown is the page-rendered version).
- context.market_notes: optional free-text notes useful for downstream work (e.g. "strong tech corridor on the north side", "large immigrant communities drive specialty grocery demand").

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

const TEMPLATES = [CATEGORY_TEMPLATE, LOCATION_TEMPLATE];

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
