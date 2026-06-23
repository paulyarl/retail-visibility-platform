/**
 * Public Storefront Policy Service
 *
 * Extends PublicApiSingleton to provide cached public storefront policy reads.
 * Uses the /api/public/storefront-policies/:tenantId endpoint.
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export type PolicyType = 'return_policy' | 'shipping_policy' | 'privacy_policy' | 'terms_of_service' | 'refund_policy';

export interface StorefrontPolicies {
  return_policy: string | null;
  shipping_policy: string | null;
  privacy_policy: string | null;
  terms_of_service: string | null;
  refund_policy: string | null;
}

export interface StorefrontPoliciesWithMeta extends StorefrontPolicies {
  hasAnyPolicies: boolean;
  updatedAt: Date | null;
}

class PublicStorefrontPolicyService extends PublicApiSingleton {
  private static instance: PublicStorefrontPolicyService;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes

  protected constructor() {
    super('public-storefront-policies', {
      ttl: 15 * 60 * 1000,
    });
  }

  public static getInstance(): PublicStorefrontPolicyService {
    if (!PublicStorefrontPolicyService.instance) {
      PublicStorefrontPolicyService.instance = new PublicStorefrontPolicyService();
    }
    return PublicStorefrontPolicyService.instance;
  }

  /**
   * Get all storefront policies for a tenant (public read).
   */
  async getPolicies(tenantId: string): Promise<StorefrontPolicies | null> {
    if (!tenantId) {
      console.error('[PublicStorefrontPolicy] getPolicies: tenantId is required');
      return null;
    }

    try {
      const result = await this.makePublicRequest<{ success: boolean; policies: StorefrontPolicies }>(
        `/api/public/storefront-policies/${tenantId}`,
        {},
        `storefront-policies-${tenantId}`,
        this.cacheTTL
      );

      if (!result.success || !result.data) {
        return null;
      }

      return result.data.policies;
    } catch (error) {
      console.error('[PublicStorefrontPolicy] Failed to get policies:', error);
      return null;
    }
  }

  /**
   * Get a single policy type for a tenant (public read).
   */
  async getPolicy(tenantId: string, type: PolicyType): Promise<string | null> {
    if (!tenantId || !type) {
      console.error('[PublicStorefrontPolicy] getPolicy: tenantId and type are required');
      return null;
    }

    try {
      const result = await this.makePublicRequest<{ success: boolean; content: string }>(
        `/api/public/storefront-policies/${tenantId}/${type}`,
        {},
        `storefront-policy-${tenantId}-${type}`,
        this.cacheTTL
      );

      if (!result.success || !result.data) {
        return null;
      }

      return result.data.content;
    } catch (error) {
      console.error('[PublicStorefrontPolicy] Failed to get policy:', error);
      return null;
    }
  }
}

export const publicStorefrontPolicyService = PublicStorefrontPolicyService.getInstance();
export default publicStorefrontPolicyService;
