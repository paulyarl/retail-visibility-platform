/**
 * Admin Platform Flags Service
 *
 * Extends AdminApiSingleton to provide platform flag management operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 * Provides admin-level platform flag CRUD operations
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface PlatformFlag {
  id: string;
  flag: string;
  enabled: boolean;
  description?: string;
  rollout?: string;
  allowTenantOverride?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EffectiveFlag {
  flag: string;
  effectiveOn: boolean;
  effectiveSource: 'env' | 'override' | 'platform_db' | 'off';
  sources: {
    platform_env: boolean;
    platform_db: boolean;
    allow_override: boolean;
    platform_override?: boolean;
  };
}

export interface FlagUpdateRequest {
  enabled?: boolean;
  description?: string;
  rollout?: string;
  allowTenantOverride?: boolean;
}

export interface FlagOverrideRequest {
  value: boolean | null;
}

class AdminPlatformFlagsService extends AdminApiSingleton {
  private static instance: AdminPlatformFlagsService;
  private static readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes for flags
  protected cacheTTL: number = AdminPlatformFlagsService.CACHE_TTL;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'admin-platform-flags*',
      'admin-effective-flags*',
      'platform-flags*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(): Promise<void> {
    await this.invalidateCachePattern('admin-platform-flags*');
    await this.invalidateCachePattern('admin-effective-flags*');
    await this.invalidateCachePattern('platform-flags*');
  }

  protected constructor() {
    super('admin-platform-flags', {
      ttl: AdminPlatformFlagsService.CACHE_TTL
    });
  }

  public static getInstance(): AdminPlatformFlagsService {
    if (!AdminPlatformFlagsService.instance) {
      AdminPlatformFlagsService.instance = new AdminPlatformFlagsService();
    }
    return AdminPlatformFlagsService.instance;
  }

  /**
   * Get all platform flags with caching
   * Uses the /api/admin/platform-flags endpoint
   */
  async getPlatformFlags(): Promise<PlatformFlag[]> {
    try {
      const result = await this.makeDefaultRequest<PlatformFlag[]>(
        '/api/admin/platform-flags',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=600', // 10 minutes
            'X-Service-Worker': 'admin-flags-cache',
            'X-Platform-Cache': 'enabled'
          }
        },
        'admin-platform-flags-all',
        AdminPlatformFlagsService.CACHE_TTL
      );

      if (!result.success) {
        clientLogger.error('[AdminPlatformFlagsService] Failed to get platform flags:', { detail: result.error });
        return [];
      }

      const rawData: any = result.data;
      return Array.isArray(rawData) ? rawData : (rawData?.data || []);
    } catch (error) {
      clientLogger.error('[AdminPlatformFlagsService] Failed to get platform flags:', { detail: error });
      return [];
    }
  }

  /**
   * Get effective flags with caching
   * Uses the /api/admin/effective-flags endpoint
   */
  async getEffectiveFlags(): Promise<Record<string, EffectiveFlag>> {
    try {
      const result = await this.makeDefaultRequest<EffectiveFlag[]>(
        '/api/admin/effective-flags',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=600', // 10 minutes
            'X-Service-Admin': 'admin-flags-cache',
            'X-Platform-Cache': 'enabled'
          }
        },
        'admin-effective-flags-all',
        AdminPlatformFlagsService.CACHE_TTL
      );

      if (!result.success) {
        clientLogger.error('[AdminPlatformFlagsService] Failed to get effective flags:', { detail: result.error });
        return {};
      }

      const rawData: any = result.data;
      const arr: EffectiveFlag[] = Array.isArray(rawData) ? rawData : (rawData?.data || []);
      const record: Record<string, EffectiveFlag> = {};
      for (const f of arr) {
        record[f.flag] = f;
      }
      return record;
    } catch (error) {
      clientLogger.error('[AdminPlatformFlagsService] Failed to get effective flags:', { detail: error });
      return {};
    }
  }

  /**
   * Update a platform flag
   * Note: This will invalidate relevant cache entries
   */
  async updatePlatformFlag(flag: string, updateData: FlagUpdateRequest): Promise<PlatformFlag | null> {
    if (!flag) {
      clientLogger.error('[AdminPlatformFlagsService] Flag name is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<PlatformFlag>(
        `/api/admin/platform-flags/${encodeURIComponent(flag)}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData)
        },
        `admin-update-flag-${flag}`,
        0 // No cache for update operations
      );

      if (!result.success) {
        clientLogger.error('[AdminPlatformFlagsService] Failed to update platform flag:', { detail: result.error });
        return null;
      }

      // Invalidate relevant caches after update
      await this.invalidateCachePattern('admin-platform-flags*');
      await this.invalidateCachePattern('admin-effective-flags*');

      return result.data || null;
    } catch (error) {
      clientLogger.error('[AdminPlatformFlagsService] Failed to update platform flag:', { detail: error });
      return null;
    }
  }

  /**
   * Set a flag override for a tenant
   * Note: This will invalidate relevant cache entries
   */
  async setFlagOverride(flag: string, value: boolean | null): Promise<void> {
    if (!flag) {
      clientLogger.error('[AdminPlatformFlagsService] Flag name is required');
      return;
    }

    try {
      const result = await this.makeDefaultRequest<void>(
        `/api/admin/flags/override/platform/${encodeURIComponent(flag)}`,
        {
          method: 'POST',
          body: JSON.stringify({ value })
        },
        `admin-set-override-${flag}`,
        0 // No cache for update operations
      );

      if (!result.success) {
        clientLogger.error('[AdminPlatformFlagsService] Failed to set flag override:', { detail: result.error });
        throw new Error('Failed to set flag override');
      }

      // Invalidate relevant caches after override change
      await this.invalidateCachePattern('admin-effective-flags*');
    } catch (error) {
      clientLogger.error('[AdminPlatformFlagsService] Failed to set flag override:', { detail: error });
      throw error;
    }
  }

  /**
   * Reset a flag override
   * Note: This will invalidate relevant cache entries
   */
  async resetFlagOverride(flag: string): Promise<void> {
    if (!flag) {
      clientLogger.error('[AdminPlatformFlagsService] Flag name is required');
      return;
    }

    try {
      const result = await this.makeDefaultRequest<void>(
        `/api/admin/flags/override/platform/${encodeURIComponent(flag)}`,
        {
          method: 'DELETE'
        },
        `admin-reset-override-${flag}`,
        0 // No cache for update operations
      );

      if (!result.success) {
        clientLogger.error('[AdminPlatformService] Failed to reset flag override:', { detail: result.error });
        throw new Error('Failed to reset flag override');
      }

      // Invalidate relevant caches after override reset
      await this.invalidateCachePattern('admin-effective-flags*');
    } catch (error) {
      clientLogger.error('[AdminPlatformService] Failed to reset flag override:', { detail: error });
      throw error;
    }
  }

  /**
   * Delete a platform flag
   * Note: This will invalidate relevant cache entries
   */
  async deletePlatformFlag(flag: string): Promise<boolean> {
    if (!flag) {
      clientLogger.error('[AdminPlatformFlagsService] Flag name is required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<void>(
        '/api/admin/platform-flags',
        {
          method: 'DELETE',
          body: JSON.stringify({ flag })
        },
        'admin-delete-flag',
        0 // No cache for delete operations
      );

      if (!result.success) {
        clientLogger.error('[AdminPlatformFlagsService] Failed to delete platform flag:', { detail: result.error });
        return false;
      }

      // Invalidate relevant caches after deletion
      await this.invalidateCachePattern('admin-platform-flags*');
      await this.invalidateCachePattern('admin-effective-flags*');

      return true;
    } catch (error) {
      clientLogger.error('[AdminPlatformFlagsService] Failed to delete platform flag:', { detail: error });
      return false;
    }
  }
}

// Export singleton instance
export const adminPlatformFlagsService = AdminPlatformFlagsService.getInstance();
