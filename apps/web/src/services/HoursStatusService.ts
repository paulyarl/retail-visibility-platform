/**
 * Hours Status Service - Public API Pattern
 * 
 * Manages business hours status for public display
 * Extends PublicApiSingleton for consistent caching and metrics
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

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
 * Hours Status Service - Public API Pattern
 * 
 * Manages business hours status for public display on storefronts and directories
 * Uses PublicApiSingleton for consistent caching and metrics
 */
class HoursStatusService extends PublicApiSingleton {

    protected defaultContext: AppContext = AppContext.STORE;
    protected defaultIsolation: CacheIsolation = CacheIsolation.STORE;
  private static instance: HoursStatusService;
  
  // Hours status cache
  private hoursStatus = new Map<string, StoreStatus>();

  // TTL constants for different data types
  private readonly HOURS_STATUS_TTL = 10 * 60 * 1000; // 10 minutes for hours status (changes throughout the day)

  private constructor() {
    super('hours-status-service');
  }

  static getInstance(): HoursStatusService {
    if (!HoursStatusService.instance) {
      HoursStatusService.instance = new HoursStatusService();
    }
    return HoursStatusService.instance;
  }

  /**
   * Get business hours status for a specific tenant
   */
  async getStoreStatus(tenantId: string): Promise<StoreStatus | null> {
    if (!tenantId) {
      return null;
    }

    const cacheKey = `hours-status-${tenantId}`;
    
    const response = await this.makeDefaultRequest<StoreStatus>(
      `/api/public/tenant/${tenantId}/business-hours/status`,
      {},
      cacheKey,
      this.HOURS_STATUS_TTL
    );

    if (!response.success || !response.data) {
      console.error('[HoursStatusService] Failed to get store status:', response.error);
      return null;
    }

    // The API returns { success, data: { isOpen, status, label } }
    // makeDefaultRequest wraps it as { success, data: { success, data: {...} } }
    // So response.data is the API response, and we need response.data.data for the actual status
    const statusData: StoreStatus = (response.data as any).data || response.data;
    
    // Store in local cache for quick access
    this.hoursStatus.set(tenantId, statusData);
    
    return statusData;
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
        console.error(`[HoursStatusService] Failed to fetch hours status for ${tenantId}:`, error);
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
   * Clear cached status for a tenant
   */
  clearCachedStatus(tenantId: string): void {
    this.hoursStatus.delete(tenantId);
  }

  /**
   * Clear all cached status
   */
  clearAllCachedStatus(): void {
    this.hoursStatus.clear();
  }

  /**
   * Get all cached tenant IDs
   */
  getCachedTenantIds(): string[] {
    return Array.from(this.hoursStatus.keys());
  }

  /**
   * Get the number of cached tenants
   */
  getCachedCount(): number {
    return this.hoursStatus.size;
  }

  /**
   * Invalidate cache for a specific tenant
   */
  async invalidateCache(tenantId: string): Promise<void> {
    const cacheKey = `hours-status-${tenantId}`;
    await this.invalidateCache(cacheKey);
    this.hoursStatus.delete(tenantId);
  }

  /**
   * Invalidate all hours status cache
   */
  async invalidateAllCache(): Promise<void> {
    // Clear all tenant-specific cache keys
    const tenantIds = this.getCachedTenantIds();
    const promises = tenantIds.map(tenantId => this.invalidateCache(tenantId));
    
    await Promise.all(promises);
    this.clearAllCachedStatus();
  }

  /**
   * Get custom metrics for this service
   */
  protected getCustomMetrics(): Record<string, any> {
    return {
      cachedTenants: this.hoursStatus.size,
      totalStatusRequests: 0 // Would be tracked in a real implementation
    };
  }
}

// Export singleton instance
export const hoursStatusService = HoursStatusService.getInstance();
