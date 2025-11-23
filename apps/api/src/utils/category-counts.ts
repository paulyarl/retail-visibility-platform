import { prisma } from '../prisma';

export interface CategoryCount {
  id: string;
  name: string;
  slug: string;
  count: number;
  googleCategoryId: string | null;
}

/**
 * Get category counts for a tenant
 * Counts only active, public products by default
 * 
 * @param tenantId - The tenant ID
 * @param includeAll - If true, count all items regardless of status/visibility
 * @returns Array of categories with product counts
 */
export async function getCategoryCounts(
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
    const counts = await prisma.InventoryItem.groupBy({
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

    // Transform to CategoryCount format
    return categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      googleCategoryId: cat.googleCategoryId,
      count: countMap[cat.id] || 0,
    }));
  } catch (error) {
    console.error('[Category Counts] Error:', error);
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

    return await prisma.InventoryItem.count({ where });
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

    return await prisma.InventoryItem.count({ where });
  } catch (error) {
    console.error('[Total Product Count] Error:', error);
    return 0;
  }
}
