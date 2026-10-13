/**
 * Seed script: Engagement Brief — the Pass 2 template (mpt-seed-brief-001).
 *
 * Spec: docs/AUDIT_CHANNEL_SCAN_AND_OPPORTUNITY_COLLECTION_SPEC.md —
 * "Two-Pass Architecture: Gather, Then Judge". Pass 1 (mpt-seed-seek-001,
 * business_analysis) collects channel evidence; Pass 2 consumes the stored
 * audit and emits the engagement_brief spine that downstream projections
 * render from.
 *
 * Mirrors the seed-business-audit-v2 pattern: the canonical body lives in
 * src/scripts/engagement-brief-default-body.md and is applied wholesale
 * when the body's seed-version marker is older than DEFAULT_BRIEF_MARKER.
 * Edit the .md asset and bump the marker to re-apply. output_schema is
 * force-applied on every run (the marker gates body transforms, not column
 * fixes) — without {"name":"engagement_brief"} the import endpoint 400s.
 *
 * Idempotent: creates the template when absent, skips when the marker is
 * current. Safe to re-run on any environment.
 *
 * Usage (from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/seed-engagement-brief-template.ts
 *   doppler run --config prd -- npx tsx src/scripts/seed-engagement-brief-template.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';

const ENGAGEMENT_BRIEF_TEMPLATE_ID = 'mpt-seed-brief-001';

// ─── Output schema declaration ───────────────────────────────────────────
// The /prompts/executions/external import endpoint resolves the validator
// via template.output_schema->>'name' through OUTPUT_SCHEMA_REGISTRY.
// auditPlatform='engagement_brief' lands the brief as an mkt_audits_list
// row — the persisted spine (spec OQ3 storage decision: audit row, not a
// dedicated table).
const ENGAGEMENT_BRIEF_OUTPUT_SCHEMA = {
  name: 'engagement_brief',
  description:
    'Pass 2 engagement brief — ranked pains/assets/capability_fits/' +
    'verification_gates spine with evidence_index refs into the source ' +
    'business_analysis audit. Code-stamped side + source_audit_id.',
};

// Versioned marker — bump when the canonical body changes so already-seeded
// templates get re-applied.
const DEFAULT_BRIEF_MARKER = '<!-- seed-version: engagement-brief-default-2026-10-13-v1 -->';

// The body references business identity vars plus the render-time sourced
// evidence block (resolvePrompt auto-sources these when
// output_schema.name === 'engagement_brief').
const BRIEF_VARIABLES = [
  'business_name', 'city', 'state', 'category',
  'source_audit', 'source_audit_id', 'footprint_side',
];

function loadBriefBody(): string {
  const body = readFileSync(
    join(__dirname, 'engagement-brief-default-body.md'),
    'utf8',
  );
  if (!body.includes(DEFAULT_BRIEF_MARKER)) {
    throw new Error(
      'engagement-brief-default-body.md is missing its DEFAULT_BRIEF_MARKER — the asset is the canonical body and must carry the marker for the idempotency gate.',
    );
  }
  return body;
}

async function main() {
  const service = MarketingPromptService.getInstance();
  const prisma = (service as any).prisma;

  const body = loadBriefBody();
  const existing = await prisma.mkt_prompt_templates_list.findUnique({
    where: { id: ENGAGEMENT_BRIEF_TEMPLATE_ID },
  });

  if (!existing) {
    await prisma.mkt_prompt_templates_list.create({
      data: {
        id: ENGAGEMENT_BRIEF_TEMPLATE_ID,
        name: 'Engagement Brief',
        prompt_type: 'seek',
        category: 'Engagement Brief',
        body,
        variables: BRIEF_VARIABLES,
        output_schema: ENGAGEMENT_BRIEF_OUTPUT_SCHEMA,
        is_active: true,
        is_default: true,
        created_by: 'system',
      },
    });
    logger.info('Created engagement brief template', undefined, {
      templateId: ENGAGEMENT_BRIEF_TEMPLATE_ID,
    });
    process.exit(0);
  }

  const needsOutputSchema =
    (existing.output_schema as { name?: string } | null)?.name !==
    ENGAGEMENT_BRIEF_OUTPUT_SCHEMA.name;
  const bodyStale = !existing.body.includes(DEFAULT_BRIEF_MARKER);

  if (!bodyStale && !needsOutputSchema) {
    logger.info('Already wired — skipping: Engagement Brief', undefined, {
      templateId: ENGAGEMENT_BRIEF_TEMPLATE_ID,
    });
    process.exit(0);
  }

  await prisma.mkt_prompt_templates_list.update({
    where: { id: ENGAGEMENT_BRIEF_TEMPLATE_ID },
    data: {
      ...(bodyStale ? { body, variables: BRIEF_VARIABLES } : {}),
      output_schema: ENGAGEMENT_BRIEF_OUTPUT_SCHEMA,
      is_active: true,
      is_default: true,
      updated_at: new Date(),
    },
  });
  logger.info('Updated engagement brief template', undefined, {
    templateId: ENGAGEMENT_BRIEF_TEMPLATE_ID,
    bodyReapplied: bodyStale,
  });
  process.exit(0);
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
