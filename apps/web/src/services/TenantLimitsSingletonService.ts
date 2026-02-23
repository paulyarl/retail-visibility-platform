/**
 * Tenant Limits Singleton Service
 *
 * Extends AuthenticatedApiSingleton to provide cached tenant limits operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '../providers/base/AuthenticatedApiSingleton';

export interface TenantLimitsStatus {
  current: number;
  limit: any;
  remaining: any;
  tier: string;
  status: string;
  tierDisplayName: string;
  canCreate: boolean;
  upgradeMessage?: string;
  upgradeToTier?: string;
  tenant?: Array<{
    id: string;
    name: string;
    tier: string;
    status: string;
  }>;
}

export interface FeaturedProductsLimits {
  limits: Record<string, number>;
  tier: string;
  status: string;
  displayNames: Record<string, string>;
}

class TenantLimitsSingletonService extends AuthenticatedApiSingleton {
  private static instance: TenantLimitsSingletonService;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes for tenant limits

  protected constructor() {
    super('tenant-limits-singleton', {
      ttl: 5 * 60 * 1000 // 5 minutes for tenant limits
    });
  }

  public static getInstance(): TenantLimitsSingletonService {
    if (!TenantLimitsSingletonService.instance) {
      TenantLimitsSingletonService.instance = new TenantLimitsSingletonService();
    }
    return TenantLimitsSingletonService.instance;
  }

  /**
   * Get tenant featured products limits with caching
   * Uses the /tenant-limits/featured-products endpoint
   */
  async getFeaturedProductsLimits(tenantId: string): Promise<FeaturedProductsLimits | null> {
    if (!tenantId) {
      console.error('[TenantLimitsSingleton] getFeaturedProductsLimits: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<FeaturedProductsLimits>(
        `/api/tenant-limits/featured-products?tenantId=${tenantId}`,
        {},
        `featured-products-limits-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantLimitsSingleton] Failed to get featured products limits:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantLimitsSingleton] Failed to get featured products limits:', error);
      return null;
    }
  }

  /**
   * Get tenant limits status with caching
   * Uses the /tenant-limits/status endpoint
   */
  async getTenantLimitsStatus(): Promise<TenantLimitsStatus | null> {
    try {
      const result = await this.makeDefaultRequest<TenantLimitsStatus>(
        '/api/tenant-limits/status',
        {},
        'tenant-limits-status',
        this.cacheTTL
      );
      if (!result.success){
        console.error('[TenantLimitsSingleton] Failed to get tenant limits status:', result.error);
        return null;
      } 

      return result.data || null;
    } catch (error) {
      console.error('[TenantLimitsSingleton] Failed to get tenant limits status:', error);
      return null;
    }
  }

  /**
   * Get all tenant limits for a tenant
   */
  async getTenantLimits(tenantId: string): Promise<{
    featuredProducts?: FeaturedProductsLimits;
    status?: TenantLimitsStatus;
  }> {
    if (!tenantId) {
      return {};
    }

    try {
      // Fetch limits in parallel for better performance
      const [featuredProductsLimits, limitsStatus] = await Promise.all([
        this.getFeaturedProductsLimits(tenantId),
        this.getTenantLimitsStatus()
      ]);

      return {
        featuredProducts: featuredProductsLimits || undefined,
        status: limitsStatus || undefined,
      };
    } catch (error) {
      console.error('[TenantLimitsSingleton] Failed to get tenant limits:', error);
      return {};
    }
  }
}

// Export singleton instance
export const tenantLimitsService = TenantLimitsSingletonService.getInstance();