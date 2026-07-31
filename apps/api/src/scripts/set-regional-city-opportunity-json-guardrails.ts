/**
 * One-off script: append explicit JSON array-labeling guardrails to the
 * "Output Rules" section of the "Seek: City REGION Review Response V1" prompt
 * template body.
 *
 * Motivation: external agents occasionally emit labeled array elements
 * (e.g. `decline_3: { ... }` instead of `{ ... }`) when the schema example
 * shows only one array member. This produces invalid JSON that fails the
 * external-import endpoint. The guardrail rule explicitly forbids the pattern.
 *
 * Idempotent — detects whether the guardrail text is already present and
 * skips if so. Safe to re-run.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/set-regional-city-opportunity-json-guardrails.ts
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

const TEMPLATE_NAME = 'Seek: City REGION Review Response V1';

const GUARDRAIL_MARKER = 'NEVER prefix an array element with a label';
const GUARDRAIL_BLOCK = `
Array Element Rule
Every element of a JSON array (for example city_rankings, top_city_opportunities, regional_category_opportunities, common_opportunity_themes, representative_categories, sources) MUST be a bare JSON object { ... } or bare value, separated from the previous element by a comma only.
NEVER prefix an array element with a label, key name, identifier, or comment.
The following are INVALID and will be rejected:
[ { "rank": 1, ... }, decline_2: { "rank": 2, ... } ]
[ { "rank": 1, ... }, city_3: { "rank": 3, ... } ]
The correct form is:
[ { "rank": 1, ... }, { "rank": 2, ... }, { "rank": 3, ... } ]
`;

async function main() {
  const existing = await prisma.mkt_prompt_templates_list.findFirst({
    where: { name: TEMPLATE_NAME },
  });

  if (!existing) {
    logger.error(`Template not found by name: "${TEMPLATE_NAME}". Create it in the UI first, then re-run this script.`);
    process.exit(1);
  }

  if (existing.body.includes(GUARDRAIL_MARKER)) {
    logger.info(`Template "${existing.name}" (${existing.id}) already contains the JSON array-labeling guardrail. No changes made.`);
    process.exit(0);
  }

  // Insert the guardrail block immediately before the "JSON Output Schema" section,
  // which is the natural place to reinforce output-format rules.
  const JSON_OUTPUT_SCHEMA_HEADER = 'JSON Output Schema';
  const insertionIndex = existing.body.indexOf(JSON_OUTPUT_SCHEMA_HEADER);
  if (insertionIndex === -1) {
    logger.error(`Could not find "${JSON_OUTPUT_SCHEMA_HEADER}" header in template body. Aborting to avoid corrupting the prompt.`);
    process.exit(1);
  }

  const updatedBody =
    existing.body.slice(0, insertionIndex) +
    GUARDRAIL_BLOCK.trim() +
    '\n\n' +
    existing.body.slice(insertionIndex);

  await prisma.mkt_prompt_templates_list.update({
    where: { id: existing.id },
    data: {
      body: updatedBody,
      updated_at: new Date(),
    },
  });

  logger.info(`Updated template "${existing.name}" (${existing.id}) body with JSON array-labeling guardrail.`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Failed to set regional city opportunity JSON guardrails', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
