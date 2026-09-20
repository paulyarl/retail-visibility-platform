/**
 * One-off script: assign `category` to seeded prompt templates so the
 * campaign Prompts tab groups them instead of dumping them under
 * "Uncategorized".
 *
 * Only touches `category` + `updated_at` — bodies, variables, and schemas
 * are left alone (deliberately NOT a seed re-run: seed-marketing-ops-templates
 * does a full-body replace that would strip the audit-v2 wiring from
 * mpt-seed-seek-001).
 *
 * The same category values are also declared in the owning seed scripts, so
 * categories survive reseeds / fresh environments:
 *   - seed-marketing-ops-templates.ts
 *   - seed-deliverable-source-material-templates.ts
 *   - seed-category-identification-template.ts
 *
 * Also corrects mpt-je6m7ru6 ("Seek: Business Audit V1"), which was manually
 * filed under "Review Response" despite being a business_analysis audit —
 * moved to "Digital Audit" alongside the V2 audit variants.
 *
 * Idempotent — safe to re-run.
 *
 * Usage (from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/set-prompt-template-categories.ts
 *   doppler run --config prd   -- npx tsx src/scripts/set-prompt-template-categories.ts
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

const TEMPLATE_CATEGORIES: Record<string, string> = {
  // Digital audits
  'mpt-seed-seek-001': 'Digital Audit',
  'mpt-je6m7ru6': 'Digital Audit',
  'mpt-seed-category-identification-001': 'Category Identification',
  // Review pipeline
  'mpt-seed-filter-001': 'Review Response',
  'mpt-seed-fulfill-001': 'Review Response',
  // Deliverable pipeline
  'mpt-review-intake': 'Deliverables',
  'mpt-deliverable-source-material': 'Deliverables',
  'mpt-seed-fulfill-002': 'Deliverables',
  'mpt-seed-fulfill-003': 'Deliverables',
  'mpt-seed-fulfill-004': 'Deliverables',
  'mpt-seed-fulfill-005': 'Deliverables',
  'mpt-seed-fulfill-006': 'Deliverables',
  'mpt-seed-fulfill-007': 'Deliverables',
  'mpt-seed-fulfill-008': 'Deliverables',
  // Market scans
  'mpt-seed-seek-002': 'Market Analysis',
  'mpt-seed-seek-003': 'Market Analysis',
  // Retainer
  'mpt-seed-retainer-001': 'Retainer',
};

async function main() {
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const [id, category] of Object.entries(TEMPLATE_CATEGORIES)) {
    const existing = await prisma.mkt_prompt_templates_list.findUnique({
      where: { id },
      select: { id: true, name: true, category: true },
    });

    if (!existing) {
      logger.warn(`Template not found — skipping: ${id}`);
      missing++;
      continue;
    }

    if (existing.category === category) {
      skipped++;
      continue;
    }

    await prisma.mkt_prompt_templates_list.update({
      where: { id },
      data: { category, updated_at: new Date() },
    });
    logger.info(`${id} (${existing.name}): category "${existing.category ?? 'null'}" -> "${category}"`);
    updated++;
  }

  logger.info(`Done: ${updated} updated, ${skipped} already correct, ${missing} not found`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Failed to set prompt template categories', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
