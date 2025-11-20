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
  tenant_id: string,
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

    // Fetch categories with counts using a single efficient query
    const categories = await prisma.tenant_category.findMany({
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
        _count: {
          select: {
            _count: {
              where: itemWhere,
            },
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    // Transform to CategoryCount format
    return categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      googleCategoryId: cat.googleCategoryId,
      count: cat._count.inventory_item,
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
  tenant_id: string,
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

    return await prisma.inventory_item.count({ where });
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
  tenant_id: string,
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

    return await prisma.inventory_item.count({ where });
  } catch (error) {
    console.error('[Total Product Count] Error:', error);
    return 0;
  }
}
