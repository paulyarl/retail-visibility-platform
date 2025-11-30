import { prisma } from '../prisma';

export interface CategoryCount {
  id: string;
  name: string;
  slug: string;
  count: number;
  googleCategoryId: string | null;
  sortOrder?: number;
  // Additional fields from materialized view
  productsWithImages?: number;
  productsWithDescriptions?: number;
  avgPriceCents?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  lastProductUpdated?: Date;
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
  includeAll: boolean = false
): Promise<CategoryCount[]> {
  try {
    // Use materialized view for instant performance (10-30x faster than groupBy)
    // Note: includeAll parameter is ignored since MV only contains active/public items
    const categories = await prisma.$queryRaw<CategoryCount[]>`
      SELECT 
        category_id as "id",
        category_name as "name", 
        category_slug as "slug",
        google_category_id as "googleCategoryId",
        category_sort_order as "sortOrder",
        product_count as "count",
        products_with_images as "productsWithImages",
        products_with_descriptions as "productsWithDescriptions",
        avg_price_cents as "avgPriceCents",
        min_price_cents as "minPriceCents", 
        max_price_cents as "maxPriceCents",
        last_product_updated as "lastProductUpdated"
      FROM storefront_category_counts
      WHERE tenant_id = ${tenantId}
      AND product_count > 0
      ORDER BY category_sort_order ASC NULLS LAST, category_name ASC
    `;

    console.log(`[Category Counts] Retrieved ${categories.length} categories from materialized view for tenant ${tenantId}`);
    return categories;
  } catch (error) {
    console.error('[Category Counts] Error reading from materialized view:', error);
    
    // Fallback to original method if MV doesn't exist yet
    console.log('[Category Counts] Falling back to original method...');
    return getCategoryCountsLegacy(tenantId, includeAll);
  }
}

/**
 * Legacy method using groupBy (fallback if materialized view not available)
 * This is the original implementation for backward compatibility
 */
async function getCategoryCountsLegacy(
  tenantId: string,
  includeAll: boolean = false
): Promise<CategoryCount[]> {
  try {
    // Build the where clause for counting items
    const itemWhere: any = {
      tenantId,
    };

    // Only count active, public items unless includeAll is true
    if (!includeAll) {
      itemWhere.itemStatus = 'active';
      itemWhere.visibility = 'public';
    }

    // Fetch categories first
    const categories = await prisma.tenantCategory.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        googleCategoryId: true,
        sortOrder: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    // Get counts for each category
    const categoryIds = categories.map(cat => cat.id);
    const counts = await prisma.inventoryItem.groupBy({
      by: ['tenantCategoryId'],
      where: {
        tenantId,
        tenantCategoryId: { in: categoryIds },
        ...(!includeAll && {
          itemStatus: 'active',
          visibility: 'public',
        }),
      },
      _count: {
        id: true,
      },
    });

    // Create a map of category ID to count
    const countMap = counts.reduce((acc, count) => {
      acc[count.tenantCategoryId || 'uncategorized'] = count._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Transform to CategoryCount format and filter out categories with no products
    return categories
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        googleCategoryId: cat.googleCategoryId,
        sortOrder: cat.sortOrder,
        count: countMap[cat.id] || 0,
      }))
      .filter(cat => cat.count > 0); // Only show categories with products
  } catch (error) {
    console.error('[Category Counts] Legacy method error:', error);
    throw new Error('Failed to get category counts');
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
      tenantId,
      tenantCategoryId: null,
    };

    if (!includeAll) {
      where.itemStatus = 'active';
      where.visibility = 'public';
    }

    return await prisma.inventoryItem.count({ where });
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
      tenantId,
    };

    if (!includeAll) {
      where.itemStatus = 'active';
      where.visibility = 'public';
    }

    return await prisma.inventoryItem.count({ where });
  } catch (error) {
    console.error('[Total Product Count] Error:', error);
    return 0;
  }
}
