/**
 * PlacesBrowsePublicService — public browse service for directory presence
 * category pages. Extends PublicApiSingleton (no auth required).
 *
 * Wraps:
 *   - GET /api/public/directory/places               (categories with published presence listings)
 *   - GET /api/public/directory/places/:categorySlug  (published presence listings by category)
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface PlaceCategory {
  category: string;
  slug: string;
  categoryId: string | null;
  iconEmoji: string | null;
  parentId: string | null;
  level: number | null;
  placeCount: number;
  cities: { city: string; state: string; placeCount: number }[];
}

export interface PlaceListing {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  logoUrl: string | null;
  description: string | null;
  snapEbtReported: boolean;
  snapEbtSource: string | null;
  publicDisclaimer: string | null;
  category: string;
  categorySlug: string;
  iconEmoji: string | null;
  claimToken: string | null;
}

export interface PlacesCategoriesResponse {
  categories: PlaceCategory[];
  totalPlaces: number;
}

export interface PlacesByCategoryResponse {
  categorySlug: string;
  places: PlaceListing[];
  count: number;
}

export interface CategoryEnrichmentMarket {
  categoryName: string;
  city: string;
  state: string;
}

export interface CategoryEnrichmentEffective {
  metaTitle: string;
  description: string;
  keywords: string[];
  schemaTypeHint: string | null;
  secondaryCategories: string[];
  synonyms: string[];
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface CategoryEnrichmentResponse {
  market: CategoryEnrichmentMarket | null;
  effective: CategoryEnrichmentEffective;
  overridden: { description: boolean; metaTitle: boolean; keywords: boolean };
  enrichedAt: string;
  bodyCopy: string | null;
  shopperGuide: string | null;
  faq: FaqEntry[] | null;
  context: {
    category_overview?: string;
    super_categories?: string[];
    sub_categories?: string[];
    adjacent_categories?: string[];
    category_profile?: {
      business_model?: string;
      typical_products?: string;
      customer_base?: string;
      online_presence_pattern?: string;
      competitive_landscape?: string;
      typical_scale?: string;
    };
    category_signals?: string[];
    market_density?: string;
    prospect_signals?: string[];
    [key: string]: any;
  } | null;
}

export interface LocationEnrichmentMarket {
  city: string;
  state: string;
  locationName: string;
}

export interface LocationEnrichmentEffective {
  metaTitle: string;
  description: string;
  keywords: string[];
  schemaTypeHint: string | null;
  secondaryCategories: string[];
}

export interface AreaBreakdownEntry {
  area_name: string;
  description: string;
  strong_categories?: string[];
}

export interface LocationEnrichmentResponse {
  market: LocationEnrichmentMarket | null;
  effective: LocationEnrichmentEffective;
  overridden: { description: boolean; metaTitle: boolean; keywords: boolean };
  enrichedAt: string;
  bodyCopy: string | null;
  topCategories: string[];
  shopperGuide: string | null;
  faq: FaqEntry[] | null;
  areaBreakdown: AreaBreakdownEntry[] | null;
  context: {
    metro_context?: string;
    market_gaps?: Array<{ category: string; signal: string; area?: string }>;
    metro_dynamics?: Array<{ city: string; state?: string; relationship: string; character: string; business_scene?: string; notes?: string }>;
    [key: string]: any;
  } | null;
}

export interface CategoryVocabEntry {
  value: string;
  label: string;
  slug: string;
  onDirectory: boolean;
}

export interface NationalCategoryRosterEntry {
  market: { categoryName: string; categoryKey: string };
  effective: {
    metaTitle: string | null;
    description: string | null;
    keywords: string[] | null;
    schemaTypeHint: string | null;
    secondaryCategories: string[] | null;
  };
  bodyCopy: string | null;
  context: { category_overview?: string; [key: string]: any } | null;
  enrichedAt: string;
}

class PlacesBrowsePublicService extends PublicApiSingleton {
  private static instance: PlacesBrowsePublicService;

  private constructor() {
    super('places-browse-public', { ttl: 5 * 60 * 1000 });
  }

  public static getInstance(): PlacesBrowsePublicService {
    if (!PlacesBrowsePublicService.instance) {
      PlacesBrowsePublicService.instance = new PlacesBrowsePublicService();
    }
    return PlacesBrowsePublicService.instance;
  }

  /** GET /api/public/directory/category-vocab — registered category vocabulary (public read of mkt_service_categories_list) */
  async getCategoryVocab(): Promise<CategoryVocabEntry[]> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/public/directory/category-vocab',
        { method: 'GET' },
        'places-category-vocab',
        5 * 60 * 1000,
      );
      if (!result.success) return [];
      const data = result.data?.data ?? result.data;
      return data?.categories ?? [];
    } catch {
      return [];
    }
  }

  /** GET /api/public/directory/places — categories with published presence listings */
  async getCategories(): Promise<PlacesCategoriesResponse | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/public/directory/places',
        { method: 'GET' },
        'places-categories',
        5 * 60 * 1000,
      );
      if (!result.success) return null;
      const data = result.data?.data ?? result.data;
      if (!data) return null;
      return {
        categories: data.categories || [],
        totalPlaces: data.totalPlaces || 0,
      };
    } catch {
      return null;
    }
  }

  /** GET /api/public/directory/places/:categorySlug — published presence listings by category */
  async getPlacesByCategory(categorySlug: string, city?: string): Promise<PlacesByCategoryResponse | null> {
    try {
      const qs = city ? `?city=${encodeURIComponent(city)}` : '';
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/places/${encodeURIComponent(categorySlug)}${qs}`,
        { method: 'GET' },
        `places-category-${categorySlug}-${city || 'all'}`,
        5 * 60 * 1000,
      );
      if (!result.success) return null;
      const data = result.data?.data ?? result.data;
      if (!data) return null;
      return {
        categorySlug: data.categorySlug,
        places: data.places || [],
        count: data.count || 0,
      };
    } catch {
      return null;
    }
  }

  /** GET /api/public/directory/category-enrichment — effective category SEO */
  async getCategoryEnrichment(
    categorySlug: string,
    city?: string,
    state?: string,
  ): Promise<CategoryEnrichmentResponse | null> {
    try {
      const qs = new URLSearchParams();
      qs.set('category', categorySlug);
      if (city) qs.set('city', city);
      if (state) qs.set('state', state);
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/category-enrichment?${qs.toString()}`,
        { method: 'GET' },
        `category-enrichment-${categorySlug}-${city || 'all'}-${state || 'all'}`,
        5 * 60 * 1000,
      );
      if (!result.success) return null;
      const data = result.data?.data ?? result.data;
      if (!data || !data.market) return null;
      return {
        market: data.market,
        effective: data.effective,
        overridden: data.overridden,
        enrichedAt: data.enrichedAt,
        bodyCopy: data.bodyCopy ?? null,
        shopperGuide: data.shopperGuide ?? null,
        faq: data.faq ?? null,
        context: data.context ?? null,
      };
    } catch {
      return null;
    }
  }

  /**
   * GET /api/public/directory/places/city/:slug (light summary) — the seed
   * shelf's resolved market: dominant state + embedded location enrichment
   * packet. Server-side callers (generateMetadata, page.tsx) use this to
   * render packet-driven SEO without a second endpoint call.
   */
  async getCityShelfSummary(citySlug: string): Promise<{
    city: string;
    state: string | null;
    total: number;
    enrichment: LocationEnrichmentResponse | null;
  } | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/places/city/${encodeURIComponent(citySlug)}?perPage=1`,
        { method: 'GET' },
        `places-city-summary-${citySlug}`,
        5 * 60 * 1000,
      );
      if (!result.success) return null;
      const data = result.data?.data ?? result.data;
      if (!data || !data.city) return null;
      return {
        city: data.city,
        state: data.state ?? null,
        total: data.total ?? 0,
        enrichment: data.enrichment ?? null,
      };
    } catch {
      return null;
    }
  }

  /** GET /api/public/directory/location-enrichment — effective location SEO for city pages */
  async getLocationEnrichment(
    city: string,
    state: string,
  ): Promise<LocationEnrichmentResponse | null> {
    try {
      const qs = new URLSearchParams();
      qs.set('city', city);
      qs.set('state', state);
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/location-enrichment?${qs.toString()}`,
        { method: 'GET' },
        `location-enrichment-${city}-${state}`,
        5 * 60 * 1000,
      );
      if (!result.success) return null;
      const data = result.data?.data ?? result.data;
      if (!data || !data.market) return null;
      return {
        market: data.market,
        effective: data.effective,
        overridden: data.overridden,
        enrichedAt: data.enrichedAt,
        bodyCopy: data.bodyCopy ?? null,
        topCategories: data.topCategories ?? [],
        shopperGuide: data.shopperGuide ?? null,
        faq: data.faq ?? null,
        areaBreakdown: data.areaBreakdown ?? null,
        context: data.context ?? null,
      };
    } catch {
      return null;
    }
  }

  /**
   * GET /api/public/directory/category-enrichment-roster — every national
   * ('__all__') category packet in one call. Powers the category-aware
   * narrative layer on the /place and /directory homes.
   */
  async getNationalCategoryRoster(): Promise<NationalCategoryRosterEntry[] | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/public/directory/category-enrichment-roster',
        { method: 'GET' },
        'category-enrichment-roster',
        5 * 60 * 1000,
      );
      if (!result.success) return null;
      const data = result.data?.data ?? result.data;
      if (!data || !Array.isArray(data.markets)) return null;
      return data.markets as NationalCategoryRosterEntry[];
    } catch {
      return null;
    }
  }
}

const placesBrowsePublicService = PlacesBrowsePublicService.getInstance();
export default placesBrowsePublicService;
