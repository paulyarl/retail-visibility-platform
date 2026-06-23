/**
 * Tenant Storefront Policy Service
 *
 * Extends TenantApiSingleton to provide tenant-scoped policy CRUD operations.
 * Uses the /api/tenants/:tenantId/storefront-policies endpoint.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface StorefrontPolicies {
  return_policy: string | null;
  shipping_policy: string | null;
  privacy_policy: string | null;
  terms_of_service: string | null;
  refund_policy: string | null;
}

class TenantStorefrontPolicyService extends TenantApiSingleton {
  private static instance: TenantStorefrontPolicyService;

  public getServiceCachePatterns(): string[] {
    return [
      'tenant-storefront-policies*',
      'storefront-policy-edit*',
    ];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-storefront-policies*');
    await this.invalidateCachePattern('storefront-policy-edit*');
  }

  private constructor() {
    super('tenant-storefront-policies', {
      ttl: 5 * 60 * 1000, // 5 minutes
    });
  }

  public static getInstance(): TenantStorefrontPolicyService {
    if (!TenantStorefrontPolicyService.instance) {
      TenantStorefrontPolicyService.instance = new TenantStorefrontPolicyService();
    }
    return TenantStorefrontPolicyService.instance;
  }

  /**
   * Get policies for merchant editing.
   */
  async getPolicies(tenantId: string): Promise<StorefrontPolicies | null> {
    if (!tenantId) {
      console.error('[TenantStorefrontPolicy] getPolicies: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; policies: StorefrontPolicies }>(
        `/api/tenants/${tenantId}/storefront-policies`,
        {},
        `tenant-storefront-policies-${tenantId}`,
        this.cacheTTL
      );

      if (!result.success || !result.data) {
        return null;
      }

      return result.data.policies;
    } catch (error) {
      console.error('[TenantStorefrontPolicy] Failed to get policies:', error);
      return null;
    }
  }

  /**
   * Update policies for a tenant.
   */
  async updatePolicies(tenantId: string, data: Partial<StorefrontPolicies>): Promise<StorefrontPolicies | null> {
    if (!tenantId) {
      console.error('[TenantStorefrontPolicy] updatePolicies: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; policies: StorefrontPolicies }>(
        `/api/tenants/${tenantId}/storefront-policies`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
        `tenant-storefront-policies-${tenantId}`,
        0 // Don't cache writes
      );

      if (!result.success || !result.data) {
        return null;
      }

      // Invalidate caches after successful update
      await this.invalidateServiceCaches(tenantId);

      return result.data.policies;
    } catch (error) {
      console.error('[TenantStorefrontPolicy] Failed to update policies:', error);
      return null;
    }
  }
}

export const tenantStorefrontPolicyService = TenantStorefrontPolicyService.getInstance();
export default tenantStorefrontPolicyService;
