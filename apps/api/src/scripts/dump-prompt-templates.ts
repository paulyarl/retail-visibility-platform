/**
 * Dump script: Prompt Template Inventory
 *
 * Regenerates docs/api-response/seek-prompt-templates.md — a raw capture of
 * GET /api/admin/marketing-ops/prompts/templates (unfiltered). Used to verify
 * seed re-runs landed: each template's updated_at should be newer than its
 * seed file's last git commit (AGENTS.md seed discipline).
 *
 * Reproduces the endpoint shape byte-for-byte: the route returns the Prisma
 * findMany result unmapped inside { success, data }, ordered by
 * is_default desc, created_at desc.
 *
 * Usage (from apps/api):
 *   doppler run --config prd   -- npx tsx src/scripts/dump-prompt-templates.ts
 *   doppler run --config local -- npx tsx src/scripts/dump-prompt-templates.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../prisma';

const OUT_PATH = path.resolve(process.cwd(), '../../docs/api-response/seek-prompt-templates.md');

async function main(): Promise<void> {
  const templates = await prisma.mkt_prompt_templates_list.findMany({
    orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify({ success: true, data: templates }));

  console.log(`Wrote ${templates.length} templates -> ${OUT_PATH}`);
  for (const t of templates) {
    if (t.id.includes('enrichment')) {
      const marker = /ENRICHMENT_DIRECTIVE_V\d+/.exec(t.body ?? '')?.[0] ?? 'NO MARKER';
      console.log(`  ${t.id}  updated_at=${t.updated_at?.toISOString()}  marker=${marker}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Dump failed:', err);
  process.exit(1);
});
