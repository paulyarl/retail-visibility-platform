/**
 * Seed script: Gold Standard Scan Template (Gold Standard System — Sprint 0)
 *
 * Seeds the prompt template that instructs an external AI to produce a
 * gold-standard scan result for a category on a specific platform (or all
 * platforms). The operator runs this prompt in an external AI, then imports
 * the result via /executions/external — the result is validated against the
 * gold_standard_scan schema.
 *
 * For establishment campaigns: the validated JSON is persisted as a DRAFT
 * gold-standard profile by IntelligenceProfileService.importAsDraft().
 * For discovery campaigns: the validated JSON creates an audit so the
 * campaign's Audits tab can render the discovered candidates.
 *
 * The template uses the 'intelligence' scope, focus = 'gold_standards',
 * and output_schema = { name: 'gold_standard_scan' }.
 *
 * Idempotent — uses a deterministic ID so re-running updates in place.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-gold-standard-scan-template.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';
import { GOLD_STANDARD_SCAN_SCHEMA_NAME } from '../validators/gold-standard-scan.schema';

const GOLD_STANDARD_SCAN_TEMPLATE = {
  id: 'mpt-seed-gold-standard-scan-001',
  name: 'Seek: Gold Standard Scan',
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

=== CANDIDATE SELECTION ===
Find businesses that:
- Have a strong, well-maintained profile on the target platform(s)
- Use the correct primary category and relevant additional categories
- Have comprehensive branding (logo, cover photo, multiple photos)
- Have accurate and consistent NAP (name, address, phone)
- Have a functional website linked from their profile
- Have active engagement (respond to reviews, post updates)
- Are recognized as leaders in their category by the community

Evaluate each candidate per platform:
- profile_url: the LIVE destination URL on the platform (e.g. "https://www.google.com/maps/place/...")
- quality_score: 0-10 based on profile completeness, branding, accuracy, engagement
- quality_rationale: why this score
- is_gold_standard: true if the candidate meets the bar (up to 4 per platform)
- branding_artifacts: what the candidate has (logo, cover photo, photo count, photo types)
- platform_config: categories, attributes, description quality
- quality_gates_passed/failed: which gates this candidate passed/failed

=== EXPECTED FIELDS ===
Derive expected_fields from the top candidates:
- universal: fields every gold-standard profile should have (canonical NAP, hours, website)
- platforms: per-platform expected fields (primary category, attributes, description, photo count, branding)
- quality_gates: non_negotiable (must-have) and recommended (nice-to-have) gates

=== BRANDING ARTIFACTS ===
Capture branding artifacts for each candidate:
- has_logo, has_cover_photo, has_profile_photo
- photo_count, photo_types
- visual_assets (platform-specific visual requirements)

These become branding quality gates and audit gap-analysis inputs.

=== SCAN METADATA ===
Record:
- scan_date
- sources_consulted (Google, Yelp, industry directories, etc.)
- selection_criteria used to identify candidates
- platforms_evaluated
- expected_field_derivation (how expected fields were derived)
- platform_focus

=== OUTPUT REQUIREMENT ===
Respond with a SINGLE JSON object only. Do NOT wrap it in markdown code fences. Do NOT include prose before or after the JSON. Do NOT include commentary. The JSON object must match the structure described in the EXPECTED OUTPUT FORMAT section below.`,
  variables: ['category', 'platform'],
  outputSchema: {
    name: GOLD_STANDARD_SCAN_SCHEMA_NAME,
    description: 'Gold Standard Scan — candidate businesses evaluated per platform with quality scores, branding artifacts, expected fields, and quality gates.',
  },
  isDefault: false,
  intelligenceFocus: 'gold_standards' as const,
};

async function main() {
  const service = MarketingPromptService.getInstance();

  const existing = await service.getTemplate(GOLD_STANDARD_SCAN_TEMPLATE.id);
  if (existing) {
    await service.updateTemplate(GOLD_STANDARD_SCAN_TEMPLATE.id, {
      name: GOLD_STANDARD_SCAN_TEMPLATE.name,
      body: GOLD_STANDARD_SCAN_TEMPLATE.body,
      variables: GOLD_STANDARD_SCAN_TEMPLATE.variables,
      outputSchema: GOLD_STANDARD_SCAN_TEMPLATE.outputSchema,
      intelligenceFocus: GOLD_STANDARD_SCAN_TEMPLATE.intelligenceFocus,
    });
    logger.info(`Updated gold standard scan template: ${GOLD_STANDARD_SCAN_TEMPLATE.id}`, undefined, { id: GOLD_STANDARD_SCAN_TEMPLATE.id });
  } else {
    await service.createTemplate({
      id: GOLD_STANDARD_SCAN_TEMPLATE.id,
      name: GOLD_STANDARD_SCAN_TEMPLATE.name,
      promptType: GOLD_STANDARD_SCAN_TEMPLATE.promptType,
      scope: GOLD_STANDARD_SCAN_TEMPLATE.scope,
      body: GOLD_STANDARD_SCAN_TEMPLATE.body,
      variables: GOLD_STANDARD_SCAN_TEMPLATE.variables,
      outputSchema: GOLD_STANDARD_SCAN_TEMPLATE.outputSchema,
      isDefault: GOLD_STANDARD_SCAN_TEMPLATE.isDefault,
      intelligenceFocus: GOLD_STANDARD_SCAN_TEMPLATE.intelligenceFocus,
    });
    logger.info(`Created gold standard scan template: ${GOLD_STANDARD_SCAN_TEMPLATE.id}`, undefined, { id: GOLD_STANDARD_SCAN_TEMPLATE.id });
  }
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: (err as Error).message });
  process.exit(1);
});
