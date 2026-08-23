/**
 * Seed script: Gold Standard Scan Templates (Gold Standard System — Sprint 0)
 *
 * Seeds TWO prompt templates for gold-standard scans:
 *
 * 1. ESTABLISHMENT (mpt-seed-gold-standard-scan-001):
 *    intelligence_campaign_kind = 'establishment'. The analyst DERIVES
 *    expected_fields and quality_gates from the top candidates. The
 *    validated JSON is persisted as a DRAFT gold-standard profile by
 *    IntelligenceProfileService.importAsDraft().
 *
 * 2. DISCOVERY (mpt-seed-gold-standard-scan-discovery-001):
 *    intelligence_campaign_kind = 'discovery'. The analyst EVALUATES
 *    candidates against the already-established gold-standard profile
 *    (injected at render time by MarketingExecutionService.resolvePrompt
 *    via serializeGoldStandard(profile, 'discovery')). The validated JSON
 *    creates an audit so the campaign's Audits tab can render the
 *    discovered candidates. Discovery scans do NOT create a profile draft.
 *
 * Both templates use the 'intelligence' scope, focus = 'gold_standards',
 * and output_schema = { name: 'gold_standard_scan' }.
 *
 * Idempotent — uses deterministic IDs so re-running updates in place.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-gold-standard-scan-template.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';
import { GOLD_STANDARD_SCAN_SCHEMA_NAME } from '../validators/gold-standard-scan.schema';

// ─── Shared prompt sections (used by both templates) ─────────────────────

const ELIGIBILITY_SECTION = `=== ELIGIBILITY — INDEPENDENT BUSINESSES ONLY ===
This scan targets INDEPENDENT, owner-operated businesses. The gold standard must reflect what an excellent independent operator can realistically achieve — NOT what a national chain with dedicated marketing staff can do. Chain and franchise profiles are structurally unreachable benchmarks for independent operators and must be excluded.

EXCLUDE these business types from candidacy:
- National or regional chains (more than ~10 corporate-owned locations)
- Franchised systems (businesses operating under a franchisor brand, even if a single unit is locally owned)
- Corporate-owned subsidiaries of holding companies or public companies
- Big-box or mass retailers where this category is a department, not the whole business
- Professional-only / trade-only distributors that do not sell to the general public (unless the category explicitly targets trade-only)

A business is ELIGIBLE if it is:
- Single-location, OR a small locally-owned group (<= ~10 locations) under common local ownership, AND
- Independently branded (not a licensed franchise name or national chain banner), AND
- Open to the general public (retail, not trade-only — unless the category is inherently trade-only)

For each candidate, you MUST record:
- ownership_type: "independent" | "small_group" | "franchise" | "chain"
- location_count_estimate: approximate number of locations (number or null)
- independence_rationale: a brief note on why this business qualifies as independent

If a well-known business in this category is a franchise or chain, do NOT include it as a candidate. Instead, note the exclusion in scan_metadata.excluded_candidates with the business name and exclusion reason. This prevents future scans from re-surfacing the same chain.`;

const CANDIDATE_EVALUATION_SECTION = `Evaluate each candidate per platform:
- profile_url: the LIVE destination URL on the platform (e.g. "https://www.google.com/maps/place/...")
- quality_score: 0-10 based on profile completeness, branding, accuracy, engagement
- quality_rationale: why this score
- is_gold_standard: true for the TOP candidates per platform (up to 4), relative to the candidate pool. The best available candidate on a platform qualifies even if they don't pass every quality gate — the quality_score and quality_gates_passed/failed capture the absolute quality signal so operators can see how strong the benchmark actually is. Only independent/small_group businesses can qualify.
- branding_artifacts: what the candidate has (logo, cover photo, photo count, photo types)
- platform_config: categories, attributes, description quality
- quality_gates_passed/failed: which gates this candidate passed/failed (informational — does NOT filter is_gold_standard)
- ownership_type, location_count_estimate, independence_rationale: recorded per candidate (see ELIGIBILITY)`;

const BRANDING_ARTIFACTS_SECTION = `=== BRANDING ARTIFACTS ===
Capture branding artifacts for each candidate:
- has_logo, has_cover_photo, has_profile_photo
- photo_count, photo_types
- visual_assets (platform-specific visual requirements)

These become branding quality gates and audit gap-analysis inputs.`;

const OUTPUT_FORMAT_SECTION = `=== OUTPUT REQUIREMENT ===
Respond with a SINGLE JSON object only. Do NOT wrap it in markdown code fences. Do NOT include prose before or after the JSON. Do NOT include commentary. The JSON object must match the structure described in the EXPECTED OUTPUT FORMAT section below.

=== EXPECTED OUTPUT FORMAT ===
Return a single JSON object with this structure (the Gold Standard Scan result):
{
  "category_key": "<normalized category key, lowercase, spaces collapsed>",
  "category_name": "<display name>",
  "platform_focus": "all|google|yelp|facebook|bbb|apple_maps|bing",

  "expected_fields": {
    "universal": {
      "canonical_name": "<string|null>",
      "canonical_address": "<string|null>",
      "canonical_phone": "<string|null>",
      "hours_present": <boolean|null>,
      "website_present": <boolean|null>,
      "quality_gates": [
        { "field": "<string>", "description": "<string>", "severity": "non_negotiable|recommended" }
      ],
      "fields": [
        { "field": "<string>", "description": "<string>", "severity": "non_negotiable|recommended" }
      ]
    },
    "platforms": {
      "google": {
        "primary_category": "<string|null>",
        "additional_categories": ["<string>", ...],
        "required_attributes": ["<string>", ...],
        "recommended_attributes": ["<string>", ...],
        "description_requirements": "<string|null>",
        "page_type": "<string|null>",
        "expected_photo_count": <number|null>,
        "branding_expectations": {
          "has_logo": <boolean|null>,
          "has_cover_photo": <boolean|null>,
          "has_profile_photo": <boolean|null>,
          "photo_count": <number|null>,
          "photo_types": ["<string>", ...],
          "visual_assets": ["<string>", ...]
        },
        "quality_gates": [
          { "field": "<string>", "description": "<string>", "severity": "non_negotiable|recommended" }
        ],
        "fields": [
          { "field": "<string>", "description": "<string>", "severity": "non_negotiable|recommended" }
        ]
      },
      "yelp": { ...same structure... },
      "facebook": { ...same structure... }
    }
  },

  "candidates": [
    {
      "business_name": "<string>",
      "city": "<string>",
      "state": "<string>",
      "nap": {
        "name": "<string|null>",
        "address": "<string|null>",
        "phone": "<string|null>"
      },
      "ownership_type": "independent|small_group|franchise|chain",
      "location_count_estimate": <number|null>,
      "independence_rationale": "<string: why this business qualifies as independent>",
      "platform_evaluations": [
        {
          "platform": "google|yelp|facebook|bbb|apple_maps|bing",
          "profile_url": "<string|null> (the live profile URL on this platform)",
          "quality_score": <number 0-10>,
          "quality_rationale": "<string>",
          "is_gold_standard": <boolean>,
          "branding_artifacts": {
            "has_logo": <boolean|null>,
            "has_cover_photo": <boolean|null>,
            "has_profile_photo": <boolean|null>,
            "photo_count": <number|null>,
            "photo_types": ["<string>", ...],
            "visual_assets": ["<string>", ...]
          },
          "platform_config": { "<key>": "<value>", ... },
          "quality_gates_passed": ["<gate field name>", ...],
          "quality_gates_failed": ["<gate field name>", ...]
        }
      ],
      "category_notes": "<string|null>"
    }
  ],

  "scan_metadata": {
    "scan_date": "<ISO date>",
    "sources_consulted": ["<source name>", ...],
    "selection_criteria": "<string>",
    "platforms_evaluated": ["google", "yelp", ...],
    "expected_field_derivation": "<string>",
    "platform_focus": "all|google|yelp|facebook|bbb|apple_maps|bing",
    "excluded_candidates": [
      { "business_name": "<string>", "reason": "<string: why excluded (franchise/chain/etc.)>" }
    ]
  }
}

Rules:
- For establishment scans: find the best 3-5 candidate businesses nationwide
  for this category on the target platform(s). Derive expected_fields from
  what the top candidates have in common. Evaluate each candidate per platform
  with quality_score, is_gold_standard flag, and branding artifacts.
- For discovery scans: evaluate additional candidates against the already-
  established expected_fields and quality gates. Flag is_gold_standard for the
  top candidates per platform relative to the pool and existing benchmark.
- profile_url is the LIVE destination URL on the platform (e.g.
  "https://www.google.com/maps/place/..."). Always capture this — it becomes
  the exemplar URL shown to operators and referenced in audit benchmarks.
- branding_artifacts capture what the candidate has (logo, cover photo, photo
  count, photo types). These become branding quality gates and audit gap inputs.
- quality_gates use severity "non_negotiable" for must-have fields and
  "recommended" for nice-to-have fields. Quality gates are aspirational targets
  derived from the top candidates — they do NOT filter is_gold_standard. A
  candidate can be flagged is_gold_standard on a platform without passing every
  gate. The quality_gates_passed/failed fields capture the gap so operators can
  see how strong the benchmark actually is.
- category_key should be the normalized (lowercase, whitespace-collapsed) category name.
- Flag the TOP candidates per platform as is_gold_standard = true (up to 4 per
  platform), relative to the candidate pool. The best available candidate on a
  platform qualifies even if they have gaps — the quality_score reflects
  absolute quality so operators know how strong the benchmark is.
- INDEPENDENT BUSINESSES ONLY. Only independent or small locally-owned groups
  (<= ~10 locations) qualify as gold-standard candidates. Franchises, chains,
  and corporate subsidiaries must be excluded and noted in
  scan_metadata.excluded_candidates with the business name and exclusion reason.
  Each candidate MUST include ownership_type, location_count_estimate, and
  independence_rationale. A candidate with ownership_type "franchise" or "chain"
  cannot have is_gold_standard = true.
- Aim for geographic diversity: select candidates across at least 3 distinct
  states/regions when possible to avoid coastal/metro clustering.`;

// ─── 1. ESTABLISHMENT template (derives expected_fields) ─────────────────

const GOLD_STANDARD_SCAN_ESTABLISHMENT_TEMPLATE = {
  id: 'mpt-seed-gold-standard-scan-001',
  name: 'Seek: Gold Standard Scan (Establishment)',
  promptType: 'seek' as const,
  scope: 'intelligence' as const,
  body: `You are a gold-standard analyst. Your task is to find and evaluate the best-in-class businesses for a category on a specific platform (or all platforms), and produce a gold-standard profile that defines what "excellent" looks like for this category.

CATEGORY: {{category}}
PLATFORM FOCUS: {{platform}}

=== OBJECTIVE ===
Find 3-5 candidate businesses nationwide that exemplify the best-in-class profile for this category. Evaluate each candidate per platform against quality gates, branding standards, and expected fields. Derive the expected_fields and quality_gates from what the top candidates have in common.

The gold-standard profile will be used to:
1. Benchmark business audits — compare a business's actual profile against the gold standard
2. Guide fulfillment — produce fixes that move a business toward the gold-standard target
3. Enrich intelligence establishment and discovery with category-specific terminology and signals

=== PLATFORM FOCUS ===
{{platform}} is the platform this scan focuses on. If the platform is "all", evaluate candidates across all major platforms (Google, Yelp, Facebook, BBB, Apple Maps, Bing). If a specific platform is named, focus the evaluation on that platform but still note cross-platform presence.

${ELIGIBILITY_SECTION}

=== CANDIDATE SELECTION ===
Find the BEST AVAILABLE independent businesses for this category. Not every candidate will be perfect — in many niches, no independent operator has a flawless cross-platform presence. Your job is to identify the strongest candidates in the pool and slot them as the benchmark, even if they have gaps.

Prioritize (in rough order):
- Independent, owner-operated businesses (see ELIGIBILITY section — no franchises, chains, or corporate subsidiaries)
- Correct primary category and clear category-specific positioning
- Functional website and published hours
- Recognizable branding (logo, photos)
- Active community presence (reviews, social engagement, local recognition)
- Geographic diversity — span at least 3 distinct states/regions when possible

Do NOT require a candidate to have every quality above before flagging them is_gold_standard. Flag the TOP candidates per platform (up to 4) relative to what the pool actually contains. A 6/10 Bing presence may be the best available benchmark for this category on Bing — flag it and let the quality_score and quality_gates_failed tell operators how strong the benchmark is.

${CANDIDATE_EVALUATION_SECTION}

=== EXPECTED FIELDS ===
Derive expected_fields from the top candidates:
- universal: fields every gold-standard profile should have (canonical NAP, hours, website)
- platforms: per-platform expected fields (primary category, attributes, description, photo count, branding)
- quality_gates: non_negotiable (must-have) and recommended (nice-to-have) gates

${BRANDING_ARTIFACTS_SECTION}

=== SCAN METADATA ===
Record:
- scan_date
- sources_consulted (Google, Yelp, industry directories, etc.)
- selection_criteria used to identify candidates
- platforms_evaluated
- expected_field_derivation (how expected fields were derived)
- platform_focus

${OUTPUT_FORMAT_SECTION}`,
  variables: ['category', 'platform'],
  outputSchema: {
    name: GOLD_STANDARD_SCAN_SCHEMA_NAME,
    description: 'Gold Standard Scan (Establishment) — candidate businesses evaluated per platform with quality scores, branding artifacts, expected fields, and quality gates. Derives the gold-standard profile from scratch.',
  },
  isDefault: false,
  intelligenceFocus: 'gold_standards' as const,
  intelligenceCampaignKind: 'establishment' as const,
};

// ─── 2. DISCOVERY template (evaluates against the established profile) ───

const GOLD_STANDARD_SCAN_DISCOVERY_TEMPLATE = {
  id: 'mpt-seed-gold-standard-scan-discovery-001',
  name: 'Seek: Gold Standard Scan (Discovery)',
  promptType: 'seek' as const,
  scope: 'intelligence' as const,
  body: `You are a gold-standard analyst. Your task is to find and evaluate additional candidate businesses for a category on a specific platform (or all platforms), and evaluate them against the ALREADY-ESTABLISHED gold-standard profile for this category.

CATEGORY: {{category}}
PLATFORM FOCUS: {{platform}}

=== OBJECTIVE ===
Find 3-5 ADDITIONAL candidate businesses nationwide that were NOT already captured in the establishment scan. Evaluate each candidate per platform against the established expected fields, quality gates, and branding standards (provided below in the GOLD STANDARD DISCOVERY CRITERIA section).

This is a DISCOVERY scan — the gold-standard profile has already been established by a prior establishment scan. Your job is to evaluate NEW candidates against that established bar, NOT to re-derive expected_fields or quality_gates.

The gold-standard profile will be used to:
1. Benchmark business audits — compare a business's actual profile against the gold standard
2. Guide fulfillment — produce fixes that move a business toward the gold-standard target
3. Enrich intelligence establishment and discovery with category-specific terminology and signals

=== PLATFORM FOCUS ===
{{platform}} is the platform this scan focuses on. If the platform is "all", evaluate candidates across all major platforms (Google, Yelp, Facebook, BBB, Apple Maps, Bing). If a specific platform is named, focus the evaluation on that platform but still note cross-platform presence.

${ELIGIBILITY_SECTION}

=== CANDIDATE SELECTION ===
Find ADDITIONAL independent businesses that were NOT already evaluated in the establishment scan. As with establishment, do NOT require candidates to have a flawless profile before flagging them is_gold_standard. Flag the TOP candidates per platform (up to 4) relative to the pool — a candidate that is stronger than the existing benchmark on a platform qualifies even if they don't pass every quality gate.

Prioritize (in rough order):
- Independent, owner-operated businesses (see ELIGIBILITY section)
- Were NOT already evaluated in the establishment scan (find new candidates, not duplicates)
- Correct primary category and clear category-specific positioning
- Functional website and published hours
- Recognizable branding (logo, photos)
- Active community presence
- Geographic diversity — span at least 3 distinct states/regions when possible

${CANDIDATE_EVALUATION_SECTION}

=== EVALUATION CRITERIA ===
The GOLD STANDARD DISCOVERY CRITERIA section below (injected by the platform) contains the established expected_fields, quality_gates, and pattern exemplars from the prior establishment scan. Use these as your evaluation reference:

1. For each candidate, check whether they pass or fail each quality gate and record the results.
2. Flag is_gold_standard = true for the TOP candidates per platform (up to 4), relative to the candidate pool AND the existing benchmark exemplars. A candidate that is at least as strong as the existing benchmark on a platform qualifies — they do NOT need to pass every non_negotiable gate. The quality_score and quality_gates_passed/failed capture the absolute quality signal.
3. Score quality_score based on how closely the candidate matches the established expected fields.
4. Record quality_gates_passed and quality_gates_failed for each platform evaluation (informational — does NOT filter is_gold_standard).
5. ECHO the established expected_fields in your output (do not re-derive them). The expected_fields in your output JSON should match the established profile's expected_fields.

If no GOLD STANDARD DISCOVERY CRITERIA section appears below, the platform is running in degraded mode (no active gold-standard profile). In that case, fall back to deriving expected_fields from the top candidates you find, and note this in scan_metadata.expected_field_derivation.

${BRANDING_ARTIFACTS_SECTION}

=== SCAN METADATA ===
Record:
- scan_date
- sources_consulted (Google, Yelp, industry directories, etc.)
- selection_criteria used to identify candidates
- platforms_evaluated
- expected_field_derivation (state "echoed from established profile v<version>" or "derived from candidates (degraded mode — no active profile)")
- platform_focus

${OUTPUT_FORMAT_SECTION}`,
  variables: ['category', 'platform'],
  outputSchema: {
    name: GOLD_STANDARD_SCAN_SCHEMA_NAME,
    description: 'Gold Standard Scan (Discovery) — additional candidate businesses evaluated against the already-established gold-standard profile. Does NOT re-derive expected_fields; echoes them from the established profile.',
  },
  isDefault: false,
  intelligenceFocus: 'gold_standards' as const,
  intelligenceCampaignKind: 'discovery' as const,
};

// ─── Seed logic ──────────────────────────────────────────────────────────

type GoldStandardScanTemplate = {
  id: string;
  name: string;
  promptType: 'seek';
  scope: 'intelligence';
  body: string;
  variables: string[];
  outputSchema: { name: string; description: string };
  isDefault: boolean;
  intelligenceFocus: 'gold_standards';
  intelligenceCampaignKind: 'establishment' | 'discovery';
};

async function seedTemplate(template: GoldStandardScanTemplate) {
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
    logger.info(`Updated gold standard scan template: ${template.id}`, undefined, { id: template.id, kind: template.intelligenceCampaignKind });
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
    logger.info(`Created gold standard scan template: ${template.id}`, undefined, { id: template.id, kind: template.intelligenceCampaignKind });
  }
}

async function main() {
  await seedTemplate(GOLD_STANDARD_SCAN_ESTABLISHMENT_TEMPLATE);
  await seedTemplate(GOLD_STANDARD_SCAN_DISCOVERY_TEMPLATE);
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: (err as Error).message });
  process.exit(1);
});
