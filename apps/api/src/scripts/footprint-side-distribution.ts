/**
 * footprint-side-distribution — OQ8 measurement pass.
 *
 * Runs the real `classifyFootprintSide` over every stored business_analysis
 * audit and prints the density_score distribution, so the emerging ↔
 * competitive boundary (COMPETITIVE_DENSITY_THRESHOLD) is tunable off real
 * sweeps rather than guessed — the spec's recommended way to close OQ8.
 *
 * Run:  cd apps/api && doppler run --config <local|prd> -- npx tsx src/scripts/footprint-side-distribution.ts
 *
 * Stub audits (queue-promotion / discovery placeholders) carry no
 * channel-scan evidence and would pile at score 0, so they are counted
 * separately and excluded from the distribution.
 */
import { prisma } from '../prisma';
import {
  classifyFootprintSide,
  COMPETITIVE_DENSITY_THRESHOLD,
  FOOTPRINT_SIDE_CLASSIFIER_VERSION,
} from '../services/engagement-brief/footprint-side';
import { isStubBusinessAnalysisAudit } from '../lib/marketing-audits';
import type { BusinessAnalysisAuditData } from '../services/outreach-openers/archetype-selection';

const NEAR_BOUNDARY = 2; // scores within ±2 of the threshold get listed

async function main() {
  const rows = await prisma.mkt_audits_list.findMany({
    where: { platform: 'business_analysis' },
    select: { id: true, campaign_id: true, audit_data: true, created_at: true },
    orderBy: { created_at: 'desc' },
  });

  let stubs = 0;
  const histogram = new Map<number, number>();
  const nearBoundary: { id: string; campaignId: string; score: number; inputs: string[] }[] = [];
  let competitive = 0;

  for (const row of rows) {
    if (isStubBusinessAnalysisAudit(row)) {
      stubs++;
      continue;
    }
    const result = classifyFootprintSide(row.audit_data as unknown as BusinessAnalysisAuditData);
    histogram.set(result.density_score, (histogram.get(result.density_score) ?? 0) + 1);
    if (result.side === 'competitive') competitive++;
    if (Math.abs(result.density_score - COMPETITIVE_DENSITY_THRESHOLD) <= NEAR_BOUNDARY) {
      nearBoundary.push({
        id: row.id,
        campaignId: row.campaign_id,
        score: result.density_score,
        inputs: result.inputs_used,
      });
    }
  }

  const scored = rows.length - stubs;
  console.log(`business_analysis audits: ${rows.length} (${stubs} stubs excluded, ${scored} scored)`);
  console.log(`classifier v${FOOTPRINT_SIDE_CLASSIFIER_VERSION}, threshold ${COMPETITIVE_DENSITY_THRESHOLD}`);
  console.log(`split: ${scored - competitive} emerging / ${competitive} competitive\n`);

  console.log('density_score histogram:');
  for (const [score, count] of [...histogram.entries()].sort((a, b) => a[0] - b[0])) {
    const marker = score === COMPETITIVE_DENSITY_THRESHOLD ? '  <- threshold' : '';
    console.log(`  ${String(score).padStart(3)} | ${'#'.repeat(count)} ${count}${marker}`);
  }

  console.log(`\nnear-boundary audits (score ${COMPETITIVE_DENSITY_THRESHOLD - NEAR_BOUNDARY}-${COMPETITIVE_DENSITY_THRESHOLD + NEAR_BOUNDARY}): ${nearBoundary.length}`);
  for (const n of nearBoundary) {
    console.log(`  ${n.id} campaign=${n.campaignId} score=${n.score}`);
    for (const input of n.inputs) console.log(`      ${input}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
