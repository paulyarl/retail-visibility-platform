/**
 * Admin Feature Purchases Service
 *
 * Extends AdminApiSingleton to provide admin operations
 * for tenant_feature_purchases via the Next.js proxy route.
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface FeaturePurchase {
  id: string;
  tenant_id: string;
  feature_key: string;
  source: string;
  status: string;
  expires_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  tenants?: { id: string; name: string; subscription_tier: string };
}

export interface GrantComplimentaryInput {
  tenant_id: string;
  feature_key: string;
  duration_days?: number;
  reason: string;
}

export interface GrantTokenData {
  grant_token: string;
  grant_token_id: string;
  qr_url: string;
  expires_at: string;
  feature_key: string;
  feature_name: string;
  target_icon: {
    type: 'feature';
    feature_key: string;
    icon_name: string | null;
    marketing_name: string;
  };
}

export interface CreateGrantTokenInput {
  feature_key: string;
  tenant_id?: string;
  duration_days?: number;
  max_claims?: number;
  qr_expiry_hours?: number;
}

export interface GrantClaim {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  claimed_at: string;
}

export interface GrantToken {
  id: string;
  feature_key: string;
  feature_name: string;
  tenant_id: string | null;
  tenant_name: string | null;
  duration_days: number | null;
  granted_by: string;
  max_claims: number;
  claims_count: number;
  qr_expires_at: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'expired' | 'fully_claimed' | 'inactive';
  claims: GrantClaim[];
}

export interface ComplimentaryGrant {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_tier: string | null;
  feature_key: string;
  source: string;
  status: string;
  expires_at: string | null;
  metadata: any;
  reason: string | null;
  granted_by: string | null;
  granted_at: string | null;
  created_at: string;
  updated_at: string;
}

class AdminFeaturePurchasesService extends AdminApiSingleton {
  private static instance: AdminFeaturePurchasesService;

  private constructor() {
    super('AdminFeaturePurchasesService');
  }

  static getInstance(): AdminFeaturePurchasesService {
    if (!AdminFeaturePurchasesService.instance) {
      AdminFeaturePurchasesService.instance = new AdminFeaturePurchasesService();
    }
    return AdminFeaturePurchasesService.instance;
  }

  async list(filters?: { tenantId?: string; status?: string; source?: string }): Promise<FeaturePurchase[]> {
    const params = new URLSearchParams();
    if (filters?.tenantId) params.set('tenantId', filters.tenantId);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.source) params.set('source', filters.source);
    const qs = params.toString();

    const result = await this.makeDefaultRequest<FeaturePurchase[]>(
      `/api/admin/feature-purchases${qs ? `?${qs}` : ''}`,
      {},
      'admin-feature-purchases-all',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch feature purchases');
    }
    const data = result.data;
    const actualData = Array.isArray(data) ? data : (data as any)?.data;
    return Array.isArray(actualData) ? actualData : [];
  }

  async grantComplimentary(input: GrantComplimentaryInput): Promise<FeaturePurchase> {
    const result = await this.makeDefaultRequest<FeaturePurchase>(
      '/api/admin/feature-purchases/grant-complimentary',
      { method: 'POST', body: JSON.stringify(input) },
      'admin-feature-purchases-grant',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to grant complimentary access');
    }
    await this.invalidateCachePattern('admin-feature-purchases');
    await this.invalidateCachePattern('admin-feature-purchases-complimentary-grants');
    const data = (result.data as any)?.data || result.data;
    return data;
  }

  async listGrants(filters?: { featureKey?: string; tenantId?: string; status?: string }): Promise<GrantToken[]> {
    const params = new URLSearchParams();
    if (filters?.featureKey) params.set('featureKey', filters.featureKey);
    if (filters?.tenantId) params.set('tenantId', filters.tenantId);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();

    const result = await this.makeDefaultRequest<GrantToken[]>(
      `/api/admin/feature-purchases/grants${qs ? `?${qs}` : ''}`,
      {},
      'admin-feature-purchases-grants',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch grant tokens');
    }
    const data = result.data;
    const actualData = Array.isArray(data) ? data : (data as any)?.data;
    return Array.isArray(actualData) ? actualData : [];
  }

  async listComplimentaryGrants(filters?: { tenantId?: string; featureKey?: string; status?: string }): Promise<ComplimentaryGrant[]> {
    const params = new URLSearchParams();
    if (filters?.tenantId) params.set('tenantId', filters.tenantId);
    if (filters?.featureKey) params.set('featureKey', filters.featureKey);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();

    const result = await this.makeDefaultRequest<ComplimentaryGrant[]>(
      `/api/admin/feature-purchases?action=complimentary-grants${qs ? `&${qs}` : ''}`,
      {},
      'admin-feature-purchases-complimentary-grants',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch complimentary grants');
    }
    const data = result.data;
    const actualData = Array.isArray(data) ? data : (data as any)?.data;
    return Array.isArray(actualData) ? actualData : [];
  }

  async invalidateGrantsCache(): Promise<void> {
    await this.invalidateCachePattern('admin-feature-purchases-grants');
    await this.invalidateCachePattern('admin-feature-purchases-complimentary-grants');
  }

  async createGrantToken(input: CreateGrantTokenInput): Promise<GrantTokenData> {
    const result = await this.makeDefaultRequest<GrantTokenData>(
      '/api/admin/feature-purchases/create-grant-token',
      { method: 'POST', body: JSON.stringify(input) },
      'admin-feature-purchases-grant-token',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create grant token');
    }
    const data = (result.data as any)?.data || result.data;
    if (!data || !data.grant_token) {
      throw new Error(
        'API did not return a grant token. The endpoint may have returned a feature purchase instead. ' +
        'Received: ' + JSON.stringify(data).substring(0, 200)
      );
    }
    return data;
  }
}

export const adminFeaturePurchasesService = AdminFeaturePurchasesService.getInstance();
