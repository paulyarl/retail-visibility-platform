/**
 * Tenant Flags Service
 * 
 * Handles tenant feature flag and toggle management operations
 * Extends AdminApiSingleton for proper caching and context management
 * 
 * MIGRATION: Replaces direct fetch calls in:
 * - /src/components/admin/AdminTenantFlags.tsx
 * - /src/app/api/admin/tenant-flags/[tenantId]/route.ts
 * - /src/app/api/admin/tenant-flags/[tenantId]/[flag]/route.ts
 * - /src/app/api/admin/platform-flags/route.ts
 * - /src/app/api/admin/effective-flags/[tenantId]/route.ts
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface TenantFlag {
  id: string;
  tenantId: string;
  flag: string;
  value: boolean | string | number;
  type: 'BOOLEAN' | 'STRING' | 'NUMBER';
  description?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface PlatformFlag {
  id: string;
  flag: string;
  defaultValue: boolean | string | number;
  type: 'BOOLEAN' | 'STRING' | 'NUMBER';
  description?: string;
  category?: string;
  isGlobal: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface EffectiveFlag {
  flag: string;
  value: boolean | string | number;
  source: 'PLATFORM_DEFAULT' | 'TENANT_OVERRIDE' | 'EFFECTIVE_COMPUTED';
  platformDefault?: boolean | string | number;
  tenantOverride?: boolean | string | number;
  isOverridden: boolean;
  lastComputed?: string;
}

export interface CreateTenantFlagRequest {
  tenantId: string;
  flag: string;
  value: boolean | string | number;
  type: 'BOOLEAN' | 'STRING' | 'NUMBER';
  description?: string;
  category?: string;
}

export interface UpdateTenantFlagRequest {
  value?: boolean | string | number;
  description?: string;
  category?: string;
  isActive?: boolean;
}

export interface CreatePlatformFlagRequest {
  flag: string;
  defaultValue: boolean | string | number;
  type: 'BOOLEAN' | 'STRING' | 'NUMBER';
  description?: string;
  category?: string;
  isGlobal?: boolean;
}

export interface UpdatePlatformFlagRequest {
  defaultValue?: boolean | string | number;
  description?: string;
  category?: string;
  isGlobal?: boolean;
  isActive?: boolean;
}

export class TenantFlagsService extends AdminApiSingleton {
  private static instance: TenantFlagsService;

  private constructor() {
    super('TenantFlagsService');
  }

  static getInstance(): TenantFlagsService {
    if (!TenantFlagsService.instance) {
      TenantFlagsService.instance = new TenantFlagsService();
    }
    return TenantFlagsService.instance;
  }

  /**
   * PILOT: Declare cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-flags-*',
      'platform-flags-*',
      'effective-flags-*',
      'tenant-flag-*'
    ];
  }

  /**
   * PILOT: Implement cache invalidation contract
   */
  public async invalidateServiceCaches(tenantId?: string, flagName?: string, ...params: any[]): Promise<void> {
    if (tenantId) {
      await this.invalidateCache(`tenant-flags-${tenantId}`);
      await this.invalidateCache(`effective-flags-${tenantId}`);
      if (flagName) {
        await this.invalidateCache(`tenant-flag-${tenantId}-${flagName}`);
      }
    } else {
      await this.invalidateCache('tenant-flags-*');
      await this.invalidateCache('platform-flags-*');
      await this.invalidateCache('effective-flags-*');
      await this.invalidateCache('tenant-flag-*');
    }
  }

  /**
   * Get all flags for a specific tenant
   */
  async getTenantFlags(tenantId: string): Promise<TenantFlag[]> {
    const result = await this.makeDefaultRequest<TenantFlag[]>(
      `/api/admin/tenant-flags/${encodeURIComponent(tenantId)}`,
      {},
      `tenant-flags-${tenantId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get tenant flags: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get specific flag for tenant
   */
  async getTenantFlag(tenantId: string, flagName: string): Promise<TenantFlag | null> {
    const result = await this.makeDefaultRequest<TenantFlag>(
      `/api/admin/tenant-flags/${encodeURIComponent(tenantId)}/${encodeURIComponent(flagName)}`,
      {},
      `tenant-flag-${tenantId}-${flagName}`
    );
    
    if (!result.success) {
      console.log(`Failed to get tenant flag: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Create or update tenant flag
   */
  async upsertTenantFlag(tenantId: string, flagName: string, flagData: UpdateTenantFlagRequest): Promise<TenantFlag | null> {
    const result = await this.makeDefaultRequest<TenantFlag>(
      `/api/admin/tenant-flags/${encodeURIComponent(tenantId)}/${encodeURIComponent(flagName)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(flagData),
      },
      `tenant-flag-upsert-${tenantId}-${flagName}`
    );
    
    if (!result.success) {
      console.log(`Failed to upsert tenant flag: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after update
    await this.invalidateServiceCaches(tenantId, flagName);
    
    return result.data || null;
  }

  /**
   * Delete tenant flag
   */
  async deleteTenantFlag(tenantId: string, flagName: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/admin/tenant-flags/${encodeURIComponent(tenantId)}/${encodeURIComponent(flagName)}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `tenant-flag-delete-${tenantId}-${flagName}`
    );
    
    if (!result.success) {
      console.log(`Failed to delete tenant flag: ${result.error}`);
      return false;
    }
    
    // Invalidate cache after deletion
    await this.invalidateServiceCaches(tenantId, flagName);
    
    return result.data?.success || false;
  }

  /**
   * Get all platform flags
   */
  async getPlatformFlags(): Promise<PlatformFlag[]> {
    const result = await this.makeDefaultRequest<PlatformFlag[]>(
      '/api/admin/platform-flags',
      {},
      'platform-flags-all'
    );
    
    if (!result.success) {
      console.log(`Failed to get platform flags: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get effective flags for tenant (platform defaults + tenant overrides)
   */
  async getEffectiveFlags(tenantId: string): Promise<EffectiveFlag[]> {
    const result = await this.makeDefaultRequest<EffectiveFlag[]>(
      `/api/admin/effective-flags/${encodeURIComponent(tenantId)}`,
      {},
      `effective-flags-${tenantId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get effective flags: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get specific effective flag for tenant
   */
  async getEffectiveFlag(tenantId: string, flagName: string): Promise<EffectiveFlag | null> {
    const result = await this.makeDefaultRequest<EffectiveFlag>(
      `/api/admin/effective-flags/${encodeURIComponent(tenantId)}/${encodeURIComponent(flagName)}`,
      {},
      `effective-flag-${tenantId}-${flagName}`
    );
    
    if (!result.success) {
      console.log(`Failed to get effective flag: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Create platform flag
   */
  async createPlatformFlag(flag: CreatePlatformFlagRequest): Promise<PlatformFlag | null> {
    const result = await this.makeDefaultRequest<PlatformFlag>(
      '/api/admin/platform-flags',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(flag),
      },
      'platform-flags-create'
    );
    
    if (!result.success) {
      console.log(`Failed to create platform flag: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after creation
    await this.invalidateServiceCaches();
    
    return result.data || null;
  }

  /**
   * Update platform flag
   */
  async updatePlatformFlag(flagName: string, updates: UpdatePlatformFlagRequest): Promise<PlatformFlag | null> {
    const result = await this.makeDefaultRequest<PlatformFlag>(
      `/api/admin/platform-flags/${encodeURIComponent(flagName)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      },
      `platform-flag-update-${flagName}`
    );
    
    if (!result.success) {
      console.log(`Failed to update platform flag: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after update
    await this.invalidateServiceCaches();
    
    return result.data || null;
  }

  /**
   * Delete platform flag
   */
  async deletePlatformFlag(flagName: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/admin/platform-flags/${encodeURIComponent(flagName)}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `platform-flag-delete-${flagName}`
    );
    
    if (!result.success) {
      console.log(`Failed to delete platform flag: ${result.error}`);
      return false;
    }
    
    // Invalidate cache after deletion
    await this.invalidateServiceCaches();
    
    return result.data?.success || false;
  }

  /**
   * Bulk update tenant flags
   */
  async bulkUpdateTenantFlags(tenantId: string, flags: Array<{ flag: string; value: boolean | string | number }>): Promise<TenantFlag[]> {
    const result = await this.makeDefaultRequest<TenantFlag[]>(
      `/api/admin/tenant-flags/${encodeURIComponent(tenantId)}/bulk`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flags }),
      },
      `tenant-flags-bulk-${tenantId}`
    );
    
    if (!result.success) {
      console.log(`Failed to bulk update tenant flags: ${result.error}`);
      return [];
    }
    
    // Invalidate cache after bulk update
    await this.invalidateServiceCaches(tenantId);
    
    return result.data || [];
  }

  /**
   * Get flag categories
   */
  async getFlagCategories(): Promise<string[]> {
    const result = await this.makeDefaultRequest<string[]>(
      '/api/admin/platform-flags/categories',
      {},
      'platform-flag-categories'
    );
    
    if (!result.success) {
      console.log(`Failed to get flag categories: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get flags by category
   */
  async getFlagsByCategory(category: string): Promise<{
    platformFlags: PlatformFlag[];
    tenantFlags?: TenantFlag[];
  }> {
    const result = await this.makeDefaultRequest<{
      platformFlags: PlatformFlag[];
      tenantFlags?: TenantFlag[];
    }>(
      `/api/admin/platform-flags/category/${encodeURIComponent(category)}`,
      {},
      `platform-flags-category-${category}`
    );
    
    if (!result.success) {
      console.log(`Failed to get flags by category: ${result.error}`);
      return { platformFlags: [] };
    }
    
    return result.data || { platformFlags: [] };
  }

  /**
   * Check if tenant has specific flag enabled
   */
  async isTenantFlagEnabled(tenantId: string, flagName: string): Promise<boolean> {
    const effectiveFlag = await this.getEffectiveFlag(tenantId, flagName);
    
    if (!effectiveFlag) {
      return false;
    }
    
    // Handle different flag types
    if (typeof effectiveFlag.value === 'boolean') {
      return effectiveFlag.value;
    } else if (typeof effectiveFlag.value === 'string') {
      return effectiveFlag.value === 'true' || effectiveFlag.value === '1' || effectiveFlag.value === 'enabled';
    } else if (typeof effectiveFlag.value === 'number') {
      return effectiveFlag.value > 0;
    }
    
    return false;
  }

  /**
   * Get flag statistics
   */
  async getFlagStats(): Promise<{
    totalPlatformFlags: number;
    activePlatformFlags: number;
    totalTenantFlags: number;
    activeTenantFlags: number;
    flagUsageByCategory: Array<{
      category: string;
      count: number;
      tenantOverrides: number;
    }>;
  }> {
    const result = await this.makeDefaultRequest<{
      totalPlatformFlags: number;
      activePlatformFlags: number;
      totalTenantFlags: number;
      activeTenantFlags: number;
      flagUsageByCategory: Array<{
        category: string;
        count: number;
        tenantOverrides: number;
      }>;
    }>(
      '/api/admin/platform-flags/stats',
      {},
      'platform-flags-stats'
    );
    
    if (!result.success) {
      console.log(`Failed to get flag stats: ${result.error}`);
      return { 
        totalPlatformFlags: 0, 
        activePlatformFlags: 0, 
        totalTenantFlags: 0, 
        activeTenantFlags: 0, 
        flagUsageByCategory: [] 
      };
    }
    
    return result.data || { 
      totalPlatformFlags: 0, 
      activePlatformFlags: 0, 
      totalTenantFlags: 0, 
      activeTenantFlags: 0, 
      flagUsageByCategory: [] 
    };
  }
}

// Export singleton instance
export default TenantFlagsService.getInstance();
