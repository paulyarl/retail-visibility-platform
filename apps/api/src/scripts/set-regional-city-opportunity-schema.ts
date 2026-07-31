/**
 * One-off script: attach the `regional_city_opportunity` output_schema to the
 * "Seek: City REGION Review Response V1" prompt template.
 *
 * The template was created via the UI (non-deterministic id), so we look it up
 * by name and set `output_schema = { name: 'regional_city_opportunity', ... }`.
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   pnpm seed:mkt-templates:regional-schema
 *   # or: npx tsx apps/api/src/scripts/set-regional-city-opportunity-schema.ts
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { REGIONAL_CITY_OPPORTUNITY_SCHEMA_NAME } from '../validators/regional-city-opportunity.schema';

const TEMPLATE_NAME = 'Seek: City REGION Review Response V1';

const OUTPUT_SCHEMA = {
  name: REGIONAL_CITY_OPPORTUNITY_SCHEMA_NAME,
  description:
    'Regional city opportunity discovery scan: ranks cities within a radius of a reference city by visible local-business digital-marketing opportunity (review response, GBP maintenance, website adoption, NAP consistency, market depth, accessibility).',
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

  logger.info(`Updated template "${existing.name}" (${existing.id}) output_schema -> ${REGIONAL_CITY_OPPORTUNITY_SCHEMA_NAME}`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Failed to set regional city opportunity output_schema', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
