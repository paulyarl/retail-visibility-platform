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

// ─── Category Enrichment Packet ─────────────────────────────────────────

export const categoryEnrichmentSchema = z.object({
  // Optional echoes — the campaign's category/city/state are authoritative;
  // these are validated when present but the applier ignores them for the
  // upsert key (campaign fields win, sentinel values included).
  category_key: z.string().min(1).optional(),
  category_name: z.string().min(1).optional(),

  // The packet. Field names map to directory_category_enrichment columns.
  meta_title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  keywords: stringArray,
  secondary_categories: stringArray.optional(),
  schema_type_hint: z.preprocess(emptyToUndef, z.string().max(100).optional()),
  body_copy: z.preprocess(emptyToUndef, z.string().max(5000).optional()),
}).passthrough();

export type CategoryEnrichmentOutput = z.infer<typeof categoryEnrichmentSchema>;

// ─── Location Enrichment Packet ─────────────────────────────────────────

export const locationEnrichmentSchema = z.object({
  // Optional echoes — campaign city/state are authoritative for the upsert key.
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  location_name: z.string().min(1).optional(),

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
}).passthrough();

export type LocationEnrichmentOutput = z.infer<typeof locationEnrichmentSchema>;

// ─── Prompt suffixes (appended to exported prompt text) ─────────────────

export const CATEGORY_ENRICHMENT_PROMPT_SUFFIX = `

Return your response as JSON matching this exact schema:
{
  "category_key": "<normalized category key, lowercase, spaces collapsed>",
  "category_name": "<display name>",
  "meta_title": "<SEO title, <= 70 chars, include category + city + state>",
  "description": "<meta description, <= 300 chars, browse-oriented local-SEO copy>",
  "keywords": ["<keyword>", ...],
  "secondary_categories": ["<related category>", ...],
  "schema_type_hint": "<schema.org type hint, e.g. CollectionPage or Store>",
  "body_copy": "<1-2 short paragraphs of visible on-page copy for the category page>"
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
  "body_copy": "<1-2 short paragraphs of visible on-page copy for the location page>"
}

Return ONLY the JSON object, no markdown fences, no commentary.`;
