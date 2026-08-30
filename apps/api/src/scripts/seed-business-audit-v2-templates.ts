/**
 * Seed script: Business Audit V2 — wire both intelligence profiles into both
 * seek variants.
 *
 * The two Business Audit V2 templates (Category-Integrated + Signal-Aligned)
 * have the Category Intelligence block AND the Gold Standard Benchmark block
 * appended at runtime by MarketingExecutionService.resolvePrompt(). However,
 * the template BODIES did not instruct the model on how to apply those blocks,
 * and the embedded JSON schemas did not define the output fields the blocks
 * require. This script wires both profiles into both bodies:
 *
 *   - mpt-j9bbem3l (Category-Integrated): already had Category Intelligence
 *     wired in; this adds the Gold Standard binding section + schema fields
 *     (profile_url, gap_analysis, quality_gate_results).
 *   - mpt-6oeuiizo (Signal-Aligned): had NEITHER profile wired in; this adds
 *     the Category Intelligence binding section + all missing CI instruction
 *     sections + schema fields, PLUS the Gold Standard binding section +
 *     schema fields.
 *
 * Idempotency: each variant has a marker string. If the marker is already
 * present in the live body, that variant is skipped (update-in-place safety
 * per AGENTS.md — check for the presence of the NEW marker, not the absence
 * of an old section).
 *
 * Usage (from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/seed-business-audit-v2-templates.ts
 *   doppler run --config prd -- npx tsx src/scripts/seed-business-audit-v2-templates.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';

// ─── Template IDs ────────────────────────────────────────────────────────
const CATEGORY_INTEGRATED_ID = 'mpt-j9bbem3l';
const SIGNAL_ALIGNED_ID = 'mpt-6oeuiizo';

// ─── Markers (presence => already wired, skip) ───────────────────────────
const GOLD_STANDARD_MARKER = 'Gold Standard Benchmark — Binding for This Audit';
const CATEGORY_INTELLIGENCE_MARKER = 'Category Intelligence — Binding for This Audit';

// ─── Shared binding-section text ─────────────────────────────────────────

const CATEGORY_INTELLIGENCE_BINDING = `Category Intelligence — Binding for This Audit
A CATEGORY INTELLIGENCE block is appended to the end of this prompt (after the JSON schema). It contains category-specific terminology, specialized sources, evidence rules, prohibited inferences, and category signals for the business category being audited.

You MUST apply the Category Intelligence block throughout this audit. Specifically:

Terminology — Use the category-specific terms listed in the block as corroboration signals when evaluating whether the business genuinely fits the requested category. A single term is never sufficient; require multiple category-specific indicators.
Specialized Sources — Consult the Specialized Sources listed in the block in addition to the mainstream platforms listed in the Platforms section below. Record every consulted source in specialized_sources_audited and sources.
Evidence Rules — Obey every rule in the block's Category Evidence Rules section. These rules are binding and override any conflicting default behavior.
Prohibited Inferences — Do NOT make any inference listed in the block's PROHIBITED INFERENCES section. These are category-specific guardrails that complement (and are stricter than) the general cautions in this template.
Category Signals — Populate detected_signals with any INT_* codes from the block's Category Signals list when verified public evidence supports them. These are admissible alongside the RA_*, DS_*, WC_*, CP_*, and VP_* signal families defined later in this template.
Absence Is Not a Negative — If a website, social profile, delivery option, specialty product, or certification listed in the block is not found, record that it was "not verified." Do not convert absence into a claim that the asset does not exist.
If the Category Intelligence block is missing or empty, proceed with the general audit instructions and note the absence in data_quality.limitations.
`;

const GOLD_STANDARD_BINDING = `Gold Standard Benchmark — Binding for This Audit
A GOLD STANDARD BENCHMARK block is appended to the end of this prompt (after the Category Intelligence block). It contains category-specific expected fields, quality gates, per-platform expected attributes, branding/photo expectations, and pattern exemplars for the business category being audited.

You MUST apply the Gold Standard block as a comparison benchmark throughout this audit. Specifically:

Expected Fields — Compare the business's actual profile against the Universal Expected Fields and each platform's Expected Fields. For every field where the business's actual value differs from the expected value, record a gap entry in gap_analysis.gaps with the platform, field name, expected value, actual value, gap description, and severity (non_negotiable or recommended).
Quality Gates — Evaluate each quality gate (Universal and per-platform). Record pass/fail in quality_gate_results.results with the platform, gate name, passed boolean, severity, and notes.
Profile URLs — Capture the live profile URL for each platform in platforms.{platform}.profile_url so the benchmark comparison references a concrete destination.
Platform Scope — The benchmark may define expected fields for platforms beyond the four audited here (google, yelp, facebook, bbb) — e.g., bing, apple_maps. For those platforms, evaluate the expected fields where publicly observable and record any gaps in gap_analysis.gaps with the platform field set accordingly; do not create platform objects for them in the platforms block.
Absence vs. Non-Negotiable — A non_negotiable quality gate or expected field is recorded as failed (passed: false) ONLY when the field is verified absent. When a field cannot be verified (not found during searched discovery paths), record passed: null and note "not verified" — do NOT convert inability to verify into a failure. This reconciles the benchmark's non_negotiable gates with the Category Intelligence absence-is-not-a-negative rule.
Subject-as-Exemplar — If the audited business appears in the benchmark's Pattern Exemplars section, treat those exemplar notes as reference priors only (not as a self-comparison). Use the other exemplar businesses as competitive comparators; do not benchmark the business against itself.
If the Gold Standard block is missing or empty, omit gap_analysis and quality_gate_results and note the absence in data_quality.limitations.
`;

// ─── Schema fragment: profile_url (inserted before data_status in each
//     platform object) ────────────────────────────────────────────────────
const PROFILE_URL_SCHEMA_LINE = '"profile_url": null,\n      "data_status": "unavailable"';

// ─── Schema fragment: gap_analysis + quality_gate_results (inserted before
//     the final closing brace, after the sources array) ───────────────────
const GAP_AND_GATES_SCHEMA = `  "gap_analysis": {
    "gaps": [
      {
        "platform": "",
        "field": "",
        "expected": null,
        "actual": null,
        "gap_description": "",
        "severity": "non_negotiable"
      }
    ],
    "summary": ""
  },
  "quality_gate_results": {
    "results": [
      {
        "platform": "",
        "gate": "",
        "passed": null,
        "severity": "non_negotiable",
        "notes": ""
      }
    ],
    "summary": ""
  }`;

// ─── Prompt 2 (Signal-Aligned) missing CI instruction sections ───────────

const STORE_FORMAT_SECTION_MD = `
### Store format classification (required)

Classify the matched business's primary operational format and record it in \`matched_business.store_format\`. Use one of:

* grocery
* grocery_plus_prepared_foods
* bakery
* butcher
* restaurant
* caterer
* wholesaler
* beauty_retailer
* online_seller
* service
* unknown

If the business is a hybrid (e.g., grocery + restaurant), set \`store_format\` to the primary format and describe the secondary operation in \`matched_business.hybrid_role\`. Compare like-for-like when benchmarking.
`;

const SPECIALIZED_SOURCES_MD = `Additionally, consult the Specialized Sources listed in the Category Intelligence block. These may include delivery marketplaces, social platforms (Instagram, TikTok, WhatsApp), vertical directories, importer/wholesaler locators, community organizations, cultural event vendor lists, and business registration records. Record every source consulted in \`specialized_sources_audited\`.

Per the Category Intelligence evidence rules, do not treat absence from a platform as evidence that the business is inactive, nonexistent, or unqualified.
`;

const CATEGORY_FIT_MD = `* Category fit assessment (required): Evaluate whether the GBP primary_category and additional_categories reflect the requested business category or a generic/incorrect label. Record your assessment in \`platforms.google.category_fit_assessment\`. Per the Category Intelligence evidence rules, a generic category label alone does not establish or deny category fit — corroborate with multiple indicators.
`;

const CATEGORY_CONTENT_CHECK_MD = `* Category-specific content check: Evaluate whether the website surfaces category-relevant products, services, terminology, or ordering/pickup options as defined in the Category Intelligence block. Record findings in \`website.category_specific_content_present\` and \`website.ordering_or_pickup_info_present\`. Absence of category-specific content is recorded as "not_verified," not as a negative claim.
`;

const NAP_ABSENCE_MD = `Do not add points solely because information is unavailable (per the Category Intelligence evidence rule \`absence_is_not_a_negative\`).
`;

const INT_SIGNALS_MD = `
### Category Intelligence Signals
Use any \`INT_*\` signal codes defined in the Category Intelligence block's "Category Signals" section. Apply them only when verified public evidence supports the signal. Common examples include (but are not limited to — defer to the block's exact definitions):

* \`INT_MULTISOURCE_IDENTITY\`: Identity corroborated across multiple independent sources.
* \`INT_ACTIVE_OPERATIONAL_EVIDENCE\`: Recent owner updates, current hours, recent customer activity, current ordering, or recent posts/reviews support active operation.
* \`INT_CATEGORY_SPECIALIZATION\`: Multiple category-specific indicators confirm the requested category specialization.
* \`INT_UNDEREXPOSED_CREDENTIAL\`: A relevant credential is present but underexposed digitally.
* \`INT_POSSIBLE_CATEGORY_MISALIGNMENT\`: Directory categories or descriptions conflict with the requested specialization.
* \`INT_VERTICAL_SOURCE_DISCOVERY\`: Business was discoverable primarily through a vertical/specialized source rather than mainstream directories.
* \`INT_RECENT_BUSINESS_EVIDENCE\`: Evidence of recent business activity within the last 90 days.
* \`INT_LOW_VISIBILITY\`: Low mainstream directory visibility despite verifiable operation.
* \`INT_WEAK_MAINSTREAM_INDEXING\`: Mainstream directory listings are sparse, stale, or poorly categorized.
* \`INT_SINGLE_SOURCE\`: Business is verifiable from only one independent source.
* \`INT_HIDDEN_TRUST\`: Strong community or vertical trust signals with weak mainstream trust signals.

If the Category Intelligence block defines additional or different \`INT_*\` codes, use the block's definitions.
`;

const OPERATIONAL_STATUS_SECTION_MD = `
---

## Operational Status

Determine whether the business is currently operational based on recent evidence (per the Category Intelligence rule \`active_operation_requires_recent_evidence\`). Recent evidence includes: recent owner updates, current hours, recent customer activity, current ordering availability, recent product posts, or recent reviews.

Do not infer active operation solely from an old listing. Record your finding in \`operational_status\`:

* status: one of active / likely_active / inactive / unable_to_verify
* last_activity_evidence: concise description of the most recent operational evidence found
* last_activity_date: ISO 8601 date of the most recent activity, or null
* evidence_sources: array of source platforms where the activity was observed
`;

const COMPETITIVE_BENCHMARK_SECTION_MD = `---

## Competitive Benchmark (Category-Relative Positioning)

Identify up to 3 competitive benchmarks in the same market that are demonstrably in the same business category (per the Category Intelligence rule \`leader_requires_category_fit\`). High mainstream visibility alone is insufficient — each benchmark must have verified evidence of category fit.

For each benchmark, record:

* business_name
* store_format (same enum as the audited business)
* geographic_reach
* product_breadth: narrow / moderate / broad
* prepared_food_component: true/false
* delivery_model: none / marketplace / direct / both
* regional_specialization: null or a concise description
* google_rating, google_review_count, yelp_rating, yelp_review_count (when available)
* profile_completeness_score: 0–10 (your rubric: claimed status, hours, photos, description, website link, ordering link, posts, categories, attributes, NAP consistency)
* format_context_note: one sentence explaining comparability to the audited business
* specialization_evidence_direct: true if category fit is directly evidenced; false if inferred

Do not include a business as a benchmark solely because of high mainstream visibility. Disclose any benchmark whose category specialization is inferred rather than directly evidenced.

If no qualified benchmarks are found, return an empty array.
`;

const CATEGORY_THEMES_MD = `Additionally, consider category-specific themes suggested by the Category Intelligence block (e.g., product authenticity/freshness, regional assortment gaps, prepared-foods quality, imports cost, category-specific service gaps).
`;

const CATEGORY_SERVICES_MD = `Additionally, consider category-specific services suggested by the Category Intelligence block (e.g., category-specific GBP optimization, delivery marketplace listing cleanup, community/social channel activation, vertical directory enrollment).
`;

// ─── Prompt 2 schema fragments ───────────────────────────────────────────

const P2_MATCHED_BUSINESS_SCHEMA = `    "matched_business": {
      "business_name": null,
      "category": null,
      "store_format": "unknown",
      "hybrid_role": null,
      "address": null,
      "phone": null,
      "website": null
    },
    "identity_status": "confirmed",
    "identity_confidence": "high",
    "identity_corroboration_sources": [],
    "limitations": []`;

const P2_GOOGLE_CATEGORY_FIT = `      "additional_categories": [],
      "category_fit_assessment": null,
      "displayed_name": null,`;

const P2_SPECIALIZED_SOURCES_SCHEMA = `  "specialized_sources_audited": [
    {
      "source": "",
      "tier": 1,
      "source_type": "",
      "consulted": false,
      "findings": "",
      "url": null,
      "accessed_date": ""
    }
  ],
  "combined_review_metrics": {`;

const P2_WEBSITE_CATEGORY_FIELDS = `    "location_information_present": "unable_to_verify",
    "category_specific_content_present": "unable_to_verify",
    "ordering_or_pickup_info_present": "unable_to_verify",
    "issues": [],`;

const P2_OPERATIONAL_STATUS_SCHEMA = `  "operational_status": {
    "status": "unable_to_verify",
    "last_activity_evidence": null,
    "last_activity_date": null,
    "evidence_sources": []
  },
  "competitive_benchmarks": [
    {
      "business_name": "",
      "store_format": "",
      "geographic_reach": "",
      "product_breadth": "",
      "prepared_food_component": false,
      "delivery_model": "",
      "regional_specialization": null,
      "google_rating": null,
      "google_review_count": null,
      "yelp_rating": null,
      "yelp_review_count": null,
      "profile_completeness_score": 0,
      "format_context_note": "",
      "specialization_evidence_direct": true
    }
  ],
  "unanswered_negative_review_examples": [`;

// ─── Insertion helpers ───────────────────────────────────────────────────

/** Insert `insertion` immediately after the first occurrence of `anchor`. */
function insertAfter(body: string, anchor: string, insertion: string): string {
  const idx = body.indexOf(anchor);
  if (idx === -1) {
    throw new Error(`Anchor not found in body:\n  ${anchor.slice(0, 120)}...`);
  }
  return body.slice(0, idx + anchor.length) + insertion + body.slice(idx + anchor.length);
}

/** Insert `insertion` immediately before the first occurrence of `anchor`. */
function insertBefore(body: string, anchor: string, insertion: string): string {
  const idx = body.indexOf(anchor);
  if (idx === -1) {
    throw new Error(`Anchor not found in body:\n  ${anchor.slice(0, 120)}...`);
  }
  return body.slice(0, idx) + insertion + body.slice(idx);
}

/** Replace the first occurrence of `from` with `to`. Throws if not found. */
function replaceFirst(body: string, from: string, to: string): string {
  const idx = body.indexOf(from);
  if (idx === -1) {
    throw new Error(`Replacement target not found in body:\n  ${from.slice(0, 120)}...`);
  }
  return body.slice(0, idx) + to + body.slice(idx + from.length);
}

// ─── Prompt 1 (Category-Integrated) transformation ───────────────────────

function transformCategoryIntegrated(body: string): string {
  // 1. Insert Gold Standard binding section after the Category Intelligence
  //    binding section (which ends with the "If the Category Intelligence
  //    block is missing or empty..." line).
  let out = insertAfter(
    body,
    'If the Category Intelligence block is missing or empty, proceed with the general audit instructions and note the absence in data_quality.limitations.',
    '\n' + GOLD_STANDARD_BINDING,
  );

  // 2. Add profile_url to each platform object in the embedded JSON schema.
  //    All four platform objects end with `"data_status": "unavailable"`.
  out = out.split('"data_status": "unavailable"').join(PROFILE_URL_SCHEMA_LINE);

  // 3. Add gap_analysis + quality_gate_results after the sources array
  //    (replacing the sources close + top-level close with sources close +
  //    comma + new fields + top-level close).
  out = replaceFirst(out, '  ]\n}', '  ],\n' + GAP_AND_GATES_SCHEMA + '\n}');

  return out;
}

// ─── Prompt 2 (Signal-Aligned) transformation ───────────────────────────

function transformSignalAligned(body: string): string {
  let out = body;

  // 1. Insert both binding sections after the intro cautions, before the
  //    first "---" separator.
  out = insertAfter(
    out,
    'Never invent or assume data.',
    '\n\n' + CATEGORY_INTELLIGENCE_BINDING + '\n' + GOLD_STANDARD_BINDING,
  );

  // 2. Store format classification — after the identity-verification conflict
  //    paragraph.
  out = insertAfter(
    out,
    'When multiple matching businesses exist and the correct business cannot be determined, set identity status to ambiguous and explain the conflict in the data quality section.',
    STORE_FORMAT_SECTION_MD,
  );

  // 3. Specialized sources — after the platform list's review-response note.
  out = insertAfter(
    out,
    'Do not estimate review-response counts unless an authorized source explicitly provides an estimate.',
    '\n' + SPECIALIZED_SOURCES_MD,
  );

  // 4. Category fit assessment — after "Duplicate or conflicting listing
  //    signals" in the Google Business Profile Assessment.
  out = insertAfter(
    out,
    '* Duplicate or conflicting listing signals',
    '\n' + CATEGORY_FIT_MD,
  );

  // 5. Category-specific content check — after "Conversion opportunities" in
  //    the Website Assessment.
  out = insertAfter(
    out,
    '* Conversion opportunities',
    '\n' + CATEGORY_CONTENT_CHECK_MD,
  );

  // 6. Absence rule — replace the existing NAP-score line in Digital
  //    Opportunity Score.
  out = replaceFirst(
    out,
    'Do not add points solely because information is unavailable.',
    NAP_ABSENCE_MD,
  );

  // 7. INT_* signals — after the VP_STALE_SOCIAL_ACTIVITY line, before the
  //    "---" that closes the Detected Audit Signals section.
  out = insertAfter(
    out,
    '* `VP_STALE_SOCIAL_ACTIVITY`: Social media profile has no posts in $>60$ days.',
    INT_SIGNALS_MD,
  );

  // 8. Operational Status + Competitive Benchmark sections — after the
  //    Detected Audit Signals section's closing "---", before "## Unanswered
  //    Negative Review Examples".
  out = insertBefore(
    out,
    '## Unanswered Negative Review Examples',
    OPERATIONAL_STATUS_SECTION_MD + COMPETITIVE_BENCHMARK_SECTION_MD + '\n---\n\n',
  );

  // 9. Category-specific themes — after "Unresolved complaints" in Negative
  //    Review Themes.
  out = insertAfter(out, '* Unresolved complaints', '\n' + CATEGORY_THEMES_MD);

  // 10. Category-specific services — after "Reputation reporting" in
  //     Recommended Services.
  out = insertAfter(out, '* Reputation reporting', '\n' + CATEGORY_SERVICES_MD);

  // 11. Store format in Summary — after the alignment-classification line.
  out = insertAfter(
    out,
    '* Alignment classification (e.g., ADMIN_NEGLECT, BALANCED_HEALTHY, etc.)',
    '\n* Store format / hybrid role',
  );

  // ── Schema insertions ──────────────────────────────────────────────────

  // 12. matched_business: add store_format, hybrid_role, and
  //     identity_corroboration_sources.
  out = replaceFirst(
    out,
    `    "matched_business": {
      "business_name": null,
      "category": null,
      "address": null,
      "phone": null,
      "website": null
    },
    "identity_status": "confirmed",
    "identity_confidence": "high",
    "limitations": []`,
    P2_MATCHED_BUSINESS_SCHEMA,
  );

  // 13. google: add category_fit_assessment after additional_categories.
  out = replaceFirst(
    out,
    `      "additional_categories": [],
      "displayed_name": null,`,
    P2_GOOGLE_CATEGORY_FIT,
  );

  // 14. Add profile_url to each platform object in the schema.
  out = out.split('"data_status": "unavailable"').join(PROFILE_URL_SCHEMA_LINE);

  // 15. specialized_sources_audited — insert before combined_review_metrics.
  out = replaceFirst(
    out,
    '  "combined_review_metrics": {',
    P2_SPECIALIZED_SOURCES_SCHEMA,
  );

  // 16. website: add category-specific content fields.
  out = replaceFirst(
    out,
    `    "location_information_present": "unable_to_verify",
    "issues": [],`,
    P2_WEBSITE_CATEGORY_FIELDS,
  );

  // 17. operational_status + competitive_benchmarks — insert before
  //     unanswered_negative_review_examples.
  out = replaceFirst(
    out,
    '  "unanswered_negative_review_examples": [',
    P2_OPERATIONAL_STATUS_SCHEMA,
  );

  // 18. gap_analysis + quality_gate_results — after the sources array.
  out = replaceFirst(out, '  ]\n}', '  ],\n' + GAP_AND_GATES_SCHEMA + '\n}');

  return out;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const service = MarketingPromptService.getInstance();
  const prisma = (service as any).prisma;

  const tasks: Array<{
    id: string;
    label: string;
    marker: string;
    transform: (body: string) => string;
  }> = [
    {
      id: CATEGORY_INTEGRATED_ID,
      label: 'Business Digital Audit - Cohesive (Category-Integrated)',
      marker: GOLD_STANDARD_MARKER,
      transform: transformCategoryIntegrated,
    },
    {
      id: SIGNAL_ALIGNED_ID,
      label: 'Business Digital Audit - Alignment Scoring (Signal-Aligned)',
      marker: CATEGORY_INTELLIGENCE_MARKER,
      transform: transformSignalAligned,
    },
  ];

  let updated = 0;
  let skipped = 0;

  for (const task of tasks) {
    try {
      const existing = await prisma.mkt_prompt_templates_list.findUnique({
        where: { id: task.id },
      });

      if (!existing) {
        logger.error(`Template not found: ${task.id} (${task.label})`);
        continue;
      }

      if (existing.body.includes(task.marker)) {
        logger.info(`Already wired — skipping: ${task.label}`);
        skipped++;
        continue;
      }

      const newBody = task.transform(existing.body);

      // Safety: confirm the marker is now present after transformation.
      if (!newBody.includes(task.marker)) {
        logger.error(`Transformation did not produce marker for: ${task.label}`);
        continue;
      }

      await prisma.mkt_prompt_templates_list.update({
        where: { id: task.id },
        data: {
          body: newBody,
          updated_at: new Date(),
        },
      });

      logger.info(`Wired both profiles into: ${task.label}`, {
        templateId: task.id,
        oldLength: existing.body.length,
        newLength: newBody.length,
      });
      updated++;
    } catch (err) {
      logger.error(`Failed to wire template: ${task.label}`, undefined, {
        templateId: task.id,
        error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      });
    }
  }

  logger.info(`Seed complete: ${updated} updated, ${skipped} skipped (already wired)`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
