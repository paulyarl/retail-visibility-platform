/**
 * Store Status Singleton Service V2 - Migrated to FlexibleApiSingletonV2
 * 
 * Provides cached store status operations with delegation pattern
 * Uses the new clean architecture for consistent execution
 */

import { FlexibleApiSingletonV2, RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingletonV2';
import { clientLogger } from '@/lib/client-logger';

export interface StoreStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'opening-soon' | 'closing-soon';
  label: string;
}

/**
 * Store Status Singleton Service V2
 * 
 * Migrated to use FlexibleApiSingletonV2 with delegation pattern
 * Maintains all existing functionality while using clean architecture
 */
class StoreStatusSingletonServiceV2 extends FlexibleApiSingletonV2 {
  private static instance: StoreStatusSingletonServiceV2;

  // Define defaults for this service
  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;

  // TTL constants
  private readonly STORE_STATUS_TTL = 2 * 60 * 1000; // 2 minutes for store status (changes frequently)

  protected constructor() {
    super('store-status-singleton-v2');
    this.cacheTTL = this.STORE_STATUS_TTL;
  }

  public static getInstance(): StoreStatusSingletonServiceV2 {
    if (!StoreStatusSingletonServiceV2.instance) {
      StoreStatusSingletonServiceV2.instance = new StoreStatusSingletonServiceV2();
    }
    return StoreStatusSingletonServiceV2.instance;
  }

  /**
   * Get store status for a specific tenant
   * Uses delegation pattern: setup → execution
   */
  async getStoreStatus(tenantId: string, apiBase?: string): Promise<StoreStatus | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Using makeDefaultRequest with delegation pattern
      const result = await this.makeDefaultRequest<StoreStatus>(
        `/api/public/tenant/${tenantId}/business-hours/status`,
        {},
        `store-status-${tenantId}`,
        this.STORE_STATUS_TTL,
        {
          requestType: RequestType.PUBLIC,
          requestTarget: RequestTarget.API
        }
      );
      
      if (!result.success){
        clientLogger.error('[StoreStatusSingletonV2] Failed to get store status:', { detail: result.error });
        return null;
      }

      return result.data || null;
    } catch (error) {
      clientLogger.error('[StoreStatusSingletonV2] Failed to get store status:', { detail: error });
      return null;
    }
  }

  /**
   * Get multiple store statuses for multiple tenants
   * Uses delegation pattern for batch operations
   */
  async getMultipleStoreStatuses(tenantIds: string[]): Promise<Map<string, StoreStatus | null>> {
    try {
      // Use makeDefaultRequest with delegation pattern for parallel requests
      const requests = tenantIds.map(async (tenantId) => {
        const status = await this.makeDefaultRequest<StoreStatus>(
          `/api/public/tenant/${tenantId}/business-hours/status`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          },
          `store-status-${tenantId}`,
          this.STORE_STATUS_TTL,
          { requestTarget: RequestTarget.API }
        );
        
        return { tenantId, status: status.success ? status.data : null };
      });

      const results = await Promise.all(requests);
      
      // Convert to Map
      const statusMap = new Map<string, StoreStatus | null>();
      results.forEach(({ tenantId, status }) => {
        statusMap.set(tenantId, status || null);
      });

      return statusMap;
    } catch (error) {
      clientLogger.error('[StoreStatusSingletonV2] Failed to get multiple store statuses:', { detail: error });
      return new Map();
    }
  }

  /**
   * Invalidate store status cache for a specific tenant
   * Note: Cache invalidation would need to be implemented in the base class
   */
  public async invalidateStoreStatusCache(tenantId: string): Promise<void> {
    // This would need to be implemented in the base class
    console.log(`[StoreStatusSingletonV2] Cache invalidation requested for tenant: ${tenantId}`);
    // TODO: Implement cache invalidation in base class
  }

  /**
   * Invalidate all store status cache
   * Note: Cache invalidation would need to be implemented in the base class
   */
  public async invalidateAllStoreStatusCache(): Promise<void> {
    console.log('[StoreStatusSingletonV2] All store status cache invalidation requested');
    // TODO: Implement cache invalidation in base class
  }

  /**
   * Get store status with real-time check (bypass cache)
   * Uses delegation pattern with no caching
   */
  async getStoreStatusRealTime(tenantId: string): Promise<StoreStatus | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Using makeDefaultRequest without cache for real-time data
      const result = await this.makeDefaultRequest<StoreStatus>(
        `/api/public/tenant/${tenantId}/business-hours/status`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        },
        `real-time-store-status-${tenantId}`, // No cache for real-time
        undefined, // No TTL for real-time
        {
          requestTarget: RequestTarget.API
        }
      );
      
      if (!result.success){
        clientLogger.error('[StoreStatusSingletonV2] Failed to get real-time store status:', { detail: result.error });
        return null;
      }

      return result.data || null;
    } catch (error) {
      clientLogger.error('[StoreStatusSingletonV2] Failed to get real-time store status:', { detail: error });
      return null;
    }
  }

  /**
   * Test hook customization for store status requests
   * Demonstrates how to customize request behavior in V2
   */
  protected async onPublicRequest<T>(
    url: string,
    options: any,
    cacheKey?: string,
    ttl?: number
  ): Promise<any> {
    console.log(`[StoreStatusSingletonV2] Customizing public request for: ${url}`);
    
    // Add custom headers for store status requests
    return {
      ...options,
      headers: {
        ...options.headers,
        'X-Store-Status-Version': 'v2',
        'X-Request-Timestamp': Date.now().toString(),
        'X-Service': 'StoreStatusSingletonServiceV2'
      }
    };
  }
}

// Export singleton instance
export const storeStatusServiceV2 = StoreStatusSingletonServiceV2.getInstance();

// Export cache invalidation helpers for external use
export const invalidateStoreStatusCacheV2 = async (tenantId: string): Promise<void> => {
  const service = StoreStatusSingletonServiceV2.getInstance();
  await service.invalidateStoreStatusCache(tenantId);
};

export const invalidateAllStoreStatusCacheV2 = async (): Promise<void> => {
  const service = StoreStatusSingletonServiceV2.getInstance();
  await service.invalidateAllStoreStatusCache();
};

// Also export the class for testing
export { StoreStatusSingletonServiceV2 };
