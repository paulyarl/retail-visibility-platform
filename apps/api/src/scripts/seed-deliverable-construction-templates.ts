/**
 * Seed script: Deliverable Construction prompt templates
 *
 * Seeds the 13 prompt-execution templates that back the deliverable
 * construction workspace's analyst hops (normalization: every hop rides
 * MarketingExecutionService.executeSingle / renderPrompt so each gains an
 * execution record, MARKETING_OPS_AI_MODEL, and a dual internal/external
 * lane):
 *
 *   - mpt-owner-voice-inference               raw_json   voice extraction JSON
 *   - mpt-review-response-draft               (none)     per-slot owner response (prose)
 *   - mpt-deliverable-section-*   (11 types)  (none)     section content (prose)
 *
 * External lanes:
 *   - Voice inference: render via OwnerVoiceService.renderInferencePrompt →
 *     external LLM → POST /prompts/executions/external (raw_json validates)
 *     → OwnerVoiceService.applyVoiceExecution persists the profile.
 *   - Slots/sections: render via ReviewSlotService.renderSlotPrompt /
 *     DeliverableSectionService.renderSectionPrompt → external LLM → the
 *     existing PUT update endpoints write back prose (response_source /
 *     source: 'external'). Prose hops stay prose — no JSON wrap.
 *
 * Bodies are imported from deliverable/prompts.ts (single definition — no
 * drift between code builders and seeded templates). Idempotent —
 * deterministic IDs, update-in-place. Bump SEED_VERSION_MARKER to force a
 * body re-sync on already-seeded rows.
 *
 * Usage (run from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/seed-deliverable-construction-templates.ts
 *   doppler run --config prd   -- npx tsx src/scripts/seed-deliverable-construction-templates.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';
import {
  VOICE_INFERENCE_PROMPT,
  DELIVERABLE_REVIEW_RESPONSE_PROMPT,
  RECOVERY_PLAYBOOK_PROMPT,
  LISTING_CORRECTIONS_PROMPT,
  CTA_FIXES_PROMPT,
  MOBILE_CATALOG_PROMPT,
  GBP_PHOTO_OPTIMIZATION_PROMPT,
  AVAILABILITY_INQUIRY_FLOW_PROMPT,
  FULFILLMENT_PATHWAY_PROMPT,
  HOURS_SYNC_PLAN_PROMPT,
  POSITIONING_REPORT_PROMPT,
  HOMEPAGE_MOCKUP_PROMPT,
  DOMAIN_MIGRATION_PLAN_PROMPT,
} from '../services/deliverable/prompts';

const SEED_VERSION_MARKER = '<!-- DELIVERABLE_CONSTRUCTION_SEED_V1 -->';

const RAW_JSON = { name: 'raw_json' };

interface SeedTemplate {
  id: string;
  name: string;
  promptType: 'seek' | 'fulfill';
  category: string;
  body: string;
  variables: string[];
  outputSchema: { name: string } | null;
  isDefault: boolean;
}

// Shared variable groups — see ownerVoiceVariables / businessContextVariables
// in deliverable/prompts.ts.
const BIZ_CTX_VARS = [
  'business_name',
  'business_category',
  'business_origin',
  'business_city',
  'business_state',
];

const VOICE_VARS = [
  'voice_person',
  'voice_formality',
  'voice_humor',
  'voice_apology_style',
  'voice_signoff_style',
  'voice_signature',
];

const SEED_TEMPLATES: SeedTemplate[] = [
  {
    id: 'mpt-owner-voice-inference',
    name: 'Deliverable Construction: Owner Voice Inference',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${VOICE_INFERENCE_PROMPT}`,
    variables: ['owner_responses'],
    outputSchema: RAW_JSON,
    isDefault: false,
  },
  {
    id: 'mpt-review-response-draft',
    name: 'Deliverable Construction: Review Response Draft',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${DELIVERABLE_REVIEW_RESPONSE_PROMPT}`,
    variables: [
      ...BIZ_CTX_VARS,
      ...VOICE_VARS,
      'business_phone',
      'business_website',
      'campaign_tone',
      'review_platform',
      'review_rating',
      'review_date',
      'review_text',
    ],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-section-recovery-playbook',
    name: 'Deliverable Section: Recovery Playbook',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${RECOVERY_PLAYBOOK_PROMPT}`,
    variables: [...BIZ_CTX_VARS, ...VOICE_VARS, 'theme_clusters'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-section-listing-corrections',
    name: 'Deliverable Section: Listing Corrections',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${LISTING_CORRECTIONS_PROMPT}`,
    variables: [
      ...BIZ_CTX_VARS,
      'nap_variations',
      'canonical_name',
      'canonical_phone',
      'canonical_address',
      'platforms_list',
    ],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-section-cta-fixes',
    name: 'Deliverable Section: CTA & Website Fixes',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${CTA_FIXES_PROMPT}`,
    variables: [...BIZ_CTX_VARS, 'website_url', 'missing_ctas', 'conversion_opportunities'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-section-mobile-catalog',
    name: 'Deliverable Section: Mobile Catalog Preview',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${MOBILE_CATALOG_PROMPT}`,
    variables: [...BIZ_CTX_VARS, 'product_categories'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-section-gbp-photo',
    name: 'Deliverable Section: GBP Photo Optimization',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${GBP_PHOTO_OPTIMIZATION_PROMPT}`,
    variables: [...BIZ_CTX_VARS, 'photo_count', 'photo_types_present', 'photo_types_missing'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-section-availability-inquiry',
    name: 'Deliverable Section: Availability Inquiry Flow',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${AVAILABILITY_INQUIRY_FLOW_PROMPT}`,
    variables: [...BIZ_CTX_VARS, 'contact_methods'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-section-fulfillment-pathway',
    name: 'Deliverable Section: Fulfillment Pathway',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${FULFILLMENT_PATHWAY_PROMPT}`,
    variables: [...BIZ_CTX_VARS, 'fulfillment_status'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-section-hours-sync',
    name: 'Deliverable Section: Hours Sync Plan',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${HOURS_SYNC_PLAN_PROMPT}`,
    variables: [...BIZ_CTX_VARS, 'regular_hours_status', 'special_hours_status', 'business_type'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-section-positioning-report',
    name: 'Deliverable Section: Web Presence Report',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${POSITIONING_REPORT_PROMPT}`,
    variables: [...BIZ_CTX_VARS, 'presence_state', 'gap_findings'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-section-homepage-mockup',
    name: 'Deliverable Section: Homepage Mockup',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${HOMEPAGE_MOCKUP_PROMPT}`,
    variables: [...BIZ_CTX_VARS, 'presence_state', 'must_have_pages'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-section-domain-migration',
    name: 'Deliverable Section: Domain Migration Plan',
    promptType: 'fulfill',
    category: 'Deliverables',
    body: `${SEED_VERSION_MARKER}\n${DOMAIN_MIGRATION_PLAN_PROMPT}`,
    variables: [...BIZ_CTX_VARS, 'presence_state', 'build_scope'],
    outputSchema: null,
    isDefault: false,
  },
];

async function main() {
  const service = MarketingPromptService.getInstance();
  const prisma = (service as any).prisma;
  let created = 0;
  let updated = 0;

  for (const template of SEED_TEMPLATES) {
    try {
      const existing = await prisma.mkt_prompt_templates_list.findUnique({ where: { id: template.id } });
      const data = {
        name: template.name,
        prompt_type: template.promptType,
        category: template.category,
        body: template.body,
        variables: template.variables,
        output_schema: template.outputSchema,
        is_active: true,
        is_default: template.isDefault,
        updated_at: new Date(),
      };

      if (existing) {
        await prisma.mkt_prompt_templates_list.update({ where: { id: template.id }, data });
        updated++;
        logger.info(`Updated template: ${template.name}`);
      } else {
        await prisma.mkt_prompt_templates_list.create({
          data: { id: template.id, ...data, created_by: 'system' },
        });
        created++;
        logger.info(`Created template: ${template.name}`);
      }
    } catch (err) {
      logger.error(`Failed to seed template: ${template.name}`, undefined, {
        error: err instanceof Error ? { message: err.message } : String(err),
      });
    }
  }

  logger.info(`Seed complete: ${created} created, ${updated} updated`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
