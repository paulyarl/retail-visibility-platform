/**
 * One-off script: attach the `city_category_opportunity` output_schema to the
 * "Local Category Audit (Seek)" prompt template.
 *
 * The template was created via the UI (non-deterministic id), so we look it up
 * by name and set `output_schema = { name: 'city_category_opportunity', ... }`.
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   pnpm seed:mkt-templates:city-category-schema
 *   # or: npx tsx apps/api/src/scripts/set-city-category-opportunity-schema.ts
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { CITY_CATEGORY_OPPORTUNITY_SCHEMA_NAME } from '../validators/city-category-opportunity.schema';

const TEMPLATE_NAME = 'Local Category Audit (Seek)';

const OUTPUT_SCHEMA = {
  name: CITY_CATEGORY_OPPORTUNITY_SCHEMA_NAME,
  description:
    'Single-category, single-city market scan: business discovery, deduplication, sampling, per-platform benchmarks (Google/Yelp/Facebook/website), competitive landscape, top competitor rankings with visibility scores, sampled business details, common digital-presence issues, opportunity gaps (geographic/services/digital), category digital opportunity score, outreach recommendation, recommended tier + fee, data quality, and structured sources. Excludes national/regional chains and franchise locations; targets independent operators and local chains (2–5 metro-area locations).',
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

  logger.info(`Updated template "${existing.name}" (${existing.id}) output_schema -> ${CITY_CATEGORY_OPPORTUNITY_SCHEMA_NAME}`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Failed to set city_category_opportunity output_schema', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
