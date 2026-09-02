/**
 * Backfill script — re-runs SeedSeoComposer for seeds without seo_enrichment.
 *
 * Handles two scenarios:
 *   1. Seeds linked to a campaign with a business_analysis audit → full packet
 *   2. Seeds without a campaign/audit → degraded Tier-A packet from listing
 *      facts only (e.g. the 10 indianapolis-african-grocery-2026 seeds)
 *
 * Idempotency marker: presence of seo_enrichment with composer_version on
 * the seed row → skip already-enriched seeds.
 *
 * Run from apps/api:
 *   doppler run --config local -- npx tsx src/scripts/backfill-seed-seo.ts
 *   doppler run --config prd -- npx tsx src/scripts/backfill-seed-seo.ts
 */
import { prisma } from '../prisma';
import { logger } from '../logger';
import {
  buildSeedSeoPacket,
  buildSeoEnrichmentJson,
} from '../services/directory/SeedSeoComposer';
import IntelligenceProfileService from '../services/intelligence/IntelligenceProfileService';

async function backfillSeedSeo() {
  // Find all seeds without seo_enrichment (or with null composer_version)
  const seeds = await prisma.$queryRaw<any[]>`
    SELECT
      dps.id AS seed_id,
      dps.tenant_id,
      dps.listing_id,
      dps.category,
      dps.city,
      dps.state,
      dl.business_name,
      dl.address,
      dl.zip_code,
      dl.phone,
      dl.website,
      dl.primary_category,
      dl.secondary_categories,
      dl.neighborhood,
      dl.business_hours,
      dscl.campaign_id,
      dscl.link_role
    FROM directory_presence_seeds dps
    LEFT JOIN directory_listings_list dl ON dl.id = dps.listing_id
    LEFT JOIN directory_seed_campaign_links dscl ON dscl.seed_id = dps.id AND dscl.link_role = 'primary'
    WHERE dps.seo_enrichment IS NULL
       OR dps.seo_enrichment->>'composer_version' IS NULL
    ORDER BY dps.created_at
  `;

  logger.info('backfill-seed-seo: starting', undefined, { seedCount: seeds.length });

  let enriched = 0;
  let skipped = 0;
  let degraded = 0;

  for (const seed of seeds) {
    try {
      // Try to load the linked campaign + audit for full enrichment
      let audit: any = null;
      let campaign: any = null;

      if (seed.campaign_id) {
        campaign = await (prisma as any).mkt_campaigns_list.findUnique({
          where: { id: seed.campaign_id },
        });

        if (campaign) {
          audit = await (prisma as any).mkt_audits_list.findFirst({
            where: { campaign_id: seed.campaign_id, platform: 'business_analysis' },
            orderBy: { created_at: 'desc' },
          });
        }
      }

      // Resolve intelligence profile by category
      const seoFocus = 'competitive' as const;
      const profile = campaign
        ? await IntelligenceProfileService.resolve(
            campaign.category || seed.category || '',
            seoFocus,
            campaign.address_city ?? seed.city ?? null,
            null,
          ).catch(() => null)
        : await IntelligenceProfileService.resolve(
            seed.category || seed.primary_category || '',
            seoFocus,
            seed.city ?? null,
            null,
          ).catch(() => null);

      // Build composer inputs
      const businessName = seed.business_name || campaign?.business_name || '';
      const category = campaign?.category || seed.category || seed.primary_category || '';
      const city = campaign?.address_city || seed.city || null;
      const state = campaign?.address_state || seed.state || null;

      if (!businessName || !category) {
        logger.warn('backfill-seed-seo: skipping seed with insufficient data', undefined, {
          seedId: seed.seed_id,
          businessName,
          category,
        });
        skipped++;
        continue;
      }

      const auditFields = audit
        ? {
            auditId: audit.id,
            storeFormat: (audit.audit_data?.audit_metadata?.matched_business?.store_format) ?? null,
            googleAdditionalCategories: (audit.audit_data?.platforms?.google?.additional_categories) ?? null,
            platformProfileUrls: (() => {
              const platforms = audit.audit_data?.platforms ?? {};
              const urls: Array<{ platform: string; url: string }> = [];
              for (const pkey of ['google', 'yelp', 'facebook', 'bbb']) {
                const pdata = (platforms as any)[pkey];
                if (pdata?.profile_url && typeof pdata.profile_url === 'string') {
                  urls.push({ platform: pkey, url: pdata.profile_url });
                }
              }
              return urls.length > 0 ? urls : null;
            })(),
          }
        : null;

      const packet = buildSeedSeoPacket({
        campaign: {
          businessName,
          category,
          addressCity: city,
          addressState: state,
          neighborhood: campaign?.neighborhood ?? null,
          businessOriginCountry: campaign?.business_origin_country ?? null,
          businessOriginRegion: campaign?.business_origin_region ?? null,
          directoryProfiles: Array.isArray(campaign?.directory_profiles)
            ? campaign.directory_profiles
            : null,
          socialProfiles: Array.isArray(campaign?.social_profiles)
            ? campaign.social_profiles
            : null,
        },
        audit: auditFields,
        intelligenceProfile: profile
          ? {
              profileId: profile.id,
              synonyms: profile.configuration_json?.synonyms ?? undefined,
              subcategories: profile.configuration_json?.subcategories ?? undefined,
              prohibitedKeywords: profile.configuration_json?.prohibited_keywords ?? undefined,
              schemaOrgType: profile.configuration_json?.schema_org_type ?? null,
            }
          : null,
        goldStandard: null,
      });

      const seoJson = buildSeoEnrichmentJson(packet);

      // Update listing with description/keywords/same_as
      await prisma.$executeRaw`
        UPDATE directory_listings_list
        SET
          description = COALESCE(${packet.description}, description),
          keywords = COALESCE(${packet.keywords}::text[], keywords),
          same_as = COALESCE(${packet.sameAs}::text[], same_as),
          updated_at = now()
        WHERE id = ${seed.listing_id}
      `;

      // Update seed with seo_enrichment
      await prisma.$executeRaw`
        UPDATE directory_presence_seeds
        SET seo_enrichment = ${JSON.stringify(seoJson)}::jsonb, updated_at = now()
        WHERE id = ${seed.seed_id}
      `;

      if (audit) {
        enriched++;
      } else {
        degraded++;
      }

      logger.info('backfill-seed-seo: enriched', undefined, {
        seedId: seed.seed_id,
        mode: audit ? 'full' : 'degraded',
        hasDescription: !!packet.description,
        keywordCount: packet.keywords.length,
        sameAsCount: packet.sameAs.length,
      });
    } catch (err) {
      logger.error('backfill-seed-seo: failed for seed', undefined, {
        seedId: seed.seed_id,
        error: (err as Error).message,
      });
      skipped++;
    }
  }

  logger.info('backfill-seed-seo: complete', undefined, {
    total: seeds.length,
    enriched,
    degraded,
    skipped,
  });

  await prisma.$disconnect();
}

backfillSeedSeo().catch((err) => {
  logger.error('backfill-seed-seo: fatal error', undefined, {
    error: (err as Error).message,
  });
  process.exit(1);
});
