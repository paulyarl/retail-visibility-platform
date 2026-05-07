import { prisma } from '../prisma';

export interface CategoryCount {
  id: string;
  name: string;
  slug: string;
  count: number;
  google_category_id: string | null;
  sort_order?: number;
  // Additional fields from materialized view
  products_with_images?: number;
  products_with_descriptions?: number;
  avg_price_cents?: number;
  min_price_cents?: number;
  max_price_cents?: number;
  last_product_updated?: Date;
  // NEW: 3-category system fields
  category_type?: 'tenant' | 'gbp_primary' | 'gbp_secondary' | 'platform';
  is_primary?: boolean;
  tenant_id?: string;
  tenant_name?: string;
}

/**
 * Get category counts for a tenant using materialized view for instant performance
 * Returns data from storefront_category_counts materialized view (10-30x faster)
 * 
 * @param tenantId - The tenant ID
 * @param includeAll - If true, count all items regardless of status/visibility (not used with MV)
 * @returns Array of categories with product counts
 */
export async function getCategoryCounts(
  tenantId: string,
  includeAll: boolean = false,
  categoryType?: 'tenant' | 'gbp_primary' | 'gbp_secondary' | 'platform'
): Promise<CategoryCount[]> {
  try {
    // Use direct SQL query instead of Prisma $queryRaw to avoid transformation issues
    const { getDirectPool } = await import('./db-pool');
    const pool = getDirectPool();
    
    // Build WHERE clause with optional category type filtering
    let whereClause = 'WHERE tenant_id = $1 AND product_count > 0';
    let params: any[] = [tenantId];
    
    if (categoryType) {
      whereClause += ' AND category_type = $2';
      params.push(categoryType);
    }
    
    const query = `
      SELECT 
        category_id,
        category_name, 
        category_slug,
        category_level,
        category_parent_id,
        product_count,
        products_with_images,
        products_with_descriptions,
        products_with_brand,
        products_with_price,
        in_stock_products,
        avg_price_cents,
        min_price_cents, 
        max_price_cents,
        last_product_updated,
        first_product_created,
        calculated_at,
        tenant_id,
        tenant_name
      FROM storefront_category_counts
      ${whereClause}
      ORDER BY category_level ASC, category_name ASC
    `;
    
    const result = await pool.query(query, params);
    
    // Transform to snake_case only (what frontend expects)
    const transformedRows = result.rows.map(row => ({
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
      level: row.category_level,
      parent_id: row.category_parent_id,
      google_category_id: null, // MV doesn't have this field, set to null
      count: row.product_count,
      products_with_images: row.products_with_images,
      products_with_descriptions: row.products_with_descriptions,
      products_with_brand: row.products_with_brand,
      products_with_price: row.products_with_price,
      in_stock_products: row.in_stock_products,
      avg_price_cents: row.avg_price_cents,
      min_price_cents: row.min_price_cents,
      max_price_cents: row.max_price_cents,
      last_product_updated: row.last_product_updated,
      first_product_created: row.first_product_created,
      calculated_at: row.calculated_at,
      tenant_id: row.tenant_id,
      tenant_name: row.tenant_name
    }));
    
    console.log(`[Category Counts] Retrieved ${result.rows.length} categories from materialized view for tenant ${tenantId}${categoryType ? ` (type: ${categoryType})` : ''}`);
    return transformedRows;
  } catch (error) {
    console.error('[Category Counts] Error reading from materialized view:', error);
    // Return empty array since MV is the primary method and fallback has TypeScript issues
    return [];
  }
}

/**
 * Get count of uncategorized items for a tenant
 * 
 * @param tenantId - The tenant ID
 * @param includeAll - If true, count all items regardless of status/visibility
 * @returns Count of items without a category
 */
export async function getUncategorizedCount(
  tenantId: string,
  includeAll: boolean = false
): Promise<number> {
  try {
    const where: any = {
      tenant_id: tenantId,
      directory_category_id: null,
    };

    if (!includeAll) {
      where.item_status = 'active';
      where.visibility = 'public';
    }

    return await prisma.inventory_items.count({ where });
  } catch (error) {
    console.error('[Uncategorized Count] Error:', error);
    return 0;
  }
}

/**
 * Get total product count for a tenant
 * 
 * @param tenantId - The tenant ID
 * @param includeAll - If true, count all items regardless of status/visibility
 * @returns Total count of items
 */
export async function getTotalProductCount(
  tenantId: string,
  includeAll: boolean = false
): Promise<number> {
  try {
    const where: any = {
      tenant_id: tenantId,
    };

    if (!includeAll) {
      where.item_status = 'active';
      where.visibility = 'public';
    }

    return await prisma.inventory_items.count({ where });
  } catch (error) {
    console.error('[Total Product Count] Error:', error);
    return 0;
  }
}
