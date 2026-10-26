import { prisma } from "../src/prisma";
import DirectoryPresenceSeedService from "../src/services/DirectoryPresenceSeedService";

/**
 * Heal campaign-first PG seeding drift.
 *
 * Queue entries whose business campaign graduated BEFORE the proving-
 * ground preflight minted the seed never got a
 * directory_seed_campaign_links row (and missed the seek→seed
 * graduation), because createCampaignFromQueue's heal only ran when
 * queue.seed_id was already stamped at promote time. The
 * createSeedsForProvingGround already_seeded branch now converges the
 * processed campaign itself — 'sibling' link + preflight graduation —
 * so this script routes every drifted entry through it.
 *
 * Drift detection: seed_id + processed_campaign_id set, and either the
 * (seed, campaign) link row is missing or the campaign still sits at
 * 'seek'. Both sides are idempotent — existing link rows are left alone
 * and the graduation is stage-guarded.
 *
 * Usage:
 *   cd apps/api && doppler run --config <local|prd> -- npx tsx scripts/heal-processed-campaign-seed-links.ts
 */
async function main() {
  const rows = await prisma.$queryRaw<{ id: string; business_name: string }[]>`
    SELECT q.id, q.business_name
    FROM mkt_prospect_queue q
    JOIN mkt_campaigns_list c ON c.id = q.processed_campaign_id
    WHERE q.seed_id IS NOT NULL
      AND q.processed_campaign_id IS NOT NULL
      AND (
        c.stage = 'seek'
        OR NOT EXISTS (
          SELECT 1 FROM directory_seed_campaign_links d
          WHERE d.campaign_id = q.processed_campaign_id
            AND d.seed_id = q.seed_id
        )
      )
    ORDER BY q.business_name
  `;

  console.log(`[heal] ${rows.length} queue entries need processed-campaign seed convergence`);
  for (const r of rows) console.log(`  - ${r.id}  ${r.business_name}`);
  if (rows.length === 0) return;

  const result = await DirectoryPresenceSeedService.createSeedsForProvingGround(
    rows.map((r) => r.id),
    'heal-processed-campaign-seed-links',
    { actorType: 'system', actorId: 'script:heal-processed-campaign-seed-links' },
  );
  console.log('[heal] result:', JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error('[heal] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
