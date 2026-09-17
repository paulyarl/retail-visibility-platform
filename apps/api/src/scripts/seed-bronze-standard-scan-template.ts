/**
 * Seed script: Bronze Standard Scan Templates (Bronze Standard System)
 *
 * Seeds TWO prompt templates for bronze-standard scans:
 *
 * 1. ESTABLISHMENT / NATIONAL (mpt-seed-bronze-standard-scan-001):
 *    intelligence_campaign_kind = 'establishment'. Stage 1 of the bronze
 *    pipeline — the analyst covers every applicable catalog reason at
 *    national scope and embeds a revision-stamped catalog snapshot in the
 *    output. The reason catalog is injected at render time by
 *    MarketingExecutionService via BronzeReasonCatalogService
 *    .serializeCatalogBlock(). The validated JSON is persisted as a DRAFT
 *    bronze-standard profile by IntelligenceProfileService.importAsDraft().
 *
 * 2. DISCOVERY / CITY (mpt-seed-bronze-standard-scan-discovery-001):
 *    intelligence_campaign_kind = 'discovery'. Stage 2 — the analyst covers
 *    every applicable reason at the campaign's city market, using the
 *    resolved bronze profile (national → city cascade) as the hunt list
 *    plus any location-scoped catalog rows (injected at render time via
 *    serializeBronzeStandard(profile, 'establishment_reference')). The
 *    validated JSON is ALSO persisted as a DRAFT profile — unlike gold,
 *    bronze discovery produces a profile (spec §6.1: the post-import hook
 *    is keyed on the schema name, not the campaign kind).
 *
 * Both templates use the 'intelligence' scope, focus = 'bronze_standards',
 * and output_schema = { name: 'bronze_standard_scan' }. Bronze scans never
 * produce an audit row.
 *
 * Idempotent — uses deterministic IDs so re-running updates in place.
 *
 * Usage (re-run after ANY edit, against both configs):
 *   doppler run --config local -- npx tsx src/scripts/seed-bronze-standard-scan-template.ts
 *   doppler run --config prd --   npx tsx src/scripts/seed-bronze-standard-scan-template.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';
import { BRONZE_STANDARD_SCAN_SCHEMA_NAME } from '../validators/bronze-standard-scan.schema';

// ─── Shared prompt sections (used by both templates) ─────────────────────

const THREE_PART_GATE_SECTION = `=== THE THREE-PART SLOT GATE ===
A business qualifies for a bronze slot ONLY when all three hold:

1. CATEGORY-QUALIFIED by observable assortment evidence — what the business
   carries or does (menu items, product lines, services offered), NOT the
   category label a platform assigned it. A business miscategorized on the
   platform still qualifies when its assortment evidence fits the category.
2. OPERATIONALLY VERIFIED — evidence the business is active or likely_active
   (recent reviews mentioning service, current hours, fresh posts, owner
   responses, live phone line). operational_status "unable_to_verify" NEVER
   fills a slot — report the lead in empty_slot_note instead.
3. LOW DIGITAL QUALITY in a way the reason explains — the reason's signal
   vocabulary is observed: missing fields, generic categories, absent
   listings, unclaimed profiles, no website. "low" = thin but present;
   "very_low" = nearly absent.

A slot is a FLOOR, not a ranking — the lowest digital quality that still
qualifies as a real, operating, category-fit business. Cap slots at 2 per
reason.`;

const COVERAGE_VOCABULARY_SECTION = `=== THE THREE-STATE COVERAGE VOCABULARY ===
Every applicable reason produces exactly one reason_coverage entry with one
of three statuses — the distinction is load-bearing, never conflate them:

- filled:                  at least one qualifying exemplar found in this
                           market on this pass.
- empty_unproven:          no exemplar here, and none ever found at any
                           evaluable scope. The hunt itself is the evidence.
- empty_proven_elsewhere:  no exemplar here, but the reason is proven at
                           national scope or in another market.

A reason that does not apply at this scope is NOT a coverage entry — list
its key in not_applicable_reasons instead. For every non-filled entry,
empty_slot_note records the EXECUTION outcome: "executed, returned 0" is
materially different from "not executed". An unexecuted vector is an
admitted blind spot, never a silent gap — record every attempt in
vector_execution_log.`;

const PROHIBITED_INFERENCES_SECTION = `=== PROHIBITED INFERENCES ===
- Low digital quality describes observable online fields ONLY. Never infer
  low revenue, low customer volume, poor products, poor service, or sales
  readiness from a thin digital footprint.
- A bronze slot is NOT a prospect verdict and NOT a competitive benchmark.
  Do not frame these businesses as outreach targets or compare them to
  high-visibility competitors.
- An empty slot never means no such business exists — it means the vectors
  executed did not reach one (or were not executed).
- A filled absent_from_platform or field-gap slot is a PER-PLATFORM finding —
  a business absent on Google may be fully present on Yelp. Never generalize
  a per-platform gap into a whole-business verdict.
- Bronze output must never be framed as competitive benchmarking — it is a
  discovery-calibration artifact.`;

const PROVENANCE_SECTION = `=== SLOT PROVENANCE ===
Every slot records discovered_by (mandatory):
- bronze_establishment_scan — found by THIS scan or a prior bronze scan.
- operator_self_discovery — found by an operator outside the scan loop
  (ground truth; survives re-scans).
- business_audit — discovered while auditing a specific business (ground
  truth; survives re-scans).
- emerging_scan / competitive_scan — carried forward from a discovery scan.

Slots carried forward from out-of-loop fills are ground truth; scan-derived
fills are confirmatory. Do not blur the distinction — preserve the
discovered_by value exactly as supplied.`;

// NOTE: The full EXPECTED OUTPUT FORMAT + Rules block is appended at runtime
// by BRONZE_STANDARD_SCAN_PROMPT_SUFFIX (in bronze-standard-scan.schema.ts)
// via the OUTPUT_SCHEMA_REGISTRY. Do NOT duplicate it here.
const OUTPUT_FORMAT_SECTION = `=== OUTPUT REQUIREMENT ===
Respond with a SINGLE JSON object only. Do NOT wrap it in markdown code fences. Do NOT include prose before or after the JSON. Do NOT include commentary. The expected JSON structure and rules are specified in the EXPECTED OUTPUT FORMAT section below.`;

// ─── 1. ESTABLISHMENT template (national — stage 1) ──────────────────────

const BRONZE_STANDARD_SCAN_ESTABLISHMENT_TEMPLATE = {
  id: 'mpt-seed-bronze-standard-scan-001',
  name: 'Seek: Bronze Standard Scan (National Establishment)',
  promptType: 'seek' as const,
  scope: 'intelligence' as const,
  body: `You are a bronze-standard analyst. Your task is to map what INVISIBLE looks like for a category: the lowest digital quality at which a real, operating, category-qualified business can exist, typed by WHY it is invisible.

CATEGORY: {{category}}
PLATFORM FOCUS: {{platform}}

=== WHAT A BRONZE STANDARD IS ===
The gold standard maps what "excellent" looks like. The bronze standard maps the opposite floor: businesses that are real, operating, and category-qualified but nearly invisible online — each one a proof that a specific discovery blind spot exists and that a specific vector reaches it.

Each reason in the catalog below is a discovery blind spot (miscategorization, missing category tokens, weak mainstream indexing, community-only presence, and so on) AND a discovery vector: the reason's expected_vectors name the sources that reveal businesses mainstream discovery misses.

This is the NATIONAL establishment scan (stage 1): you are deriving the national bronze profile. Cover EVERY applicable reason in the injected catalog — the catalog is your hunt list, and your output embeds a revision-stamped snapshot of it so the profile stays interpretable after the catalog moves on. The geographic search scope is specified in the SEARCH SCOPE section at the end of this prompt.

${THREE_PART_GATE_SECTION}

${COVERAGE_VOCABULARY_SECTION}

${PROVENANCE_SECTION}

=== PLATFORM FOCUS ===
{{platform}} is the platform this scan focuses on. When blank or "all", treat the scan as cross-platform: platform-anchored reasons (absent_from_platform, unclaimed_profile, and the field-gap family) qualify across every major platform, and observed_platform on each slot names the platform the reason was observed on. When a specific platform is named, only platform-anchored reasons bound to that platform (and non-platform reasons) are applicable.

${PROHIBITED_INFERENCES_SECTION}

=== SCAN METADATA ===
Record the catalog_revision stamped on the injected catalog block, the scope_mix (how many reasons of each scope level were applicable), and the full vector_execution_log (every vector attempted, whether it executed, and what it returned).

${OUTPUT_FORMAT_SECTION}`,
  variables: ['category', 'platform'],
  outputSchema: {
    name: BRONZE_STANDARD_SCAN_SCHEMA_NAME,
    description: 'Bronze Standard Scan (National Establishment) — covers every applicable catalog reason at national scope, embeds the revision-stamped catalog snapshot, and produces the national bronze-standard profile.',
  },
  isDefault: false,
  intelligenceFocus: 'bronze_standards' as const,
  intelligenceCampaignKind: 'establishment' as const,
};

// ─── 2. DISCOVERY template (city — stage 2) ──────────────────────────────

const BRONZE_STANDARD_SCAN_DISCOVERY_TEMPLATE = {
  id: 'mpt-seed-bronze-standard-scan-discovery-001',
  name: 'Seek: Bronze Standard Scan (City Discovery)',
  promptType: 'seek' as const,
  scope: 'intelligence' as const,
  body: `You are a bronze-standard analyst. Your task is to map what INVISIBLE looks like for a category in a specific market: the lowest digital quality at which a real, operating, category-qualified business can exist here, typed by WHY it is invisible.

CATEGORY: {{category}}
PLATFORM FOCUS: {{platform}}

=== WHAT THIS SCAN IS ===
This is the CITY discovery scan (stage 2). The BRONZE STANDARD NATIONAL REFERENCE and BRONZE REASON CATALOG sections below (injected by the platform) are your hunt list — the established reason map this market must cover. Produce exactly one reason_coverage entry per applicable reason.

Your output becomes the market's bronze profile: the calibration artifact the emerging discovery scan consumes to know what a hard-to-find business looks like here and which vectors reach it. The geographic search scope is specified in the SEARCH SCOPE section at the end of this prompt.

${THREE_PART_GATE_SECTION}

${COVERAGE_VOCABULARY_SECTION}

=== NATIONAL PROOF STATES ===
The national reference tells you which reasons are already proven somewhere:
- A reason proven nationally but empty in this market is reported
  empty_proven_elsewhere — the reason is real; this market just did not
  yield an exemplar this pass.
- A reason with no exemplar at ANY evaluable scope is empty_unproven — but
  you still hunt it. The hunt is how it becomes proven.
- Reasons in the catalog that do not apply at this scope go in
  not_applicable_reasons, never in reason_coverage.

${PROVENANCE_SECTION}

${PROHIBITED_INFERENCES_SECTION}

=== SCAN METADATA ===
Record the catalog_revision stamped on the injected catalog block, the scope_mix, and the full vector_execution_log (every vector attempted, whether it executed, and what it returned).

${OUTPUT_FORMAT_SECTION}`,
  variables: ['category', 'platform'],
  outputSchema: {
    name: BRONZE_STANDARD_SCAN_SCHEMA_NAME,
    description: 'Bronze Standard Scan (City Discovery) — covers every applicable reason at the market scope using the national bronze profile as the hunt list; produces the city bronze-standard profile consumed by emerging discovery.',
  },
  isDefault: false,
  intelligenceFocus: 'bronze_standards' as const,
  intelligenceCampaignKind: 'discovery' as const,
};

// ─── Seed logic ──────────────────────────────────────────────────────────

type BronzeStandardScanTemplate = {
  id: string;
  name: string;
  promptType: 'seek';
  scope: 'intelligence';
  body: string;
  variables: string[];
  outputSchema: { name: string; description: string };
  isDefault: boolean;
  intelligenceFocus: 'bronze_standards';
  intelligenceCampaignKind: 'establishment' | 'discovery';
};

async function seedTemplate(template: BronzeStandardScanTemplate) {
  const service = MarketingPromptService.getInstance();
  const existing = await service.getTemplate(template.id);
  if (existing) {
    await service.updateTemplate(template.id, {
      name: template.name,
      body: template.body,
      variables: template.variables,
      outputSchema: template.outputSchema,
      intelligenceFocus: template.intelligenceFocus,
      intelligenceCampaignKind: template.intelligenceCampaignKind,
    });
    logger.info(`Updated bronze standard scan template: ${template.id}`, undefined, { id: template.id, kind: template.intelligenceCampaignKind });
  } else {
    await service.createTemplate({
      id: template.id,
      name: template.name,
      promptType: template.promptType,
      scope: template.scope,
      body: template.body,
      variables: template.variables,
      outputSchema: template.outputSchema,
      isDefault: template.isDefault,
      intelligenceFocus: template.intelligenceFocus,
      intelligenceCampaignKind: template.intelligenceCampaignKind,
    });
    logger.info(`Created bronze standard scan template: ${template.id}`, undefined, { id: template.id, kind: template.intelligenceCampaignKind });
  }
}

async function main() {
  await seedTemplate(BRONZE_STANDARD_SCAN_ESTABLISHMENT_TEMPLATE);
  await seedTemplate(BRONZE_STANDARD_SCAN_DISCOVERY_TEMPLATE);
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: (err as Error).message });
  process.exit(1);
});
