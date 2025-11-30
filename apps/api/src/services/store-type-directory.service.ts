import { Pool } from 'pg';
import { slugify } from '../utils/slug';

// Create a direct database connection pool that bypasses Prisma's issues
// In development, we need to handle self-signed certificates
const getPoolConfig = () => {
  // Modify connection string to use prefer instead of require for local development
  let connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  
  // Always disable SSL certificate verification for local development
  // Check for production indicators (Railway, Vercel, etc.)
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.log('[StoreType Pool] Local development detected - disabling SSL completely');
    console.log('[StoreType Pool] Original connection string:', connectionString);
    // Completely remove SSL for development - this will work with rejectUnauthorized: false
    if (connectionString.includes('sslmode=')) {
      console.log('[StoreType Pool] Removing SSL mode entirely');
      connectionString = connectionString.replace(/sslmode=[^&]+/, 'sslmode=disable');
    } else {
      console.log('[StoreType Pool] Adding sslmode=disable');
      connectionString += '&sslmode=disable';
    }
    console.log('[StoreType Pool] Modified connection string:', connectionString);
  }

  const config: any = {
    connectionString,
    min: 1,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  if (!isProduction) {
    config.ssl = {
      rejectUnauthorized: false
    };
  } else {
    console.log('[StoreType Pool] Production environment - SSL verification enabled');
  }

  return config;
};

// Create pool on-demand to ensure SSL config is applied
let directPool: Pool | null = null;

const getDirectPool = () => {
  // Always create a new pool in development to ensure SSL config is applied
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.log('[StoreType Pool] Creating fresh pool for development');
    return new Pool(getPoolConfig());
  }

  if (!directPool) {
    directPool = new Pool(getPoolConfig());
  }
  return directPool;
};

/**
 * Store Type Directory Service
 * 
 * Handles store type discovery in the directory (GMB categories)
 * Parallel to category-directory.service.ts but for store types
 */
class StoreTypeDirectoryService {
  /**
   * Get all store types with counts
   * Uses directory_listings.primary_category
   */
  async getStoreTypes(
    location?: { lat: number; lng: number },
    radiusMiles?: number
  ) {
    try {
      console.log('[StoreTypeService] Fetching GBP store types from directory_gbp_stats');

      // Query stats materialized view for fast aggregated data
      const result = await getDirectPool().query(`
        SELECT 
          gbp_category_id,
          gbp_category_name,
          gbp_category_display_name,
          store_count,
          primary_store_count,
          secondary_store_count,
          total_products,
          avg_rating,
          unique_locations,
          cities,
          states,
          featured_store_count,
          synced_store_count,
          first_store_added,
          last_store_updated
        FROM directory_gbp_stats
        WHERE store_count > 0
        ORDER BY store_count DESC
      `);

      console.log(`[StoreTypeService] Found ${result.rows.length} GBP store types`);

      return result.rows.map(row => ({
        id: row.gbp_category_id,
        name: row.gbp_category_name,
        displayName: row.gbp_category_display_name,
        slug: slugify(row.gbp_category_name),
        storeCount: parseInt(row.store_count),
        store_count: parseInt(row.store_count), // Compatibility
        primaryStoreCount: parseInt(row.primary_store_count || '0'),
        primary_store_count: parseInt(row.primary_store_count || '0'), // Compatibility
        secondaryStoreCount: parseInt(row.secondary_store_count || '0'),
        secondary_store_count: parseInt(row.secondary_store_count || '0'), // Compatibility
        totalProducts: parseInt(row.total_products || '0'),
        total_products: parseInt(row.total_products || '0'), // Compatibility
        avgRating: parseFloat(row.avg_rating || '0'),
        avg_rating: parseFloat(row.avg_rating || '0'), // Compatibility
        uniqueLocations: parseInt(row.unique_locations || '0'),
        unique_locations: parseInt(row.unique_locations || '0'), // Compatibility
        cities: row.cities || [],
        states: row.states || [],
        featuredStoreCount: parseInt(row.featured_store_count || '0'),
        featured_store_count: parseInt(row.featured_store_count || '0'), // Compatibility
        syncedStoreCount: parseInt(row.synced_store_count || '0'),
        synced_store_count: parseInt(row.synced_store_count || '0'), // Compatibility
        firstStoreAdded: row.first_store_added,
        first_store_added: row.first_store_added, // Compatibility
        lastStoreUpdated: row.last_store_updated,
        last_store_updated: row.last_store_updated, // Compatibility
      }));
    } catch (error) {
      console.error('[StoreTypeService] Error fetching store types:', error);
      return [];
    }
  }

  /**
   * Get stores by store type (GBP category)
   * Uses directory_gbp_listings materialized view
   */
  async getStoresByType(
    typeSlug: string,
    location?: { lat: number; lng: number },
    radius?: number
  ) {
    try {
      console.log(`[StoreTypeService] Fetching stores for GBP type: ${typeSlug}`);
      
      // Convert slug to GBP category ID format (e.g., "electronics-store" -> "gcid:electronics_store")
      const categoryId = `gcid:${typeSlug.replace(/-/g, '_')}`;
      
      console.log(`[StoreTypeService] Looking for GBP category ID: ${categoryId}`);
      
      // Query from directory_gbp_listings materialized view
      const result = await getDirectPool().query(`
        SELECT
          id,
          tenant_id,
          business_name,
          slug,
          address,
          city,
          state,
          zip_code as postal_code,
          latitude,
          longitude,
          gbp_category_id,
          gbp_category_name,
          is_primary,
          rating_avg,
          rating_count,
          product_count,
          logo_url,
          description,
          is_featured,
          subscription_tier,
          created_at,
          updated_at
        FROM directory_gbp_listings
        WHERE gbp_category_id = $1
        ORDER BY 
          is_primary DESC,
          rating_avg DESC NULLS LAST,
          product_count DESC NULLS LAST,
          created_at DESC
        LIMIT 100
      `, [categoryId]);

      const stores = result.rows;

      console.log(`[StoreTypeService] Found ${stores.length} stores`);

      return stores.map((store) => ({
        id: store.tenant_id || store.id,
        tenantId: store.tenant_id,
        name: store.business_name,
        businessName: store.business_name,
        slug: store.slug,
        address: store.address,
        city: store.city,
        state: store.state,
        postalCode: store.postal_code,
        latitude: store.latitude,
        longitude: store.longitude,
        primaryCategory: store.primary_category,
        gbpCategoryName: store.gbp_category_name,
        gbpPrimaryCategoryName: store.gbp_category_name,
        isPrimary: store.is_primary,
        ratingAvg: store.rating_avg,
        rating: store.rating_avg,
        ratingCount: store.rating_count,
        productCount: store.product_count,
        logoUrl: store.logo_url,
        description: store.description,
        isFeatured: store.is_featured,
        subscriptionTier: store.subscription_tier,
        createdAt: store.created_at,
        updatedAt: store.updated_at,
      }));
    } catch (error) {
      console.error('[StoreTypeService] Error fetching stores by type:', error);
      return [];
    }
  }

  /**
   * Get store type details from GBP stats materialized view
   */
  async getStoreTypeDetails(typeSlug: string) {
    try {
      console.log(`[StoreTypeService] Fetching GBP type details for: ${typeSlug}`);
      
      // Convert slug to GBP category ID format (e.g., "electronics-store" -> "gcid:electronics_store")
      const categoryId = `gcid:${typeSlug.replace(/-/g, '_')}`;
      
      console.log(`[StoreTypeService] Looking for GBP category ID: ${categoryId}`);
      
      // Query from directory_gbp_stats materialized view
      const result = await getDirectPool().query(`
        SELECT
          gbp_category_id,
          gbp_category_name,
          gbp_category_display_name,
          store_count,
          primary_store_count,
          secondary_store_count,
          total_products,
          avg_rating,
          unique_locations,
          cities,
          states
        FROM directory_gbp_stats
        WHERE gbp_category_id = $1
        LIMIT 1
      `, [categoryId]);

      if (result.rows.length === 0) {
        return null;
      }

      const type = result.rows[0];
      return {
        id: type.gbp_category_id,
        name: type.gbp_category_name,
        displayName: type.gbp_category_display_name,
        slug: typeSlug,
        storeCount: parseInt(type.store_count),
        primaryStoreCount: parseInt(type.primary_store_count || '0'),
        secondaryStoreCount: parseInt(type.secondary_store_count || '0'),
        totalProducts: parseInt(type.total_products || '0'),
        avgRating: parseFloat(type.avg_rating || '0'),
        uniqueLocations: parseInt(type.unique_locations || '0'),
        cities: type.cities || [],
        states: type.states || [],
      };
    } catch (error) {
      console.error('[StoreTypeService] Error fetching store type details:', error);
      return null;
    }
  }
}

export const storeTypeDirectoryService = new StoreTypeDirectoryService();
