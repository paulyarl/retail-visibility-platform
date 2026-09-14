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

  private constructor() {
    super();
  }

  static getInstance(): MarketContextLoader {
    if (!MarketContextLoader.instance) {
      MarketContextLoader.instance = new MarketContextLoader();
    }
    return MarketContextLoader.instance;
  }

  /**
   * Load market intelligence for a (category, city, state) market.
   *
   * Returns empty objects when enrichment hasn't run — callers should
   * check for the presence of specific fields before using them.
   */
  async loadMarketContext(
    category: string,
    city: string | null,
    state: string | null,
    ctx?: RequestCtx,
  ): Promise<MarketContext> {
    const empty: MarketContext = { category: {}, location: {} };
    if (!city || !state || !category) return empty;
    // National campaigns (city = '__all__') have no city profile.
    if (city.trim().toLowerCase() === '__all__') return empty;

    try {
      const rows = await this.prisma.$queryRaw<Array<{ category_key: string; context: any }>>`
        SELECT category_key, context FROM directory_category_enrichment
        WHERE LOWER(city) = LOWER(${city})
          AND LOWER(state) = LOWER(${state})
          AND category_key IN (${category}, '__location__')
      `;
      if (!Array.isArray(rows) || rows.length === 0) return empty;

      const categoryCtx = rows.find((r) => r.category_key === category)?.context;
      const locationCtx = rows.find((r) => r.category_key === '__location__')?.context;

      return {
        category: categoryCtx ?? {},
        location: locationCtx ?? {},
      };
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
   * Check whether any category intelligence is available.
   */
  hasCategoryIntelligence(ctx: CategoryIntelligence): boolean {
    return Boolean(
      ctx.category_summary ||
      ctx.category_profile ||
      (ctx.category_signals && ctx.category_signals.length > 0) ||
      ctx.market_density ||
      (ctx.prospect_signals && ctx.prospect_signals.length > 0),
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
