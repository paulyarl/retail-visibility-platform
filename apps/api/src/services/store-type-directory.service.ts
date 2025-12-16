import { getDirectPool } from '../utils/db-pool';
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

/**
 * Store Type Directory Service
 * 
 * Handles store type discovery in the directory (GMB categories)
 * Parallel to category-directory.service.ts but for store types
 */
class StoreTypeDirectoryService {
  /**
   * Get all store types with counts
   * OPTIMIZED: Uses directory_gbp_stats materialized view for fast queries (<10ms)
   */
  async getStoreTypes(
    location?: { lat: number; lng: number },
    radiusMiles?: number
  ) {
    try {
      // Try the MV first, fallback to direct query if MV doesn't exist
      let result;
      try {
        result = await getDirectPool().query(`
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
          ORDER BY store_count DESC, gbp_category_name ASC
        `);
      } catch (mvError: any) {
        // MV doesn't exist, use optimized direct query from tenant_gbp_categories
        if (mvError.code === '42P01') {
          console.log('[StoreTypeService] MV not found, using optimized direct query');
          result = await getDirectPool().query(`
            SELECT 
              gc.id as gbp_category_id,
              gc.name as gbp_category_name,
              gc.display_name as gbp_category_display_name,
              COUNT(DISTINCT tgc.tenant_id) as store_count,
              COUNT(DISTINCT tgc.tenant_id) FILTER (WHERE tgc.category_type = 'primary') as primary_store_count,
              COUNT(DISTINCT tgc.tenant_id) FILTER (WHERE tgc.category_type = 'secondary') as secondary_store_count,
              0 as total_products,
              0 as avg_rating,
              0 as unique_locations,
              ARRAY[]::text[] as cities,
              ARRAY[]::text[] as states,
              0 as featured_store_count,
              0 as synced_store_count,
              NULL as first_store_added,
              NULL as last_store_updated
            FROM gbp_categories_list gc
            JOIN tenant_gbp_categories tgc ON tgc.gbp_category_id = gc.id
            JOIN tenants t ON t.id = tgc.tenant_id
            LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
            WHERE t.location_status = 'active'
              AND t.directory_visible = true
              AND dsl.is_published = true
            GROUP BY gc.id, gc.name, gc.display_name
            HAVING COUNT(DISTINCT tgc.tenant_id) > 0
            ORDER BY COUNT(DISTINCT tgc.tenant_id) DESC, gc.name ASC
          `);
        } else {
          throw mvError;
        }
      }

      // If no store types found, provide fallback hardcoded categories
      if (result.rows.length === 0) {
        console.log('[StoreTypeService] No store types found, providing fallback categories');
        return this.getFallbackStoreTypes();
      }

      // Transform to expected format
      return result.rows.map(row => ({
        id: row.gbp_category_id,
        name: row.gbp_category_name,
        displayName: row.gbp_category_display_name,
        slug: slugify(row.gbp_category_name),
        storeCount: parseInt(row.store_count) || 0,
        primaryStoreCount: parseInt(row.primary_store_count) || 0,
        secondaryStoreCount: parseInt(row.secondary_store_count) || 0,
        totalProducts: parseInt(row.total_products) || 0,
        avgRating: parseFloat(row.avg_rating) || 0,
        uniqueLocations: parseInt(row.unique_locations) || 0,
        cities: row.cities || [],
        states: row.states || [],
        featuredStoreCount: parseInt(row.featured_store_count) || 0,
        syncedStoreCount: parseInt(row.synced_store_count) || 0,
        firstStoreAdded: row.first_store_added,
        lastStoreUpdated: row.last_store_updated,
        // Compatibility fields (snake_case)
        store_count: parseInt(row.store_count) || 0,
        primary_store_count: parseInt(row.primary_store_count) || 0,
        secondary_store_count: parseInt(row.secondary_store_count) || 0,
        total_products: parseInt(row.total_products) || 0,
        avg_rating: parseFloat(row.avg_rating) || 0,
        unique_locations: parseInt(row.unique_locations) || 0,
        featured_store_count: parseInt(row.featured_store_count) || 0,
        synced_store_count: parseInt(row.synced_store_count) || 0,
        first_store_added: row.first_store_added,
        last_store_updated: row.last_store_updated,
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
      console.log(`[StoreTypeService] Fetching stores for type slug: ${typeSlug}`);
      
      // Convert slug to expected name format (e.g., "toy-store" -> "Toy store")
      const expectedName = typeSlug
        .split('-')
        .map((word, index) => index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)
        .join(' ');
      
      console.log(`[StoreTypeService] Expected category name: ${expectedName}`);
      
      // First, get the GBP category ID and name from the slug
      // Try multiple matching strategies
      const categoryLookup = await getDirectPool().query(`
        SELECT id, name, display_name
        FROM gbp_categories_list
        WHERE LOWER(REPLACE(REPLACE(name, ' ', '-'), '_', '-')) = $1
          OR LOWER(REPLACE(REPLACE(display_name, ' ', '-'), '_', '-')) = $1
          OR LOWER(name) = LOWER($2)
          OR LOWER(display_name) = LOWER($2)
          OR id = $3
        LIMIT 1
      `, [typeSlug, expectedName, `gcid:${typeSlug.replace(/-/g, '_')}`]);
      
      console.log(`[StoreTypeService] Category lookup result: ${JSON.stringify(categoryLookup.rows)}`);
      
      if (categoryLookup.rows.length === 0) {
        console.log(`[StoreTypeService] No category found for slug: ${typeSlug}`);
        return [];
      }
      
      const category = categoryLookup.rows[0];
      const categoryName = category.name;
      const categoryId = category.id;
      
      console.log(`[StoreTypeService] Found category: ${categoryName} (${categoryId})`);
      
      // Query stores that have this GBP category (primary or secondary)
      // Match by both ID and name to handle different storage formats
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
        LEFT JOIN gbp_categories_list gc ON gc.id = tgc.gbp_category_id
        LEFT JOIN (
          SELECT
            tenant_id,
            COUNT(*) as product_count
          FROM inventory_items
          WHERE item_status = 'active' AND visibility = 'public'
            AND directory_category_id IS NOT NULL
          GROUP BY tenant_id
        ) real_counts ON t.id = real_counts.tenant_id
        WHERE (tgc.gbp_category_id = $1 OR gc.name = $2 OR LOWER(gc.name) = LOWER($2))
          AND t.location_status = 'active'
          AND t.directory_visible = true
          AND dsl.is_published = true
        ORDER BY 
          dsl.rating_avg DESC NULLS LAST,
          real_counts.product_count DESC NULLS LAST,
          dsl.created_at DESC
        LIMIT 100
      `, [categoryId, categoryName]);
      
      console.log(`[StoreTypeService] Found ${result.rows.length} stores for category ${categoryName}`);

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
   * Get store type details - query from tenant_gbp_categories to include secondary categories
   */
  async getStoreTypeDetails(typeSlug: string): Promise<StoreTypeDetails | null> {
    const pool = getDirectPool();
    
    try {
      // Convert slug to category name format (e.g., "toy-store" -> "Toy store")
      const categoryName = typeSlug
        .split('-')
        .map((word, index) => index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)
        .join(' ');
      
      console.log(`[StoreTypeService] getStoreTypeDetails for slug: ${typeSlug}, expected name: ${categoryName}`);
      
      // First lookup the category in gbp_categories_list
      const categoryLookup = await pool.query(`
        SELECT id, name, display_name
        FROM gbp_categories_list
        WHERE LOWER(REPLACE(REPLACE(name, ' ', '-'), '_', '-')) = $1
          OR LOWER(REPLACE(REPLACE(display_name, ' ', '-'), '_', '-')) = $1
          OR LOWER(name) = LOWER($2)
          OR LOWER(display_name) = LOWER($2)
          OR id = $3
        LIMIT 1
      `, [typeSlug, categoryName, `gcid:${typeSlug.replace(/-/g, '_')}`]);
      
      console.log(`[StoreTypeService] Category lookup result: ${JSON.stringify(categoryLookup.rows)}`);
      
      if (categoryLookup.rows.length === 0) {
        console.log(`[StoreTypeService] No category found in gbp_categories_list for: ${typeSlug}`);
        return null;
      }
      
      const category = categoryLookup.rows[0];
      const categoryId = category.id;
      const actualCategoryName = category.name;
      
      // Query store count from tenant_gbp_categories (includes both primary and secondary)
      const result = await pool.query(`
        SELECT 
          $2 as gbp_category_name,
          $2 as gbp_category_display_name,
          COUNT(DISTINCT t.id) as store_count,
          COUNT(DISTINCT t.id) FILTER (WHERE tgc.category_type = 'primary') as primary_store_count,
          COUNT(DISTINCT t.id) FILTER (WHERE tgc.category_type = 'secondary') as secondary_store_count,
          COALESCE(SUM(real_counts.product_count), 0) as total_products,
          COALESCE(AVG(dsl.rating_avg), 0) as avg_rating,
          COUNT(DISTINCT dsl.city) as unique_locations,
          ARRAY_AGG(DISTINCT dsl.city) FILTER (WHERE dsl.city IS NOT NULL) as cities,
          ARRAY_AGG(DISTINCT dsl.state) FILTER (WHERE dsl.state IS NOT NULL) as states
        FROM tenant_gbp_categories tgc
        JOIN tenants t ON t.id = tgc.tenant_id
        LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
        LEFT JOIN gbp_categories_list gc ON gc.id = tgc.gbp_category_id
        LEFT JOIN (
          SELECT
            tenant_id,
            COUNT(*) as product_count
          FROM inventory_items
          WHERE item_status = 'active' AND visibility = 'public'
          GROUP BY tenant_id
        ) real_counts ON t.id = real_counts.tenant_id
        WHERE (tgc.gbp_category_id = $1 OR gc.name = $2 OR LOWER(gc.name) = LOWER($2))
          AND t.location_status = 'active'
          AND t.directory_visible = true
          AND dsl.is_published = true
      `, [categoryId, actualCategoryName]);

      console.log(`[StoreTypeService] Store count query result: ${JSON.stringify(result.rows)}`);

      if (result.rows.length === 0 || parseInt(result.rows[0].store_count) === 0) {
        // Return empty result with category info
        return {
          id: categoryId,
          name: actualCategoryName,
          displayName: category.display_name || actualCategoryName,
          slug: typeSlug,
          storeCount: 0,
          primaryStoreCount: 0,
          secondaryStoreCount: 0,
          totalProducts: 0,
          avgRating: 0,
          uniqueLocations: 0,
          cities: [],
          states: []
        };
      }

      const type = result.rows[0];
      return {
        id: categoryId,
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
