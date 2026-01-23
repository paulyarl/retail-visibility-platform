import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';

// TypeScript interfaces for hours status
export interface StoreStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'opening-soon' | 'closing-soon';
  label: string;
}

export interface HoursStatusData {
  [tenantId: string]: StoreStatus;
}

/**
 * Hours Status Singleton - Manages business hours status for all stores
 * Now extends UniversalSingleton for unified caching and metrics
 */
class HoursStatusSingleton extends UniversalSingleton {
  private static instance: HoursStatusSingleton;
  
  // Hours status cache
  private hoursStatus = new Map<string, StoreStatus>();

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }

  static getInstance(): HoursStatusSingleton {
    if (!HoursStatusSingleton.instance) {
      HoursStatusSingleton.instance = new HoursStatusSingleton('hours-status-singleton');
    }
    return HoursStatusSingleton.instance;
  }
  
  // ====================
  // API METHODS
  // ====================
  
  private async makePublicRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    this.apiCalls++;
    
    const publicOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      }
    };
    
    const response = await fetch(url, publicOptions);
    
    if (!response.ok) {
      throw new Error(`Public API request failed: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  private handlePublicError(error: any): void {
    console.error('Public API error:', error);
  }
  
  // ====================
  // HOURS STATUS SPECIFIC METRICS
  // ====================
  
  protected getCustomMetrics(): Record<string, any> {
    return {
      cachedTenants: this.hoursStatus.size,
      totalStatusRequests: 0 // Would be tracked in a real implementation
    };
  }

  /**
   * Get business hours status for a specific tenant
   */
  async getStoreStatus(tenantId: string): Promise<StoreStatus | null> {
    if (!tenantId) {
      return null;
    }

    const cacheKey = `hours-status-${tenantId}`;
    
    // Check cache first (shorter TTL for hours status since it changes throughout the day)
    const cached = await this.getFromCache<StoreStatus>(cacheKey);
    if (cached) {
      this.hoursStatus.set(tenantId, cached);
      return cached;
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const url = `${apiUrl}/public/tenant/${tenantId}/business-hours/status`;
      
      const response = await this.makePublicRequest<any>(url);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch hours status');
      }

      const statusData: StoreStatus = response.data;
      
      // Store in cache
      await this.setCache(cacheKey, statusData);
      
      this.hoursStatus.set(tenantId, statusData);
      
      return statusData;
    } catch (error) {
      this.handlePublicError(error);
      throw error;
    }
  }

  /**
   * Get business hours status for multiple tenants (batch request)
   */
  async getMultipleStoreStatus(tenantIds: string[]): Promise<Map<string, StoreStatus>> {
    const results = new Map<string, StoreStatus>();
    
    // Process in parallel for better performance
    const promises = tenantIds.map(async (tenantId) => {
      try {
        const status = await this.getStoreStatus(tenantId);
        if (status) {
          results.set(tenantId, status);
        }
      } catch (error) {
        console.error(`Failed to fetch hours status for ${tenantId}:`, error);
        // Continue with other requests even if one fails
      }
    });
    
    await Promise.all(promises);
    
    return results;
  }

  /**
   * Get cached status for a tenant (no API call)
   */
  getCachedStatus(tenantId: string): StoreStatus | null {
    return this.hoursStatus.get(tenantId) || null;
  }

  /**
   * Check if status is cached for a tenant
   */
  hasStatus(tenantId: string): boolean {
    return this.hoursStatus.has(tenantId);
  }

  /**
   * Clear status for a specific tenant
   */
  async clearTenantStatus(tenantId: string): Promise<void> {
    this.hoursStatus.delete(tenantId);
    const cacheKey = `hours-status-${tenantId}`;
    await super.clearCache(cacheKey);
  }

  /**
   * Clear all hours status cache
   */
  async clearAllStatus(): Promise<void> {
    this.hoursStatus.clear();
    await super.clearCache();
  }

  /**
   * Preload status for featured stores (called during app initialization)
   */
  async preloadFeaturedStoresStatus(tenantIds: string[]): Promise<void> {
    try {
      await this.getMultipleStoreStatus(tenantIds);
    } catch (error) {
      console.error('Failed to preload featured stores status:', error);
      // Don't throw error - preload failures shouldn't break the app
    }
  }

  /**
   * Refresh status for a tenant (force API call)
   */
  async refreshStatus(tenantId: string): Promise<StoreStatus | null> {
    // Clear cache first
    await this.clearTenantStatus(tenantId);
    
    // Fetch fresh data
    return this.getStoreStatus(tenantId);
  }
}

// Export singleton instance
export const hoursStatusSingleton = HoursStatusSingleton.getInstance();
