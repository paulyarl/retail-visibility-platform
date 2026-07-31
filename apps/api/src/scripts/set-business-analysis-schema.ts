/**
 * One-off script: attach the `business_analysis` output_schema to the
 * "Seek: Business Review Response V1" prompt template.
 *
 * The template was created via the UI (non-deterministic id), so we look it up
 * by name and set `output_schema = { name: 'business_analysis', ... }`.
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   pnpm seed:mkt-templates:business-schema
 *   # or: npx tsx apps/api/src/scripts/set-business-analysis-schema.ts
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { BUSINESS_ANALYSIS_SCHEMA_NAME } from '../validators/business-analysis.schema';

const TEMPLATE_NAME = 'Seek: Business Review Response V1';

const OUTPUT_SCHEMA = {
  name: BUSINESS_ANALYSIS_SCHEMA_NAME,
  description:
    'Single-business deep-dive audit with identity verification, per-platform review metrics, website assessment, NAP consistency, digital opportunity score, high-attention flag, recommended tier + fee, data quality block, and structured sources.',
};

async function main() {
  const existing = await prisma.mkt_prompt_templates_list.findFirst({
    where: { name: TEMPLATE_NAME },
  });

  if (!existing) {
    logger.error(`Template not found by name: "${TEMPLATE_NAME}". Create it in the UI first, then re-run this script.`);
    process.exit(1);
  }

  await prisma.mkt_prompt_templates_list.update({
    where: { id: existing.id },
    data: {
      output_schema: OUTPUT_SCHEMA,
      updated_at: new Date(),
    },
  });

  logger.info(`Updated template "${existing.name}" (${existing.id}) output_schema -> ${BUSINESS_ANALYSIS_SCHEMA_NAME}`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Failed to set business_analysis output_schema', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
