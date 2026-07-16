/**
 * API Queries Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached API query operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

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
  subscription_status?: string;
  trialEndsAt?: string;
  trial_ends_at?: string;
  subscriptionEndsAt?: string;
  subscription_ends_at?: string;
  graceEndsAt?: string;
  grace_ends_at?: string;
  manualSubscriptionControl?: boolean;
  manual_subscription_control?: boolean;
  manualSubscriptionExpiresAt?: string;
  manual_subscription_expires_at?: string;
  manualSubscriptionReason?: string;
  manual_subscription_reason?: string;
  effectiveExpiresAt?: string;
  effectiveExpiresType?: 'trial' | 'subscription' | 'manual';
  effectiveExpiresSource?: 'automatic_trial' | 'automatic_subscription' | 'manual_override';
  metadata?: any;
  organizationId?: string;
  organization_id?: string;
  createdAt?: string;
  created_at?: string;
  service_level?: string;
  reopening_date?: string;
  _count?: {
    items: number;
    users: number;
  };
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

    protected defaultContext: AppContext = AppContext.TENANT;
    protected defaultIsolation: CacheIsolation = CacheIsolation.TENANT;
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
    if (!organizationId) {
      clientLogger.error('[ApiQueriesSingleton] Organization ID is required for billing counters');
      return {} as OrganizationData;
    }

    console.log('[ApiQueriesSingleton] Fetching billing counters for organization:', organizationId);
    
    const result = await this.makeDefaultRequest<OrganizationData>(
      `/api/organization/billing/counters?organizationId=${organizationId}`,
      {},
      `org-billing-counters-${organizationId}`
    );

    if (!result.success) {
      clientLogger.error('[ApiQueriesSingleton] Failed to get organization billing counters:', { detail: result.error });
      console.error('[ApiQueriesSingleton] Response details:', {
        success: result.success,
        error: result.error,
        data: result.data,
        status: result.status
      });
      return {} as OrganizationData;
    }

    console.log('[ApiQueriesSingleton] Successfully fetched billing counters for organization:', organizationId);
    return result.data || {} as OrganizationData;
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant> {
    const result = await this.makeDefaultRequest<Tenant>(
      `/api/tenants/${tenantId}`,
      {},
      `tenant-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[ApiQueriesSingleton] Failed to get tenant:', { detail: result.error });
      return {} as Tenant;
    }

    return result.data || {} as Tenant;
  }

  /**
   * Get tenant categories
   */
  async getTenantCategories(tenantId: string): Promise<Category[]> {
    const result = await this.makeDefaultRequest<Category[]>(
      `/api/tenant/${tenantId}/categories`,
      {},
      `tenant-categories-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[ApiQueriesSingleton] Failed to get tenant categories:', { detail: result.error });
      return [];
    }

    return result.data || [];
  }

  /**
   * Get upgrade requests
   */
  async getUpgradeRequests(tenantId?: string, status?: string): Promise<UpgradeRequest[]> {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    if (status) params.set('status', status);

    const cacheKey = `upgrade-requests-${tenantId || 'all'}-${status || 'all'}`;
    
    const result = await this.makeDefaultRequest<UpgradeRequest[]>(
      `/api/upgrade-requests?${params.toString()}`,
      {},
      cacheKey
    );

    if (!result.success) {
      clientLogger.error('[ApiQueriesSingleton] Failed to get upgrade requests:', { detail: result.error });
      return [];
    }

    return result.data || [];
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
