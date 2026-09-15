/**
 * MarketIntelSurfaceService — frontend client for category + city market intel.
 *
 * Extends PublicApiSingleton with ttl: 0 (no caching — same as the place
 * teaser service). Wraps the public surface endpoints.
 *
 * Spec: docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md (§12.4)
 */
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface CategoryMarketIntelTeaser {
  surfaceType: 'category';
  categorySlug: string;
  city: string;
  state: string | null;
  hasIntelligence: boolean;
  cards: {
    categorySignals: { available: boolean; teaser: string; count: number };
    categoryProfile: { available: boolean; teaser: string };
    marketDensity: { available: boolean; teaser: string };
    addYourBusiness: { available: boolean; teaser: string };
    fullReport: { available: boolean; teaser: string };
  };
}

export interface CityMarketIntelTeaser {
  surfaceType: 'city';
  city: string;
  state: string;
  hasIntelligence: boolean;
  cards: {
    marketGaps: { available: boolean; teaser: string; count: number };
    metroDynamics: { available: boolean; teaser: string };
    marketSummary: { available: boolean; teaser: string };
    addYourBusiness: { available: boolean; teaser: string };
    fullReport: { available: boolean; teaser: string };
  };
}

class MarketIntelSurfaceService extends PublicApiSingleton {
  private static instance: MarketIntelSurfaceService;
  private constructor() {
    super('market-intel-surface', { ttl: 0 });
  }
  static getInstance() {
    if (!MarketIntelSurfaceService.instance) {
      MarketIntelSurfaceService.instance = new MarketIntelSurfaceService();
    }
    return MarketIntelSurfaceService.instance;
  }

  /**
   * Fetch the category teaser summary.
   * @param categorySlug  e.g. "indian-grocery"
   * @param city          e.g. "Kansas City" or "__all__" for national
   * @param state         e.g. "MO" (null for national)
   */
  async getCategoryTeaser(
    categorySlug: string,
    city: string,
    state: string | null,
  ): Promise<CategoryMarketIntelTeaser | null> {
    try {
      const qs = new URLSearchParams({ city });
      if (state) qs.set('state', state);
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/category/${encodeURIComponent(categorySlug)}/market-intel/summary?${qs.toString()}`,
        { method: 'GET' },
        undefined,
        0,
      );
      const data = result.data?.data ?? result.data;
      return data as CategoryMarketIntelTeaser;
    } catch {
      return null;
    }
  }

  /**
   * Fetch the city teaser summary.
   * @param citySlug  e.g. "kansas-city-mo"
   */
  async getCityTeaser(citySlug: string): Promise<CityMarketIntelTeaser | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/city/${encodeURIComponent(citySlug)}/market-intel/summary`,
        { method: 'GET' },
        undefined,
        0,
      );
      const data = result.data?.data ?? result.data;
      return data as CityMarketIntelTeaser;
    } catch {
      return null;
    }
  }
}

export default MarketIntelSurfaceService.getInstance();
