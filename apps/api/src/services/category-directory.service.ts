import { prisma } from '../prisma';

export interface CategoryWithStores {
  id: string;
  name: string;
  slug: string;
  googleCategoryId: string | null;
  storeCount: number;
  productCount: number;
}

export class CategoryDirectoryService {
  /**
   * Get all categories with store and product counts
   * Uses the materialized view for performance
   */
  async getCategoriesWithStores(
    location?: { lat: number; lng: number },
    radius?: number
  ): Promise<CategoryWithStores[]> {
    try {
      console.log('[CategoryService] Fetching categories using Prisma ORM...');
      
      // Use Prisma ORM to query TenantCategory with aggregations
      // This avoids the materialized view and raw SQL protocol issues
      const categories = await prisma.tenantCategory.findMany({
        where: {
          isActive: true,
          items: {
            some: {
              itemStatus: 'active',
              visibility: 'public',
              tenant: {
                googleSyncEnabled: true,
                directoryVisible: true,
                locationStatus: 'active',
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          googleCategoryId: true,
          _count: {
            select: {
              items: {
                where: {
                  itemStatus: 'active',
                  visibility: 'public',
                  tenant: {
                    googleSyncEnabled: true,
                    directoryVisible: true,
                    locationStatus: 'active',
                  },
                },
              },
            },
          },
          items: {
            where: {
              itemStatus: 'active',
              visibility: 'public',
              tenant: {
                googleSyncEnabled: true,
                directoryVisible: true,
                locationStatus: 'active',
              },
            },
            select: {
              tenantId: true,
            },
            distinct: ['tenantId'],
          },
        },
      });

      console.log(`[CategoryService] Found ${categories.length} categories`);

      return categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        googleCategoryId: cat.googleCategoryId,
        storeCount: cat.items.length, // Distinct tenant count
        productCount: cat._count.items,
      }));
    } catch (error) {
      console.error('[CategoryService] Error fetching categories:', error);
      // Return empty array on error - graceful degradation
      return [];
    }
  }
  
  async getStoresByCategory(
    categoryId: string,
    location?: { lat: number; lng: number },
    radius?: number
  ) {
    console.log('[CategoryService] getStoresByCategory called (stub)');
    return [];
  }
  
  async getCategoryHierarchy(categoryId?: string) {
    console.log('[CategoryService] getCategoryHierarchy called (stub)');
    return [];
  }
  
  async verifyStoreCategory(tenantId: string, categoryId: string) {
    console.log('[CategoryService] verifyStoreCategory called (stub)');
    return false;
  }
  
  async getCategoryPath(categoryId: string) {
    console.log('[CategoryService] getCategoryPath called (stub)');
    return [];
  }
}

export const categoryDirectoryService = new CategoryDirectoryService();
