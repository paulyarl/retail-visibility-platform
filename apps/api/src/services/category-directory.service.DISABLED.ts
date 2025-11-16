// DISABLED: This service requires schema migration to be run first
// See: apps/api/MIGRATION_NEEDED.md
// 
// This file will be renamed back to category-directory.service.ts after migration

export class CategoryDirectoryService {
  async getCategoriesWithStores() {
    return [];
  }
  
  async getStoresByCategory() {
    return [];
  }
  
  async getCategoryHierarchy() {
    return [];
  }
  
  async verifyStoreCategory() {
    return false;
  }
  
  async getCategoryPath() {
    return [];
  }
}

export const categoryDirectoryService = new CategoryDirectoryService();
