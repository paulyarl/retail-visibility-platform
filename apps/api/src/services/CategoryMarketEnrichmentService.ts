import { Prisma } from '@prisma/client';
import { BaseService } from './BaseService';
import {
  IntelligenceProfileService,
  normalizeCategoryKey,
  normalizeReferenceCity,
  normalizeReferenceState,
} from './intelligence/IntelligenceProfileService';
import {
  buildCategorySeoPacket,
  buildSeedSeoPacket,
  buildSeoEnrichmentJson,
  type CategorySeoPacket,
  type SeedSeoPacket,
  type CampaignSeoFields,
  type IntelligenceProfileSeoFields,
  type GoldStandardSeoFields,
} from './directory/SeedSeoComposer';
import {
  generateCategoryMarketEnrichmentId,
  generateListingEnrichmentLogId,
} from '../lib/id-generator';
import { audit } from '../audit';
import { logger } from '../logger';
import type { RequestCtx } from '../context';

export interface MarketState {
  id: string;
  categoryKey: string;
  categoryName: string;
  city: string;
  state: string;
  composed: CategorySeoPacket;
  override: {
    description: string | null;
    metaTitle: string | null;
    keywords: string[] | null;
  };
  effective: CategorySeoPacket;
  synonyms: string[];
  enrichedAt: Date;
  enrichedBy: string | null;
  triggerSource: string;
  intelligenceProfileId: string | null;
  goldStandardProfileId: string | null;
  composerVersion: number;
  overrideBy: string | null;
  overrideAt: Date | null;
}

export interface EnrichMarketResult {
  marketKey: { categoryKey: string; city: string; state: string };
  categoryEnrichmentId: string | null;
  listingsEnriched: number;
  listingsSkipped: number;
  skipReasons: Record<string, number>;
}

class CategoryMarketEnrichmentService extends BaseService {
  private static instance: CategoryMarketEnrichmentService;

  private constructor() {
    super();
  }

  static getInstance(): CategoryMarketEnrichmentService {
    if (!CategoryMarketEnrichmentService.instance) {
      CategoryMarketEnrichmentService.instance = new CategoryMarketEnrichmentService();
    }
    return CategoryMarketEnrichmentService.instance;
  }

  async enrichMarket(
    category: string,
    city: string,
    state: string,
    opts: { triggerSource?: 'manual' | 'profile_activated'; enrichedBy?: string } = {},
    ctx?: RequestCtx,
  ): Promise<EnrichMarketResult> {
    const categoryKey = normalizeCategoryKey(category);
    const normalizedCity = normalizeReferenceCity(city);
    const normalizedState = normalizeReferenceState(state);

    if (!normalizedCity || !normalizedState) {
      return {
        marketKey: { categoryKey, city, state },
        categoryEnrichmentId: null,
        listingsEnriched: 0,
        listingsSkipped: 0,
        skipReasons: { invalid_market: 1 },
      };
    }

    const profile = await this.resolveProfileForMarket(categoryKey, normalizedCity, ctx);
    if (!profile) {
      return {
        marketKey: { categoryKey, city: normalizedCity, state: normalizedState },
        categoryEnrichmentId: null,
        listingsEnriched: 0,
        listingsSkipped: 0,
        skipReasons: { no_active_profile: 1 },
      };
    }

    const goldStandard = await IntelligenceProfileService.getInstance().resolveGoldStandard(
      categoryKey,
      null,
      normalizedCity,
      normalizedState,
      ctx,
    );

    const profileSeo = this.toIntelligenceProfileSeoFields(profile);
    const goldSeo = this.toGoldStandardSeoFields(goldStandard);

    const packet = buildCategorySeoPacket({
      categoryKey,
      categoryName: profile.category_name,
      city: normalizedCity,
      state: normalizedState,
      intelligenceProfile: profileSeo,
      goldStandard: goldSeo,
    });

    const id = generateCategoryMarketEnrichmentId();
    const enrichedAt = new Date();
    const triggerSource = opts.triggerSource ?? 'manual';
    const enrichedBy = opts.enrichedBy ?? null;

    const keywords = packet.keywords.length > 0 ? packet.keywords : [];
    const secondary = packet.secondaryCategories.length > 0 ? packet.secondaryCategories : [];

    const upsert = Prisma.sql`
      INSERT INTO directory_category_enrichment (
        id, category_key, category_name, city, state,
        meta_title, description, keywords, secondary_categories, schema_type_hint,
        intelligence_profile_id, gold_standard_profile_id, composer_version,
        enriched_at, enriched_by, trigger_source, created_at, updated_at
      )
      VALUES (
        ${id}, ${categoryKey}, ${profile.category_name}, ${normalizedCity}, ${normalizedState},
        ${packet.metaTitle}, ${packet.description},
        ARRAY[${Prisma.join(keywords)}]::text[],
        ARRAY[${Prisma.join(secondary)}]::text[],
        ${packet.schemaTypeHint},
        ${packet.inputs.intelligenceProfileId}, ${packet.inputs.goldStandardProfileId}, ${packet.composerVersion},
        ${enrichedAt}, ${enrichedBy}, ${triggerSource}, now(), now()
      )
      ON CONFLICT (category_key, city, state) DO UPDATE SET
        category_name = EXCLUDED.category_name,
        meta_title = EXCLUDED.meta_title,
        description = EXCLUDED.description,
        keywords = EXCLUDED.keywords,
        secondary_categories = EXCLUDED.secondary_categories,
        schema_type_hint = EXCLUDED.schema_type_hint,
        intelligence_profile_id = EXCLUDED.intelligence_profile_id,
        gold_standard_profile_id = EXCLUDED.gold_standard_profile_id,
        composer_version = EXCLUDED.composer_version,
        enriched_at = EXCLUDED.enriched_at,
        enriched_by = EXCLUDED.enriched_by,
        trigger_source = EXCLUDED.trigger_source,
        updated_at = now()
      WHERE directory_category_enrichment.category_key = EXCLUDED.category_key
        AND directory_category_enrichment.city = EXCLUDED.city
        AND directory_category_enrichment.state = EXCLUDED.state
    `;

    await this.prisma.$queryRaw(upsert);

    await audit({
      tenantId: undefined,
      actor: enrichedBy,
      actorType: 'user',
      action: 'directory_market_enrichment.sync',
      payload: {
        market: { categoryKey, city: normalizedCity, state: normalizedState },
        categoryEnrichmentId: id,
        profileId: profile.id,
        triggerSource,
      },
    });

    const listingResult = await this.enrichMarketListings(
      { categoryKey, city: normalizedCity, state: normalizedState },
      profile,
      goldStandard,
      { triggerSource, enrichedBy },
      ctx,
    );

    return {
      marketKey: { categoryKey, city: normalizedCity, state: normalizedState },
      categoryEnrichmentId: id,
      listingsEnriched: listingResult.enriched,
      listingsSkipped: listingResult.skipped,
      skipReasons: listingResult.skipReasons,
    };
  }

  async getMarket(
    category: string,
    city: string,
    state?: string | null,
    ctx?: RequestCtx,
  ): Promise<MarketState | null> {
    const categoryKey = normalizeCategoryKey(category);
    const normalizedCity = normalizeReferenceCity(city);
    if (!normalizedCity) return null;

    let normalizedState: string | null = null;
    if (state) {
      normalizedState = normalizeReferenceState(state);
    }

    let rows: any[];
    if (normalizedState) {
      rows = await this.prisma.$queryRaw`
        SELECT * FROM directory_category_enrichment
        WHERE category_key = ${categoryKey}
          AND city = ${normalizedCity}
          AND state = ${normalizedState}
        LIMIT 1
      `;
    } else {
      rows = await this.prisma.$queryRaw`
        SELECT * FROM directory_category_enrichment
        WHERE category_key = ${categoryKey}
          AND city = ${normalizedCity}
        ORDER BY state
        LIMIT 2
      `;
      if (rows.length !== 1) return null;
    }

    if (!rows || rows.length === 0) return null;
    return await this.rowToMarketState(rows[0]);
  }

  async getMarketByKey(
    categoryKey: string,
    city: string,
    state: string,
  ): Promise<MarketState | null> {
    const rows = await this.prisma.$queryRaw`
      SELECT * FROM directory_category_enrichment
      WHERE category_key = ${categoryKey}
        AND city = ${city}
        AND state = ${state}
      LIMIT 1
    `;
    if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
    return await this.rowToMarketState(rows[0]);
  }

  /**
   * Enrich all published listings that match the market key.
   * For seed listings, guard against operator_override provenance and audit-powered
   * linked-campaign content. For tenant listings, guard against owner_edit and
   * operator_override log rows.
   */
  private async enrichMarketListings(
    marketKey: { categoryKey: string; city: string; state: string },
    profile: { id: string; category_name: string; configuration_json: any },
    goldStandard: { id: string; configuration_json: any } | null,
    opts: { triggerSource: string; enrichedBy: string | null },
    ctx?: RequestCtx,
  ): Promise<{ enriched: number; skipped: number; skipReasons: Record<string, number> }> {
    const profileSeo = this.toIntelligenceProfileSeoFields(profile);
    const goldSeo = this.toGoldStandardSeoFields(goldStandard);
    const pageSize = 200;
    let skip = 0;
    let enriched = 0;
    let skipped = 0;
    const skipReasons: Record<string, number> = {};

    while (true) {
      const listings = await this.prisma.directory_listings_list.findMany({
        where: {
          is_published: true,
          primary_category: { equals: profile.category_name, mode: 'insensitive' },
          city: { equals: marketKey.city, mode: 'insensitive' },
          state: { equals: marketKey.state, mode: 'insensitive' },
        },
        include: { directory_presence_seeds: true },
        take: pageSize,
        skip,
      });
      if (listings.length === 0) break;

      const listingIds = listings.map((l) => l.id);
      const seedIds = listings
        .map((l) => l.directory_presence_seeds?.id)
        .filter(Boolean) as string[];

      const [seedProvenanceRows, latestLogByListingId] = await Promise.all([
        seedIds.length
          ? this.prisma.directory_field_provenance.findMany({
              where: {
                seed_id: { in: seedIds },
                field_key: { in: ['description', 'keywords'] },
              },
            })
          : Promise.resolve([] as any[]),
        this.getLatestLogsByListingId(listingIds),
      ]);

      const seedProvenanceMap = new Map<string, Map<string, any>>();
      for (const row of seedProvenanceRows) {
        if (!seedProvenanceMap.has(row.seed_id)) seedProvenanceMap.set(row.seed_id, new Map());
        seedProvenanceMap.get(row.seed_id)!.set(row.field_key, row);
      }

      for (const listing of listings) {
        try {
          const campaignFields: CampaignSeoFields = {
            businessName: listing.business_name || 'Business',
            category: listing.primary_category || profile.category_name,
            addressCity: listing.city || null,
            addressState: listing.state || null,
          };

          const packet = buildSeedSeoPacket({
            campaign: campaignFields,
            audit: null,
            intelligenceProfile: profileSeo,
            goldStandard: goldSeo,
          });

          if (!packet.description) {
            this.incSkipReason(skipReasons, 'composer_degraded');
            skipped++;
            continue;
          }

          if (listing.directory_presence_seeds) {
            const seed = listing.directory_presence_seeds;
            const provenanceMap = seedProvenanceMap.get(seed.id) || new Map();
            const descriptionOverridden =
              provenanceMap.get('description')?.source_name === 'operator_override';
            const keywordsOverridden =
              provenanceMap.get('keywords')?.source_name === 'operator_override';

            if (descriptionOverridden && keywordsOverridden) {
              this.incSkipReason(skipReasons, 'operator_override');
              skipped++;
              continue;
            }

            // Also skip if a linked campaign already powered this seed. A
            // linked-campaign provenance row for description/keywords means the
            // content came from an operator-validated audit, which outranks market
            // enrichment.
            const hasCampaignContent =
              provenanceMap.get('description')?.source_name === 'linked_campaign' ||
              provenanceMap.get('keywords')?.source_name === 'linked_campaign';
            if (hasCampaignContent) {
              this.incSkipReason(skipReasons, 'linked_campaign');
              skipped++;
              continue;
            }

            await this.writeSeedListing(
              listing,
              seed,
              packet,
              { descriptionOverridden, keywordsOverridden },
              opts,
              ctx,
            );
            enriched++;
          } else {
            const latestLog = latestLogByListingId.get(listing.id);
            const guard = this.computeTenantGuard(latestLog);
            if (guard.ownerAuthored) {
              this.incSkipReason(skipReasons, 'owner_authored');
              skipped++;
              continue;
            }
            if (guard.descriptionOverridden && guard.keywordsOverridden) {
              this.incSkipReason(skipReasons, 'operator_override');
              skipped++;
              continue;
            }

            await this.writeTenantListing(listing, packet, guard, opts, ctx);
            enriched++;
          }
        } catch (err) {
          this.incSkipReason(skipReasons, 'error');
          skipped++;
          logger.warn('[CategoryMarketEnrichmentService] listing enrichment failed', ctx, {
            listingId: listing.id,
            error: (err as Error).message,
          });
        }
      }

      skip += pageSize;
      if (listings.length < pageSize) break;
    }

    return { enriched, skipped, skipReasons };
  }

  private incSkipReason(reasons: Record<string, number>, key: string) {
    reasons[key] = (reasons[key] || 0) + 1;
  }

  private async getLatestLogsByListingId(
    listingIds: string[],
  ): Promise<Map<string, any>> {
    if (listingIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw`
      SELECT DISTINCT ON (listing_id) *
      FROM directory_listing_enrichment_log
      WHERE listing_id IN (${Prisma.join(listingIds)})
      ORDER BY listing_id, enriched_at DESC
    ` as any[];
    const map = new Map<string, any>();
    for (const row of rows) {
      map.set(row.listing_id, row);
    }
    return map;
  }

  private computeTenantGuard(latestLog: any): {
    ownerAuthored: boolean;
    descriptionOverridden: boolean;
    keywordsOverridden: boolean;
  } {
    if (!latestLog) {
      return { ownerAuthored: false, descriptionOverridden: false, keywordsOverridden: false };
    }
    const values = latestLog.fields_values || {};
    const isOwner = latestLog.trigger_source === 'owner_edit';
    const isOperator = latestLog.trigger_source === 'operator_override';
    const descriptionPresent = values.description !== undefined && values.description !== null;
    const keywordsPresent = Array.isArray(values.keywords) && values.keywords.length > 0;
    return {
      ownerAuthored: isOwner,
      descriptionOverridden: isOperator && descriptionPresent,
      keywordsOverridden: isOperator && keywordsPresent,
    };
  }

  private async writeSeedListing(
    listing: any,
    seed: any,
    packet: SeedSeoPacket,
    guard: { descriptionOverridden: boolean; keywordsOverridden: boolean },
    opts: { triggerSource: string; enrichedBy: string | null },
    ctx?: RequestCtx,
  ): Promise<void> {
    const updatedDescription = !guard.descriptionOverridden;
    const updatedKeywords = !guard.keywordsOverridden;

    if (!updatedDescription && !updatedKeywords) return;

    const updateData: any = {};
    if (updatedDescription) updateData.description = packet.description;
    if (updatedKeywords) updateData.keywords = packet.keywords;
    updateData.updated_at = new Date();

    await this.prisma.directory_listings_list.update({
      where: { id: listing.id },
      data: updateData,
    });

    const now = new Date();
    const upsertProvenance = async (fieldKey: 'description' | 'keywords', value: string | string[]) => {
      const id = `${fieldKey}-${seed.id}`.substring(0, 60);
      await this.prisma.directory_field_provenance.upsert({
        where: { seed_id_field_key: { seed_id: seed.id, field_key: fieldKey } },
        update: {
          value: Array.isArray(value) ? value.join(', ') : value,
          source_name: 'market_enrichment',
          source_url: null,
          accessed_at: null,
          confidence: 'medium',
          show_on_public: true,
          updated_at: now,
        },
        create: {
          id,
          seed_id: seed.id,
          tenant_id: seed.tenant_id || listing.tenant_id,
          field_key: fieldKey,
          value: Array.isArray(value) ? value.join(', ') : value,
          source_name: 'market_enrichment',
          source_url: null,
          accessed_at: null,
          confidence: 'medium',
          show_on_public: true,
          created_at: now,
          updated_at: now,
        },
      });
    };

    if (updatedDescription) await upsertProvenance('description', packet.description);
    if (updatedKeywords) await upsertProvenance('keywords', packet.keywords);

    await this.prisma.directory_presence_seeds.update({
      where: { id: seed.id },
      data: {
        seo_enrichment: buildSeoEnrichmentJson(packet) as any,
        updated_at: new Date(),
      },
    });

    logger.info('[CategoryMarketEnrichmentService] seed listing enriched', ctx, {
      listingId: listing.id,
      seedId: seed.id,
      triggerSource: opts.triggerSource,
    });
  }

  private async writeTenantListing(
    listing: any,
    packet: SeedSeoPacket,
    guard: { ownerAuthored: boolean; descriptionOverridden: boolean; keywordsOverridden: boolean },
    opts: { triggerSource: string; enrichedBy: string | null },
    ctx?: RequestCtx,
  ): Promise<void> {
    const updatedDescription = !guard.descriptionOverridden;
    const updatedKeywords = !guard.keywordsOverridden;

    if (!updatedDescription && !updatedKeywords) {
      return;
    }

    const updateData: any = {};
    if (updatedDescription) updateData.description = packet.description;
    if (updatedKeywords) updateData.keywords = packet.keywords;
    updateData.updated_at = new Date();

    await this.prisma.directory_listings_list.update({
      where: { id: listing.id },
      data: updateData,
    });

    await this.prisma.directory_settings_list.upsert({
      where: { tenant_id: listing.tenant_id },
      update: {
        ...(updatedDescription ? { seo_description: packet.description } : {}),
        ...(updatedKeywords ? { seo_keywords: packet.keywords } : {}),
        updated_at: new Date(),
      },
      create: {
        id: listing.tenant_id,
        tenant_id: listing.tenant_id,
        seo_description: updatedDescription ? packet.description : null,
        seo_keywords: updatedKeywords ? packet.keywords : [],
        updated_at: new Date(),
      },
    });

    const projected: string[] = [];
    const skipped: string[] = [];
    const fieldsValues: Record<string, any> = {};
    if (updatedDescription) {
      projected.push('description');
      fieldsValues.description = packet.description;
    } else {
      skipped.push('description');
    }
    if (updatedKeywords) {
      projected.push('keywords');
      fieldsValues.keywords = packet.keywords;
    } else {
      skipped.push('keywords');
    }

    await this.prisma.directory_listing_enrichment_log.create({
      data: {
        id: generateListingEnrichmentLogId(),
        tenant_id: listing.tenant_id,
        listing_id: listing.id,
        category_key: normalizeCategoryKey(listing.primary_category || ''),
        city: listing.city || '',
        state: listing.state || '',
        fields_projected: projected,
        fields_skipped: skipped,
        skip_reasons: skipped.length ? { reason: 'operator_override' } : undefined,
        fields_values: fieldsValues,
        intelligence_profile_id: packet.inputs.intelligenceProfileId,
        composer_version: packet.composerVersion,
        enriched_at: new Date(),
        enriched_by: opts.enrichedBy,
        trigger_source: opts.triggerSource,
      },
    });

    logger.info('[CategoryMarketEnrichmentService] tenant listing enriched', ctx, {
      listingId: listing.id,
      triggerSource: opts.triggerSource,
    });
  }

  private async loadSynonyms(row: any): Promise<string[]> {
    const profileId: string | null = row.intelligence_profile_id ?? null;
    if (!profileId) return [];
    const profile = await this.prisma.mkt_intelligence_profiles.findFirst({
      where: { id: profileId, status: 'active' },
      orderBy: { version: 'desc' },
    });
    const cfg = (profile as any)?.configuration_json || {};
    const prohibited = new Set<string>();
    if (cfg.prohibited_keywords && Array.isArray(cfg.prohibited_keywords)) {
      for (const kw of cfg.prohibited_keywords) {
        if (typeof kw === 'string') prohibited.add(kw.toLowerCase().trim());
      }
    }
    const seen = new Set<string>();
    const result: string[] = [];
    if (cfg.synonyms && Array.isArray(cfg.synonyms)) {
      for (const syn of cfg.synonyms) {
        const value = typeof syn === 'string' ? syn : null;
        if (!value) continue;
        const trimmed = value.trim();
        const lower = trimmed.toLowerCase();
        if (!trimmed || prohibited.has(lower) || seen.has(lower)) continue;
        seen.add(lower);
        result.push(trimmed);
      }
    }
    return result.slice(0, 6);
  }

  private async rowToMarketState(row: any): Promise<MarketState> {
    const composed: CategorySeoPacket = {
      metaTitle: row.meta_title ?? '',
      description: row.description ?? '',
      keywords: row.keywords ?? [],
      secondaryCategories: row.secondary_categories ?? [],
      schemaTypeHint: row.schema_type_hint ?? null,
      inputs: {
        intelligenceProfileId: row.intelligence_profile_id ?? null,
        goldStandardProfileId: row.gold_standard_profile_id ?? null,
      },
      composerVersion: row.composer_version ?? 1,
    };

    const override = {
      description: row.operator_override_description ?? null,
      metaTitle: row.operator_override_meta_title ?? null,
      keywords: row.operator_override_keywords ?? null,
    };

    const effective: CategorySeoPacket = {
      metaTitle: override.metaTitle ?? composed.metaTitle,
      description: override.description ?? composed.description,
      keywords: (override.keywords?.length ? override.keywords : composed.keywords) ?? [],
      secondaryCategories: composed.secondaryCategories,
      schemaTypeHint: composed.schemaTypeHint,
      inputs: composed.inputs,
      composerVersion: composed.composerVersion,
    };

    const synonyms = await this.loadSynonyms(row);

    return {
      id: row.id,
      categoryKey: row.category_key,
      categoryName: row.category_name,
      city: row.city,
      state: row.state,
      composed,
      override,
      effective,
      synonyms,
      enrichedAt: row.enriched_at,
      enrichedBy: row.enriched_by ?? null,
      triggerSource: row.trigger_source,
      intelligenceProfileId: row.intelligence_profile_id ?? null,
      goldStandardProfileId: row.gold_standard_profile_id ?? null,
      composerVersion: row.composer_version ?? 1,
      overrideBy: row.override_by ?? null,
      overrideAt: row.override_at ?? null,
    };
  }

  private async resolveProfileForMarket(
    categoryKey: string,
    city: string,
    ctx?: RequestCtx,
  ): Promise<{ id: string; category_name: string; configuration_json: any } | null> {
    const service = IntelligenceProfileService.getInstance();
    const competitive = await service.resolve(categoryKey, 'competitive', city, null, ctx);
    if (competitive) return competitive;
    const emerging = await service.resolve(categoryKey, 'emerging', city, null, ctx);
    return emerging ?? null;
  }

  private toIntelligenceProfileSeoFields(
    profile: { id: string; configuration_json: any } | null,
  ): IntelligenceProfileSeoFields | null {
    if (!profile) return null;
    const cfg = profile.configuration_json || {};
    return {
      profileId: profile.id,
      synonyms: cfg.synonyms ?? undefined,
      subcategories: cfg.subcategories ?? undefined,
      prohibitedKeywords: cfg.prohibited_keywords ?? undefined,
      schemaOrgType: cfg.schema_org_type ?? null,
    };
  }

  private toGoldStandardSeoFields(
    gold: { id: string; configuration_json: any } | null,
  ): GoldStandardSeoFields | null {
    if (!gold) return null;
    const cfg = gold.configuration_json || {};
    const expected = Array.isArray(cfg.expected_fields)
      ? (cfg.expected_fields as any[])
          .map((f: any) => (typeof f === 'string' ? f : f?.field || f?.name))
          .filter(Boolean)
      : undefined;
    return {
      profileId: gold.id,
      expectedFieldNames: expected,
    };
  }
}

export default CategoryMarketEnrichmentService;
