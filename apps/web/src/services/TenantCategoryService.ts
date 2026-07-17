import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

/**
 * Tenant category interface
 */
export interface TenantCategory {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  sortOrder: number;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Category analytics interface
 */
export interface CategoryAnalytics {
  categoryId: string;
  name: string;
  productCount: number;
  viewCount: number;
  conversionRate: number;
  revenue: number;
  topProducts: Array<{
    id: string;
    name: string;
    views: number;
    sales: number;
  }>;
}

/**
 * Service for managing tenant categories
 * Handles tenant category CRUD operations and analytics
 */
export class TenantCategoryService extends TenantApiSingleton {
  private static instance: TenantCategoryService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-category-service*',
      'category-analytics*',
      'category-performance*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-category-service*');
    await this.invalidateCachePattern('category-analytics*');
    await this.invalidateCachePattern('category-performance*');
  }

  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      ttl: 10 * 60 * 1000, // 10 minutes cache for categories
      ...cacheOptions
    });
  }

  static getInstance(): TenantCategoryService {
    if (!TenantCategoryService.instance) {
      TenantCategoryService.instance = new TenantCategoryService('tenant-category-service');
    }
    return TenantCategoryService.instance;
  }

  /**
   * Get tenant category by ID
   */
  async getTenantCategory(tenantId: string, categoryId: string): Promise<any> {
    if (!tenantId || !categoryId) {
      throw new Error('Tenant ID and Category ID are required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/v1/tenants/${tenantId}/categories/${categoryId}`,
      {},
      `platform-tenant-category-${tenantId}-${categoryId}`,
      this.cacheTTL
    );

    if (!result.success) {
      clientLogger.error('[TenantCategoryService] Failed to get tenant category:', { detail: result.error });
      throw result.error;
    }

    return result.data;
  }

  /**
   * Update tenant category
   */
  async updateTenantCategory(tenantId: string, categoryId: string, categoryData: any): Promise<any> {
    if (!tenantId || !categoryId) {
      throw new Error('Tenant ID and Category ID are required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/v1/tenants/${tenantId}/categories/${categoryId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(categoryData)
      },
      `platform-update-tenant-category-${tenantId}-${categoryId}`
    );

    if (!result.success) {
      clientLogger.error('[TenantCategoryService] Failed to update tenant category:', { detail: result.error });
      throw result.error;
    }

    // Invalidate categories complete cache for this tenant
    await this.invalidateCache(`platform-categories-complete-${tenantId}*`);
    
    return result.data;
  }

  /**
   * Delete tenant category
   */
  async deleteTenantCategory(tenantId: string, categoryId: string): Promise<any> {
    if (!tenantId || !categoryId) {
      throw new Error('Tenant ID and Category ID are required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/v1/tenants/${tenantId}/categories/${categoryId}`,
      {
        method: 'DELETE'
      },
      `platform-delete-tenant-category-${tenantId}-${categoryId}`
    );

    if (!result.success) {
      clientLogger.error('[TenantCategoryService] Failed to delete tenant category:', { detail: result.error });
      throw result.error;
    }

    // Invalidate categories complete cache for this tenant
    await this.invalidateCache(`platform-categories-complete-${tenantId}*`);
    
    return result.data;
  }

  /**
   * Create tenant category
   */
  async createTenantCategory(tenantId: string, categoryData: any): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/v1/tenants/${tenantId}/categories`,
      {
        method: 'POST',
        body: JSON.stringify(categoryData)
      },
      `platform-create-tenant-category-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[TenantCategoryService] Failed to create tenant category:', { detail: result.error });
      throw result.error;
    }

    // Invalidate categories complete cache for this tenant
    await this.invalidateCache(`platform-categories-complete-${tenantId}*`);
    
    return result.data;
  }

  /**
   * Get all categories for a tenant
   */
  async getTenantCategories(tenantId: string): Promise<any[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any[]>(
      `/api/v1/tenants/${tenantId}/categories`,
      {},
      `platform-tenant-categories-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      clientLogger.error('[TenantCategoryService] Failed to get tenant categories:', { detail: result.error });
      return [];
    }

    return result.data || [];
  }

  /**
   * Reorder tenant categories
   */
  async reorderTenantCategories(tenantId: string, categoryOrders: { categoryId: string; sortOrder: number }[]): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/v1/tenants/${tenantId}/categories/reorder`,
      {
        method: 'PATCH',
        body: JSON.stringify({ categoryOrders })
      },
      `platform-reorder-tenant-categories-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[TenantCategoryService] Failed to reorder tenant categories:', { detail: result.error });
      throw result.error;
    }

    // Invalidate categories cache for this tenant
    await this.invalidateCache(`platform-tenant-categories-${tenantId}*`);
    await this.invalidateCache(`platform-categories-complete-${tenantId}*`);
  }

  /**
   * Bulk import tenant categories
   */
  async bulkImportTenantCategories(tenantId: string, categories: any[]): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/v1/tenants/${tenantId}/categories/bulk-import`,
      {
        method: 'POST',
        body: JSON.stringify({ categories })
      },
      `platform-bulk-import-tenant-categories-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[TenantCategoryService] Failed to bulk import tenant categories:', { detail: result.error });
      throw result.error;
    }

    // Invalidate categories cache for this tenant
    await this.invalidateCache(`platform-tenant-categories-${tenantId}*`);
    await this.invalidateCache(`platform-categories-complete-${tenantId}*`);

    return result.data;
  }

  /**
   * Get tenant category analytics
   */
  async getTenantCategoryAnalytics(tenantId: string, categoryId?: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const url = categoryId 
      ? `/api/v1/tenants/${tenantId}/categories/${categoryId}/analytics`
      : `/api/v1/tenants/${tenantId}/categories/analytics`;

    const result = await this.makeDefaultRequest<any>(
      url,
      {},
      `platform-tenant-category-analytics-${tenantId}-${categoryId || 'all'}`,
      this.cacheTTL
    );

    if (!result.success) {
      clientLogger.error('[TenantCategoryService] Failed to get tenant category analytics:', { detail: result.error });
      return null;
    }

    return result.data;
  }

  /**
   * Archive tenant category
   */
  async archiveTenantCategory(tenantId: string, categoryId: string): Promise<any> {
    if (!tenantId || !categoryId) {
      throw new Error('Tenant ID and Category ID are required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/v1/tenants/${tenantId}/categories/${categoryId}/archive`,
      { method: 'POST' },
      `platform-archive-tenant-category-${tenantId}-${categoryId}`
    );

    if (!result.success) {
      clientLogger.error('[TenantCategoryService] Failed to archive tenant category:', { detail: result.error });
      throw result.error;
    }

    // Invalidate categories cache for this tenant
    await this.invalidateCache(`platform-tenant-categories-${tenantId}*`);
    await this.invalidateCache(`platform-categories-complete-${tenantId}*`);

    return result.data;
  }

  /**
   * Restore archived tenant category
   */
  async restoreTenantCategory(tenantId: string, categoryId: string): Promise<any> {
    if (!tenantId || !categoryId) {
      throw new Error('Tenant ID and Category ID are required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/v1/tenants/${tenantId}/categories/${categoryId}/restore`,
      { method: 'POST' },
      `platform-restore-tenant-category-${tenantId}-${categoryId}`
    );

    if (!result.success) {
      clientLogger.error('[TenantCategoryService] Failed to restore tenant category:', { detail: result.error });
      throw result.error;
    }

    // Invalidate categories cache for this tenant
    await this.invalidateCache(`platform-tenant-categories-${tenantId}*`);
    await this.invalidateCache(`platform-categories-complete-${tenantId}*`);

    return result.data;
  }
}

// Export singleton instance
export const tenantCategoryService = TenantCategoryService.getInstance();
