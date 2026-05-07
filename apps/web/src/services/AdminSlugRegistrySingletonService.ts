/**
 * Admin Slug Registry Singleton Service
 * 
 * Extends AdminApiSingleton to provide cached admin slug registry operations
 * Manages product slug registry entries with parsing, comparison, and migration tools
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface SlugRegistryEntry {
  id: string;
  product_slug: string;
  universal_sku: string | null;
  slug_hash: string | null;
  tenant_id: string;
  original_sku: string | null;
  slug_type: 'upc' | 'lpc' | null;
  slug_prefix: 'upc' | 'lpc' | null;
  brand_normalized: string | null;
  category_normalized: string | null;
  format_version: string | null;
  migration_status: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SlugComponents {
  type: 'upc' | 'lpc';
  sku: string | null;
  brand: string | null;
  category: string;
  identifier: string | null;
  name_hash: string;
}

export interface ProductComparison {
  exact_match: boolean;
  category_match: boolean;
  type_match: boolean;
  similarity_score: number;
  match_type: string;
}

export interface SlugRegistryFilters {
  slugType?: 'upc' | 'lpc';
  formatVersion?: 'v1' | 'v2';
  migrationStatus?: string;
  isActive?: boolean;
  brand?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SlugRegistryStats {
  total: number;
  upcCount: number;
  lpcCount: number;
  v2Count: number;
  activeCount: number;
  migratedCount: number;
  pendingMigrationCount: number;
}

class AdminSlugRegistrySingletonService extends AdminApiSingleton {
  private static instance: AdminSlugRegistrySingletonService;

  private constructor() {
    super('admin-slug-registry-singleton');
  }

  public static getInstance(): AdminSlugRegistrySingletonService {
    if (!AdminSlugRegistrySingletonService.instance) {
      AdminSlugRegistrySingletonService.instance = new AdminSlugRegistrySingletonService();
    }
    return AdminSlugRegistrySingletonService.instance;
  }

  /**
   * Get all slug registry entries with filters
   */
  async getSlugRegistryEntries(filters: SlugRegistryFilters = {}): Promise<{
    entries: SlugRegistryEntry[];
    total: number;
    hasMore: boolean;
  } | null> {
    const params = new URLSearchParams();
    
    if (filters.slugType) params.set('slugType', filters.slugType);
    if (filters.formatVersion) params.set('formatVersion', filters.formatVersion);
    if (filters.migrationStatus) params.set('migrationStatus', filters.migrationStatus);
    if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive));
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));

    const result = await this.makeDefaultRequest<{
      data: SlugRegistryEntry[];
      total: number;
    }>(
      `/api/admin/slug-registry?${params.toString()}`,
      {},
      `admin-slug-registry:${JSON.stringify(filters)}`
    );

    if (!result.success) {
      console.error('[AdminSlugRegistry] Failed to get entries:', result.error);
      return null;
    }

    const response = result.data;
    if (!response) {
      return null;
    }

    return {
      entries: response.data,
      total: response.total,
      hasMore: (filters.page || 1) * (filters.limit || 50) < response.total
    };
  }

  /**
   * Get a single slug registry entry by ID or slug
   */
  async getSlugRegistryEntry(identifier: string): Promise<SlugRegistryEntry | null> {
    const result = await this.makeDefaultRequest<SlugRegistryEntry>(
      `/api/admin/slug-registry/${encodeURIComponent(identifier)}`,
      {},
      `admin-slug-registry-entry:${identifier}`
    );

    if (!result.success) {
      console.error('[AdminSlugRegistry] Failed to get entry:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Parse a slug into its components
   */
  async parseSlug(slug: string): Promise<SlugComponents | null> {
    const result = await this.makeDefaultRequest<SlugComponents>(
      `/api/catalog/slugs/${encodeURIComponent(slug)}/parse`,
      {},
      `admin-slug-parse:${slug}`
    );

    if (!result.success) {
      console.error('[AdminSlugRegistry] Failed to parse slug:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Compare two products by slug or registry ID
   */
  async compareProducts(params: {
    slug1?: string;
    slug2?: string;
    registryId1?: string;
    registryId2?: string;
  }): Promise<ProductComparison | null> {
    const result = await this.makeDefaultRequest<ProductComparison>(
      '/api/catalog/slugs/compare',
      {
        method: 'POST',
        body: JSON.stringify(params)
      },
      `admin-slug-compare:${params.slug1 || params.registryId1}:${params.slug2 || params.registryId2}`
    );

    if (!result.success) {
      console.error('[AdminSlugRegistry] Failed to compare products:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Regenerate a slug for a registry entry
   */
  async regenerateSlug(registryId: string): Promise<SlugRegistryEntry | null> {
    const result = await this.makeDefaultRequest<SlugRegistryEntry>(
      `/api/admin/slug-registry/${registryId}/regenerate`,
      {
        method: 'POST'
      },
      `admin-slug-regenerate:${registryId}`
    );

    if (!result.success) {
      console.error('[AdminSlugRegistry] Failed to regenerate slug:', result.error);
      return null;
    }

    // Invalidate cache after mutation
    await this.invalidateSlugRegistryCache();

    return result.data || null;
  }

  /**
   * Update a slug registry entry
   */
  async updateSlugRegistryEntry(registryId: string, data: Partial<SlugRegistryEntry>): Promise<SlugRegistryEntry | null> {
    const result = await this.makeDefaultRequest<SlugRegistryEntry>(
      `/api/admin/slug-registry/${registryId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data)
      },
      `admin-slug-update:${registryId}`
    );

    if (!result.success) {
      console.error('[AdminSlugRegistry] Failed to update entry:', result.error);
      return null;
    }

    // Invalidate cache after mutation
    await this.invalidateSlugRegistryCache();

    return result.data || null;
  }

  /**
   * Bulk migrate slugs to v2 format
   */
  async bulkMigrateSlugs(entryIds: string[]): Promise<{
    success: number;
    failed: number;
    results: Array<{ id: string; status: 'success' | 'failed'; error?: string }>;
  } | null> {
    const cachekey = `admin-slug-bulk-migrate:${entryIds.join(',')}`;
    const result = await this.makeDefaultRequest<{
      success: number;
      failed: number;
      results: Array<{ id: string; status: 'success' | 'failed'; error?: string }>;
    }>(
      '/api/admin/slug-registry/bulk-migrate',
      {
        method: 'POST',
        body: JSON.stringify({ entryIds })
      },
      cachekey
    );

    if (!result.success) {
      console.error('[AdminSlugRegistry] Failed to bulk migrate:', result.error);
      return null;
    }

    // Invalidate cache after mutation
    await this.invalidateSlugRegistryCache();

    return result.data || null;
  }

  /**
   * Get slug registry statistics
   */
  async getSlugRegistryStats(): Promise<SlugRegistryStats | null> {
    const cachekey = `admin-slug-registry-stats`;
    const result = await this.makeDefaultRequest<SlugRegistryStats>(
      '/api/admin/slug-registry/stats',
      {},
      cachekey
    );

    if (!result.success) {
      console.error('[AdminSlugRegistry] Failed to get stats:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Soft delete (deactivate) a slug registry entry
   */
  async deactivateSlug(registryId: string): Promise<boolean> {
    const cachekey = `admin-slug-deactivate:${registryId}`;
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/admin/slug-registry/${registryId}/deactivate`,
      {
        method: 'POST'
      },
      cachekey
    );

    if (!result.success) {
      console.error('[AdminSlugRegistry] Failed to deactivate slug:', result.error);
      return false;
    }

    await this.invalidateSlugRegistryCache();
    return true;
  }

  /**
   * Restore a deactivated slug registry entry
   */
  async activateSlug(registryId: string): Promise<boolean> {
    const cachekey = `admin-slug-activate:${registryId}`;
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/admin/slug-registry/${registryId}/activate`,
      {
        method: 'POST'
      },
      cachekey
    );

    if (!result.success) {
      console.error('[AdminSlugRegistry] Failed to activate slug:', result.error);
      return false;
    }

    await this.invalidateSlugRegistryCache();
    return true;
  }

  /**
   * Invalidate slug registry cache
   */
  public async invalidateSlugRegistryCache(): Promise<void> {
    await this.invalidateCache('admin-slug-registry*');
  }

  /**
   * Invalidate specific entry cache
   */
  public async invalidateEntryCache(identifier: string): Promise<void> {
    const cachekey = `admin-slug-registry-entry:${identifier}`;
    await this.invalidateCache(cachekey);
  }
}

// Export singleton instance
export const adminSlugRegistryService = AdminSlugRegistrySingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateSlugRegistryCache = async (): Promise<void> => {
  const service = AdminSlugRegistrySingletonService.getInstance();
  await service.invalidateSlugRegistryCache();
};
