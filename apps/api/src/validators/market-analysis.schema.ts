/**
 * Canonical Market Analysis Output Schema
 *
 * Single source of truth for the shape of `market_analysis` prompt output.
 * Imported by:
 *   - The render/copy/download flow (to append the expected shape to the
 *     prompt text sent to external agents).
 *   - The external-import endpoint (to validate pasted JSON before storing
 *     an execution + audit).
 *
 * Audit creation is keyed off `template.output_schema->>'name' === 'market_analysis'`,
 * NOT `prompt_type` (which encodes pipeline stage: seek/fulfill/filter/retainer,
 * not output shape).
 *
 * Uses `z.coerce.number()` + percent-stripping preprocess so valid-looking
 * output returned as strings ("4.2", "85%") is accepted instead of 400ing.
 */

import { z } from 'zod';
import {
  regionalCityOpportunitySchema,
  REGIONAL_CITY_OPPORTUNITY_SCHEMA_NAME,
  REGIONAL_CITY_OPPORTUNITY_PROMPT_SUFFIX,
} from './regional-city-opportunity.schema';
import {
  businessAnalysisSchema,
  BUSINESS_ANALYSIS_SCHEMA_NAME,
  BUSINESS_ANALYSIS_PROMPT_SUFFIX,
} from './business-analysis.schema';
import {
  recoveryResolutionSchema,
  RECOVERY_RESOLUTION_SCHEMA_NAME,
  RECOVERY_RESOLUTION_PROMPT_SUFFIX,
} from './recovery-resolution.schema';
import {
  cityCategoryOpportunitySchema,
  CITY_CATEGORY_OPPORTUNITY_SCHEMA_NAME,
  CITY_CATEGORY_OPPORTUNITY_PROMPT_SUFFIX,
} from './city-category-opportunity.schema';
import {
  intelligenceDiscoverySchemaWithRefinements as intelligenceDiscoverySchema,
  INTELLIGENCE_DISCOVERY_SCHEMA_NAME,
  INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX,
} from './intelligence-discovery.schema';
import {
  intelligenceProfileSchema,
  INTELLIGENCE_PROFILE_SCHEMA_NAME,
  INTELLIGENCE_PROFILE_PROMPT_SUFFIX,
} from './intelligence-profile.schema';
import {
  profileRepairTriageSchema,
  PROFILE_REPAIR_TRIAGE_SCHEMA_NAME,
  PROFILE_REPAIR_TRIAGE_PROMPT_SUFFIX,
  type ProfileRepairTriageOutput,
  profileRepairAuditSchema,
  PROFILE_REPAIR_AUDIT_SCHEMA_NAME,
  PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX,
  type ProfileRepairAuditOutput,
  citationRepairPackageSchema,
  CITATION_REPAIR_PACKAGE_SCHEMA_NAME,
  CITATION_REPAIR_PACKAGE_PROMPT_SUFFIX,
  type CitationRepairPackageOutput,
} from './profile-repair-output.schema';

export {
  profileRepairTriageSchema,
  PROFILE_REPAIR_TRIAGE_SCHEMA_NAME,
  PROFILE_REPAIR_TRIAGE_PROMPT_SUFFIX,
  type ProfileRepairTriageOutput,
  profileRepairAuditSchema,
  PROFILE_REPAIR_AUDIT_SCHEMA_NAME,
  PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX,
  type ProfileRepairAuditOutput,
  citationRepairPackageSchema,
  CITATION_REPAIR_PACKAGE_SCHEMA_NAME,
  CITATION_REPAIR_PACKAGE_PROMPT_SUFFIX,
  type CitationRepairPackageOutput,
};

// ============================================================================
// Raw JSON Schema (permissive — accepts any valid JSON object or array)
// ============================================================================

/**
 * Permissive schema for templates that produce variable/freeform JSON without
 * a strict shape (fulfill deliverables, filter QA checks, retainer sequences,
 * city ecosystem scans, custom operator templates).
 *
 * Accepts any parsed JSON object or array. Used so importExternalResult()
 * succeeds (parses + stores the JSON) without forcing a specific shape on
 * templates that don't have a dedicated schema.
 */
export const RAW_JSON_SCHEMA_NAME = 'raw_json' as const;

export const rawJsonSchema = z.union([
  z.record(z.string(), z.any()),
  z.array(z.any()),
]);

export const RAW_JSON_PROMPT_SUFFIX = `

Return your response as valid JSON only. No markdown fences, no commentary.`;

/**
 * Strip a trailing `%` and coerce to number.
 * Accepts "85%", "85", 85, "4.2", 4.2 — all become numbers.
 */
const percentOrNumber = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim().replace(/%$/, '');
    const n = Number(trimmed);
    return Number.isNaN(n) ? val : n;
  }
  return val;
}, z.number());

/**
 * Coerce string-or-number ratings to number.
 * Accepts "4.2", 4.2, 4 — all become numbers.
 */
const coercedNumber = z.coerce.number();

export const marketAnalysisSchema = z.object({
  market_analysis: z.object({
    location: z.string(),
    industry: z.string(),
    total_approximate_businesses: coercedNumber,
    average_gbp_metrics: z.object({
      average_rating: coercedNumber,
      average_review_count: coercedNumber,
    }),
    gbp_claimed_percentage: percentOrNumber,
    website_presence_percentage: percentOrNumber,
    top_5_competitors: z
      .array(
        z.object({
          name: z.string(),
          approximate_rating: coercedNumber,
          approximate_review_count: coercedNumber,
          location_status: z.string(),
        }),
      )
      .min(1),
    common_pain_points: z.array(z.string()),
    opportunity_gaps: z.array(z.string()),
    recommended_outreach_angle: z.string(),
  }),
});

export type MarketAnalysisOutput = z.infer<typeof marketAnalysisSchema>;

/**
 * The schema name used to identify market-analysis-shaped templates
 * and audits. Stored in `mkt_prompt_templates_list.output_schema->>'name'`
 * and used as `mkt_audits_list.platform` for imported market analyses.
 */
export const MARKET_ANALYSIS_SCHEMA_NAME = 'market_analysis' as const;

/**
 * Human-readable description of the market_analysis output shape,
 * suitable for appending to a prompt sent to an external agent.
 * Kept in sync with `marketAnalysisSchema` above.
 */
export const MARKET_ANALYSIS_PROMPT_SUFFIX = `

Return your response as JSON matching this exact schema:
{
  "market_analysis": {
    "location": "<string>",
    "industry": "<string>",
    "total_approximate_businesses": <number>,
    "average_gbp_metrics": {
      "average_rating": <number>,
      "average_review_count": <number>
    },
    "gbp_claimed_percentage": <number 0-100>,
    "website_presence_percentage": <number 0-100>,
    "top_5_competitors": [
      {
        "name": "<string>",
        "approximate_rating": <number>,
        "approximate_review_count": <number>,
        "location_status": "<string>"
      }
    ],
    "common_pain_points": ["<string>", ...],
    "opportunity_gaps": ["<string>", ...],
    "recommended_outreach_angle": "<string>"
  }
}

Return ONLY the JSON object, no markdown fences, no commentary.`;

/**
 * Registry of known output schemas by name.
 * The import endpoint looks up `template.output_schema->>'name'` here
 * to pick the validator and decide whether to create an audit.
 *
 * To add a new output shape:
 *   1. Define its zod schema in this module (or a sibling file).
 *   2. Add an entry here with name, validator, and auditPlatform (or null).
 *   3. Seed templates with `output_schema = {"name": "<name>", ...}`.
 */
export const OUTPUT_SCHEMA_REGISTRY: Record<
  string,
  {
    validator: z.ZodTypeAny;
    /** If set, imported results create an audit with this platform value. */
    auditPlatform: string | null;
    /** Human-readable prompt suffix appended to exported prompt text. */
    promptSuffix: string;
  }
> = {
  [MARKET_ANALYSIS_SCHEMA_NAME]: {
    validator: marketAnalysisSchema,
    auditPlatform: 'category_analysis',
    promptSuffix: MARKET_ANALYSIS_PROMPT_SUFFIX,
  },
  [REGIONAL_CITY_OPPORTUNITY_SCHEMA_NAME]: {
    validator: regionalCityOpportunitySchema,
    auditPlatform: 'city_analysis',
    promptSuffix: REGIONAL_CITY_OPPORTUNITY_PROMPT_SUFFIX,
  },
  [BUSINESS_ANALYSIS_SCHEMA_NAME]: {
    validator: businessAnalysisSchema,
    auditPlatform: 'business_analysis',
    promptSuffix: BUSINESS_ANALYSIS_PROMPT_SUFFIX,
  },
  [RECOVERY_RESOLUTION_SCHEMA_NAME]: {
    validator: recoveryResolutionSchema,
    auditPlatform: null, // recovery resolutions create deliverables, not audits
    promptSuffix: RECOVERY_RESOLUTION_PROMPT_SUFFIX,
  },
  [CITY_CATEGORY_OPPORTUNITY_SCHEMA_NAME]: {
    validator: cityCategoryOpportunitySchema,
    auditPlatform: 'city_category_analysis',
    promptSuffix: CITY_CATEGORY_OPPORTUNITY_PROMPT_SUFFIX,
  },
  [INTELLIGENCE_DISCOVERY_SCHEMA_NAME]: {
    validator: intelligenceDiscoverySchema,
    // Intelligence discovery imports land in mkt_audits_list so the campaign's
    // Audits tab can render the discovered businesses and the operator can
    // spawn business-scope child campaigns from them. The full validated
    // discovery payload is stored in audit_data; scalar audit columns are left
    // at their defaults (discovery output has no GBP metrics).
    auditPlatform: 'intelligence_discovery',
    promptSuffix: INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX,
  },
  [INTELLIGENCE_PROFILE_SCHEMA_NAME]: {
    validator: intelligenceProfileSchema,
    auditPlatform: null, // profile establishment creates draft profiles, not audits
    promptSuffix: INTELLIGENCE_PROFILE_PROMPT_SUFFIX,
  },
  [PROFILE_REPAIR_TRIAGE_SCHEMA_NAME]: {
    validator: profileRepairTriageSchema,
    auditPlatform: null, // triage creates a recommendation, not an audit
    promptSuffix: PROFILE_REPAIR_TRIAGE_PROMPT_SUFFIX,
  },
  [PROFILE_REPAIR_AUDIT_SCHEMA_NAME]: {
    validator: profileRepairAuditSchema,
    auditPlatform: null, // per-issue audits create deliverable inputs, not audits
    promptSuffix: PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX,
  },
  [CITATION_REPAIR_PACKAGE_SCHEMA_NAME]: {
    validator: citationRepairPackageSchema,
    auditPlatform: null, // fulfill creates a deliverable, not an audit
    promptSuffix: CITATION_REPAIR_PACKAGE_PROMPT_SUFFIX,
  },
  [RAW_JSON_SCHEMA_NAME]: {
    validator: rawJsonSchema,
    auditPlatform: null, // permissive schema never creates an audit
    promptSuffix: RAW_JSON_PROMPT_SUFFIX,
  },
};

/**
 * Resolve an output schema by name. Returns null if the template has no
 * declared output_schema or the name is not in the registry.
 */
export function resolveOutputSchema(
  schemaName: string | null | undefined,
): { validator: z.ZodTypeAny; auditPlatform: string | null; promptSuffix: string } | null {
  if (!schemaName) return null;
  return OUTPUT_SCHEMA_REGISTRY[schemaName] ?? null;
}
