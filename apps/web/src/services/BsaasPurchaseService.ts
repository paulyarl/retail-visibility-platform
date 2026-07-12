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
  billingCycle: 'one_time' | 'weekly' | 'monthly' | 'annual';
  trialDays: number;
  trialEligible: boolean;
  demoEligible: boolean;
  purchase: {
    id: string;
    feature_key: string;
    status: string;
    expires_at: string | null;
    source: string;
  } | null;
  tierAvailability: 'not_in_tier' | 'in_tier_active' | 'in_tier_gate_off';
  tierCapabilityKey: string | null;
  tierEligible: boolean;
  ineligibleReason: string | null;
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

export interface BsaasBundleItem {
  featureKey: string;
  name: string;
  inTier: boolean;
  alreadyPurchased: boolean;
}

export interface BsaasBundleCatalogItem {
  bundleKey: string;
  name: string;
  description: string;
  priceCents: number;
  billingCycle: 'one_time' | 'weekly' | 'monthly' | 'annual';
  trialDays: number;
  trialEligible: boolean;
  demoEligible: boolean;
  items: BsaasBundleItem[];
  tierEligible: boolean;
  ineligibleReason: string | null;
  ineligibleDomains: string[];
  allActive: boolean;
  allInTier: boolean;
}

export interface BsaasBundlePurchaseResult {
  success: boolean;
  data?: {
    bundle_key: string;
    status: string;
    price_cents: number;
    billing_cycle: string;
    expires_at: string | null;
    purchase_ids: string[];
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
    return ['bsaas-catalog', 'bsaas-purchases', 'bsaas-bundle-catalog'];
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

  /**
   * Get the bundle catalog with tenant-specific tier status
   */
  async getBundleCatalog(): Promise<BsaasBundleCatalogItem[]> {
    const response = await this.makeDefaultRequest<BsaasBundleCatalogItem[]>(
      '/api/subscription/bundle-catalog',
      { method: 'GET' },
      'bsaas-bundle-catalog'
    );

    if (!response.success) {
      throw new Error('Failed to fetch bundle catalog');
    }

    const data = response.data;
    const actualData = Array.isArray(data) ? data : (data as any)?.data;
    return Array.isArray(actualData) ? actualData : [];
  }

  /**
   * Purchase a bundle
   */
  async purchaseBundle(
    bundleKey: string,
    paymentMethodId: string,
    promotionCode?: string
  ): Promise<BsaasBundlePurchaseResult> {
    const response = await this.makeDefaultRequest<BsaasBundlePurchaseResult>(
      '/api/subscription/bundle-purchase',
      {
        method: 'POST',
        body: JSON.stringify({ bundleKey, paymentMethodId, ...(promotionCode ? { promotionCode } : {}) }),
      },
      'bsaas-bundle-purchase'
    );

    if (!response.success) {
      const errorData = response.error as any;
      return {
        success: false,
        error: typeof errorData === 'string' ? errorData : errorData?.error || 'purchase_failed',
        message: typeof errorData === 'string' ? errorData : errorData?.message || 'Failed to purchase bundle',
      };
    }

    const innerData = (response.data as any)?.data || response.data;
    return { success: true, data: innerData };
  }

  /**
   * Validate a promo code and preview the discount (no purchase)
   */
  async validatePromoCode(
    promotionCode: string,
    priceCents: number,
    opts?: { featureKey?: string; bundleKey?: string }
  ): Promise<{ success: boolean; data?: any; error?: string; message?: string }> {
    const response = await this.makeDefaultRequest<any>(
      '/api/subscription/validate-promo',
      {
        method: 'POST',
        body: JSON.stringify({
          promotionCode,
          priceCents,
          ...(opts?.featureKey ? { featureKey: opts.featureKey } : {}),
          ...(opts?.bundleKey ? { bundleKey: opts.bundleKey } : {}),
        }),
      },
      'bsaas-validate-promo'
    );

    if (!response.success) {
      const errorData = response.error as any;
      return {
        success: false,
        error: typeof errorData === 'string' ? errorData : errorData?.error || 'validation_failed',
        message: typeof errorData === 'string' ? errorData : errorData?.message || 'Failed to validate promo code',
      };
    }

    const innerData = (response.data as any)?.data || response.data;
    return { success: true, data: innerData };
  }

  /**
   * Redeem a grant token (from QR code URL)
   */
  async redeemGrant(grantToken: string): Promise<{ success: boolean; data?: any; error?: string; message?: string }> {
    const response = await this.makeDefaultRequest<any>(
      '/api/subscription/redeem-grant',
      {
        method: 'POST',
        body: JSON.stringify({ grant_token: grantToken }),
      },
      'bsaas-redeem-grant',
      0,
    );

    if (!response.success) {
      const errorData = response.error as any;
      return {
        success: false,
        error: typeof errorData === 'string' ? errorData : errorData?.error || 'redeem_failed',
        message: typeof errorData === 'string' ? errorData : errorData?.message || 'Failed to redeem grant',
      };
    }

    const innerData = (response.data as any)?.data || response.data;
    return { success: true, data: innerData };
  }
}

export const bsaasPurchaseService = BsaasPurchaseService.Instance;
