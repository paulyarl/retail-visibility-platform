import { Prisma } from '@prisma/client';
import { BaseService } from './BaseService';
import {
  normalizeReferenceCity,
  normalizeReferenceState,
} from './intelligence/IntelligenceProfileService';
import {
  buildLocationSeoPacket,
  type LocationSeoPacket,
  type LocationEnrichmentInput,
} from './directory/SeedSeoComposer';
import { generateCategoryMarketEnrichmentId } from '../lib/id-generator';
import { audit } from '../audit';
import { logger } from '../logger';
import type { RequestCtx } from '../context';

const LOCATION_SENTINEL_KEY = '__location__';

export interface LocationState {
  id: string;
  categoryKey: string;
  categoryName: string;
  locationName: string;
  city: string;
  state: string;
  composed: LocationSeoPacket;
  override: {
    description: string | null;
    metaTitle: string | null;
    keywords: string[] | null;
  };
  effective: LocationSeoPacket;
  enrichedAt: Date;
  enrichedBy: string | null;
  triggerSource: string;
  composerVersion: number;
  overrideBy: string | null;
  overrideAt: Date | null;
}

export interface EnrichLocationResult {
  city: string;
  state: string;
  locationName: string;
  locationEnrichmentId: string | null;
  businessCount: number;
  categoryCount: number;
}

interface CategoryRow {
  category_key: string;
  category_name: string;
  city: string;
  state: string;
  meta_title: string;
  description: string;
  keywords: string[];
  secondary_categories: string[];
}

interface ListingAggregateRow {
  primary_category: string;
  cnt: bigint;
}

class LocationMarketEnrichmentService extends BaseService {
  private static instance: LocationMarketEnrichmentService;

  private constructor() {
    super();
  }

  static getInstance(): LocationMarketEnrichmentService {
    if (!LocationMarketEnrichmentService.instance) {
      LocationMarketEnrichmentService.instance = new LocationMarketEnrichmentService();
    }
    return LocationMarketEnrichmentService.instance;
  }

  async getLocation(
    city: string,
    state: string | null | undefined,
    ctx?: RequestCtx,
  ): Promise<LocationState | null> {
    const normalizedCity = normalizeReferenceCity(city);
    const normalizedState = state ? normalizeReferenceState(state) : null;
    if (!normalizedCity || !normalizedState) return null;

    const row = await this.findRow(normalizedCity, normalizedState);
    if (row) {
      return this.rowToLocationState(row);
    }

    return this.enrichLocation(normalizedCity, normalizedState, { triggerSource: 'on_demand' }, ctx);
  }

  async enrichLocation(
    city: string,
    state: string,
    opts: { triggerSource?: 'manual' | 'profile_activated' | 'on_demand'; enrichedBy?: string | null } = {},
    ctx?: RequestCtx,
  ): Promise<LocationState | null> {
    const normalizedCity = normalizeReferenceCity(city);
    const normalizedState = state ? normalizeReferenceState(state) : null;
    if (!normalizedCity || !normalizedState) {
      return null;
    }

    const locationName = `${normalizedCity}, ${normalizedState}`;
    const triggerSource = opts.triggerSource ?? 'manual';
    const enrichedBy = opts.enrichedBy ?? null;

    const [categoryRows, listingRows] = await Promise.all([
      this.getCategoryEnrichments(normalizedCity, normalizedState),
      this.getListingAggregates(normalizedCity, normalizedState),
    ]);

    const categoryEnrichments: LocationEnrichmentInput[] = [];
    const categoryMap = new Map<string, CategoryRow>();
    for (const row of categoryRows) {
      categoryMap.set(row.category_name.toLowerCase().trim(), row);
    }

    let businessCount = 0;
    const categoriesFromListings: string[] = [];
    for (const row of (listingRows as ListingAggregateRow[])) {
      const catName = row.primary_category?.trim();
      if (!catName) continue;
      categoriesFromListings.push(catName);
      businessCount += Number(row.cnt);
      const lower = catName.toLowerCase();
      const matched = categoryMap.get(lower);
      categoryEnrichments.push({
        categoryName: catName,
        keywords: matched?.keywords ?? [],
        synonyms: matched?.secondary_categories ?? [],
      });
    }

    // Include enriched categories that may not have published listings yet
    for (const row of categoryRows) {
      if (!categoriesFromListings.some((c) => c.toLowerCase().trim() === row.category_name.toLowerCase().trim())) {
        categoryEnrichments.push({
          categoryName: row.category_name,
          keywords: row.keywords,
          synonyms: row.secondary_categories,
        });
      }
    }

    const packet = buildLocationSeoPacket({
      city: normalizedCity,
      state: normalizedState,
      locationName,
      businessCount,
      categoryEnrichments,
    });

    const id = generateCategoryMarketEnrichmentId();
    const enrichedAt = new Date();
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
        ${id}, ${LOCATION_SENTINEL_KEY}, ${locationName}, ${normalizedCity}, ${normalizedState},
        ${packet.metaTitle}, ${packet.description},
        ARRAY[${Prisma.join(keywords)}]::text[],
        ARRAY[${Prisma.join(secondary)}]::text[],
        ${packet.schemaTypeHint},
        ${null}, ${null}, ${packet.composerVersion},
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
      RETURNING *
    `;

    const resultRows = await this.prisma.$queryRaw<CategoryRow[]>(upsert);
    const row = Array.isArray(resultRows) && resultRows.length > 0 ? resultRows[0] : null;

    audit({
      actor: enrichedBy,
      actorType: enrichedBy ? 'user' : 'system',
      action: 'directory_location_enrichment.sync',
      payload: {
        city: normalizedCity,
        state: normalizedState,
        locationName,
        businessCount,
        categoryCount: categoryEnrichments.length,
        locationEnrichmentId: id,
        triggerSource,
      },
    });

    logger.info('LocationMarketEnrichmentService.enrichLocation', ctx, {
      city: normalizedCity,
      state: normalizedState,
      businessCount,
      categoryCount: categoryEnrichments.length,
      locationEnrichmentId: id,
    });

    return row ? this.rowToLocationState(row) : null;
  }

  private async findRow(city: string, state: string): Promise<any | null> {
    const rows = await this.prisma.$queryRaw`
      SELECT * FROM directory_category_enrichment
      WHERE category_key = ${LOCATION_SENTINEL_KEY}
        AND city = ${city}
        AND state = ${state}
      LIMIT 1
    `;
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  private async getCategoryEnrichments(city: string, state: string): Promise<CategoryRow[]> {
    const rows = await this.prisma.$queryRaw<CategoryRow[]>`
      SELECT category_key, category_name, city, state, meta_title, description, keywords, secondary_categories
      FROM directory_category_enrichment
      WHERE category_key != ${LOCATION_SENTINEL_KEY}
        AND city = ${city}
        AND state = ${state}
      ORDER BY enriched_at DESC
    `;
    return Array.isArray(rows) ? rows : [];
  }

  private async getListingAggregates(city: string, state: string): Promise<ListingAggregateRow[]> {
    const rows = await this.prisma.$queryRaw<ListingAggregateRow[]>`
      SELECT primary_category, COUNT(*) as cnt
      FROM directory_listings_list
      WHERE is_published = true
        AND (business_hours IS NULL OR business_hours::text != 'null')
        AND LOWER(city) = LOWER(${city})
        AND LOWER(state) = LOWER(${state})
        AND primary_category IS NOT NULL
      GROUP BY primary_category
      ORDER BY cnt DESC
    `;
    return Array.isArray(rows) ? rows : [];
  }

  private rowToLocationState(row: any): LocationState {
    const composed: LocationSeoPacket = {
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

    const effective: LocationSeoPacket = {
      metaTitle: override.metaTitle ?? composed.metaTitle,
      description: override.description ?? composed.description,
      keywords: (override.keywords?.length ? override.keywords : composed.keywords) ?? [],
      secondaryCategories: composed.secondaryCategories,
      schemaTypeHint: composed.schemaTypeHint,
      inputs: composed.inputs,
      composerVersion: composed.composerVersion,
    };

    return {
      id: row.id,
      categoryKey: row.category_key,
      categoryName: row.category_name,
      locationName: row.category_name,
      city: row.city,
      state: row.state,
      composed,
      override,
      effective,
      enrichedAt: row.enriched_at,
      enrichedBy: row.enriched_by ?? null,
      triggerSource: row.trigger_source,
      composerVersion: row.composer_version ?? 1,
      overrideBy: row.override_by ?? null,
      overrideAt: row.override_at ?? null,
    };
  }
}

export default LocationMarketEnrichmentService.getInstance();
