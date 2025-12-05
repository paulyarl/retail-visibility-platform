import { Pool } from 'pg';
import { slugify } from '../utils/slug';

// TypeScript interfaces for store type data
interface StoreTypeDetails {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  storeCount: number;
  primaryStoreCount: number;
  secondaryStoreCount: number;
  totalProducts: number;
  avgRating: number;
  uniqueLocations: number;
  cities: string[];
  states: string[];
}

interface Store {
  id: string;
  tenantId: string;
  name: string;
  businessName: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: string | null;
  longitude: string | null;
  gbpCategoryName: string;
  gbpPrimaryCategoryName: string;
  isPrimary: boolean;
  ratingAvg: string;
  rating: string;
  ratingCount: number;
  productCount: string;
  logoUrl: string | null;
  description: string | null;
  isFeatured: boolean;
  subscriptionTier: string;
  createdAt: string;
  updatedAt: string;
}

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
    //console.log('[StoreType Pool] Local development detected - disabling SSL completely');
    //console.log('[StoreType Pool] Original connection string:', connectionString);
    // Completely remove SSL for development - this will work with rejectUnauthorized: false
    if (connectionString.includes('sslmode=')) {
      //console.log('[StoreType Pool] Removing SSL mode entirely');
      connectionString = connectionString.replace(/sslmode=[^&]+/, 'sslmode=disable');
    } else {
      //console.log('[StoreType Pool] Adding sslmode=disable');
      connectionString += '&sslmode=disable';
    }
    //console.log('[StoreType Pool] Modified connection string:', connectionString);
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
    //console.log('[StoreType Pool] Creating fresh pool for development');
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
      //console.log('[StoreTypeService] Fetching GBP store types from both primary and secondary categories');

      // Query using both primary (tenant_business_profiles_list) and secondary (metadata) GBP categories
      const result = await getDirectPool().query(`
        -- Primary GBP categories from tenant_business_profiles_list
        SELECT 
          gbp.gbp_category_id,
          gbp.gbp_category_name,
          gbp.gbp_category_name as gbp_category_display_name,
          COUNT(DISTINCT t.id) as store_count,
          COUNT(DISTINCT t.id) as primary_store_count,
          0 as secondary_store_count,
          0 as total_products,
          COALESCE(AVG(dsl.rating_avg), 0) as avg_rating,
          COUNT(DISTINCT dsl.city) as unique_locations,
          ARRAY_AGG(DISTINCT dsl.city) FILTER (WHERE dsl.city IS NOT NULL) as cities,
          ARRAY_AGG(DISTINCT dsl.state) FILTER (WHERE dsl.state IS NOT NULL) as states,
          COUNT(DISTINCT t.id) FILTER (WHERE dsl.is_featured = true) as featured_store_count,
          COUNT(DISTINCT t.id) FILTER (WHERE gbp.gbp_category_last_mirrored IS NOT NULL) as synced_store_count,
          MIN(t.created_at) as first_store_added,
          MAX(dsl.updated_at) as last_store_updated,
          'primary' as category_type
        FROM tenants t
        LEFT JOIN tenant_business_profiles_list gbp ON gbp.tenant_id = t.id
        LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
        WHERE t.location_status = 'active'
          AND t.directory_visible = true
          AND gbp.gbp_category_id IS NOT NULL
          AND gbp.gbp_category_id LIKE 'gcid:%'
          AND dsl.is_published = true
        GROUP BY gbp.gbp_category_id, gbp.gbp_category_name
        
        UNION ALL
        
        -- Secondary GBP categories from junction table
        SELECT 
          gc.id as gbp_category_id,
          gc.name as gbp_category_name,
          gc.display_name as gbp_category_display_name,
          COUNT(DISTINCT t.id) as store_count,
          0 as primary_store_count,
          COUNT(DISTINCT t.id) as secondary_store_count,
          0 as total_products,
          COALESCE(AVG(dsl.rating_avg), 0) as avg_rating,
          COUNT(DISTINCT dsl.city) as unique_locations,
          ARRAY_AGG(DISTINCT dsl.city) FILTER (WHERE dsl.city IS NOT NULL) as cities,
          ARRAY_AGG(DISTINCT dsl.state) FILTER (WHERE dsl.state IS NOT NULL) as states,
          COUNT(DISTINCT t.id) FILTER (WHERE dsl.is_featured = true) as featured_store_count,
          0 as synced_store_count,
          MIN(t.created_at) as first_store_added,
          MAX(dsl.updated_at) as last_store_updated,
          'secondary' as category_type
        FROM tenant_gbp_categories tgc
        JOIN gbp_categories_list gc ON gc.id = tgc.gbp_category_id
        JOIN tenants t ON t.id = tgc.tenant_id
        LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
        WHERE tgc.category_type = 'secondary'
          AND t.location_status = 'active'
          AND t.directory_visible = true
          AND gc.is_active = true
          AND dsl.is_published = true
        GROUP BY gc.id, gc.name, gc.display_name
        
        ORDER BY store_count DESC, gbp_category_name ASC
      `);

      //console.log(`[StoreTypeService] Found ${result.rows.length} GBP store types`);

      // If no store types found, provide fallback hardcoded categories
      if (result.rows.length === 0) {
        console.log('[StoreTypeService] No store types found, providing fallback categories');
        return this.getFallbackStoreTypes();
      }

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
   * Get fallback store types when no GBP categories exist in database
   * Returns hardcoded common store types with 0 counts
   */
  private getFallbackStoreTypes(): StoreTypeDetails[] {
    const fallbackCategories = [
      { id: "gcid:grocery_store", name: "Grocery store", displayName: "Grocery store" },
      { id: "gcid:convenience_store", name: "Convenience store", displayName: "Convenience store" },
      { id: "gcid:supermarket", name: "Supermarket", displayName: "Supermarket" },
      { id: "gcid:liquor_store", name: "Liquor store", displayName: "Liquor store" },
      { id: "gcid:specialty_food_store", name: "Specialty food store", displayName: "Specialty food store" },
      { id: "gcid:clothing_store", name: "Clothing store", displayName: "Clothing store" },
      { id: "gcid:shoe_store", name: "Shoe store", displayName: "Shoe store" },
      { id: "gcid:electronics_store", name: "Electronics store", displayName: "Electronics store" },
      { id: "gcid:furniture_store", name: "Furniture store", displayName: "Furniture store" },
      { id: "gcid:hardware_store", name: "Hardware store", displayName: "Hardware store" },
      { id: "gcid:pharmacy", name: "Pharmacy", displayName: "Pharmacy" },
      { id: "gcid:beauty_supply_store", name: "Beauty supply store", displayName: "Beauty supply store" },
      { id: "gcid:cosmetics_store", name: "Cosmetics store", displayName: "Cosmetics store" },
      { id: "gcid:health_and_beauty_shop", name: "Health and beauty shop", displayName: "Health and beauty shop" },
      { id: "gcid:book_store", name: "Book store", displayName: "Book store" },
      { id: "gcid:pet_store", name: "Pet store", displayName: "Pet store" },
      { id: "gcid:toy_store", name: "Toy store", displayName: "Toy store" },
      { id: "gcid:sporting_goods_store", name: "Sporting goods store", displayName: "Sporting goods store" },
      { id: "gcid:gift_shop", name: "Gift shop", displayName: "Gift shop" },
      { id: "gcid:department_store", name: "Department store", displayName: "Department store" },
    ];

    return fallbackCategories.map(category => ({
      id: category.id,
      name: category.name,
      displayName: category.displayName,
      slug: slugify(category.name),
      storeCount: 0,
      primaryStoreCount: 0,
      secondaryStoreCount: 0,
      totalProducts: 0,
      avgRating: 0,
      uniqueLocations: 0,
      cities: [],
      states: [],
      featuredStoreCount: 0,
      syncedStoreCount: 0,
      firstStoreAdded: null,
      lastStoreUpdated: null,
    }));
  }

  /**
   * Get stores by store type (category)
   * Uses directory_category_products view
   */
  async getStoresByType(
    typeSlug: string,
    location?: { lat: number; lng: number },
    radius?: number
  ) {
    try {
      //console.log(`[StoreTypeService] Fetching stores for type: ${typeSlug}`);
      
      // First, get the GBP category ID and name from the slug
      const categoryLookup = await getDirectPool().query(`
        SELECT id, name, display_name
        FROM gbp_categories_list
        WHERE LOWER(REPLACE(name, ' ', '-')) = $1
          OR LOWER(REPLACE(display_name, ' ', '-')) = $1
        LIMIT 1
      `, [typeSlug]);
      
      if (categoryLookup.rows.length === 0) {
        console.log(`[StoreTypeService] No category found for slug: ${typeSlug}`);
        return [];
      }
      
      const category = categoryLookup.rows[0];
      const categoryName = category.name;
      const categoryId = category.id;
      
      //console.log(`[StoreTypeService] Found category: ${categoryName} (${categoryId})`);
      
      // Query stores that have this GBP category (primary or secondary)
      const result = await getDirectPool().query(`
        SELECT
          t.id as tenant_id,
          t.id,
          t.name as business_name,
          t.slug,
          dsl.address,
          dsl.city,
          dsl.state,
          dsl.zip_code as postal_code,
          dsl.latitude,
          dsl.longitude,
          $2 as primary_category,
          $2 as gbp_category_name,
          $2 as gbp_primary_category_name,
          dsl.rating_avg,
          dsl.rating_count,
          -- Calculate real product count from inventory_items
          COALESCE(real_counts.product_count, 0) as product_count,
          -- Get logo URL from directory listings
          dsl.logo_url as logo_url,
          null as description,
          dsl.is_featured,
          t.subscription_tier,
          dsl.created_at,
          dsl.updated_at,
          dsl.is_published as directory_published
        FROM tenant_gbp_categories tgc
        JOIN tenants t ON t.id = tgc.tenant_id
        LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
        LEFT JOIN (
          SELECT
            tenant_id,
            COUNT(*) as product_count
          FROM inventory_items
          WHERE item_status = 'active' AND visibility = 'public'
            AND directory_category_id IS NOT NULL  -- Only count products with categories (matches storefront filter)
          GROUP BY tenant_id
        ) real_counts ON t.id = real_counts.tenant_id
        WHERE tgc.gbp_category_id = $1
          AND t.location_status = 'active'
          AND t.directory_visible = true
          AND dsl.is_published = true
        ORDER BY 
          dsl.rating_avg DESC NULLS LAST,
          real_counts.product_count DESC NULLS LAST,
          dsl.created_at DESC
        LIMIT 100
      `, [categoryId, categoryName]);

      const stores = result.rows;

      //console.log(`[StoreTypeService] Found ${stores.length} stores`);

      return stores.map((store) => ({
        id: store.tenant_id || store.id,
        tenantId: store.tenant_id,
        name: store.business_name,
        businessName: store.business_name,
        slug: store.slug || slugify(store.business_name), // Generate slug if null
        address: store.address,
        city: store.city,
        state: store.state,
        postalCode: store.postal_code,
        latitude: store.latitude,
        longitude: store.longitude,
        primaryCategory: store.primary_category,
        gbpCategoryName: store.gbp_category_name,
        gbpPrimaryCategoryName: store.gbp_category_name,
        ratingAvg: store.rating_avg,
        rating: store.rating_avg,
        ratingCount: store.rating_count,
        productCount: store.product_count,
        logoUrl: store.logo_url,
        description: store.description,
        isFeatured: store.is_featured,
        subscriptionTier: store.subscription_tier,
        directoryPublished: store.directory_published || false, // Add directory publish status
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
  async getStoreTypeDetails(typeSlug: string): Promise<StoreTypeDetails | null> {
    const pool = getDirectPool();
    
    try {
      // Convert slug to category name format (e.g., "health-beauty" -> "Health & Beauty")
      const categoryName = typeSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' & ');
      
      //console.log(`[StoreTypeService] Looking for category name: ${categoryName}`);
      
      // Query from directory_category_products view with real product counts
      const result = await pool.query(`
        SELECT 
          dcp.category_name as gbp_category_name,
          dcp.category_name as gbp_category_display_name,
          COUNT(DISTINCT dcp.tenant_id) as store_count,
          COUNT(DISTINCT dcp.tenant_id) as primary_store_count,
          0 as secondary_store_count,
          COALESCE(SUM(CAST(real_counts.product_count AS INTEGER)), 0) as total_products,
          COALESCE(AVG(CAST(dcp.rating_avg AS NUMERIC)), 0) as avg_rating,
          0 as unique_locations,
          ARRAY[]::text[] as cities,
          ARRAY[]::text[] as states
        FROM directory_category_products dcp
        LEFT JOIN (
          SELECT
            tenant_id,
            COUNT(*) as product_count
          FROM inventory_items
          WHERE item_status = 'active' AND visibility = 'public'
            AND directory_category_id IS NOT NULL  -- Only count products with categories (matches storefront filter)
          GROUP BY tenant_id
        ) real_counts ON dcp.tenant_id = real_counts.tenant_id
        WHERE dcp.category_name = $1
          AND dcp.is_published = true
        GROUP BY dcp.category_name
        LIMIT 1
      `, [categoryName]);

      if (result.rows.length === 0) {
        return null;
      }

      const type = result.rows[0];
      return {
        id: `gcid:${typeSlug.replace(/-/g, '_')}`,
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
        states: type.states || []
      };

    } catch (error) {
      console.error('[StoreTypeService] Error fetching store type details:', error);
      return null;
    }
  }
}

export const storeTypeDirectoryService = new StoreTypeDirectoryService();
