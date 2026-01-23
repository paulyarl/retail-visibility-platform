import { prisma } from '../prisma';

export interface FeaturedProduct {
  id: string;
  inventory_item_id: string;
  tenant_id: string;
  featured_type: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
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
    featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick',
    options?: {
      featured_priority?: number;
      featured_expires_at?: Date | string | null;
      auto_unfeature?: boolean;
    }
  ): Promise<FeaturedProduct> {
    try {
      console.log(`[addFeaturedType] Adding product ${inventoryItemId} as ${featuredType} for tenant ${tenantId}`);
      
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
          is_active: true
        },
        create: {
          inventory_item_id: inventoryItemId,
          tenant_id: tenantId,
          featured_type: featuredType,
          featured_priority: options?.featured_priority || 50,
          featured_at: new Date(),
          featured_expires_at: options?.featured_expires_at ? new Date(options.featured_expires_at) : null,
          auto_unfeature: options?.auto_unfeature !== undefined ? options.auto_unfeature : true,
          is_active: true
        }
      });

      console.log(`[addFeaturedType] Successfully created/updated featured product:`, {
        id: featuredProduct.id,
        inventory_item_id: featuredProduct.inventory_item_id,
        tenant_id: featuredProduct.tenant_id,
        featured_type: featuredProduct.featured_type,
        is_active: featuredProduct.is_active
      });

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
    featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick'
  ): Promise<boolean> {
    try {
      console.log(`[FeaturedProductsService] Removing ${featuredType} from inventory_item_id: ${inventoryItemId}`);
      
      // First check if the featured product exists
      const existingFeatured = await prisma.featured_products.findFirst({
        where: {
          inventory_item_id: inventoryItemId,
          featured_type: featuredType
        }
      });

      if (!existingFeatured) {
        console.log(`[FeaturedProductsService] Featured product not found: inventory_item_id=${inventoryItemId}, featured_type=${featuredType}`);
        return false;
      }

      console.log(`[FeaturedProductsService] Found featured product to delete: ${existingFeatured.id}`);

      const result = await prisma.featured_products.deleteMany({
        where: {
          inventory_item_id: inventoryItemId,
          featured_type: featuredType
        }
      });

      console.log(`[FeaturedProductsService] Deleted ${result.count} featured products for inventory_item_id=${inventoryItemId}, featured_type=${featuredType}`);
      
      // Verify the deletion by checking the database immediately
      const remainingCount = await prisma.featured_products.count({
        where: {
          tenant_id: existingFeatured.tenant_id,
          featured_type: featuredType,
          is_active: true
        }
      });
      
      console.log(`[FeaturedProductsService] Verification: ${remainingCount} ${featuredType} products remaining for tenant ${existingFeatured.tenant_id}`);
      
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
    featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick',
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
    featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick',
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
        staff_pick: []
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
        staff_pick: []
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
      console.log(`[getStorefrontFeaturedProducts] Fetching for tenant: ${tenantId}`);
      
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

      console.log(`[getStorefrontFeaturedProducts] Found ${featuredProducts.length} featured products`);

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
        staff_pick: []
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

      // Limit each group
      Object.keys(grouped).forEach(key => {
        grouped[key] = grouped[key].slice(0, limit);
      });

      // Log the final counts
      Object.keys(grouped).forEach(key => {
        console.log(`[getStorefrontFeaturedProducts] ${key}: ${grouped[key].length} products`);
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
        staff_pick: []
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
      featured_type: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
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
          is_active: true
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
        staff_pick: Number(stat.staff_pick)
      },
      expiring_soon: Number(stat.expiring_soon),
      expired: Number(stat.expired)
    };
  }
}
