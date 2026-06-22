/**
 * BSaaS Purchase Service (Frontend)
 *
 * API client for self-service à la carte feature purchases.
 * Calls the tenant-facing endpoints mounted at /api/subscription/feature-*.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

export interface BsaasCatalogItem {
  key: string;
  name: string;
  description: string;
  category: string | null;
  priceCents: number;
  billingCycle: 'one_time' | 'monthly' | 'annual';
  trialDays: number;
  purchase: {
    id: string;
    feature_key: string;
    status: string;
    expires_at: string | null;
    source: string;
  } | null;
  tierAvailability: 'not_in_tier' | 'in_tier_active' | 'in_tier_gate_off';
  tierCapabilityKey: string | null;
}

export interface BsaasPurchaseRecord {
  id: string;
  feature_key: string;
  status: string;
  source: string;
  expires_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface BsaasPurchaseResult {
  success: boolean;
  data?: {
    id: string;
    feature_key: string;
    status: string;
    expires_at: string | null;
    transaction_id?: string;
  };
  error?: string;
  message?: string;
}

class BsaasPurchaseService extends TenantApiSingleton {
  protected defaultContext: AppContext = AppContext.TENANT;
  protected defaultIsolation: CacheIsolation = CacheIsolation.TENANT;

  private static instance: BsaasPurchaseService;

  private constructor() {
    super('bsaas-purchases');
  }

  public static get Instance(): BsaasPurchaseService {
    if (!BsaasPurchaseService.instance) {
      BsaasPurchaseService.instance = new BsaasPurchaseService();
    }
    return BsaasPurchaseService.instance;
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateAllTenantCaches(tenantId);
  }

  private async invalidateAllTenantCaches(_tenantId?: string): Promise<void> {
    // Placeholder for cache invalidation
  }

  public getServiceCachePatterns(): string[] {
    return ['bsaas-catalog', 'bsaas-purchases'];
  }

  /**
   * Get the feature catalog with tenant-specific tier status
   */
  async getFeatureCatalog(): Promise<BsaasCatalogItem[]> {
    const response = await this.makeDefaultRequest<BsaasCatalogItem[]>(
      '/api/subscription/feature-catalog',
      { method: 'GET' },
      'bsaas-catalog'
    );

    if (!response.success) {
      throw new Error('Failed to fetch feature catalog');
    }

    const data = response.data;
    const actualData = Array.isArray(data) ? data : (data as any)?.data;
    return Array.isArray(actualData) ? actualData : [];
  }

  /**
   * List the tenant's feature purchases
   */
  async getFeaturePurchases(): Promise<BsaasPurchaseRecord[]> {
    const response = await this.makeDefaultRequest<BsaasPurchaseRecord[]>(
      '/api/subscription/feature-purchases',
      { method: 'GET' },
      'bsaas-purchases'
    );

    if (!response.success) {
      throw new Error('Failed to fetch feature purchases');
    }

    const data = response.data;
    const actualData = Array.isArray(data) ? data : (data as any)?.data;
    return Array.isArray(actualData) ? actualData : [];
  }

  /**
   * Purchase a feature
   */
  async purchaseFeature(
    featureKey: string,
    paymentMethodId: string,
    promotionCode?: string
  ): Promise<BsaasPurchaseResult> {
    const response = await this.makeDefaultRequest<BsaasPurchaseResult>(
      '/api/subscription/feature-purchase',
      {
        method: 'POST',
        body: JSON.stringify({ featureKey, paymentMethodId, ...(promotionCode ? { promotionCode } : {}) }),
      },
      'bsaas-purchase'
    );

    if (!response.success) {
      const errorData = response.error as any;
      return {
        success: false,
        error: typeof errorData === 'string' ? errorData : errorData?.error || 'purchase_failed',
        message: typeof errorData === 'string' ? errorData : errorData?.message || 'Failed to purchase feature',
      };
    }

    const innerData = (response.data as any)?.data || response.data;
    return { success: true, data: innerData };
  }

  /**
   * Cancel a feature purchase
   */
  async cancelPurchase(purchaseId: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const response = await this.makeDefaultRequest<any>(
      `/api/subscription/feature-purchase/${purchaseId}/cancel`,
      { method: 'POST' },
      `bsaas-cancel-${purchaseId}`,
      0
    );

    if (!response.success) {
      const errorData = response.error as any;
      return {
        success: false,
        error: typeof errorData === 'string' ? errorData : errorData?.error || 'cancel_failed',
        message: typeof errorData === 'string' ? errorData : errorData?.message || 'Failed to cancel purchase',
      };
    }

    return { success: true };
  }
}

export const bsaasPurchaseService = BsaasPurchaseService.Instance;
