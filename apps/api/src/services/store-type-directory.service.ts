import { Pool } from 'pg';

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
      console.log('[StoreTypeService] Fetching store types from directory_listings_list');

      // Get unique store types with counts using direct database connection
      const result = await getDirectPool().query(`
        WITH category_counts AS (
          SELECT
            primary_category,
            COUNT(*) as store_count
          FROM directory_listings_list
          WHERE is_published = true
            AND primary_category IS NOT NULL
            AND primary_category != ''
          GROUP BY primary_category
          ORDER BY COUNT(*) DESC
        )
        SELECT
          primary_category,
          store_count::integer
        FROM category_counts
        ORDER BY store_count DESC
      `);

      const storeTypes = result.rows;

      console.log(`[StoreTypeService] Found ${storeTypes.length} store types`);

      return storeTypes.map(type => ({
        name: type.primary_category,
        slug: this.slugify(type.primary_category),
        storeCount: type.store_count,
      }));
    } catch (error) {
      console.error('[StoreTypeService] Error fetching store types:', error);
      return [];
    }
  }

  /**
   * Get stores by store type
   * Similar to getStoresByCategory but uses primary_category
   */
  async getStoresByType(
    typeSlug: string,
    location?: { lat: number; lng: number },
    radius?: number
  ) {
    try {
      console.log(`[StoreTypeService] Fetching stores for type: ${typeSlug}`);
      
      // Convert slug back to category name (approximate)
      const typeName = this.unslugify(typeSlug);

      // Get stores using direct database connection
      const result = await getDirectPool().query(`
        WITH store_data AS (
          SELECT
            id,
            tenantId,
            businessName as business_name,
            slug,
            address,
            city,
            state,
            zipCode as postal_code,
            latitude,
            longitude,
            primary_category,
            ratingAvg as rating_avg,
            ratingCount as rating_count,
            product_count,
            logoUrl as logo_url,
            description,
            isFeatured as is_featured,
            subscriptionTier as subscription_tier,
            createdAt as created_at,
            updatedAt as updated_at
          FROM directory_listings_list
          WHERE is_published = true
            AND primary_category ILIKE $1
        )
        SELECT * FROM store_data
        ORDER BY product_count DESC
        LIMIT 100
      `, [`%${typeName}%`]);

      const stores = result.rows;

      console.log(`[StoreTypeService] Found ${stores.length} stores`);

      return stores.map((store) => ({
        id: store.tenantId,
        name: store.business_name,
        slug: store.slug,
        address: store.address,
        city: store.city,
        state: store.state,
        postalCode: store.postal_code,
        latitude: store.latitude,
        longitude: store.longitude,
        primaryCategory: store.primary_category,
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
   * Get store type details
   */
  async getStoreTypeDetails(typeSlug: string) {
    try {
      const typeName = this.unslugify(typeSlug);
      
      // Get store type details using direct database connection
      const result = await getDirectPool().query(`
        WITH type_details AS (
          SELECT
            primary_category,
            COUNT(*) as store_count,
            SUM(product_count) as total_products
          FROM directory_listings_list
          WHERE is_published = true
            AND primary_category ILIKE $1
          GROUP BY primary_category
          LIMIT 1
        )
        SELECT
          primary_category,
          store_count::integer,
          COALESCE(total_products, 0)::integer as total_products
        FROM type_details
      `, [`%${typeName}%`]);

      if (result.rows.length === 0) {
        return null;
      }

      const type = result.rows[0];
      return {
        name: type.primary_category,
        slug: this.slugify(type.primary_category),
        storeCount: type.store_count,
        totalProducts: type.total_products,
      };
    } catch (error) {
      console.error('[StoreTypeService] Error fetching store type details:', error);
      return null;
    }
  }

  /**
   * Helper: Convert category name to slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Helper: Convert slug back to approximate category name
   */
  private unslugify(slug: string): string {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export const storeTypeDirectoryService = new StoreTypeDirectoryService();
