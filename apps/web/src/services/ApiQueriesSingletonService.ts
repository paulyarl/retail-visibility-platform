/**
 * API Queries Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached API query operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface TenantTier {
  tier: string;
  limits: Record<string, any>;
  features: Record<string, boolean>;
}

interface TenantUsage {
  products: number;
  activeProducts: number;
  monthlySkuQuota: number | null;
  skusAddedThisMonth: number;
  quotaRemaining: number | null;
  locations: number;
  users: number;
  apiCalls: number;
  storageGB: number;
}

interface Tenant {
  id: string;
  name: string;
  businessName?: string;
  subscriptionTier?: string;
  subscription_tier?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  metadata?: any;
}

interface OrganizationData {
  organizationId: string;
  organizationName: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  limits: {
    maxLocations: number;
    maxTotalSKUs: number;
  };
  usage: {
    totalSKUs: number;
    totalLocations: number;
  };
  current: {
    totalLocations: number;
    totalSKUs: number;
  };
  status: {
    locations: 'ok' | 'warning' | 'at_limit';
    skus: 'ok' | 'warning' | 'at_limit';
    overall: 'ok' | 'warning' | 'at_limit';
  };
  locationBreakdown: Array<{
    tenantId: string;
    tenantName: string;
    skuCount: number;
    metadata?: any;
  }>;
}

interface UpgradeRequest {
  id: string;
  tenantId: string;
  status: string;
  requestedTier: string;
  currentTier: string;
  createdAt: string;
  processedAt?: string;
  notes?: string;
}

class ApiQueriesSingletonService extends AuthenticatedApiSingleton {
  private static instance: ApiQueriesSingletonService;

  private constructor() {
    super('api-queries-singleton');
    this.cacheTTL = 10 * 60 * 1000; // 10 minutes for API query data
  }

  public static getInstance(): ApiQueriesSingletonService {
    if (!ApiQueriesSingletonService.instance) {
      ApiQueriesSingletonService.instance = new ApiQueriesSingletonService();
    }
    return ApiQueriesSingletonService.instance;
  }

  /**
   * Get organization billing counters
   */
  async getOrganizationBillingCounters(organizationId: string): Promise<OrganizationData> {
    try {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const result = await this.makeAuthenticatedRequest<OrganizationData>(
        `/api/organization/billing/counters?organizationId=${organizationId}`,
        {},
        `org-billing-counters-${organizationId}`
      );

      return result || {} as OrganizationData;
    } catch (error) {
      console.error('[ApiQueriesSingleton] Failed to get organization billing counters:', error);
      return {} as OrganizationData;
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant> {
    try {
      const result = await this.makeAuthenticatedRequest<Tenant>(
        `/api/tenants/${tenantId}`,
        {},
        `tenant-${tenantId}`
      );

      return result || {} as Tenant;
    } catch (error) {
      console.error('[ApiQueriesSingleton] Failed to get tenant:', error);
      return {} as Tenant;
    }
  }

  /**
   * Get tenant categories
   */
  async getTenantCategories(tenantId: string): Promise<Category[]> {
    try {
      const result = await this.makeAuthenticatedRequest<Category[]>(
        `/api/tenant/${tenantId}/categories`,
        {},
        `tenant-categories-${tenantId}`
      );

      return result || [];
    } catch (error) {
      console.error('[ApiQueriesSingleton] Failed to get tenant categories:', error);
      return [];
    }
  }

  /**
   * Get upgrade requests
   */
  async getUpgradeRequests(tenantId?: string, status?: string): Promise<UpgradeRequest[]> {
    try {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      if (status) params.set('status', status);

      const cacheKey = `upgrade-requests-${tenantId || 'all'}-${status || 'all'}`;
      
      const result = await this.makeAuthenticatedRequest<UpgradeRequest[]>(
        `/api/upgrade-requests?${params.toString()}`,
        {},
        cacheKey
      );

      return result || [];
    } catch (error) {
      console.error('[ApiQueriesSingleton] Failed to get upgrade requests:', error);
      return [];
    }
  }

  /**
   * Invalidate tenant cache
   */
  public async invalidateTenantCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`tenant-${tenantId}*`);
    await this.invalidateCache(`tenant-categories-${tenantId}*`);
  }

  /**
   * Invalidate organization cache
   */
  public async invalidateOrganizationCache(organizationId: string): Promise<void> {
    await this.invalidateCache(`org-billing-counters-${organizationId}*`);
  }

  /**
   * Invalidate upgrade requests cache
   */
  public async invalidateUpgradeRequestsCache(tenantId?: string): Promise<void> {
    const pattern = tenantId 
      ? `upgrade-requests-${tenantId}*`
      : 'upgrade-requests-*';
    await this.invalidateCache(pattern);
  }
}

// Export singleton instance
export const apiQueriesService = ApiQueriesSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateTenantCache = async (tenantId: string): Promise<void> => {
  const service = ApiQueriesSingletonService.getInstance();
  await service.invalidateTenantCache(tenantId);
};

export const invalidateOrganizationCache = async (organizationId: string): Promise<void> => {
  const service = ApiQueriesSingletonService.getInstance();
  await service.invalidateOrganizationCache(organizationId);
};

export const invalidateUpgradeRequestsCache = async (tenantId?: string): Promise<void> => {
  const service = ApiQueriesSingletonService.getInstance();
  await service.invalidateUpgradeRequestsCache(tenantId);
};
