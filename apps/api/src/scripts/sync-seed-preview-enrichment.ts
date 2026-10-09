/**
 * Sync script — refreshes active seed_preview demo tenants' business
 * description + SEO tags from the seed's deterministic composed enrichment
 * packet (the same source as the admin "Composed enrichment" card).
 *
 * createFromSeed copies the listing description at creation time; previews
 * created before the composed-packet preference landed keep the market
 * sweep's generic placeholder text forever since createFromSeed
 * short-circuits on the existing tenant.
 *
 * Run from apps/api:
 *   doppler run --config local -- npx tsx src/scripts/sync-seed-preview-enrichment.ts
 *   doppler run --config prd -- npx tsx src/scripts/sync-seed-preview-enrichment.ts
 */
import { prisma } from '../prisma';
import { logger } from '../logger';
import DirectoryPresenceSeedService from '../services/DirectoryPresenceSeedService';

async function syncSeedPreviewEnrichment() {
  const previews = await prisma.$queryRaw<any[]>`
    SELECT id, name, metadata->'seed_preview'->>'seed_id' AS seed_id
    FROM tenants
    WHERE is_demo = true
      AND demo_template = 'seed_preview'
      AND location_status = 'active'
      AND metadata->'seed_preview'->>'seed_id' IS NOT NULL
  `;

  logger.info(`sync-seed-preview-enrichment: ${previews.length} active seed-preview tenant(s)`);

  let updated = 0;
  let skipped = 0;

  for (const preview of previews) {
    const composed = await DirectoryPresenceSeedService.getComposedEnrichment(
      preview.seed_id,
    ).catch(() => null);
    const packet = composed?.packet;
    if (!packet?.description) {
      skipped++;
      continue;
    }

    const seoTags =
      Array.isArray(packet.keywords) && packet.keywords.length > 0
        ? JSON.stringify(packet.keywords)
        : null;

    await prisma.$executeRaw`
      UPDATE tenant_business_profiles_list
      SET business_description = ${packet.description},
          seo_tags = COALESCE(${seoTags}::jsonb, seo_tags),
          updated_at = now()
      WHERE tenant_id = ${preview.id}
    `;
    updated++;
    logger.info(
      `sync-seed-preview-enrichment: ${preview.id} (${preview.name}) ← ${composed.sourceName}`,
    );
  }

  logger.info(`sync-seed-preview-enrichment: done — ${updated} updated, ${skipped} skipped`);
}

syncSeedPreviewEnrichment()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('sync-seed-preview-enrichment failed', undefined, { err });
    process.exit(1);
  });
