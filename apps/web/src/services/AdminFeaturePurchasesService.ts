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
      '/api/admin/feature-purchases?action=grant-complimentary',
      { method: 'POST', body: JSON.stringify(input) },
      'admin-feature-purchases-grant',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to grant complimentary access');
    }
    await this.invalidateCachePattern('admin-feature-purchases');
    const data = (result.data as any)?.data || result.data;
    return data;
  }
}

export const adminFeaturePurchasesService = AdminFeaturePurchasesService.getInstance();
