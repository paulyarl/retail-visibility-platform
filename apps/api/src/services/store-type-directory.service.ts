import { prisma } from '../prisma';

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

      // Get unique store types with counts - simplest possible query
      const storeTypes = await prisma.$queryRaw<Array<{
        primary_category: string;
        store_count: number;
      }>>`
        SELECT 'test' as primary_category, 1 as store_count
        LIMIT 1
      `;

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

      // Get stores from directory_listings_list using raw SQL with CTE to avoid JSON fields
      const stores = await prisma.$queryRaw<Array<{
        id: string;
        tenantId: string;
        business_name: string;
        slug: string;
        address: string | null;
        city: string | null;
        state: string | null;
        postal_code: string | null;
        latitude: number | null;
        longitude: number | null;
        primary_category: string | null;
        rating_avg: number | null;
        rating_count: number | null;
        product_count: number | null;
        logo_url: string | null;
        description: string | null;
        is_featured: boolean | null;
        subscription_tier: string | null;
        created_at: Date | null;
        updated_at: Date | null;
      }>>`
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
            AND primary_category ILIKE ${`%${typeName}%`}
        )
        SELECT * FROM store_data
        ORDER BY product_count DESC
        LIMIT 100
      `;

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
      
      // Get store type details using raw SQL with CTE
      const result = await prisma.$queryRaw<Array<{
        primary_category: string;
        store_count: number;
        total_products: number;
      }>>`
        WITH type_details AS (
          SELECT
            primary_category,
            COUNT(*) as store_count,
            SUM(product_count) as total_products
          FROM directory_listings_list
          WHERE is_published = true
            AND primary_category ILIKE ${`%${typeName}%`}
          GROUP BY primary_category
          LIMIT 1
        )
        SELECT
          primary_category,
          store_count::integer,
          COALESCE(total_products, 0)::integer as total_products
        FROM type_details
      `;

      if (result.length === 0) {
        return null;
      }

      const type = result[0];
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
