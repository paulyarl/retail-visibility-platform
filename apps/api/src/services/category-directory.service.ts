/**
 * Category Directory Service - STUB VERSION
 * 
 * This is a temporary stub that returns empty data.
 * The full implementation requires database schema migration.
 * 
 * See: apps/api/MIGRATION_NEEDED.md for deployment instructions
 * 
 * After migration is complete, replace this file with the full implementation
 * from: apps/api/src/services/category-directory.service.DISABLED.ts
 */

export interface CategoryWithStores {
  id: string;
  name: string;
  slug: string;
  googleCategoryId: string | null;
  storeCount: number;
  productCount: number;
}

export interface StoreWithProducts {
  id: string;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  distance?: number;
  productCount: number;
  verified: boolean;
  lastSync: Date | null;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  googleCategoryId: string | null;
  parentId: string | null;
  children: CategoryNode[];
  storeCount: number;
  productCount: number;
}

export class CategoryDirectoryService {
  /**
   * STUB: Returns empty array until migration is complete
   */
  async getCategoriesWithStores(
    location?: { lat: number; lng: number },
    radius?: number
  ): Promise<CategoryWithStores[]> {
    console.warn('CategoryDirectoryService: Using stub implementation - migration required');
    return [];
  }

  /**
   * STUB: Returns empty array until migration is complete
   */
  async getStoresByCategory(
    categoryId: string,
    location?: { lat: number; lng: number },
    radius?: number
  ): Promise<StoreWithProducts[]> {
    console.warn('CategoryDirectoryService: Using stub implementation - migration required');
    return [];
  }

  /**
   * STUB: Returns empty array until migration is complete
   */
  async getCategoryHierarchy(categoryId?: string): Promise<CategoryNode[]> {
    console.warn('CategoryDirectoryService: Using stub implementation - migration required');
    return [];
  }

  /**
   * STUB: Returns false until migration is complete
   */
  async verifyStoreCategory(
    tenantId: string,
    categoryId: string
  ): Promise<boolean> {
    console.warn('CategoryDirectoryService: Using stub implementation - migration required');
    return false;
  }

  /**
   * STUB: Returns empty array until migration is complete
   */
  async getCategoryPath(categoryId: string): Promise<CategoryWithStores[]> {
    console.warn('CategoryDirectoryService: Using stub implementation - migration required');
    return [];
  }
}

export const categoryDirectoryService = new CategoryDirectoryService();
