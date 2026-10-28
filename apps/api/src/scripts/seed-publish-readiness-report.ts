/**
 * Read-only publish-readiness report (§4.8).
 *
 * Answers, for every live seed: does it pass the publish gate today, and
 * would it pass after a recompose? Nothing is written.
 *
 * Usage (from apps/api):
 *   doppler run --config prd -- npx tsx src/scripts/seed-publish-readiness-report.ts
 *   doppler run --config prd -- npx tsx src/scripts/seed-publish-readiness-report.ts \
 *     --batch pg-mcamp-mdjvk2bu-20261023 --json /tmp/seed-readiness.json
 *
 * Options:
 *   --batch <label>  limit to one seed batch
 *   --campaign <id>  limit to seeds whose primary link is this campaign
 *   --limit <n>      stop after n seeds (useful for a spot check)
 *   --json <path>    also write the full result set as JSON
 */

import { writeFileSync } from 'node:fs';
import { prisma } from '../prisma';
import DirectoryPresenceSeedService from '../services/DirectoryPresenceSeedService';
import {
  evaluateSeedPublishability,
  type SeedPublishabilityBlocker,
} from '../services/directory/seedPublishability';

type Row = {
  seed_id: string;
  slug: string;
  business_name: string | null;
  seed_batch: string | null;
  status: string;
  description: string | null;
  address: string | null;
  category: string | null;
  city: string | null;
  phone: string | null;
  description_source: string | null;
  primary_campaign_id: string | null;
};

type Verdict =
  | 'already_publishable'
  | 'recompose_would_publish'
  | 'still_thin'
  | 'skip_claimed'
  | 'skip_suppressed'
  | 'skip_operator_override';

type ReportRow = {
  slug: string;
  batch: string | null;
  campaignId: string | null;
  status: string;
  currentPublishable: boolean;
  currentBlockers: SeedPublishabilityBlocker[];
  proposedPublishable: boolean;
  proposedBlockers: SeedPublishabilityBlocker[];
  descriptionSource: string;
  composedSource: string;
  verdict: Verdict;
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function facts(row: Row, description = row.description) {
  return {
    status: row.status,
    businessName: row.business_name,
    description,
    address: row.address,
    category: row.category,
  };
}

async function main() {
  const batch = arg('--batch');
  const campaign = arg('--campaign');
  const limit = Number(arg('--limit') ?? 0);
  const jsonPath = arg('--json');

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      dps.id AS seed_id,
      dll.slug,
      dll.business_name,
      dps.seed_batch,
      dps.status,
      dll.description,
      dll.address,
      dps.category,
      dll.city,
      dll.phone,
      (
        SELECT dfp.source_name
        FROM directory_field_provenance dfp
        WHERE dfp.seed_id = dps.id AND dfp.field_key = 'description'
        ORDER BY dfp.updated_at DESC NULLS LAST
        LIMIT 1
      ) AS description_source,
      (
        SELECT dscl.campaign_id
        FROM directory_seed_campaign_links dscl
        WHERE dscl.seed_id = dps.id AND dscl.link_role = 'primary'
        ORDER BY dscl.created_at ASC
        LIMIT 1
      ) AS primary_campaign_id
    FROM directory_presence_seeds dps
    JOIN directory_listings_list dll ON dll.id = dps.listing_id
    WHERE dps.status IN ('published', 'invited', 'claimed')
      AND dll.is_published = true
    ORDER BY dps.seed_batch, dll.slug
  `;

  const filtered = rows
    .filter((row) => (batch ? row.seed_batch === batch : true))
    .filter((row) => (campaign ? row.primary_campaign_id === campaign : true))
    .slice(0, limit > 0 ? limit : undefined);

  const results: ReportRow[] = [];

  for (const row of filtered) {
    const current = evaluateSeedPublishability(facts(row));

    let composed: any = null;
    try {
      composed = await DirectoryPresenceSeedService.getComposedEnrichment(row.seed_id);
    } catch (err) {
      console.warn(
        `[seed-readiness] compose failed for ${row.slug}: ${(err as Error).message}`,
      );
    }

    const proposedDescription = composed?.packet?.description ?? row.description;
    const proposed = evaluateSeedPublishability(facts(row, proposedDescription));
    const composedSource = composed?.sourceName ?? 'none';

    let verdict: Verdict;
    if (row.status === 'claimed') verdict = 'skip_claimed';
    else if (row.status === 'suppressed') verdict = 'skip_suppressed';
    else if (row.description_source === 'operator_override') verdict = 'skip_operator_override';
    else if (current.publishable) verdict = 'already_publishable';
    else if (
      proposed.publishable &&
      composedSource !== 'none' &&
      composedSource !== 'seed_seo_composer'
    ) {
      verdict = 'recompose_would_publish';
    } else {
      verdict = 'still_thin';
    }

    results.push({
      slug: row.slug,
      batch: row.seed_batch,
      campaignId: row.primary_campaign_id,
      status: row.status,
      currentPublishable: current.publishable,
      currentBlockers: current.blockers,
      proposedPublishable: proposed.publishable,
      proposedBlockers: proposed.blockers,
      descriptionSource: row.description_source ?? '(none)',
      composedSource,
      verdict,
    });
  }

  console.table(
    results.map((row) => ({
      slug: row.slug,
      batch: row.batch,
      current: row.currentPublishable ? 'pass' : row.currentBlockers.join(','),
      source: row.descriptionSource,
      recomposed: row.proposedPublishable ? 'pass' : row.proposedBlockers.join(','),
      composedFrom: row.composedSource,
      verdict: row.verdict,
    })),
  );

  const counts = results.reduce<Record<string, number>>((acc, row) => {
    acc[row.verdict] = (acc[row.verdict] ?? 0) + 1;
    return acc;
  }, {});

  console.log('\nSummary');
  console.log(`  seeds scanned: ${results.length}`);
  for (const [verdict, count] of Object.entries(counts).sort()) {
    console.log(`  ${verdict}: ${count}`);
  }

  // Per-campaign roll-up — the phase gate for the re-discovery run. A phase is
  // solid when `recompose_would_publish` rises and `still_thin` falls without
  // turning an `already_publishable` seed thin.
  const byCampaign = results.reduce<Record<string, Record<string, number>>>((acc, row) => {
    const key = row.campaignId ?? '(no primary campaign)';
    acc[key] = acc[key] ?? {};
    acc[key][row.verdict] = (acc[key][row.verdict] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\nBy primary campaign');
  for (const [campaignId, verdicts] of Object.entries(byCampaign).sort()) {
    const total = Object.values(verdicts).reduce((sum, n) => sum + n, 0);
    console.log(`  ${campaignId} (${total})`);
    for (const [verdict, count] of Object.entries(verdicts).sort()) {
      console.log(`    ${verdict}: ${count}`);
    }
  }

  if (jsonPath) {
    writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\nWrote ${results.length} rows to ${jsonPath}`);
  }
}

main()
  .catch((err) => {
    console.error('[seed-readiness] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
