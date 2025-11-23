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

      // Get unique store types with counts
      const storeTypes = await prisma.$queryRaw<Array<{
        primary_category: string;
        store_count: bigint;
      }>>`
        SELECT 
          primary_category,
          COUNT(*) as store_count
        FROM directory_listings_list
        WHERE is_published = true
          AND primary_category IS NOT NULL
          AND primary_category != ''
        GROUP BY primary_category
        ORDER BY store_count DESC
      `;

      console.log(`[StoreTypeService] Found ${storeTypes.length} store types`);

      return storeTypes.map(type => ({
        name: type.primary_category,
        slug: this.slugify(type.primary_category),
        storeCount: Number(type.store_count),
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

      // Get stores from directory_listings_list using raw SQL
      const stores = await prisma.$queryRaw<Array<{
        id: string;
        tenantId: string;
        business_name: string;
        slug: string;
        address_line1: string | null;
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
        is_published: boolean | null;
        subscription_tier: string | null;
        created_at: Date | null;
        updated_at: Date | null;
      }>>`
        SELECT 
          id,
          tenantId,
          businessName as business_name,
          slug,
          address as address_line1,
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
          is_published,
          subscriptionTier as subscription_tier,
          createdAt as created_at,
          updatedAt as updated_at
        FROM directory_listings_list
        WHERE is_published = true
          AND primary_category ILIKE ${`%${typeName}%`}
        ORDER BY product_count DESC
        LIMIT 100
      `;

      console.log(`[StoreTypeService] Found ${stores.length} stores`);

      return stores.map((store) => ({
        id: store.tenantId,
        name: store.business_name,
        slug: store.slug,
        address: store.address_line1,
        city: store.city,
        state: store.state,
        postalCode: store.postal_code,
        latitude: store.latitude,
        longitude: store.longitude,
        productCount: store.product_count,
        storeType: store.primary_category,
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
      
      const result = await prisma.$queryRaw<Array<{ 
        primary_category: string; 
        store_count: bigint; 
        total_products: bigint; 
      }>>`
        SELECT 
          primary_category,
          COUNT(*) as store_count,
          SUM(product_count) as total_products
        FROM directory_listings_list
        WHERE is_published = true
          AND primary_category ILIKE ${`%${typeName}%`}
        GROUP BY primary_category
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const type = result[0];
      return {
        name: type.primary_category,
        slug: this.slugify(type.primary_category),
        storeCount: Number(type.store_count),
        productCount: Number(type.total_products),
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
