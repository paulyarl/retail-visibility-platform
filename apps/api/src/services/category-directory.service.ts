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
      console.log('[CategoryService] Fetching categories from materialized view...');
      
      // Query the materialized view with timeout
      const query = `
        SELECT 
          category_id as id,
          category_name as name,
          category_slug as slug,
          google_category_id as "googleCategoryId",
          COUNT(DISTINCT tenant_id) as store_count,
          SUM(product_count)::int as product_count
        FROM directory_category_stores
        GROUP BY category_id, category_name, category_slug, google_category_id
        ORDER BY store_count DESC, product_count DESC
      `;
      
      const results = await Promise.race([
        prisma.$queryRawUnsafe<any[]>(query),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
      ]);

      console.log(`[CategoryService] Found ${results.length} categories`);

      return results.map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        googleCategoryId: row.googleCategoryId,
        storeCount: parseInt(row.store_count) || 0,
        productCount: parseInt(row.product_count) || 0,
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
