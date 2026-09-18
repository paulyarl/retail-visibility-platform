/**
 * Intelligence Profile Schema (GAP-P8)
 *
 * Validates the §10 profile structure for the establishment import path.
 * When an operator imports an externally-generated profile via
 * /executions/external, the result is validated against this schema before
 * being persisted as a DRAFT profile by IntelligenceProfileService.importAsDraft().
 *
 * Key structural requirements:
 *   - terminology: map of term → definition
 *   - specialized_sources: array with name, type, capabilities[], limitations[]
 *   - prohibited_inferences: array of strings (inferences the AI must NOT make)
 *   - category_signals: array of INT_* signal codes
 *   - .passthrough() allows forward-compatible fields
 *
 * Used by:
 *   - The external-import endpoint (validates pasted JSON)
 *   - The prompt suffix (appended to the establishment template's exported prompt)
 *   - The post-import hook in importExternalResult()
 */

import { z } from 'zod';

export const INTELLIGENCE_PROFILE_SCHEMA_NAME = 'intelligence_profile';

// ─── Specialized Source ──────────────────────────────────────────────────

const specializedSourceSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  // URL of the source's homepage, landing page, or directory index. Optional
  // so legacy imports without URLs still validate, but the establishment
  // prompt instructs the agent to capture it for any source that has a
  // canonical web address — vertical directories and community organizations
  // especially, where the URL is the operator-actionable entry point.
  //
  // Models frequently emit `"url": null` (rather than omitting the key) for
  // sources with no canonical web address (e.g. "storefront corridor
  // observation", "supplier sourcing-road network"). Coerce null → undefined
  // so downstream consumers always see `url` as either a valid URL string or
  // undefined, and so external imports don't fail validation on null URLs.
  url: z.preprocess(
    (v) => (v === null ? undefined : v),
    z.string().url().optional(),
  ),
  priority: z.number().int().optional(),
  capabilities: z.array(z.string()).min(1),
  limitations: z.array(z.string()).min(1),
}).passthrough();

// ─── Discovery Substrate (category-independent enumeration) ──────────────
//
// The substrate is what makes discovery category-independent. It is the
// enumeration floor that surfaces businesses whose names do NOT self-identify
// with the category (e.g. "Universal Tropical Market" for an African grocery,
// "A-1 Market" for an Asian grocery, "Sunny Beauty" for a beauty-supply store).
// A profile whose only discovery paths are keyed on the category's own tokens
// is incomplete — the substrate fields are what the discovery scan executes to
// avoid that failure mode. All three are optional in the schema so legacy
// profiles still validate, but the establishment template + prompt suffix
// require every NEW profile to carry them.

const geographyGridSchema = z.object({
  // Reference market the grid was derived from (normally the campaign's city/state).
  city: z.string().optional(),
  state: z.string().optional(),
  // Exhaustive ZIP sweep units. Every ZIP must be swept independently; a ZIP
  // with zero findings is an executed-empty result, never a silent skip.
  zips: z.array(z.string()).optional(),
  // Arterial commercial stretches, derived from address evidence where possible.
  corridors: z.array(z.string()).optional(),
  // Separately-incorporated suburbs / contiguous commercial municipalities in
  // the catchment — the "shared-ZIP suburb" class (e.g. Gladstone, MO sharing
  // 64118 with Kansas City). Explicit so the retail catchment is sweepable, not
  // implied by the principal city's administrative boundary.
  adjacent_municipalities: z.array(z.string()).optional(),
  // Optional radius scope from the campaign.
  radius_miles: z.number().optional(),
}).passthrough();

const genericLabelSetEntrySchema = z.object({
  platform: z.string().min(1),
  // The generic buckets that SWALLOW this category — the labels a mislabeled
  // business sits under. Category-specific in content, universal in class.
  labels: z.array(z.string()).min(1),
}).passthrough();

const labelIndependentSweepSchema = z.object({
  dataset: z.string().min(1),
  url: z.preprocess(
    (v) => (v === null ? undefined : v),
    z.string().url().optional(),
  ),
  // MUST be "geography": the dataset is enumerated by ZIP/address, never by a
  // category name token. Token-keying a label-independent dataset makes it
  // label-dependent and defeats its purpose.
  sweep_key: z.string().optional(),
  filter: z.string().optional(),
  post_filter: z.string().optional(),
  note: z.string().optional(),
}).passthrough();

// ─── Profile Configuration (§10 structure) ───────────────────────────────

export const intelligenceProfileSchema = z.object({
  // Category identification
  category_key: z.string().min(1),
  category_name: z.string().min(1),

  // Terminology — map of term → definition
  terminology: z.record(z.string(), z.string()).optional(),

  // Synonyms — alternative names for the category
  synonyms: z.array(z.string()).optional(),

  // Subcategories — with descriptions
  subcategories: z.array(z.string()).optional(),

  // Specialized sources — with capabilities and limitations
  specialized_sources: z.array(specializedSourceSchema).min(1),

  // Discovery substrate — category-independent enumeration primitives. Optional
  // in the schema for backward compatibility, but REQUIRED by the establishment
  // template + prompt suffix for every new profile.
  geography_grid: geographyGridSchema.optional(),
  generic_label_set: z.array(genericLabelSetEntrySchema).optional(),
  label_independent_sweeps: z.array(labelIndependentSweepSchema).optional(),

  // Discovery patterns — how to find businesses in this category
  discovery_patterns: z.record(z.string(), z.any()).optional(),

  // Category evidence rules — what evidence matters for this category
  category_evidence_rules: z.record(z.string(), z.any()).optional(),

  // Prohibited inferences — inferences the AI must NOT make
  prohibited_inferences: z.array(z.string()).min(1),

  // Category signals — INT_* signal codes relevant to this category
  category_signals: z.array(z.string()).min(1),
}).passthrough();

// ─── Prompt suffix (appended to the establishment template's prompt) ─────

export const INTELLIGENCE_PROFILE_PROMPT_SUFFIX = `
=== EXPECTED OUTPUT FORMAT ===
Return a single JSON object with this structure (the Category Intelligence Profile):
{
  "category_key": "<normalized category key, lowercase, spaces collapsed>",
  "category_name": "<display name>",
  "terminology": {
    "<term>": "<definition>",
    ...
  },
  "synonyms": ["<alternative name>", ...],
  "subcategories": ["<subcategory: description>", ...],
  "specialized_sources": [
    {
      "name": "<source name>",
      "type": "<source type: service_history | certification | professional_network | mainstream_directory | vertical_directory | social_platform | other>",
      "url": "<source homepage or directory index URL, if the source has a canonical web address>",
      "priority": <number>,
      "capabilities": ["<what this source can do>", ...],
      "limitations": ["<what this source cannot do or what it does NOT measure>", ...]
    }
  ],
  "geography_grid": {
    "city": "<reference city>",
    "state": "<reference state>",
    "zips": ["<every ZIP the market's commercial addresses fall in>", ...],
    "corridors": ["<arterial commercial stretch, derived from address evidence>", ...],
    "adjacent_municipalities": ["<separately-incorporated suburb / contiguous commercial municipality in the catchment>", ...],
    "radius_miles": <number, if a radius scope applies>
  },
  "generic_label_set": [
    {
      "platform": "<platform>",
      "labels": ["<generic label that SWALLOWS this category>", ...]
    }
  ],
  "label_independent_sweeps": [
    {
      "dataset": "<address-indexed dataset name>",
      "url": "<dataset URL, if it has a canonical web address>",
      "sweep_key": "geography",
      "filter": "none",
      "post_filter": "assortment",
      "note": "<optional>"
    }
  ],
  "discovery_patterns": {
    "<pattern_name>": "<description or instructions>",
    ...
  },
  "category_evidence_rules": {
    "<rule_name>": "<description>",
    ...
  },
  "prohibited_inferences": [
    "<inference the AI must NOT make for this category>",
    ...
  ],
  "category_signals": ["INT_*", ...]
}

Rules:
- specialized_sources MUST have at least one entry with capabilities AND limitations.
- geography_grid, generic_label_set, and label_independent_sweeps are REQUIRED. They are the category-independent discovery substrate: geography_grid names the exhaustive sweep units (ZIPs + corridors), generic_label_set names the generic platform labels that swallow this category, and label_independent_sweeps names the address-indexed datasets that must be swept WITHOUT a category name token.
- label_independent_sweeps entries MUST set "sweep_key": "geography". These datasets are enumerated by ZIP/address and filtered to category fit by assortment evidence AFTER enumeration. Do NOT key them on the category name — token-keying a label-independent dataset makes it label-dependent and hides every business whose legal name carries no category token.
- geography_grid.zips MUST list every ZIP the market's commercial addresses fall in, not only the ZIPs where category businesses were already found. Every ZIP is swept independently; a ZIP with zero findings is an executed-empty result, not a silent skip.
- geography_grid scope is the RETAIL CATCHMENT, not the administrative city: the principal city PLUS its contiguous commercial suburbs. geography_grid.adjacent_municipalities MUST list the separately-incorporated municipalities in the catchment — including any that share a ZIP with the principal city (the shared-ZIP suburb class). A ZIP spanning the principal city and a suburb is ONE sweep unit.
- generic_label_set MUST name the generic/misleading labels that hide this category on each platform, not the correct category label.
- For each specialized_source that has a canonical web address (a homepage, directory index, organization page, or store locator), include its "url". Vertical directories, community organizations, professional networks, and official brand/chain websites should always carry a url — it is the operator's entry point to the source. Omit "url" only for sources that have no single canonical web address (e.g. "storefront photo evidence", "SNAP listings" as a class).
- limitations are critical — they describe what the source does NOT measure (e.g. "CARFAX service history is NOT a review system").
- prohibited_inferences MUST list at least one inference that must not be made (e.g. "Absence from CARFAX does NOT mean the business is inactive").
- category_signals MUST use INT_* codes only.
- category_key should be the normalized (lowercase, whitespace-collapsed) category name.
`;
