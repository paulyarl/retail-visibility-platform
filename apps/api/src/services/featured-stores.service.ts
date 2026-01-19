import { getDirectPool } from '../utils/db-pool';

// TypeScript interfaces for featured stores
interface FeaturedStore {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  primaryCategory: string | null;
  logoUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  productCount: string;
  isFeatured: boolean;
  subscriptionTier: string;
  useCustomWebsite: boolean;
  businessHours: any;
  directoryPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FeaturedStoreStats {
  totalStores: number;
  totalProducts: number;
  avgRating: number;
  uniqueLocations: number;
  cities: string[];
  states: string[];
  firstStoreAdded: string | null;
  lastStoreUpdated: string | null;
}

/**
 * Featured Stores Service
 * 
 * Handles promotional featured stores functionality
 * Completely separate from store types/directory categories
 */
class FeaturedStoresService {
  /**
   * Get all featured stores with statistics
   * Used by the /api/directory/featured-stores endpoint
   */
  async getFeaturedStores(
    location?: { lat: number; lng: number },
    radiusMiles?: number,
    limit?: number
  ): Promise<{
    stores: FeaturedStore[];
    stats: FeaturedStoreStats;
    totalCount: number;
  }> {
    try {
      const pool = getDirectPool();
      const maxStores = limit || 50;
      
      // Build the base query for featured stores
      let featuredStoresQuery = `
        SELECT 
          dll.id,
          dll.tenant_id,
          dll.business_name,
          dll.slug,
          dll.address,
          dll.city,
          dll.state,
          dll.zip_code,
          dll.phone,
          dll.email,
          dll.website,
          dll.latitude,
          dll.longitude,
          dll.primary_category,
          dll.logo_url,
          dll.rating_avg,
          dll.rating_count,
          dll.product_count,
          dll.is_featured,
          dll.subscription_tier,
          dll.use_custom_website,
          dll.business_hours,
          dll.is_published,
          dll.created_at,
          dll.updated_at
        FROM directory_listings_list dll
        WHERE dll.is_published = true 
          AND dll.is_featured = true
      `;
      
      const params: any[] = [];
      
      // Add location filtering if provided
      if (location && radiusMiles) {
        featuredStoresQuery += `
          AND (
            dll.latitude IS NOT NULL 
            AND dll.longitude IS NOT NULL
            AND (
              3959 * acos(cos(radians($${params.length + 1})) * cos(radians(dll.latitude)) * 
              cos(radians(dll.longitude) - radians($${params.length + 2})) + 
              sin(radians($${params.length + 1})) * sin(radians(dll.latitude)))
            ) <= $${params.length + 3}
          )
        `;
        params.push(location.lat, location.lng, radiusMiles);
      }
      
      featuredStoresQuery += ` ORDER BY dll.business_name ASC`;
      
      // Execute the query
      const result = await pool.query(featuredStoresQuery, params);
      
      // Transform the results to match the expected format
      const featuredStores: FeaturedStore[] = result.rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        businessName: row.business_name,
        slug: row.slug,
        address: row.address,
        city: row.city,
        state: row.state,
        postalCode: row.zip_code,
        phone: row.phone,
        email: row.email,
        website: row.website,
        latitude: row.latitude,
        longitude: row.longitude,
        primaryCategory: row.primary_category,
        logoUrl: row.logo_url,
        ratingAvg: parseFloat(row.rating_avg) || 0,
        ratingCount: parseInt(row.rating_count) || 0,
        productCount: row.product_count?.toString() || "0",
        isFeatured: row.is_featured || false,
        subscriptionTier: row.subscription_tier,
        useCustomWebsite: row.use_custom_website || false,
        businessHours: row.business_hours,
        directoryPublished: row.is_published || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      // Calculate statistics
      const stats: FeaturedStoreStats = {
        totalStores: featuredStores.length,
        totalProducts: featuredStores.reduce((sum, store) => sum + parseInt(store.productCount), 0),
        avgRating: featuredStores.length > 0 
          ? featuredStores.reduce((sum, store) => sum + store.ratingAvg, 0) / featuredStores.length 
          : 0,
        uniqueLocations: new Set(featuredStores.map(store => `${store.city}, ${store.state}`)).size,
        cities: [...new Set(featuredStores.map(store => store.city).filter((city): city is string => Boolean(city)))],
        states: [...new Set(featuredStores.map(store => store.state).filter((state): state is string => Boolean(state)))],
        firstStoreAdded: featuredStores.length > 0 ? featuredStores[0].createdAt : null,
        lastStoreUpdated: featuredStores.length > 0 
          ? featuredStores.reduce((latest, store) => 
              new Date(store.updatedAt) > new Date(latest) ? store.updatedAt : latest, 
              featuredStores[0].updatedAt
            ) 
          : null
      };
      
      // Limit results
      const limitedStores = featuredStores.slice(0, maxStores);
      
      return {
        stores: limitedStores,
        stats,
        totalCount: featuredStores.length
      };
      
    } catch (error) {
      console.error('[FeaturedStoresService] Error fetching featured stores:', error);
      throw error;
    }
  }
  
  /**
   * Get featured stores count only
   * Used for quick count checks
   */
  async getFeaturedStoresCount(): Promise<number> {
    try {
      const pool = getDirectPool();
      
      const countQuery = `
        SELECT COUNT(*) as total_featured_stores
        FROM directory_listings_list dll
        WHERE dll.is_published = true 
          AND dll.is_featured = true
      `;
      
      const result = await pool.query(countQuery);
      return parseInt(result.rows[0]?.total_featured_stores || '0');
      
    } catch (error) {
      console.error('[FeaturedStoresService] Error getting featured stores count:', error);
      return 0;
    }
  }
}

export const featuredStoresService = new FeaturedStoresService();
