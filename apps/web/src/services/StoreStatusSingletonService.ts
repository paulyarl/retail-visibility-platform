/**
 * Store Status Singleton Service
 * 
 * Extends PublicApiSingleton to provide cached store status operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface StoreStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'opening-soon' | 'closing-soon';
  label: string;
}

class StoreStatusSingletonService extends PublicApiSingleton {
  private static instance: StoreStatusSingletonService;

  private constructor() {
    super('store-status-singleton');
    this.cacheTTL = 2 * 60 * 1000; // 2 minutes for store status (changes frequently)
  }

  public static getInstance(): StoreStatusSingletonService {
    if (!StoreStatusSingletonService.instance) {
      StoreStatusSingletonService.instance = new StoreStatusSingletonService();
    }
    return StoreStatusSingletonService.instance;
  }

  /**
   * Get store status for a specific tenant
   */
  async getStoreStatus(tenantId: string, apiBase?: string): Promise<StoreStatus | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<StoreStatus>(
        `/api/public/tenant/${tenantId}/business-hours/status`,
        {},
        `store-status-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[StoreStatusSingleton] Failed to get store status:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[StoreStatusSingleton] Failed to get store status:', error);
      return null;
    }
  }

  /**
   * Invalidate store status cache for a specific tenant
   */
  public async invalidateStoreStatusCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`store-status-${tenantId}*`);
  }

  /**
   * Invalidate all store status cache
   */
  public async invalidateAllStoreStatusCache(): Promise<void> {
    await this.invalidateCache('store-status-*');
  }
}

// Export singleton instance
export const storeStatusService = StoreStatusSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateStoreStatusCache = async (tenantId: string): Promise<void> => {
  const service = StoreStatusSingletonService.getInstance();
  await service.invalidateStoreStatusCache(tenantId);
};

export const invalidateAllStoreStatusCache = async (): Promise<void> => {
  const service = StoreStatusSingletonService.getInstance();
  await service.invalidateAllStoreStatusCache();
};
