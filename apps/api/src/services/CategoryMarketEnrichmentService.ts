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
  type CategorySeoPacket,
  type IntelligenceProfileSeoFields,
  type GoldStandardSeoFields,
} from './directory/SeedSeoComposer';
import {
  generateCategoryMarketEnrichmentId,
} from '../lib/id-generator';
import { audit } from '../audit';
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

    return {
      marketKey: { categoryKey, city: normalizedCity, state: normalizedState },
      categoryEnrichmentId: id,
      listingsEnriched: 0,
      listingsSkipped: 0,
      skipReasons: {},
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
