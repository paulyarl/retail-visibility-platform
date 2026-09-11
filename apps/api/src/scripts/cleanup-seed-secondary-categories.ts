/**
 * Cleanup script — strips auto-populated secondary_categories from directory
 * presence seeds.
 *
 * Secondary categories are operator-managed: set via Edit Fields after the
 * category-identification audit, never composed automatically. This script
 * clears listing.secondary_categories and deletes the secondary_categories
 * provenance row for seeds whose provenance came from an automated source
 * (intelligence_profile / seed_seo_composer / business_analysis_audit /
 * linked_campaign / prospect_queue:*). Operator- and owner-sourced rows
 * (operator_override, owner_claim) are left untouched.
 *
 * Also re-syncs directory_settings_list.secondary_categories for affected
 * tenants (publishSeed mirrors the listing column there).
 *
 * Idempotent — a second run finds no auto-sourced provenance rows.
 *
 * Run from apps/api:
 *   doppler run --config local -- npx tsx src/scripts/cleanup-seed-secondary-categories.ts
 *   doppler run --config prd -- npx tsx src/scripts/cleanup-seed-secondary-categories.ts
 */
import { prisma } from '../prisma';
import { logger } from '../logger';

const AUTO_SOURCES = [
  'intelligence_profile',
  'seed_seo_composer',
  'business_analysis_audit',
  'linked_campaign',
];

async function main() {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT dfp.seed_id, dps.listing_id, dps.tenant_id, dfp.source_name,
           dl.secondary_categories
    FROM directory_field_provenance dfp
    JOIN directory_presence_seeds dps ON dps.id = dfp.seed_id
    JOIN directory_listings_list dl ON dl.id = dps.listing_id
    WHERE dfp.field_key = 'secondary_categories'
      AND (dfp.source_name = ANY(${AUTO_SOURCES}::text[])
           OR dfp.source_name LIKE 'prospect_queue:%')
  `;

  logger.info('cleanup-seed-secondary-categories: found seeds', undefined, {
    count: rows.length,
  });

  for (const row of rows) {
    await prisma.$executeRaw`
      UPDATE directory_listings_list
      SET secondary_categories = '{}'::text[], updated_at = now()
      WHERE id = ${row.listing_id}
    `;
    await prisma.$executeRaw`
      DELETE FROM directory_field_provenance
      WHERE seed_id = ${row.seed_id} AND field_key = 'secondary_categories'
    `;
    await prisma.$executeRaw`
      UPDATE directory_settings_list
      SET secondary_categories = '{}'::text[], updated_at = now()
      WHERE tenant_id = ${row.tenant_id}
    `;
    logger.info('cleanup-seed-secondary-categories: cleaned', undefined, {
      seedId: row.seed_id,
      listingId: row.listing_id,
      source: row.source_name,
      removedCount: Array.isArray(row.secondary_categories)
        ? row.secondary_categories.length
        : 0,
    });
  }

  // Warn (don't touch) about verbose "name: description"-style entries with
  // no auto-source provenance — likely manual or legacy data to review.
  const suspicious = await prisma.$queryRaw<any[]>`
    SELECT dps.id AS seed_id, dl.secondary_categories
    FROM directory_presence_seeds dps
    JOIN directory_listings_list dl ON dl.id = dps.listing_id
    WHERE EXISTS (
      SELECT 1 FROM unnest(dl.secondary_categories) s
      WHERE position(':' in s) > 0 OR length(s) > 100
    )
  `;
  for (const row of suspicious) {
    logger.warn(
      'cleanup-seed-secondary-categories: verbose secondary categories remain — review manually',
      undefined,
      { seedId: row.seed_id, secondaryCategories: row.secondary_categories },
    );
  }

  logger.info('cleanup-seed-secondary-categories: complete', undefined, {
    cleaned: rows.length,
    flaggedForReview: suspicious.length,
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error('cleanup-seed-secondary-categories: fatal error', undefined, {
    error: (err as Error).message,
  });
  process.exit(1);
});
