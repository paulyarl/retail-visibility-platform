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
  url: z.string().url().optional(),
  priority: z.number().int().optional(),
  capabilities: z.array(z.string()).min(1),
  limitations: z.array(z.string()).min(1),
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
- For each specialized_source that has a canonical web address (a homepage, directory index, organization page, or store locator), include its "url". Vertical directories, community organizations, professional networks, and official brand/chain websites should always carry a url — it is the operator's entry point to the source. Omit "url" only for sources that have no single canonical web address (e.g. "storefront photo evidence", "SNAP listings" as a class).
- limitations are critical — they describe what the source does NOT measure (e.g. "CARFAX service history is NOT a review system").
- prohibited_inferences MUST list at least one inference that must not be made (e.g. "Absence from CARFAX does NOT mean the business is inactive").
- category_signals MUST use INT_* codes only.
- category_key should be the normalized (lowercase, whitespace-collapsed) category name.
`;
