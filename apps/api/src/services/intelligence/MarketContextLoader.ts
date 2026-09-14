/**
 * MarketContextLoader — Shared market intelligence loader for intelligence
 * campaigns (establishment, discovery) and business audits.
 *
 * Loads structural market intelligence from prior PG enrichment runs:
 *   - Category intelligence: row (category, city, state) context JSONB
 *   - Location intelligence: row ('__location__', city, state) context JSONB
 *
 * The loader returns raw data. Binding formatters (establishment, discovery,
 * audit) produce the narrative-aware text blocks that announce, present, and
 * set expectations for the analyst.
 *
 * Design properties:
 *   - Graceful degradation: returns null/empty when enrichment hasn't run.
 *   - No sentiment bleed: loads intelligence (profiles, signals, gaps) only —
 *     never body_copy, shopper_guide, faq, or other shopper-facing sentiments.
 *   - Reusable: the business audit's buildMarketContextBlock can later be
 *     refactored to use this loader.
 *
 * Pattern: singleton extends BaseService
 * Spec: docs/LocalBiz/INTELLIGENCE_CAMPAIGN_MARKET_CONTEXT_SPEC.md
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';

// ─── Types ───────────────────────────────────────────────────────────────

export interface CategoryProfile {
  business_model?: string;
  typical_products?: string;
  customer_base?: string;
  online_presence_pattern?: string;
  competitive_landscape?: string;
  typical_scale?: string;
}

export interface CityProfile {
  metro_description?: string;
  major_industries?: string[];
  growth_trajectory?: string;
  demographic_character?: string;
  market_character?: string;
}

export interface MarketGap {
  category: string;
  signal: string;
  area?: string;
}

export interface MetroDynamic {
  city: string;
  state?: string;
  relationship: string;
  character: string;
  business_scene?: string;
  notes?: string;
}

export interface CategoryIntelligence {
  category_summary?: string;
  keywords?: string[];
  secondary_categories?: string[];
  category_notes?: string;
  category_profile?: CategoryProfile;
  category_signals?: string[];
  market_density?: string;
  prospect_signals?: string[];
  // Structural taxonomy (merged into context JSONB by the campaign applier).
  // Same structural nature as category_profile — describes what the category
  // IS in the taxonomy tree, not shopper-facing sentiment. Consumed by
  // intelligence campaign formatters to give the analyst category placement
  // context (breadcrumbs, specializations, siblings).
  super_categories?: string[];
  sub_categories?: string[];
  adjacent_categories?: string[];
}

export interface LocationIntelligence {
  market_summary?: string;
  top_categories?: string[];
  secondary_categories?: string[];
  keywords?: string[];
  notable_areas?: string[];
  market_notes?: string;
  city_profile?: CityProfile;
  market_gaps?: MarketGap[];
  metro_context?: string;
  metro_dynamics?: MetroDynamic[];
}

export interface MarketContext {
  category: CategoryIntelligence;
  location: LocationIntelligence;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class MarketContextLoader extends BaseService {
  private static instance: MarketContextLoader;
  // Spec open question #4: cache the loader result per (category, city,
  // state) with a 5-minute TTL, same as the enrichment public API.
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly cache = new Map<string, { data: MarketContext; expiresAt: number }>();

  private constructor() {
    super();
  }

  static getInstance(): MarketContextLoader {
    if (!MarketContextLoader.instance) {
      MarketContextLoader.instance = new MarketContextLoader();
    }
    return MarketContextLoader.instance;
  }

  /** Clear the in-memory cache (used by tests). */
  resetCache(): void {
    this.cache.clear();
  }

  /**
   * Load market intelligence for a (category, city, state) market.
   *
   * Returns empty objects when enrichment hasn't run — callers should
   * check for the presence of specific fields before using them.
   *
   * National campaigns (city = '__all__') have no city profile — only the
   * national category enrichment row (written literally as (category,
   * '__all__', '__all__') by CategoryMarketEnrichmentService) is loaded.
   */
  async loadMarketContext(
    category: string,
    city: string | null,
    state: string | null,
    ctx?: RequestCtx,
  ): Promise<MarketContext> {
    const empty: MarketContext = { category: {}, location: {} };
    if (!city || !category) return empty;
    const isNational = city.trim().toLowerCase() === '__all__';
    if (!isNational && !state) return empty;

    const cacheKey = `${category.toLowerCase()}|${city.trim().toLowerCase()}|${(state ?? '').trim().toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    try {
      if (isNational) {
        const rows = await this.prisma.$queryRaw<Array<{ category_key: string; context: any }>>`
          SELECT category_key, context FROM directory_category_enrichment
          WHERE LOWER(city) = '__all__'
            AND category_key = ${category}
        `;
        const categoryCtx = Array.isArray(rows)
          ? rows.find((r) => r.category_key === category)?.context
          : undefined;
        const data: MarketContext = { category: categoryCtx ?? {}, location: {} };
        this.cache.set(cacheKey, { data, expiresAt: Date.now() + MarketContextLoader.CACHE_TTL_MS });
        return data;
      }

      const rows = await this.prisma.$queryRaw<Array<{ category_key: string; context: any }>>`
        SELECT category_key, context FROM directory_category_enrichment
        WHERE LOWER(city) = LOWER(${city})
          AND LOWER(state) = LOWER(${state})
          AND category_key IN (${category}, '__location__')
      `;

      const categoryCtx = Array.isArray(rows)
        ? rows.find((r) => r.category_key === category)?.context
        : undefined;
      const locationCtx = Array.isArray(rows)
        ? rows.find((r) => r.category_key === '__location__')?.context
        : undefined;

      const data: MarketContext = {
        category: categoryCtx ?? {},
        location: locationCtx ?? {},
      };
      this.cache.set(cacheKey, { data, expiresAt: Date.now() + MarketContextLoader.CACHE_TTL_MS });
      return data;
    } catch (err) {
      logger.warn('Failed to load market context', ctx, {
        category,
        city,
        state,
        error: (err as Error).message,
      });
      return empty;
    }
  }

  /**
   * Load location intelligence for a (city, state) market WITHOUT a category.
   *
   * Used by category-identification seeks: the analyst is determining the
   * category, so category intelligence is unavailable, but the location
   * profile (city_profile, market_gaps, metro_dynamics, notable_areas) is
   * category-agnostic and informs the population test for candidate shelves.
   *
   * Returns an empty LocationIntelligence when enrichment hasn't run.
   * National campaigns (city = '__all__') have no city profile — returns empty.
   */
  async loadLocationContext(
    city: string | null,
    state: string | null,
    ctx?: RequestCtx,
  ): Promise<LocationIntelligence> {
    const empty: LocationIntelligence = {};
    if (!city) return empty;
    const isNational = city.trim().toLowerCase() === '__all__';
    if (isNational || !state) return empty;

    const cacheKey = `__location__|${city.trim().toLowerCase()}|${state.trim().toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data.location;

    try {
      const rows = await this.prisma.$queryRaw<Array<{ category_key: string; context: any }>>`
        SELECT category_key, context FROM directory_category_enrichment
        WHERE LOWER(city) = LOWER(${city})
          AND LOWER(state) = LOWER(${state})
          AND category_key = '__location__'
      `;
      const locationCtx = Array.isArray(rows)
        ? rows.find((r) => r.category_key === '__location__')?.context
        : undefined;

      const data: MarketContext = { category: {}, location: locationCtx ?? {} };
      this.cache.set(cacheKey, { data, expiresAt: Date.now() + MarketContextLoader.CACHE_TTL_MS });
      return data.location;
    } catch (err) {
      logger.warn('Failed to load location context', ctx, {
        city,
        state,
        error: (err as Error).message,
      });
      return empty;
    }
  }

  /**
   * Check whether any category intelligence is available.
   */
  hasCategoryIntelligence(ctx: CategoryIntelligence): boolean {
    return Boolean(
      ctx.category_summary ||
      ctx.category_profile ||
      (ctx.category_signals && ctx.category_signals.length > 0) ||
      ctx.market_density ||
      (ctx.prospect_signals && ctx.prospect_signals.length > 0) ||
      (ctx.super_categories && ctx.super_categories.length > 0) ||
      (ctx.sub_categories && ctx.sub_categories.length > 0) ||
      (ctx.adjacent_categories && ctx.adjacent_categories.length > 0),
    );
  }

  /**
   * Check whether any location intelligence is available.
   */
  hasLocationIntelligence(ctx: LocationIntelligence): boolean {
    return Boolean(
      ctx.market_summary ||
      ctx.city_profile ||
      (ctx.market_gaps && ctx.market_gaps.length > 0) ||
      (ctx.metro_dynamics && ctx.metro_dynamics.length > 0) ||
      (ctx.notable_areas && ctx.notable_areas.length > 0),
    );
  }
}

export default MarketContextLoader.getInstance();
