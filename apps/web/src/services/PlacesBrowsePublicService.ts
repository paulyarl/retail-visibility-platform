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
}

const placesBrowsePublicService = PlacesBrowsePublicService.getInstance();
export default placesBrowsePublicService;
