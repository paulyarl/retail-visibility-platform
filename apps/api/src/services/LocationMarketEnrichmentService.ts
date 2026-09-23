import { Prisma } from '@prisma/client';
import { BaseService } from './BaseService';
import {
  normalizeReferenceCity,
  normalizeReferenceState,
} from './intelligence/IntelligenceProfileService';
import { isNationalSentinel } from './intelligence/geography-grid';
import {
  buildLocationSeoPacket,
  type LocationSeoPacket,
  type LocationEnrichmentInput,
} from './directory/SeedSeoComposer';
import { generateCategoryMarketEnrichmentId } from '../lib/id-generator';
import { audit } from '../audit';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import type { LocationEnrichmentOutput } from '../validators/directory-enrichment.schema';

const LOCATION_SENTINEL_KEY = '__location__';

// composer_version=1 is the deterministic SeedSeoComposer output; 2 marks
// rows written by a directory_enrichment campaign run (AI-produced packet).
const CAMPAIGN_COMPOSER_VERSION = 2;

// Prisma.join throws on an empty array — emit a literal empty text[] instead.
const textArraySql = (arr: string[]) =>
  arr.length ? Prisma.sql`ARRAY[${Prisma.join(arr)}]::text[]` : Prisma.sql`ARRAY[]::text[]`;

// Raw $queryRaw params serialize JS arrays as Postgres arrays (jsonb[]), not
// jsonb — stringify JSON-typed values and cast so they land as a single jsonb.
const jsonbSql = (v: unknown) =>
  v == null ? Prisma.sql`NULL` : Prisma.sql`${JSON.stringify(v)}::jsonb`;

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
  // Multi-task enrichment fields (migration 284)
  bodyCopy: string | null;
  topCategories: string[];
  shopperGuide: string | null;
  faq: any | null;
  areaBreakdown: any | null;
  context: any | null;
}

export interface EnrichLocationResult {
  city: string;
  state: string;
  locationName: string;
  locationEnrichmentId: string | null;
  businessCount: number;
  categoryCount: number;
}

/**
 * Measured national coverage — the deterministic fact layer injected into
 * national ('__all__') location enrichment prompts and stamped into
 * context.national_coverage on the national row.
 */
export interface NationalCoverage {
  totalStates: number;
  totalCities: number;
  totalListings: number;
  states: { state: string; cityCount: number; listingCount: number }[];
  topCities: { city: string; state: string; listingCount: number }[];
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
    // National sentinel — the ('__location__','__all__','__all__') row.
    // Literal lookup: normalizers would produce '__All__'/'__ALL__' and miss
    // the row, and a miss must NOT fall into enrichLocation — an on-demand
    // national write would persist a phantom '__All__' row with empty
    // aggregates. National rows are produced by campaign runs or an explicit
    // enrichNational call only.
    if (isNationalSentinel(city)) {
      const row = await this.findRow('__all__', '__all__');
      return row ? this.rowToLocationState(row) : null;
    }
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
    opts: { triggerSource?: 'manual' | 'profile_activated' | 'on_demand' | 'campaign_run' | 'pg_sweep'; enrichedBy?: string | null } = {},
    ctx?: RequestCtx,
  ): Promise<LocationState | null> {
    // National sentinel — deterministic national coverage compose. Without
    // this guard, normalizeReferenceCity('__all__') would write a phantom
    // '__All__' row with empty aggregates.
    if (isNationalSentinel(city)) {
      return this.enrichNational(opts, ctx);
    }
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
        ${textArraySql(keywords)},
        ${textArraySql(secondary)},
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

  /**
   * Apply a validated AI-produced enrichment packet to the
   * ('__location__', city, state) row — the directory_enrichment campaign lane.
   *
   * Merge contract (AI wins when non-empty; deterministic aggregates fill
   * gaps): meta_title / description / keywords / secondary_categories /
   * schema_type_hint fall back to the buildLocationSeoPacket output computed
   * from live listing + category-enrichment aggregates. top_categories is
   * AI-only (no aggregate equivalent) — used as the secondary_categories
   * fallback before aggregates when the AI left secondary_categories empty.
   * body_copy is AI-only (the deterministic packet has no body copy).
   *
   * No listing fan-out: the location packet is city-level copy, not
   * business-specific — stamping it onto every listing in the city would
   * duplicate identical content across listings.
   */
  async applyEnrichmentPacket(
    input: {
      campaign: { id: string; city?: string | null; state?: string | null };
      packet: LocationEnrichmentOutput;
      executionId?: string | null;
      enrichedBy?: string | null;
    },
    ctx?: RequestCtx,
  ): Promise<LocationState | null> {
    const { campaign, packet } = input;
    // National ('__all__') packets write the literal sentinel row —
    // normalizers would produce '__All__'/'__ALL__'.
    const isNational = isNationalSentinel(campaign.city);
    const normalizedCity = isNational ? '__all__' : normalizeReferenceCity(campaign.city);
    const normalizedState = isNational
      ? '__all__'
      : (campaign.state ? normalizeReferenceState(campaign.state) : null);
    if (!normalizedCity || !normalizedState) {
      return null;
    }

    const locationName = isNational ? 'United States' : `${normalizedCity}, ${normalizedState}`;
    const enrichedBy = input.enrichedBy ?? null;

    // Deterministic aggregate fallback packet — same inputs as enrichLocation
    // for city packets; national packets aggregate across all covered markets
    // and stamp the measured coverage grid into context.national_coverage.
    const [categoryRows, listingRows, nationalCoverage] = isNational
      ? await Promise.all([
          this.getNationalCategoryEnrichments(),
          this.getNationalListingAggregates(),
          this.getNationalCoverage(),
        ])
      : await Promise.all([
          this.getCategoryEnrichments(normalizedCity, normalizedState),
          this.getListingAggregates(normalizedCity, normalizedState),
          Promise.resolve(null),
        ]);

    const categoryMap = new Map<string, CategoryRow>();
    for (const row of categoryRows) {
      categoryMap.set(row.category_name.toLowerCase().trim(), row);
    }

    let businessCount = 0;
    const categoriesFromListings: string[] = [];
    const categoryEnrichments: LocationEnrichmentInput[] = [];
    for (const row of listingRows) {
      const catName = row.primary_category?.trim();
      if (!catName) continue;
      categoriesFromListings.push(catName);
      businessCount += Number(row.cnt);
      const matched = categoryMap.get(catName.toLowerCase());
      categoryEnrichments.push({
        categoryName: catName,
        keywords: matched?.keywords ?? [],
        synonyms: matched?.secondary_categories ?? [],
      });
    }
    for (const row of categoryRows) {
      if (!categoriesFromListings.some((c) => c.toLowerCase().trim() === row.category_name.toLowerCase().trim())) {
        categoryEnrichments.push({
          categoryName: row.category_name,
          keywords: row.keywords,
          synonyms: row.secondary_categories,
        });
      }
    }

    const aggregatePacket = buildLocationSeoPacket({
      // Composer keyword seeds get display strings — the literal '__all__'
      // sentinel must never land in the row's keywords.
      city: isNational ? 'United States' : normalizedCity,
      state: isNational ? 'US' : normalizedState,
      locationName,
      categoryEnrichments,
    });

    // Per-field merge: AI wins when non-empty; aggregate fills gaps.
    const aiKeywords = (packet.keywords ?? []).map((k) => k.trim()).filter(Boolean);
    const aiSecondary = (packet.secondary_categories ?? []).map((s) => s.trim()).filter(Boolean);
    const aiTopCategories = (packet.top_categories ?? []).map((s) => s.trim()).filter(Boolean);
    const merged = {
      metaTitle: packet.meta_title?.trim() || aggregatePacket.metaTitle,
      description: packet.description?.trim() || aggregatePacket.description,
      keywords: aiKeywords.length ? aiKeywords : aggregatePacket.keywords,
      secondaryCategories: aiSecondary.length
        ? aiSecondary
        : (aiTopCategories.length ? aiTopCategories : aggregatePacket.secondaryCategories),
      schemaTypeHint: packet.schema_type_hint?.trim() || aggregatePacket.schemaTypeHint,
      bodyCopy: packet.body_copy?.trim() || null,
    };

    // New task fields — AI-only, no aggregate fallback.
    const shopperGuide = packet.shopper_guide?.trim() || null;
    const faq = packet.faq ?? null;
    const areaBreakdown = packet.area_breakdown ?? null;
    // National packets carry the measured coverage grid alongside the AI
    // context — the deterministic fact layer the copy must not contradict.
    const context = isNational
      ? { ...(packet.context ?? {}), national_coverage: nationalCoverage }
      : (packet.context ?? null);

    const id = generateCategoryMarketEnrichmentId();
    const enrichedAt = new Date();
    const triggerSource = 'campaign_run';

    const upsert = Prisma.sql`
      INSERT INTO directory_category_enrichment (
        id, category_key, category_name, city, state,
        meta_title, description, keywords, secondary_categories, schema_type_hint,
        body_copy, shopper_guide, faq, area_breakdown, context,
        intelligence_profile_id, gold_standard_profile_id, composer_version,
        enriched_at, enriched_by, trigger_source,
        source_campaign_id, source_execution_id, created_at, updated_at
      )
      VALUES (
        ${id}, ${LOCATION_SENTINEL_KEY}, ${locationName}, ${normalizedCity}, ${normalizedState},
        ${merged.metaTitle}, ${merged.description},
        ${textArraySql(merged.keywords)},
        ${textArraySql(merged.secondaryCategories)},
        ${merged.schemaTypeHint},
        ${merged.bodyCopy},
        ${shopperGuide},
        ${jsonbSql(faq)},
        ${jsonbSql(areaBreakdown)},
        ${jsonbSql(context)},
        ${null}, ${null}, ${CAMPAIGN_COMPOSER_VERSION},
        ${enrichedAt}, ${enrichedBy}, ${triggerSource},
        ${campaign.id}, ${input.executionId ?? null}, now(), now()
      )
      ON CONFLICT (category_key, city, state) DO UPDATE SET
        category_name = EXCLUDED.category_name,
        meta_title = EXCLUDED.meta_title,
        description = EXCLUDED.description,
        keywords = EXCLUDED.keywords,
        secondary_categories = EXCLUDED.secondary_categories,
        schema_type_hint = EXCLUDED.schema_type_hint,
        body_copy = EXCLUDED.body_copy,
        shopper_guide = EXCLUDED.shopper_guide,
        faq = EXCLUDED.faq,
        area_breakdown = EXCLUDED.area_breakdown,
        context = EXCLUDED.context,
        composer_version = EXCLUDED.composer_version,
        enriched_at = EXCLUDED.enriched_at,
        enriched_by = EXCLUDED.enriched_by,
        trigger_source = EXCLUDED.trigger_source,
        source_campaign_id = EXCLUDED.source_campaign_id,
        source_execution_id = EXCLUDED.source_execution_id,
        updated_at = now()
      RETURNING *
    `;

    const resultRows = await this.prisma.$queryRaw<any[]>(upsert);
    const row = Array.isArray(resultRows) && resultRows.length > 0 ? resultRows[0] : null;

    audit({
      actor: enrichedBy,
      actorType: enrichedBy ? 'user' : 'system',
      action: 'directory_location_enrichment.campaign_apply',
      payload: {
        city: normalizedCity,
        state: normalizedState,
        locationName,
        campaignId: campaign.id,
        executionId: input.executionId ?? null,
        locationEnrichmentId: id,
        triggerSource,
      },
    });

    logger.info('LocationMarketEnrichmentService.applyEnrichmentPacket', ctx, {
      city: normalizedCity,
      state: normalizedState,
      campaignId: campaign.id,
      locationEnrichmentId: id,
    });

    return row ? this.rowToLocationState(row) : null;
  }

  /**
   * Deterministic national location enrich — the
   * ('__location__','__all__','__all__') row. Composes the same SEO packet
   * shape as a city enrich but aggregates across ALL covered markets
   * (national listing aggregates + national category enrichment rows) and
   * stamps the measured coverage grid into context.national_coverage —
   * merged over any existing AI context so the deterministic fact layer
   * refreshes without clobbering campaign-applied fields.
   */
  private async enrichNational(
    opts: { triggerSource?: 'manual' | 'profile_activated' | 'on_demand' | 'campaign_run' | 'pg_sweep'; enrichedBy?: string | null } = {},
    ctx?: RequestCtx,
  ): Promise<LocationState | null> {
    const locationName = 'United States';
    const triggerSource = opts.triggerSource ?? 'manual';
    const enrichedBy = opts.enrichedBy ?? null;

    const [categoryRows, listingRows, coverage] = await Promise.all([
      this.getNationalCategoryEnrichments(),
      this.getNationalListingAggregates(),
      this.getNationalCoverage(),
    ]);

    const categoryMap = new Map<string, CategoryRow>();
    for (const row of categoryRows) {
      categoryMap.set(row.category_name.toLowerCase().trim(), row);
    }

    let businessCount = 0;
    const categoriesFromListings: string[] = [];
    const categoryEnrichments: LocationEnrichmentInput[] = [];
    for (const row of (listingRows as ListingAggregateRow[])) {
      const catName = row.primary_category?.trim();
      if (!catName) continue;
      categoriesFromListings.push(catName);
      businessCount += Number(row.cnt);
      const matched = categoryMap.get(catName.toLowerCase());
      categoryEnrichments.push({
        categoryName: catName,
        keywords: matched?.keywords ?? [],
        synonyms: matched?.secondary_categories ?? [],
      });
    }
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
      city: 'United States',
      state: 'US',
      locationName,
      categoryEnrichments,
    });

    const existing = await this.findRow('__all__', '__all__');
    const context = { ...((existing?.context as any) ?? {}), national_coverage: coverage };

    // A campaign-applied row (composer_version=2) keeps its AI head copy —
    // this sync refreshes the fact layer (national_coverage + aggregate
    // inputs), it does not revert the packet to composer prose. Deliberately
    // different from the city path: the composer cannot write national
    // coverage narrative, so the campaign packet is the only good source.
    // Baseline rows (v1 / missing) take the full deterministic packet.
    const campaignRow = existing?.composer_version === CAMPAIGN_COMPOSER_VERSION;
    const metaTitle = campaignRow ? existing.meta_title : packet.metaTitle;
    const description = campaignRow ? existing.description : packet.description;
    const keywords = campaignRow
      ? (existing.keywords ?? [])
      : (packet.keywords.length > 0 ? packet.keywords : []);
    const secondary = campaignRow
      ? (existing.secondary_categories ?? [])
      : (packet.secondaryCategories.length > 0 ? packet.secondaryCategories : []);
    const schemaTypeHint = campaignRow ? existing.schema_type_hint : packet.schemaTypeHint;
    const composerVersion = campaignRow ? CAMPAIGN_COMPOSER_VERSION : packet.composerVersion;

    const id = generateCategoryMarketEnrichmentId();
    const enrichedAt = new Date();

    const upsert = Prisma.sql`
      INSERT INTO directory_category_enrichment (
        id, category_key, category_name, city, state,
        meta_title, description, keywords, secondary_categories, schema_type_hint,
        context,
        intelligence_profile_id, gold_standard_profile_id, composer_version,
        enriched_at, enriched_by, trigger_source, created_at, updated_at
      )
      VALUES (
        ${id}, ${LOCATION_SENTINEL_KEY}, ${locationName}, '__all__', '__all__',
        ${metaTitle}, ${description},
        ${textArraySql(keywords)},
        ${textArraySql(secondary)},
        ${schemaTypeHint},
        ${jsonbSql(context)},
        ${null}, ${null}, ${composerVersion},
        ${enrichedAt}, ${enrichedBy}, ${triggerSource}, now(), now()
      )
      ON CONFLICT (category_key, city, state) DO UPDATE SET
        category_name = EXCLUDED.category_name,
        meta_title = EXCLUDED.meta_title,
        description = EXCLUDED.description,
        keywords = EXCLUDED.keywords,
        secondary_categories = EXCLUDED.secondary_categories,
        schema_type_hint = EXCLUDED.schema_type_hint,
        context = EXCLUDED.context,
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
        city: '__all__',
        state: '__all__',
        locationName,
        businessCount,
        categoryCount: categoryEnrichments.length,
        coveredStates: coverage.totalStates,
        coveredCities: coverage.totalCities,
        locationEnrichmentId: id,
        triggerSource,
      },
    });

    logger.info('LocationMarketEnrichmentService.enrichNational', ctx, {
      businessCount,
      categoryCount: categoryEnrichments.length,
      coveredStates: coverage.totalStates,
      coveredCities: coverage.totalCities,
      locationEnrichmentId: id,
    });

    return row ? this.rowToLocationState(row) : null;
  }

  /**
   * Measured national coverage — the deterministic fact layer for the
   * national location packet. Distinct (city, state) markets, per-state
   * rollups, and category leaders across every published listing. This is
   * DB truth, not derived copy — injected into the national location prompt
   * and stamped into context.national_coverage at apply.
   */
  async getNationalCoverage(ctx?: RequestCtx): Promise<NationalCoverage> {
    try {
      const [stateRows, cityRows] = await Promise.all([
        this.prisma.$queryRaw<{ state: string; city_count: bigint; listing_count: bigint }[]>`
          SELECT state, COUNT(DISTINCT city) AS city_count, COUNT(*) AS listing_count
          FROM directory_listings_list
          WHERE is_published = true
            AND (business_hours IS NULL OR business_hours::text != 'null')
            AND state IS NOT NULL AND city IS NOT NULL
          GROUP BY state
          ORDER BY listing_count DESC
        `,
        this.prisma.$queryRaw<{ city: string; state: string; listing_count: bigint }[]>`
          SELECT city, state, COUNT(*) AS listing_count
          FROM directory_listings_list
          WHERE is_published = true
            AND (business_hours IS NULL OR business_hours::text != 'null')
            AND city IS NOT NULL AND state IS NOT NULL
          GROUP BY city, state
          ORDER BY listing_count DESC
          LIMIT 50
        `,
      ]);
      const states = (Array.isArray(stateRows) ? stateRows : []).map((r) => ({
        state: r.state,
        cityCount: Number(r.city_count),
        listingCount: Number(r.listing_count),
      }));
      const cities = (Array.isArray(cityRows) ? cityRows : []).map((r) => ({
        city: r.city,
        state: r.state,
        listingCount: Number(r.listing_count),
      }));
      return {
        totalStates: states.length,
        totalCities: cities.length === 50 ? states.reduce((a, s) => a + s.cityCount, 0) : cities.length,
        totalListings: states.reduce((a, s) => a + s.listingCount, 0),
        states,
        topCities: cities.slice(0, 20),
      };
    } catch (err) {
      logger.warn('Failed to compute national coverage', ctx, { error: (err as Error).message });
      return { totalStates: 0, totalCities: 0, totalListings: 0, states: [], topCities: [] };
    }
  }

  /** National listing aggregates — category counts across ALL markets. */
  private async getNationalListingAggregates(): Promise<ListingAggregateRow[]> {
    const rows = await this.prisma.$queryRaw<ListingAggregateRow[]>`
      SELECT primary_category, COUNT(*) as cnt
      FROM directory_listings_list
      WHERE is_published = true
        AND (business_hours IS NULL OR business_hours::text != 'null')
        AND primary_category IS NOT NULL
      GROUP BY primary_category
      ORDER BY cnt DESC
    `;
    return Array.isArray(rows) ? rows : [];
  }

  /** National category enrichment rows — the (category,'__all__','__all__') packets. */
  private async getNationalCategoryEnrichments(): Promise<CategoryRow[]> {
    const rows = await this.prisma.$queryRaw<CategoryRow[]>`
      SELECT category_key, category_name, city, state, meta_title, description, keywords, secondary_categories
      FROM directory_category_enrichment
      WHERE category_key != ${LOCATION_SENTINEL_KEY}
        AND city = '__all__'
        AND state = '__all__'
      ORDER BY enriched_at DESC
    `;
    return Array.isArray(rows) ? rows : [];
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
      bodyCopy: row.body_copy ?? null,
      topCategories: row.context?.top_categories ?? [],
      shopperGuide: row.shopper_guide ?? null,
      faq: row.faq ?? null,
      areaBreakdown: row.area_breakdown ?? null,
      context: row.context ?? null,
    };
  }
}

export default LocationMarketEnrichmentService.getInstance();
