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
    const featuredProducts = await prisma.$queryRaw<FeaturedProductWithDetails[]>`
      SELECT 
        fp.id,
        fp.inventory_item_id,
        fp.tenant_id,
        fp.featured_type,
        fp.featured_priority,
        fp.featured_at,
        fp.featured_expires_at,
        fp.auto_unfeature,
        fp.is_active,
        CASE 
          WHEN fp.featured_expires_at IS NOT NULL THEN
            EXTRACT(DAY FROM fp.featured_expires_at - CURRENT_DATE)
          ELSE NULL
        END as days_until_expiration,
        CASE 
          WHEN fp.featured_expires_at IS NOT NULL AND fp.featured_expires_at <= CURRENT_DATE THEN TRUE
          ELSE FALSE 
        END as is_expired,
        CASE 
          WHEN fp.featured_expires_at IS NOT NULL 
          AND fp.featured_expires_at > CURRENT_DATE 
          AND fp.featured_expires_at <= (CURRENT_DATE + INTERVAL '3 days') THEN TRUE
          ELSE FALSE 
        END as is_expiring_soon
      FROM featured_products fp
      WHERE fp.inventory_item_id = ${inventoryItemId}
        AND fp.is_active = true
      ORDER BY fp.featured_priority DESC
    `;

    return featuredProducts;
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
    let whereConditions = [`fp.tenant_id = '${tenantId}'`];
    
    if (options?.featured_type) {
      whereConditions.push(`fp.featured_type = '${options.featured_type}'`);
    }
    
    if (options?.is_active !== undefined) {
      whereConditions.push(`fp.is_active = ${options.is_active}`);
    }

    let limitClause = '';
    if (options?.limit) {
      limitClause = ` LIMIT ${options.limit}`;
      if (options?.offset) {
        limitClause += ` OFFSET ${options.offset}`;
      }
    }

    const featuredProducts = await prisma.$queryRaw<FeaturedProductWithDetails[]>`
      SELECT 
        fp.id,
        fp.inventory_item_id,
        fp.tenant_id,
        fp.featured_type,
        fp.featured_priority,
        fp.featured_at,
        fp.featured_expires_at,
        fp.auto_unfeature,
        fp.is_active,
        CASE 
          WHEN fp.featured_expires_at IS NOT NULL THEN
            EXTRACT(DAY FROM fp.featured_expires_at - CURRENT_DATE)
          ELSE NULL
        END as days_until_expiration,
        CASE 
          WHEN fp.featured_expires_at IS NOT NULL AND fp.featured_expires_at <= CURRENT_DATE THEN TRUE
          ELSE FALSE 
        END as is_expired,
        CASE 
          WHEN fp.featured_expires_at IS NOT NULL 
          AND fp.featured_expires_at > CURRENT_DATE 
          AND fp.featured_expires_at <= (CURRENT_DATE + INTERVAL '3 days') THEN TRUE
          ELSE FALSE 
        END as is_expiring_soon
      FROM featured_products fp
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY fp.featured_priority DESC, fp.featured_at DESC
      ${limitClause}
    `;

    return featuredProducts;
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
    const featuredProduct = await prisma.$queryRaw<FeaturedProduct[]>`
      INSERT INTO featured_products (
        inventory_item_id,
        tenant_id,
        featured_type,
        featured_priority,
        featured_at,
        featured_expires_at,
        auto_unfeature,
        is_active
      ) VALUES (
        ${inventoryItemId},
        ${tenantId},
        ${featuredType},
        ${options?.featured_priority || 50},
        NOW(),
        ${options?.featured_expires_at || null},
        ${options?.auto_unfeature !== undefined ? options.auto_unfeature : true},
        true
      )
      RETURNING *
    `;

    return featuredProduct[0];
  }

  /**
   * Remove a featured type from an item
   */
  static async removeFeaturedType(
    inventoryItemId: string,
    featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick'
  ): Promise<boolean> {
    const result = await prisma.$queryRaw`
      DELETE FROM featured_products 
      WHERE inventory_item_id = ${inventoryItemId}
        AND featured_type = ${featuredType}
    `;

    return Array.isArray(result) && result.length > 0;
  }

  /**
   * Update featured type expiration
   */
  static async updateFeaturedTypeExpiration(
    inventoryItemId: string,
    featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick',
    featured_expires_at: Date | string | null,
    auto_unfeature?: boolean
  ): Promise<FeaturedProduct | null> {
    const featuredProducts = await prisma.$queryRaw<FeaturedProduct[]>`
      UPDATE featured_products 
      SET 
        featured_expires_at = ${featured_expires_at},
        auto_unfeature = ${auto_unfeature !== undefined ? auto_unfeature : auto_unfeature}
      WHERE inventory_item_id = ${inventoryItemId}
        AND featured_type = ${featuredType}
      RETURNING *
    `;

    return featuredProducts.length > 0 ? featuredProducts[0] : null;
  }

  /**
   * Get featured products grouped by type for storefront display
   */
  static async getStorefrontFeaturedProducts(
    tenantId: string,
    limit: number = 10
  ): Promise<{ [key: string]: FeaturedProductWithDetails[] }> {
    const featuredProducts = await this.getFeaturedProductsForTenant(tenantId, {
      is_active: true,
      limit: limit * 5 // Get more to account for filtering
    });

    // Group by featured_type
    const grouped: { [key: string]: FeaturedProductWithDetails[] } = {
      store_selection: [],
      new_arrival: [],
      seasonal: [],
      sale: [],
      staff_pick: []
    };

    featuredProducts.forEach(fp => {
      if (grouped[fp.featured_type]) {
        // Only include non-expired products
        if (!fp.is_expired) {
          grouped[fp.featured_type].push(fp);
        }
      }
    });

    // Limit each group
    Object.keys(grouped).forEach(key => {
      grouped[key] = grouped[key].slice(0, limit);
    });

    return grouped;
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

    // Build the VALUES clause for bulk insert
    const valuesClause = items.map(item => 
      `('${item.inventory_item_id}', '${item.tenant_id}', '${item.featured_type}', ${item.featured_priority || 50}, NOW(), ${item.featured_expires_at ? `'${item.featured_expires_at}'` : 'NULL'}, ${item.auto_unfeature !== undefined ? item.auto_unfeature : true}, true)`
    ).join(', ');

    const featuredProducts = await prisma.$queryRaw<FeaturedProduct[]>`
      INSERT INTO featured_products (
        inventory_item_id,
        tenant_id,
        featured_type,
        featured_priority,
        featured_at,
        featured_expires_at,
        auto_unfeature,
        is_active
      ) VALUES ${valuesClause}
      RETURNING *
    `;

    return featuredProducts;
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
