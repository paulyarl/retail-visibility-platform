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
      const categories = await prisma.directory_category.findMany({
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
          const itemCount = await prisma.inventory_items.count({
            where: {
              directory_category_id: category.id,
              item_status: 'active',
              visibility: 'public',
              tenants: {
                location_status: 'active',
                directory_settings_list : {
                  is_published: true,
                },
              },
            },
          });

          // Count distinct tenants with items in this category
          const tenantCount = await prisma.inventory_items.findMany({
            where: {
              directory_category_id: category.id,
              item_status: 'active',
              visibility: 'public',
              tenants : {
                location_status: 'active',
                directory_settings_list: {
                  is_published: true,
                },
              },
            },
            select: {
              tenant_id: true,
            },
            distinct: ['tenant_id'],
          });

          return {
            id: category.id,
            name: category.name,
            slug: category.slug,
            googleCategoryId: category.google_category_id,
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
      const category = await prisma.directory_category.findFirst({
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
      const stores = await prisma.tenants.findMany({
        where: {
          google_sync_enabled: true,
          directory_visible: true,
          location_status: 'active',
          inventory_items: {
            some: {
              directory_category_id: category.id,
              item_status: 'active',
              visibility: 'public',
            },
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          tenant_business_profiles_list: {
            select: {
              business_name: true,
              address_line1: true,
              city: true,
              state: true,
              postal_code: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      });

      // Count products for each store and get GBP category
      const storesWithCounts = await Promise.all(
        stores.map(async (store: any) => {
          const productCount = await prisma.inventory_items.count({
            where: {
              tenant_id: store.id,
              directory_category_id: category.id,
              item_status: 'active',
              visibility: 'public',
            },
          });

          // Get tenant with metadata for GBP category
          const tenantWithMetadata = await prisma.tenants.findUnique({
            where: { id: store.id },
            select: { metadata: true },
          });

          const gbpPrimaryCategoryName = 
            (tenantWithMetadata?.metadata as any)?.gbp_categories?.primary?.name || null;

          return {
            id: store.id,
            name: store.tenant_business_profiles_list?.businessName || store.name,
            businessName: store.tenant_business_profiles_list?.businessName || store.name,
            slug: store.slug,
            address: store.tenant_business_profiles_list?.businessLine1,
            city: store.tenant_business_profiles_list?.city,
            state: store.tenant_business_profiles_list?.state,
            postalCode: store.tenant_business_profiles_list?.postal_code,
            latitude: store.tenant_business_profiles_list?.latitude,
            longitude: store.tenant_business_profiles_list?.longitude,
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
      
      const path: Array<{ id: string; name: string; slug: string; parent_id: string | null }> = [];
      let currentId: string | null = categoryId;
      
      // Walk up the parent chain
      while (currentId) {
        const category: { id: string; name: string; slug: string; parentId: string | null } | null = await prisma.directory_category.findUnique({
          where: { id: currentId },
          select: {
            id: true,
            name: true,
            slug: true,
            parentId: true,
          },
        });
        
        // Map parentId to parent_id to match expected type
        const mappedCategory: { id: string; name: string; slug: string; parent_id: string | null } | null = category ? {
          id: category.id,
          name: category.name,
          slug: category.slug,
          parent_id: category.parentId
        } : null;
        
        if (!mappedCategory) break;
        
        path.unshift(mappedCategory); // Add to beginning for correct order
        currentId = mappedCategory.parent_id;
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
