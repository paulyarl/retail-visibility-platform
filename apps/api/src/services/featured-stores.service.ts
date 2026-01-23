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
  activityLevel: 'very_active' | 'active' | 'moderately_active' | 'less_active';
  
  // Rich product data from storefront_products_mv
  actualProductCount: number;
  productsWithImages: number;
  avgProductPrice: number;
  productsWithReviews: number;
  avgReviewRating: number;
  
  // Featured type counts
  staffPickCount: number;
  seasonalCount: number;
  saleCount: number;
  newArrivalCount: number;
  storeSelectionCount: number;
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
      
      // Build the base query for featured stores with product counts from storefront_products_mv
      let featuredStoresQuery = `
        SELECT 
          -- Directory listing data
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
          dll.is_featured,
          dll.subscription_tier,
          dll.use_custom_website,
          dll.business_hours,
          dll.is_published,
          dll.created_at,
          dll.updated_at,
          
          -- Product counts from storefront_products_mv
          COALESCE(product_counts.total_products, 0) as actual_product_count,
          COALESCE(product_counts.products_with_images, 0) as products_with_images,
          COALESCE(product_counts.avg_price, 0) as avg_product_price,
          COALESCE(product_counts.products_with_reviews, 0) as products_with_reviews,
          COALESCE(product_counts.avg_review_rating, 0) as avg_review_rating,
          
          -- Featured type counts
          COALESCE(product_counts.staff_pick_count, 0) as staff_pick_count,
          COALESCE(product_counts.seasonal_count, 0) as seasonal_count,
          COALESCE(product_counts.sale_count, 0) as sale_count,
          COALESCE(product_counts.new_arrival_count, 0) as new_arrival_count,
          COALESCE(product_counts.store_selection_count, 0) as store_selection_count,
          
          -- Store activity indicators
          CASE 
            WHEN dll.updated_at > NOW() - INTERVAL '7 days' THEN 'very_active'
            WHEN dll.updated_at > NOW() - INTERVAL '30 days' THEN 'active'
            WHEN dll.updated_at > NOW() - INTERVAL '90 days' THEN 'moderately_active'
            ELSE 'less_active'
          END as activity_level
          
        FROM directory_listings_list dll
        LEFT JOIN (
          SELECT 
            mv.tenant_id,
            COUNT(*) as total_products,
            COUNT(*) FILTER (WHERE mv.image_url IS NOT NULL) as products_with_images,
            ROUND(AVG(mv.price_cents / 100.0)) as avg_price,
            COUNT(*) FILTER (WHERE mv.rating_avg > 0) as products_with_reviews,
            ROUND(AVG(mv.rating_avg)) as avg_review_rating,
            COUNT(*) FILTER (WHERE mv.featured_type = 'staff_pick') as staff_pick_count,
            COUNT(*) FILTER (WHERE mv.featured_type = 'seasonal') as seasonal_count,
            COUNT(*) FILTER (WHERE mv.featured_type = 'sale') as sale_count,
            COUNT(*) FILTER (WHERE mv.featured_type = 'new_arrival') as new_arrival_count,
            COUNT(*) FILTER (WHERE mv.featured_type = 'store_selection') as store_selection_count
          FROM storefront_products mv
          WHERE mv.item_status = 'active' 
            AND mv.visibility = 'public'
          GROUP BY mv.tenant_id
        ) product_counts ON product_counts.tenant_id = dll.tenant_id
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
        updatedAt: row.updated_at,
        activityLevel: row.activity_level || 'less_active',
        
        // Rich product data from storefront_products_mv
        actualProductCount: parseInt(row.actual_product_count) || 0,
        productsWithImages: parseInt(row.products_with_images) || 0,
        avgProductPrice: parseFloat(row.avg_product_price) || 0,
        productsWithReviews: parseInt(row.products_with_reviews) || 0,
        avgReviewRating: parseFloat(row.avg_review_rating) || 0,
        
        // Featured type counts
        staffPickCount: parseInt(row.staff_pick_count) || 0,
        seasonalCount: parseInt(row.seasonal_count) || 0,
        saleCount: parseInt(row.sale_count) || 0,
        newArrivalCount: parseInt(row.new_arrival_count) || 0,
        storeSelectionCount: parseInt(row.store_selection_count) || 0
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
