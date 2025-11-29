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
      
      // Get all active categories first
      const categories = await prisma.tenantCategory.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          googleCategoryId: true,
        },
      });

      // For each category, count items and distinct tenants
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category: any) => {
          // Count items in this category from published directory listings
          const itemCount = await prisma.inventoryItem.count({
            where: {
              tenantCategoryId: category.id,
              itemStatus: 'active',
              visibility: 'public',
              tenant: {
                locationStatus: 'active',
                directorySettings: {
                  isPublished: true,
                },
              },
            },
          });

          // Count distinct tenants with items in this category
          const tenantCount = await prisma.inventoryItem.findMany({
            where: {
              tenantCategoryId: category.id,
              itemStatus: 'active',
              visibility: 'public',
              tenant: {
                locationStatus: 'active',
                directorySettings: {
                  isPublished: true,
                },
              },
            },
            select: {
              tenantId: true,
            },
            distinct: ['tenantId'],
          });

          return {
            id: category.id,
            name: category.name,
            slug: category.slug,
            googleCategoryId: category.googleCategoryId,
            storeCount: tenantCount.length, // Distinct tenant count
            productCount: itemCount, // Total items count
          };
        })
      );

      console.log(`[CategoryService] Found ${categoriesWithCounts.length} categories`);

      // Deduplicate by category name to prevent duplicates in UI
      const uniqueCategories = categoriesWithCounts.reduce((acc: CategoryWithStores[], category) => {
        const existingIndex = acc.findIndex(c => c.name === category.name);
        if (existingIndex === -1) {
          acc.push(category);
        } else {
          // Combine counts if same category name exists
          acc[existingIndex].storeCount += category.storeCount;
          acc[existingIndex].productCount += category.productCount;
        }
        return acc;
      }, []);

      console.log(`[CategoryService] After deduplication: ${uniqueCategories.length} unique categories`);

      return uniqueCategories;
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
      const category = await prisma.tenantCategory.findFirst({
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
          locationStatus: 'active',
          inventoryItems: {
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
          tenantBusinessProfile: {
            select: {
              businessName: true,
              businessLine1: true,
              city: true,
              state: true,
              postalCode: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      });

      // Count products for each store and get GBP category
      const storesWithCounts = await Promise.all(
        stores.map(async (store: any) => {
          const productCount = await prisma.inventoryItem.count({
            where: {
              tenantId: store.id,
              tenantCategoryId: category.id,
              itemStatus: 'active',
              visibility: 'public',
            },
          });

          // Get tenant with metadata for GBP category
          const tenantWithMetadata = await prisma.tenant.findUnique({
            where: { id: store.id },
            select: { metadata: true },
          });

          const gbpPrimaryCategoryName = 
            (tenantWithMetadata?.metadata as any)?.gbp_categories?.primary?.name || null;

          return {
            id: store.id,
            name: store.tenantBusinessProfile?.businessName || store.name,
            businessName: store.tenantBusinessProfile?.businessName || store.name,
            slug: store.slug,
            address: store.tenantBusinessProfile?.businessLine1,
            city: store.tenantBusinessProfile?.city,
            state: store.tenantBusinessProfile?.state,
            postalCode: store.tenantBusinessProfile?.postalCode,
            latitude: store.tenantBusinessProfile?.latitude,
            longitude: store.tenantBusinessProfile?.longitude,
            productCount: productCount,
            gbpPrimaryCategoryName: gbpPrimaryCategoryName,
          };
        })
      );

      console.log(`[CategoryService] Found ${storesWithCounts.length} stores`);

      return storesWithCounts;
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
        const category: { id: string; name: string; slug: string; parentId: string | null } | null = await prisma.tenantCategory.findUnique({
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
