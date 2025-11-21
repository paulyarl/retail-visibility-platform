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
      const categories = await prisma.tenant_category.findMany({
        where: {
          isActive: true,
          _count: {
            some: {
              itemStatus: 'active',
              visibility: 'public',
              tenant: {
                googleSyncEnabled: true,
                directoryVisible: true,
                location_status: 'active',
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
              _count: {
                where: {
                  itemStatus: 'active',
                  visibility: 'public',
                  tenant: {
                    googleSyncEnabled: true,
                    directoryVisible: true,
                    location_status: 'active',
                  },
                },
              },
            },
          },
          _count: {
            where: {
              itemStatus: 'active',
              visibility: 'public',
              tenant: {
                googleSyncEnabled: true,
                directoryVisible: true,
                location_status: 'active',
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
        productCount: cat._count.inventory_item,
      }));
    } catch (error) {
      console.error('[CategoryService] Error fetching categories:', error);
      // Return empty array on error - graceful degradation
      return [];
    }
  }
  
  async getStoresByCategory(
    categorySlug: string,
    location?: { lat: number; lng: number },
    radius?: number
  ) {
    try {
      console.log(`[CategoryService] Fetching stores for category: ${categorySlug}`);
      
      // 1. Find category by slug
      const category = await prisma.tenant_category.findFirst({
        where: { 
          slug: categorySlug, 
          isActive: true 
        },
      });

      if (!category) {
        console.log(`[CategoryService] Category not found: ${categorySlug}`);
        return [];
      }
      
      // 2. Find tenants with products in this category
      const stores = await prisma.tenant.findMany({
        where: {
          googleSyncEnabled: true,
          directoryVisible: true,
          location_status: 'active',
          _count: {
            some: {
              tenantCategoryId: category.id,
              itemStatus: 'active',
              visibility: 'public',
            },
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          tenant_business_profile: {
            select: {
              business_name: true,
              addressLine1: true,
              city: true,
              state: true,
              postalCode: true,
              latitude: true,
              longitude: true,
            },
          },
          _count: {
            select: {
              _count: {
                where: {
                  tenantCategoryId: category.id,
                  itemStatus: 'active',
                  visibility: 'public',
                },
              },
            },
          },
        },
      });

      console.log(`[CategoryService] Found ${stores.length} stores`);

      return stores.map((store) => ({
        id: store.id,
        name: store.businessProfile?.businessName || store.name,
        slug: store.slug,
        address: store.businessProfile?.addressLine1,
        city: store.businessProfile?.city,
        state: store.businessProfile?.state,
        postalCode: store.businessProfile?.postalCode,
        latitude: store.businessProfile?.latitude,
        longitude: store.businessProfile?.longitude,
        productCount: store._count.inventory_item,
      }));
    } catch (error) {
      console.error('[CategoryService] Error fetching stores by category:', error);
      return [];
    }
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
    try {
      console.log(`[CategoryService] Building category path for: ${categoryId}`);
      
      const path: Array<{ id: string; name: string; slug: string; parentId: string | null }> = [];
      let currentId: string | null = categoryId;
      
      // Walk up the parent chain
      while (currentId) {
        const category = await prisma.tenant_category.findUnique({
          where: { id: currentId },
          select: {
            id: true,
            name: true,
            slug: true,
            parentId: true,
          },
        });
        
        if (!category) break;
        
        path.unshift(category); // Add to beginning for correct order
        currentId = category.parentId;
      }
      
      console.log(`[CategoryService] Built path with ${path.length} levels`);
      return path;
    } catch (error) {
      console.error('[CategoryService] Error building category path:', error);
      return [];
    }
  }
}

export const categoryDirectoryService = new CategoryDirectoryService();
