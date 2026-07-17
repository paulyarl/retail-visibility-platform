/**
 * Cache Invalidation Service
 * 
 * Provides methods to clear API and browser caches
 * Uses AdminApiSingleton for authenticated API calls
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

interface CacheInvalidationResult {
  success: boolean;
  cleared: number;
  failed: number;
  results: Array<{
    pattern: string;
    status: string;
    error?: string;
  }>;
}

interface TenantInvalidationResult extends CacheInvalidationResult {
  tenantId?: string;
  patterns: number;
}

export class CacheInvalidationService extends AdminApiSingleton {
  constructor() {
    super('CacheInvalidationService');
  }

  /**
   * Clear API caches for specific patterns
   */
  async clearApiCaches(patterns: string[]): Promise<CacheInvalidationResult> {
    try {
      const response = await this.makeAdminRequest<CacheInvalidationResult>('/api/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patterns }),
      });

      if (response.success && response.data) {
        const result = response.data;
        console.log(`✅ Cleared ${result.cleared} API cache patterns${result.failed > 0 ? ` (${result.failed} failed)` : ''}`);
        return result;
      } else {
        throw new Error('Cache invalidation failed');
      }
    } catch (error) {
      clientLogger.warn('⚠️ API cache clear error:', { detail: error });
      throw error;
    }
  }

  /**
   * Clear all tenant-related API caches
   */
  async clearAllTenantCaches(): Promise<TenantInvalidationResult> {
    try {
      const response = await this.makeAdminRequest<TenantInvalidationResult>('/api/cache/invalidate/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Clear all tenant caches
      });

      if (response.success && response.data) {
        const result = response.data;
        console.log(`✅ Cleared ${result.cleared} tenant API cache patterns across ${result.patterns} patterns${result.failed > 0 ? ` (${result.failed} failed)` : ''}`);
        return result;
      } else {
        throw new Error('Tenant cache invalidation failed');
      }
    } catch (error) {
      clientLogger.warn('⚠️ Tenant API cache clear error:', { detail: error });
      throw error;
    }
  }

  /**
   * Clear API caches for a specific tenant
   */
  async clearTenantCaches(tenantId: string): Promise<TenantInvalidationResult> {
    try {
      const response = await this.makeAdminRequest<TenantInvalidationResult>('/api/cache/invalidate/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId }),
      });

      if (response.success && response.data) {
        const result = response.data;
        console.log(`✅ Cleared ${result.cleared} API cache patterns for tenant ${tenantId}${result.failed > 0 ? ` (${result.failed} failed)` : ''}`);
        return result;
      } else {
        throw new Error('Tenant cache invalidation failed');
      }
    } catch (error) {
      clientLogger.warn('⚠️ Tenant API cache clear error:', { detail: error });
      throw error;
    }
  }
}

// Export singleton instance
export const cacheInvalidationService = new CacheInvalidationService();
