import { prisma } from '../prisma';
import { triggerRevalidate } from '../utils/revalidate';
import { isValidBadgeKey, isPlatformControlledKey, getBadgeByKey } from './BadgeRegistryService';

// Dynamic featured type validation
const VALID_FEATURED_TYPES = [
  'store_selection',
  'new_arrival', 
  'seasonal',
  'sale',
  'staff_pick',
  'bestseller',
  'clearance',
  'trending',
  'featured',
  'recommended',
  'random_featured'
] as const;

export type FeaturedType = typeof VALID_FEATURED_TYPES[number];

// Platform-controlled types (algorithmic)
const PLATFORM_CONTROLLED_TYPES = [
  'trending',
  'recommended', 
  'bestseller',
  'random_featured'
] as const;

export type PlatformControlledType = typeof PLATFORM_CONTROLLED_TYPES[number];

/**
 * Check if a featured type is platform-controlled (algorithmic)
 */
export function isPlatformControlledType(type: FeaturedType): type is PlatformControlledType {
  return PLATFORM_CONTROLLED_TYPES.includes(type as PlatformControlledType);
}

/**
 * Validates if a featured type is supported
 */
export function isValidFeaturedType(type: string): type is FeaturedType {
  return VALID_FEATURED_TYPES.includes(type as FeaturedType);
}

/**
 * Gets all valid featured types
 */
export function getValidFeaturedTypes(): FeaturedType[] {
  return [...VALID_FEATURED_TYPES];
}

/**
 * Async: Validate if a featured type is supported via the badge registry.
 * Falls back to the static array if the registry is unavailable.
 */
export async function isValidFeaturedTypeAsync(type: string): Promise<boolean> {
  return isValidBadgeKey(type);
}

/**
 * Async: Check if a featured type is platform-controlled via the badge registry.
 * Falls back to the static array if the registry is unavailable.
 */
export async function isPlatformControlledTypeAsync(type: string): Promise<boolean> {
  return isPlatformControlledKey(type);
}

/**
 * Generate trending products based on mv_storefront_discovery metrics
 */
async function generateTrendingProducts(tenantId: string, limit: number): Promise<FeaturedProductWithDetails[]> {
  try {
    // Use mv_storefront_discovery for better trending signals
    const trendingProducts = await prisma.$queryRawUnsafe(`
      SELECT 
        inventory_item_id,
        product_name as name,
        product_title as title,
        product_description as description,
        sku,
        brand,
        current_price_cents as price_cents,
        sale_price_cents,
        stock,
        image_url,
        product_slug,
        brand_normalized::text as brand_normalized,
        category_normalized::text as category_normalized,
        slug_type::text as slug_type,
        platform_tenant_count,
        platform_purchase_count,
        product_type::text as product_type,
        created_at,
        updated_at
      FROM mv_storefront_discovery 
      WHERE tenant_id = $1
        AND item_status = 'active'
        AND visibility = 'public'
        AND in_stock = true
      ORDER BY 
        trending_score DESC,
        view_count DESC,
        conversion_count DESC,
        units_sold DESC
      LIMIT $2
    `, tenantId, limit) as any[];

    return trendingProducts.map((item: any, index: number) => ({
      id: `trending-${item.inventory_item_id}`,
      inventory_item_id: item.inventory_item_id,
      tenant_id: tenantId,
      featured_type: 'trending' as const,
      featured_priority: 100 - index,
      featured_at: item.updated_at || item.created_at,
      featured_expires_at: null,
      auto_unfeature: false,
      is_active: true,
      days_until_expiration: -1,
      is_expired: false,
      is_expiring_soon: false,
      name: item.name,
      title: item.title,
      description: item.description,
      sku: item.sku,
      price_cents: item.price_cents,
      sale_price_cents: item.sale_price_cents,
      stock: item.stock,
      image_url: item.image_url,
      brand: item.brand,
      availability: 'available',
      has_variants: false,
      payment_gateway_type: null,
      price: item.price_cents ? item.price_cents / 100 : 0,
      imageUrl: item.image_url,
      // NEW: Slug registry fields
      product_slug: item.product_slug,
      brand_normalized: item.brand_normalized,
      category_normalized: item.category_normalized,
      slug_type: item.slug_type,
      platform_tenant_count: item.platform_tenant_count,
      platform_purchase_count: item.platform_purchase_count,
      product_type: item.product_type || 'physical'
    }));
  } catch (error) {
    console.error('Error generating trending products from MV:', error);
    return [];
  }
}

/**
 * Generate recommended products based on mv_storefront_discovery quality signals
 */
async function generateRecommendedProducts(tenantId: string, limit: number): Promise<FeaturedProductWithDetails[]> {
  try {
    // Use mv_storefront_discovery for quality-based recommendations
    const recommendedProducts = await prisma.$queryRawUnsafe(`
      SELECT 
        inventory_item_id,
        product_name as name,
        product_title as title,
        product_description as description,
        sku,
        brand,
        current_price_cents as price_cents,
        sale_price_cents,
        stock,
        image_url,
        product_slug,
        brand_normalized::text as brand_normalized,
        category_normalized::text as category_normalized,
        slug_type::text as slug_type,
        platform_tenant_count,
        product_type::text as product_type,
        created_at
      FROM mv_storefront_discovery 
      WHERE tenant_id = $1
        AND item_status = 'active'
        AND visibility = 'public'
        AND in_stock = true
        AND has_image = true
        AND has_description = true
        AND (
          product_average_rating >= 4.0 
          OR product_rating_live >= 4.0
          OR stock >= 5
        )
      ORDER BY 
        product_average_rating DESC NULLS LAST,
        product_rating_live DESC NULLS LAST,
        stock DESC,
        review_count DESC NULLS LAST,
        product_reviews_count_live DESC NULLS LAST,
        trending_score DESC
      LIMIT $2
    `, tenantId, limit) as any[];

    return recommendedProducts.map((item: any, index: number) => ({
      id: `recommended-${item.inventory_item_id}`,
      inventory_item_id: item.inventory_item_id,
      tenant_id: tenantId,
      featured_type: 'recommended' as const,
      featured_priority: 90 - index,
      featured_at: item.created_at,
      featured_expires_at: null,
      auto_unfeature: false,
      is_active: true,
      days_until_expiration: -1,
      is_expired: false,
      is_expiring_soon: false,
      name: item.name,
      title: item.title,
      description: item.description,
      sku: item.sku,
      price_cents: item.price_cents,
      sale_price_cents: item.sale_price_cents,
      stock: item.stock,
      image_url: item.image_url,
      brand: item.brand,
      availability: 'available',
      has_variants: false,
      payment_gateway_type: null,
      price: item.price_cents ? item.price_cents / 100 : 0,
      imageUrl: item.image_url,
      // NEW: Slug registry fields
      product_slug: item.product_slug,
      brand_normalized: item.brand_normalized,
      category_normalized: item.category_normalized,
      slug_type: item.slug_type,
      platform_tenant_count: item.platform_tenant_count,
      product_type: item.product_type || 'physical'
    }));
  } catch (error) {
    console.error('Error generating recommended products from MV:', error);
    return [];
  }
}

/**
 * Generate bestseller products based on mv_storefront_discovery sales metrics
 */
async function generateBestsellerProducts(tenantId: string, limit: number): Promise<FeaturedProductWithDetails[]> {
  try {
    // Use mv_storefront_discovery for actual sales data
    const bestsellerProducts = await prisma.$queryRawUnsafe(`
      SELECT 
        inventory_item_id,
        product_name as name,
        product_title as title,
        product_description as description,
        sku,
        brand,
        current_price_cents as price_cents,
        sale_price_cents,
        stock,
        image_url,
        product_slug,
        brand_normalized::text as brand_normalized,
        category_normalized::text as category_normalized,
        slug_type::text as slug_type,
        platform_tenant_count,
        platform_purchase_count,
        product_type::text as product_type,
        created_at,
        updated_at
      FROM mv_storefront_discovery 
      WHERE tenant_id = $1
        AND item_status = 'active'
        AND visibility = 'public'
        AND in_stock = true
        AND (
          units_sold > 0 
          OR conversion_count > 0
          OR revenue_cents > 0
        )
      ORDER BY 
        units_sold DESC,
        conversion_count DESC,
        revenue_cents DESC,
        (CASE WHEN units_sold > 0 THEN revenue_cents / units_sold ELSE 0 END) DESC,
        trending_score DESC
      LIMIT $2
    `, tenantId, limit) as any[];

    return bestsellerProducts.map((item: any, index: number) => ({
      id: `bestseller-${item.inventory_item_id}`,
      inventory_item_id: item.inventory_item_id,
      tenant_id: tenantId,
      featured_type: 'bestseller' as const,
      featured_priority: 95 - index,
      featured_at: item.updated_at || item.created_at,
      featured_expires_at: null,
      auto_unfeature: false,
      is_active: true,
      days_until_expiration: -1,
      is_expired: false,
      is_expiring_soon: false,
      name: item.name,
      title: item.title,
      description: item.description,
      sku: item.sku,
      price_cents: item.price_cents,
      sale_price_cents: item.sale_price_cents,
      stock: item.stock,
      image_url: item.image_url,
      brand: item.brand,
      availability: 'available',
      has_variants: false,
      payment_gateway_type: null,
      // NEW: Slug registry fields
      product_slug: item.product_slug,
      brand_normalized: item.brand_normalized,
      category_normalized: item.category_normalized,
      slug_type: item.slug_type,
      platform_tenant_count: item.platform_tenant_count,
      platform_purchase_count: item.platform_purchase_count,
      price: item.price_cents ? item.price_cents / 100 : 0,
      imageUrl: item.image_url,
      product_type: item.product_type || 'physical'
    }));
  } catch (error) {
    console.error('Error generating bestseller products from MV:', error);
    return [];
  }
}

/**
 * Generate random discovery products based on mv_storefront_discovery quality metrics
 */
async function generateRandomDiscoveryProducts(tenantId: string, limit: number): Promise<FeaturedProductWithDetails[]> {
  try {
    // Use mv_storefront_discovery for quality-based random selection
    const qualityProducts = await prisma.$queryRawUnsafe(`
      SELECT 
        inventory_item_id,
        product_name as name,
        product_title as title,
        product_description as description,
        sku,
        brand,
        current_price_cents as price_cents,
        sale_price_cents,
        stock,
        image_url,
        trending_score::float8 as trending_score,
        product_average_rating::float8 as product_average_rating,
        view_count,
        product_type::text as product_type,
        created_at,
        updated_at
      FROM mv_storefront_discovery 
      WHERE tenant_id = $1
        AND item_status = 'active'
        AND visibility = 'public'
        AND in_stock = true
        AND has_image = true
        AND has_description = true
        AND (
          trending_score > 0.1
          OR product_average_rating >= 3.5
          OR view_count > 5
        )
      ORDER BY RANDOM()
      LIMIT $2
    `, tenantId, Math.min(limit * 3, 100)) as any[];

    // Apply additional scoring and limit
    const scoredProducts = qualityProducts.map((item: any, index: number) => {
      const score = (
        (item.trending_score || 0) * 0.3 +
        (item.product_average_rating || 0) / 5 * 0.3 +
        Math.min(Number(item.view_count || 0), 100) / 100 * 0.2 +
        Math.random() * 0.2
      );
      
      return {
        ...item,
        randomScore: score
      };
    });

    // Sort by combined score and take top results
    const selectedProducts = scoredProducts
      .sort((a: any, b: any) => b.randomScore - a.randomScore)
      .slice(0, limit);

    return selectedProducts.map((item: any, index: number) => ({
      id: `random-${item.inventory_item_id}`,
      inventory_item_id: item.inventory_item_id,
      tenant_id: tenantId,
      featured_type: 'random_featured' as const,
      featured_priority: Math.floor(Math.random() * 50) + 50,
      featured_at: new Date(),
      featured_expires_at: null,
      auto_unfeature: false,
      is_active: true,
      days_until_expiration: -1,
      is_expired: false,
      is_expiring_soon: false,
      name: item.name,
      title: item.title,
      description: item.description,
      sku: item.sku,
      price_cents: item.price_cents,
      sale_price_cents: item.sale_price_cents,
      stock: item.stock,
      image_url: item.image_url,
      brand: item.brand,
      availability: 'available',
      has_variants: false,
      payment_gateway_type: null,
      price: item.price_cents ? item.price_cents / 100 : 0,
      imageUrl: item.image_url,
      product_type: item.product_type || 'physical'
    }));
  } catch (error) {
    console.error('Error generating random discovery products from MV:', error);
    return [];
  }
}

export interface FeaturedProduct {
  id: string;
  inventory_item_id: string;
  tenant_id: string;
  featured_type: FeaturedType;
  featured_priority: number;
  featured_at: Date;
  featured_expires_at: Date | null;
  auto_unfeature: boolean;
  is_active: boolean;
}

export interface FeaturedProductWithDetails extends FeaturedProduct {
  days_until_expiration?: number;
  is_expired?: boolean;
  is_expiring_soon?: boolean;
  product_type?: string;
}

export class FeaturedProductsService {
  /**
   * Get all featured products for a specific item
   */
  static async getFeaturedTypesForItem(inventoryItemId: string): Promise<FeaturedProductWithDetails[]> {
    try {
      // Use Prisma's regular query methods now that the model exists
      const featuredProducts = await prisma.featured_products.findMany({
        where: {
          inventory_item_id: inventoryItemId
        },
        orderBy: [
          { featured_priority: 'desc' },
          { featured_at: 'desc' }
        ]
      });

      // Transform the results to match the expected interface
      const transformedProducts = featuredProducts.map(fp => {
        const now = new Date();
        const expiresAt = fp.featured_expires_at ? new Date(fp.featured_expires_at) : null;
        const daysRemaining = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : -1;
        const isExpired = expiresAt ? expiresAt <= now : false;
        const isExpiringSoon = expiresAt && !isExpired && daysRemaining <= 3;

        return {
          id: fp.id,
          inventory_item_id: fp.inventory_item_id,
          tenant_id: fp.tenant_id,
          featured_type: fp.featured_type,
          featured_priority: fp.featured_priority,
          featured_at: fp.featured_at,
          featured_expires_at: fp.featured_expires_at,
          auto_unfeature: fp.auto_unfeature,
          is_active: fp.is_active,
          days_until_expiration: daysRemaining,
          is_expired: isExpired,
          is_expiring_soon: isExpiringSoon
        } as FeaturedProductWithDetails;
      });

      return transformedProducts;
    } catch (error) {
      // If table doesn't exist or other error, return empty array
      console.warn('Featured products table not available, returning empty array:', error);
      return [];
    }
  }

  /**
   * Get all featured products for a tenant
   */
  static async getFeaturedProductsForTenant(
    tenantId: string,
    options?: {
      featured_type?: string;
      is_active?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<FeaturedProductWithDetails[]> {
    try {
      // Use Prisma's regular query methods now that the model exists
      const whereClause: any = {
        tenant_id: tenantId
      };

      if (options?.featured_type) {
        whereClause.featured_type = options.featured_type;
      }
      
      if (options?.is_active !== undefined) {
        whereClause.is_active = options.is_active;
      }

      const featuredProducts = await prisma.featured_products.findMany({
        where: whereClause,
        orderBy: [
          { featured_priority: 'desc' },
          { featured_at: 'desc' }
        ],
        take: options?.limit,
        skip: options?.offset
      });

      // Transform the results to match the expected interface
      const transformedProducts = featuredProducts.map(fp => {
        const now = new Date();
        const expiresAt = fp.featured_expires_at ? new Date(fp.featured_expires_at) : null;
        const daysRemaining = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : -1;
        const isExpired = expiresAt ? expiresAt <= now : false;
        const isExpiringSoon = expiresAt && !isExpired && daysRemaining <= 3;

        return {
          id: fp.id,
          inventory_item_id: fp.inventory_item_id,
          tenant_id: fp.tenant_id,
          featured_type: fp.featured_type,
          featured_priority: fp.featured_priority,
          featured_at: fp.featured_at,
          featured_expires_at: fp.featured_expires_at,
          auto_unfeature: fp.auto_unfeature,
          is_active: fp.is_active,
          days_until_expiration: daysRemaining,
          is_expired: isExpired,
          is_expiring_soon: isExpiringSoon
        } as FeaturedProductWithDetails;
      });

      return transformedProducts;
    } catch (error) {
      console.error('Error in getFeaturedProductsForTenant:', error);
      return [];
    }
  }

  /**
   * Add a featured type to an item
   */
  static async addFeaturedType(
    inventoryItemId: string,
    tenantId: string,
    featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick' | 'bestseller' | 'clearance' | 'trending' | 'featured' | 'recommended' | 'random_featured',
    options?: {
      featured_priority?: number;
      featured_expires_at?: Date | string | null;
      auto_unfeature?: boolean;
      assignment_source?: 'auto' | 'manual' | 'system';
    }
  ): Promise<FeaturedProduct> {
    try {
      // Look up badge type from registry to determine approval behavior
      const badgeType = await getBadgeByKey(featuredType);
      const requiresAdminApproval = badgeType?.requiresAdminApproval ?? false;
      const adminApproved = !requiresAdminApproval;
      
      const featuredProduct = await prisma.featured_products.upsert({
        where: {
          inventory_item_id_featured_type: {
            inventory_item_id: inventoryItemId,
            featured_type: featuredType
          }
        },
        update: {
          featured_priority: options?.featured_priority || 50,
          featured_expires_at: options?.featured_expires_at ? new Date(options.featured_expires_at) : null,
          auto_unfeature: options?.auto_unfeature !== undefined ? options.auto_unfeature : true,
          is_active: true,
          admin_approved: adminApproved,
          assignment_source: options?.assignment_source || 'manual',
        },
        create: {
          inventory_item_id: inventoryItemId,
          tenant_id: tenantId,
          featured_type: featuredType,
          featured_priority: options?.featured_priority || 50,
          featured_at: new Date(),
          featured_expires_at: options?.featured_expires_at ? new Date(options.featured_expires_at) : null,
          auto_unfeature: options?.auto_unfeature !== undefined ? options.auto_unfeature : true,
          is_active: true,
          admin_approved: adminApproved,
          assignment_source: options?.assignment_source || 'manual',
        }
      });

      // console.log(`[addFeaturedType] Successfully created/updated featured product:`, {
      //   id: featuredProduct.id,
      //   inventory_item_id: featuredProduct.inventory_item_id,
      //   tenant_id: featuredProduct.tenant_id,
      //   featured_type: featuredProduct.featured_type,
      //   is_active: featuredProduct.is_active
      // });

      // Trigger storefront revalidation
      triggerRevalidate(tenantId, [
        `/t/${tenantId}`,
        `/directory/t/${tenantId}`,
        `/api/public/products/featured?tenantId=${tenantId}`
      ]).catch(() => {});

      return featuredProduct as FeaturedProduct;
    } catch (error) {
      console.error('Error in addFeaturedType:', error);
      throw error;
    }
  }

  /**
   * Remove a featured type from an item
   */
  static async removeFeaturedType(
    inventoryItemId: string,
    featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick' | 'bestseller' | 'clearance' | 'trending' | 'featured' | 'recommended'
  ): Promise<boolean> {
    try {
      // console.log(`[FeaturedProductsService] Removing ${featuredType} from inventory_item_id: ${inventoryItemId}`);
      
      // First check if the featured product exists
      const existingFeatured = await prisma.featured_products.findFirst({
        where: {
          inventory_item_id: inventoryItemId,
          featured_type: featuredType
        }
      });

      if (!existingFeatured) {
        // console.log(`[FeaturedProductsService] Featured product not found: inventory_item_id=${inventoryItemId}, featured_type=${featuredType}`);
        return false;
      }

      // console.log(`[FeaturedProductsService] Found featured product to delete: ${existingFeatured.id}`);

      const result = await prisma.featured_products.deleteMany({
        where: {
          inventory_item_id: inventoryItemId,
          featured_type: featuredType
        }
      });

      // console.log(`[FeaturedProductsService] Deleted ${result.count} featured products for inventory_item_id=${inventoryItemId}, featured_type=${featuredType}`);
      
      // Verify the deletion by checking the database immediately
      const remainingCount = await prisma.featured_products.count({
        where: {
          tenant_id: existingFeatured.tenant_id,
          featured_type: featuredType,
          is_active: true
        }
      });
      
      // console.log(`[FeaturedProductsService] Verification: ${remainingCount} ${featuredType} products remaining for tenant ${existingFeatured.tenant_id}`);
      
      // Trigger storefront revalidation
      triggerRevalidate(existingFeatured.tenant_id, [
        `/t/${existingFeatured.tenant_id}`,
        `/directory/t/${existingFeatured.tenant_id}`,
        `/api/public/products/featured?tenantId=${existingFeatured.tenant_id}`
      ]).catch(() => {});
      
      return result.count > 0;
    } catch (error) {
      console.error('[FeaturedProductsService] Error in removeFeaturedType:', error);
      return false;
    }
  }

  /**
   * Update featured type
   */
  static async updateFeaturedType(
    inventoryItemId: string,
    featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick' | 'bestseller' | 'clearance' | 'trending' | 'featured' | 'recommended',
    updates: {
      featured_expires_at?: Date | string | null;
      auto_unfeature?: boolean;
      is_active?: boolean;
    }
  ): Promise<FeaturedProduct | null> {
    try {
      const featuredProducts = await prisma.featured_products.updateMany({
        where: {
          inventory_item_id: inventoryItemId,
          featured_type: featuredType
        },
        data: updates
      });

      if (featuredProducts.count === 0) {
        return null;
      }

      // Return the updated record
      const updatedRecord = await prisma.featured_products.findFirst({
        where: {
          inventory_item_id: inventoryItemId,
          featured_type: featuredType
        }
      });

      return updatedRecord as FeaturedProduct;
    } catch (error) {
      console.error('Error in updateFeaturedType:', error);
      return null;
    }
  }

  /**
   * Update featured type expiration (legacy method for backward compatibility)
   */
  static async updateFeaturedTypeExpiration(
    inventoryItemId: string,
    featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick' | 'bestseller' | 'clearance' | 'trending' | 'featured' | 'recommended',
    featured_expires_at: Date | string | null,
    auto_unfeature?: boolean
  ): Promise<FeaturedProduct | null> {
    return this.updateFeaturedType(inventoryItemId, featuredType, {
      featured_expires_at,
      auto_unfeature
    });
  }

  /**
   * Get all featured products for management (no limits)
   */
  static async getAllFeaturedProductsForManagement(
    tenantId: string
  ): Promise<{ [key: string]: FeaturedProductWithDetails[] }> {
    try {
      // Get ALL featured products (no limit)
      const featuredProducts = await prisma.featured_products.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true
        },
        orderBy: [
          { featured_priority: 'asc' },
          { featured_at: 'asc' }
        ]
      });

      // Remove duplicates by keeping only the latest entry for each inventory_item_id and featured_type
      const uniqueFeaturedProducts = featuredProducts.reduce((acc, fp) => {
        const key = `${fp.inventory_item_id}-${fp.featured_type}`;
        if (!acc.has(key) || (fp.featured_at && new Date(fp.featured_at) > new Date(acc.get(key).featured_at))) {
          acc.set(key, fp);
        }
        return acc;
      }, new Map());

      const deduplicatedProducts = Array.from(uniqueFeaturedProducts.values());

      // Then get the inventory items for these products
      const inventoryItemIds = deduplicatedProducts.map(fp => fp.inventory_item_id);
      
      const inventoryItems = await prisma.inventory_items.findMany({
        where: {
          id: { in: inventoryItemIds }
          // Removed item_status: 'active' filter to show all featured products regardless of inventory status
        }
      });

      // Create a map for quick lookup
      const itemMap = new Map(
        inventoryItems.map(item => [item.id, item])
      );

      // Group by featured_type and combine data
      const grouped: { [key: string]: FeaturedProductWithDetails[] } = {
        store_selection: [],
        new_arrival: [],
        seasonal: [],
        sale: [],
        staff_pick: [],
        bestseller: [],
        clearance: [],
        featured: [],
        recommended: [],
        trending: []
      };

      deduplicatedProducts.forEach(fp => {
        if (grouped[fp.featured_type]) {
          const inventoryItem = itemMap.get(fp.inventory_item_id);
          
          // Only include if inventory item exists and is not expired
          if (inventoryItem) {
            const now = new Date();
            const expiresAt = fp.featured_expires_at ? new Date(fp.featured_expires_at) : null;
            const isExpired = expiresAt ? expiresAt <= now : false;
            
            if (!isExpired) {
              // Transform to match the expected interface for frontend
              const transformedProduct = {
                id: fp.id,
                inventory_item_id: fp.inventory_item_id,
                tenant_id: fp.tenant_id,
                featured_type: fp.featured_type,
                featured_priority: fp.featured_priority,
                featured_at: fp.featured_at,
                featured_expires_at: fp.featured_expires_at,
                auto_unfeature: fp.auto_unfeature,
                is_active: fp.is_active,
                // Calculate expiration details
                days_until_expiration: expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : -1,
                is_expired: isExpired,
                is_expiring_soon: expiresAt && !isExpired && Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 3,
                // Include inventory item details
                name: inventoryItem.name,
                title: inventoryItem.title,
                description: inventoryItem.description,
                sku: inventoryItem.sku,
                price_cents: inventoryItem.price_cents,
                sale_price_cents: inventoryItem.sale_price_cents,
                stock: inventoryItem.stock,
                image_url: inventoryItem.image_url,
                brand: inventoryItem.brand,
                availability: inventoryItem.availability,
                has_variants: inventoryItem.has_variants,
                                payment_gateway_type: inventoryItem.payment_gateway_type,
                // Convert price from cents to dollars for frontend
                price: inventoryItem.price_cents ? inventoryItem.price_cents / 100 : 0,
                // Map image_url to imageUrl for frontend consistency
                imageUrl: inventoryItem.image_url
              } as FeaturedProductWithDetails;
              
              grouped[fp.featured_type].push(transformedProduct);
            }
          }
        }
      });

      return grouped;
    } catch (error) {
      console.error('Error in getAllFeaturedProductsForManagement:', error);
      // Return empty groups if there's an error
      return {
        store_selection: [],
        new_arrival: [],
        seasonal: [],
        sale: [],
        staff_pick: [],
        bestseller: [],
        clearance: [],
        featured: [],
        recommended: [],
        trending: []
      };
    }
  }

  /**
   * Get featured products grouped by type for storefront display
   */
  static async getStorefrontFeaturedProducts(
    tenantId: string,
    limit: number = 10
  ): Promise<{ [key: string]: FeaturedProductWithDetails[] }> {
    try {
      // console.log(`[getStorefrontFeaturedProducts] Fetching for tenant: ${tenantId}`);
      
      // First get the featured products using Prisma ORM
      const featuredProducts = await prisma.featured_products.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true
        },
        orderBy: [
          { featured_priority: 'desc' },
          { featured_at: 'desc' }
        ],
        take: limit * 5 // Get more to account for filtering
      });

      // console.log(`[getStorefrontFeaturedProducts] Found ${featuredProducts.length} featured products`);

      // Then get the inventory items for these products
      const inventoryItemIds = featuredProducts.map(fp => fp.inventory_item_id);
      const inventoryItems = await prisma.inventory_items.findMany({
        where: {
          id: { in: inventoryItemIds },
          item_status: 'active'
        }
      });

      // Create a map for quick lookup
      const itemMap = new Map(
        inventoryItems.map(item => [item.id, item])
      );

      // Group by featured_type and combine data
      const grouped: { [key: string]: FeaturedProductWithDetails[] } = {
        store_selection: [],
        new_arrival: [],
        seasonal: [],
        sale: [],
        staff_pick: [],
        bestseller: [],
        clearance: [],
        featured: [],
        recommended: [],
        trending: [],
        random_featured: []
      };

      featuredProducts.forEach(fp => {
        if (grouped[fp.featured_type]) {
          const inventoryItem = itemMap.get(fp.inventory_item_id);
          
          // Only include if inventory item exists and is not expired
          if (inventoryItem) {
            const now = new Date();
            const expiresAt = fp.featured_expires_at ? new Date(fp.featured_expires_at) : null;
            const isExpired = expiresAt ? expiresAt <= now : false;
            
            if (!isExpired) {
              // Transform to match the expected interface for frontend
              const transformedProduct = {
                id: fp.id,
                inventory_item_id: fp.inventory_item_id,
                tenant_id: fp.tenant_id,
                featured_type: fp.featured_type,
                featured_priority: fp.featured_priority,
                featured_at: fp.featured_at,
                featured_expires_at: fp.featured_expires_at,
                auto_unfeature: fp.auto_unfeature,
                is_active: fp.is_active,
                // Calculate expiration details
                days_until_expiration: expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : -1,
                is_expired: isExpired,
                is_expiring_soon: expiresAt && !isExpired && Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 3,
                // Include inventory item details
                name: inventoryItem.name,
                title: inventoryItem.title,
                description: inventoryItem.description,
                sku: inventoryItem.sku,
                price_cents: inventoryItem.price_cents,
                sale_price_cents: inventoryItem.sale_price_cents,
                stock: inventoryItem.stock,
                image_url: inventoryItem.image_url,
                brand: inventoryItem.brand,
                availability: inventoryItem.availability,
                has_variants: inventoryItem.has_variants,
                                payment_gateway_type: inventoryItem.payment_gateway_type,
                // Convert price from cents to dollars for frontend
                price: inventoryItem.price_cents ? inventoryItem.price_cents / 100 : 0,
                // Map image_url to imageUrl for frontend consistency
                imageUrl: inventoryItem.image_url
              } as FeaturedProductWithDetails;
              
              grouped[fp.featured_type].push(transformedProduct);
            }
          }
        }
      });

      // Generate platform-controlled algorithmic selections
      // Prefer system-assigned badges from featured_products (synced by syncPlatformTypes job).
      // Fall back to on-the-fly generation if no system-assigned badges exist yet.
      try {
        // Check if system-assigned platform types exist in featured_products
        const systemPlatformBadges = await prisma.featured_products.findMany({
          where: {
            tenant_id: tenantId,
            is_active: true,
            assignment_source: 'system',
            featured_type: { in: ['trending', 'bestseller', 'recommended', 'random_featured'] },
          },
          select: { featured_type: true },
          distinct: ['featured_type'],
        });

        const systemTypesAvailable = new Set(systemPlatformBadges.map(b => b.featured_type));

        // For each platform type, use system-assigned badges if available, otherwise generate on-the-fly
        if (systemTypesAvailable.has('trending')) {
          // Already in grouped from the featured_products query above
        } else {
          const trendingProducts = await generateTrendingProducts(tenantId, limit);
          grouped.trending = trendingProducts.slice(0, limit);
        }

        if (systemTypesAvailable.has('recommended')) {
          // Already in grouped from the featured_products query above
        } else {
          const recommendedProducts = await generateRecommendedProducts(tenantId, limit);
          grouped.recommended = recommendedProducts.slice(0, limit);
        }

        if (systemTypesAvailable.has('bestseller')) {
          // Already in grouped from the featured_products query above
        } else {
          const bestsellerProducts = await generateBestsellerProducts(tenantId, limit);
          grouped.bestseller = bestsellerProducts.slice(0, limit);
        }

        if (systemTypesAvailable.has('random_featured')) {
          // Already in grouped from the featured_products query above
        } else {
          const randomProducts = await generateRandomDiscoveryProducts(tenantId, limit);
          grouped.random_featured = randomProducts.slice(0, limit);
        }

        console.log(`[getStorefrontFeaturedProducts] Platform types: ${Array.from(systemTypesAvailable).join(', ') || 'all on-the-fly'}`);
      } catch (error) {
        console.error('[getStorefrontFeaturedProducts] Error generating platform-controlled selections:', error);
        // Continue with merchant-controlled products if algorithmic generation fails
      }

      // Limit each group
      Object.keys(grouped).forEach(key => {
        grouped[key] = grouped[key].slice(0, limit);
      });

      // Log the final counts
      Object.keys(grouped).forEach(key => {
        // console.log(`[getStorefrontFeaturedProducts] ${key}: ${grouped[key].length} products`);
      });

      return grouped;
    } catch (error) {
      console.error('Error in getStorefrontFeaturedProducts:', error);
      // Return empty groups if there's an error
      return {
        store_selection: [],
        new_arrival: [],
        seasonal: [],
        sale: [],
        staff_pick: [],
        bestseller: [],
        clearance: [],
        featured: [],
        recommended: [],
        trending: [],
        random_featured: []
      };
    }
  }

  /**
   * Migrate existing featured products from old single-type system to new multi-type system
   */
  static async migrateLegacyFeaturedProducts(tenantId: string): Promise<{
    migrated: number;
    skipped: number;
    errors: number;
  }> {
    try {
      // Get all featured products from the old system
      const legacyFeatured = await prisma.inventory_items.findMany({
        where: {
          tenant_id: tenantId,
          is_featured: true
        },
        select: {
          id: true,
          tenant_id: true,
          featured_at: true,
          featured_until: true,
          featured_priority: true
        }
      });

      let migrated = 0;
      let skipped = 0;
      let errors = 0;

      for (const item of legacyFeatured) {
        try {
          // Check if already migrated to new system
          const existingFeatured = await prisma.featured_products.findFirst({
            where: {
              inventory_item_id: item.id,
              tenant_id: item.tenant_id,
              featured_type: 'store_selection' // Default to store_selection for legacy items
            }
          });

          if (existingFeatured) {
            skipped++;
            continue;
          }

          // Migrate to new system
          await prisma.featured_products.create({
            data: {
              inventory_item_id: item.id,
              tenant_id: item.tenant_id,
              featured_type: 'store_selection', // Default type for legacy featured products
              featured_priority: item.featured_priority || 50,
              featured_at: item.featured_at || new Date(),
              featured_expires_at: item.featured_until,
              auto_unfeature: true,
              is_active: true
            }
          });

          migrated++;
        } catch (error) {
          console.error(`Error migrating item ${item.id}:`, error);
          errors++;
        }
      }

      return { migrated, skipped, errors };
    } catch (error) {
      console.error('Error in migrateLegacyFeaturedProducts:', error);
      return { migrated: 0, skipped: 0, errors: 1 };
    }
  }

  /**
   * Bulk operations - Add multiple featured types to multiple items
   */
  static async bulkAddFeaturedTypes(
    items: Array<{
      inventory_item_id: string;
      tenant_id: string;
      featured_type: FeaturedType;
      featured_priority?: number;
      featured_expires_at?: Date | string | null;
      auto_unfeature?: boolean;
    }>
  ): Promise<FeaturedProduct[]> {
    if (items.length === 0) return [];

    try {
      // Use Prisma's createMany now that the model exists
      const featuredProducts = await prisma.featured_products.createMany({
        data: items.map(item => ({
          inventory_item_id: item.inventory_item_id,
          tenant_id: item.tenant_id,
          featured_type: item.featured_type,
          featured_priority: item.featured_priority || 50,
          featured_at: new Date(),
          featured_expires_at: item.featured_expires_at ? new Date(item.featured_expires_at) : null,
          auto_unfeature: item.auto_unfeature !== undefined ? item.auto_unfeature : true,
          is_active: true,
          admin_approved: true, // Auto-approve featured products by default
          approved_at: new Date()
        })),
        skipDuplicates: true
      });

      // Return the created items by fetching them
      const createdItems = await prisma.featured_products.findMany({
        where: {
          inventory_item_id: { in: items.map(item => item.inventory_item_id) },
          tenant_id: items[0].tenant_id
        },
        orderBy: { featured_at: 'desc' }
      });

      return createdItems as FeaturedProduct[];
    } catch (error) {
      console.error('Error in bulkAddFeaturedTypes:', error);
      return [];
    }
  }

  /**
   * Get featured products statistics for a tenant
   */
  static async getFeaturedProductsStats(tenantId: string): Promise<{
    total_featured: number;
    by_type: { [key: string]: number };
    expiring_soon: number;
    expired: number;
  }> {
    const stats = await prisma.$queryRaw<Array<{
      total_featured: bigint;
      store_selection: bigint;
      new_arrival: bigint;
      seasonal: bigint;
      sale: bigint;
      staff_pick: bigint;
      bestseller: bigint;
      clearance: bigint;
      featured: bigint;
      recommended: bigint;
      trending: bigint;
      expiring_soon: bigint;
      expired: bigint;
    }>>`
      SELECT 
        COUNT(*) as total_featured,
        COUNT(CASE WHEN featured_type = 'store_selection' THEN 1 END) as store_selection,
        COUNT(CASE WHEN featured_type = 'new_arrival' THEN 1 END) as new_arrival,
        COUNT(CASE WHEN featured_type = 'seasonal' THEN 1 END) as seasonal,
        COUNT(CASE WHEN featured_type = 'sale' THEN 1 END) as sale,
        COUNT(CASE WHEN featured_type = 'staff_pick' THEN 1 END) as staff_pick,
        COUNT(CASE WHEN featured_type = 'bestseller' THEN 1 END) as bestseller,
        COUNT(CASE WHEN featured_type = 'clearance' THEN 1 END) as clearance,
        COUNT(CASE WHEN featured_type = 'featured' THEN 1 END) as featured,
        COUNT(CASE WHEN featured_type = 'recommended' THEN 1 END) as recommended,
        COUNT(CASE WHEN featured_type = 'trending' THEN 1 END) as trending,
        COUNT(CASE WHEN 
          featured_expires_at IS NOT NULL 
          AND featured_expires_at > CURRENT_DATE 
          AND featured_expires_at <= (CURRENT_DATE + INTERVAL '3 days')
        THEN 1 END) as expiring_soon,
        COUNT(CASE WHEN 
          featured_expires_at IS NOT NULL AND featured_expires_at <= CURRENT_DATE
        THEN 1 END) as expired
      FROM featured_products
      WHERE tenant_id = ${tenantId}
        AND is_active = true
    `;

    const stat = stats[0];
    return {
      total_featured: Number(stat.total_featured),
      by_type: {
        store_selection: Number(stat.store_selection),
        new_arrival: Number(stat.new_arrival),
        seasonal: Number(stat.seasonal),
        sale: Number(stat.sale),
        staff_pick: Number(stat.staff_pick),
        bestseller: Number(stat.bestseller),
        clearance: Number(stat.clearance),
        featured: Number(stat.featured),
        recommended: Number(stat.recommended),
        trending: Number(stat.trending)
      },
      expiring_soon: Number(stat.expiring_soon),
      expired: Number(stat.expired)
    };
  }

  /**
   * Approve tenant for featured access (admin only)
   */
  static async approveTenantFeaturedAccess(
    tenantId: string,
    adminUserId: string
  ): Promise<any> {
    try {
      console.log('[DEBUG] Approving tenant featured access with user ID:', adminUserId);

      const updatedTenant = await prisma.tenants.update({
        where: { id: tenantId },
        data: {
          featured_access_approved: true,
          featured_access_approved_by: adminUserId,
          featured_access_approved_at: new Date(),
          featured_access_rejection_reason: null
        } as any, // Type assertion for new fields
        include: {
          user_tenants: {
            include: {
              users: {
                select: {
                  id: true,
                  email: true,
                  first_name: true,
                  last_name: true
                }
              }
            }
          }
        }
      });

      // Invalidate cache for this tenant
      await this.invalidateCache(tenantId);

      return updatedTenant;
    } catch (error) {
      console.error('Error approving tenant featured access:', error);
      throw error;
    }
  }

  /**
   * Reject tenant for featured access (admin only)
   */
  static async rejectTenantFeaturedAccess(
    tenantId: string,
    adminUserId: string,
    reason?: string
  ): Promise<any> {
    try {
      console.log('[DEBUG] Rejecting tenant featured access with user ID:', adminUserId);

      const updatedTenant = await prisma.tenants.update({
        where: { id: tenantId },
        data: {
          featured_access_approved: false,
          featured_access_approved_by: adminUserId,
          featured_access_approved_at: new Date(),
          featured_access_rejection_reason: reason || null
        } as any, // Type assertion for new fields
        include: {
          user_tenants: {
            include: {
              users: {
                select: {
                  id: true,
                  email: true,
                  first_name: true,
                  last_name: true
                }
              }
            }
          }
        }
      });

      // Invalidate cache for this tenant
      await this.invalidateCache(tenantId);

      return updatedTenant;
    } catch (error) {
      console.error('Error rejecting tenant featured access:', error);
      throw error;
    }
  }

  /**
   * Get all featured products (both approved and rejected)
   */
  static async getAllFeaturedProducts(): Promise<any[]> {
    try {
      const featuredProducts = await prisma.featured_products.findMany({
        where: {
          is_active: true
        },
        include: {
          inventory_items: {
            select: {
              id: true,
              sku: true,
              name: true,
              title: true,
              brand: true,
              price_cents: true,
              image_url: true,
            }
          },
          tenants: {
            select: {
              id: true,
              name: true,
              subscription_tier: true
            }
          }
        },
        orderBy: {
          featured_at: 'desc'
        }
      });

      return featuredProducts;
    } catch (error) {
      console.error('[FeaturedProductsService] Error getting all featured products:', error);
      throw error;
    }
  }

  /**
   * Approve a featured product
   */
  static async approveFeaturedProduct(productId: string, adminUserId: string): Promise<any> {
    try {
      const updatedProduct = await prisma.featured_products.update({
        where: {
          id: productId
        },
        data: {
          admin_approved: true,
          approved_at: new Date()
        }
      });

      // Invalidate cache
      await this.invalidateCache(productId);

      return updatedProduct;
    } catch (error) {
      console.error('Error approving featured product:', error);
      throw error;
    }
  }

  /**
   * Reject a featured product
   */
  static async rejectFeaturedProduct(productId: string, adminUserId: string, reason?: string): Promise<any> {
    try {
      // First, let's just update the approval status without the user relation
      const updatedProduct = await prisma.featured_products.update({
        where: {
          id: productId
        },
        data: {
          admin_approved: false,
          approved_at: new Date()
        }
      });

      // Invalidate cache
      await this.invalidateCache(productId);

      return updatedProduct;
    } catch (error) {
      console.error('Error rejecting featured product:', error);
      throw error;
    }
  }

  /**
   * Get all tenants with featured access status
   */
  static async getAllTenantsWithFeaturedAccessStatus(): Promise<any[]> {
    try {
      const tenants = await prisma.tenants.findMany({
        select: {
          id: true,
          name: true,
          subscription_tier: true,
          subscription_status: true,
          created_at: true,
          featured_access_approved: true,
          featured_access_approved_by: true,
          featured_access_approved_at: true,
          featured_access_rejection_reason: true,
          user_tenants: {
            select: {
              users: {
                select: {
                  id: true,
                  email: true,
                  first_name: true,
                  last_name: true
                }
              }
            }
          },
          featured_products: {
            where: {
              is_active: true
            },
            select: {
              id: true,
              inventory_item_id: true,
              tenant_id: true,
              featured_type: true,
              featured_priority: true,
              featured_at: true,
              is_active: true,
              admin_approved: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      return tenants;
    } catch (error) {
      console.error('[FeaturedProductsService] Error getting all tenants with featured access status:', error);
      throw error;
    }
  }

  /**
   * Get tenants pending featured access approval
   */
  static async getTenantsPendingFeaturedAccess(): Promise<any[]> {
    try {
      const pendingTenants = await prisma.tenants.findMany({
        where: {
          featured_access_approved: false,
          featured_access_approved_by: null, // Not yet reviewed
        } as any, // Type assertion for new fields
        include: {
          user_tenants: {
            include: {
              users: {
                select: {
                  id: true,
                  email: true,
                  first_name: true,
                  last_name: true
                }
              }
            }
          },
          featured_products: {
            where: {
              featured_type: 'featured',
              is_active: true
            },
            take: 1,
            orderBy: {
              featured_at: 'desc'
            }
          }
        },
        orderBy: [
          { created_at: 'desc' }
        ]
      });

      return pendingTenants;
    } catch (error) {
      console.error('Error getting tenants pending featured access:', error);
      throw error;
    }
  }

  /**
   * Check if tenant has featured access
   */
  static async tenantHasFeaturedAccess(tenantId: string): Promise<boolean> {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          featured_access_approved: true
        } as any // Type assertion for new fields
      });

      return (tenant as any)?.featured_access_approved || false;
    } catch (error) {
      console.error('Error checking tenant featured access:', error);
      return false;
    }
  }

  /**
   * Invalidate cache for a specific tenant
   */
  static async invalidateCache(tenantId: string): Promise<void> {
    try {
      // Invalidate various cache patterns for this tenant
      const cachePatterns = [
        `featured-products-${tenantId}*`,
        `tenant-featured-products-${tenantId}*`,
        `featured-limits-${tenantId}*`,
        `/api/featured-products/management?tenantId=${tenantId}*`
      ];

      // This would integrate with your cache service
      // For now, we'll log the invalidation
      console.log(`[FeaturedProductsService] Invalidating cache for tenant ${tenantId}:`, cachePatterns);
      
      // TODO: Implement actual cache invalidation with your cache service
      // Example: await cacheService.invalidatePatterns(cachePatterns);
      
    } catch (error) {
      console.error('Error invalidating cache:', error);
      // Don't throw error for cache invalidation failures
    }
  }

  /**
   * Sync platform-controlled types (trending, bestseller, recommended, random_featured)
   * from mv_storefront_discovery into the featured_products table with assignment_source='system'.
   *
   * This unifies the query pattern — all badge types can be read from featured_products
   * instead of some being computed on-the-fly and others stored in the table.
   *
   * Should be called by a periodic job (e.g., every 6 hours).
   */
  static async syncPlatformTypes(
    tenantId: string,
    limit: number = 10
  ): Promise<{ synced: number; deactivated: number }> {
    let synced = 0;
    let deactivated = 0;

    try {
      const platformTypes = [
        { type: 'trending' as const, generator: generateTrendingProducts },
        { type: 'bestseller' as const, generator: generateBestsellerProducts },
        { type: 'recommended' as const, generator: generateRecommendedProducts },
        { type: 'random_featured' as const, generator: generateRandomDiscoveryProducts },
      ];

      for (const { type, generator } of platformTypes) {
        const products = await generator(tenantId, limit);

        // Deactivate existing system-assigned badges of this type that are no longer in the new set
        const newItemIds = new Set(products.map(p => p.inventory_item_id));
        const existing = await prisma.featured_products.findMany({
          where: {
            tenant_id: tenantId,
            featured_type: type,
            is_active: true,
            assignment_source: 'system',
          },
          select: { id: true, inventory_item_id: true },
        });

        const toDeactivate = existing.filter(e => !newItemIds.has(e.inventory_item_id));
        if (toDeactivate.length > 0) {
          await prisma.featured_products.updateMany({
            where: { id: { in: toDeactivate.map(e => e.id) } },
            data: { is_active: false },
          });
          deactivated += toDeactivate.length;
        }

        // Upsert new system-assigned badges
        for (const product of products) {
          await prisma.featured_products.upsert({
            where: {
              inventory_item_id_featured_type: {
                inventory_item_id: product.inventory_item_id,
                featured_type: type,
              },
            },
            update: {
              featured_priority: product.featured_priority,
              is_active: true,
              assignment_source: 'system',
              rule_evaluated_at: new Date(),
            },
            create: {
              inventory_item_id: product.inventory_item_id,
              tenant_id: tenantId,
              featured_type: type,
              featured_priority: product.featured_priority,
              featured_at: new Date(),
              auto_unfeature: false,
              is_active: true,
              assignment_source: 'system',
              rule_evaluated_at: new Date(),
            },
          });
          synced++;
        }
      }

      console.log(`[syncPlatformTypes] Tenant ${tenantId}: synced=${synced}, deactivated=${deactivated}`);
    } catch (error) {
      console.error('[syncPlatformTypes] Error:', error);
    }

    return { synced, deactivated };
  }
}
