/**
 * Admin BSaaS Analytics Service
 *
 * Extends AdminApiSingleton to fetch BSaaS revenue analytics.
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface BsaasAnalyticsSummary {
  totalActivePurchases: number;
  totalTrialPurchases: number;
  totalPastDuePurchases: number;
  totalSuspendedPurchases: number;
  totalExpiredPurchases: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  totalLifetimeRevenue: number;
  trialConversionRate: number;
  churnRate: number;
  totalTenantsWithPurchases: number;
}

export interface FeatureRevenueRow {
  feature_key: string;
  feature_name: string;
  marketing_name: string | null;
  active_count: number;
  trial_count: number;
  monthly_revenue: number;
  annual_revenue: number;
  lifetime_revenue: number;
}

export interface RecentPurchaseRow {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  feature_key: string;
  status: string;
  source: string;
  price_cents: number;
  billing_cycle: string;
  purchased_at: string;
  expires_at: string | null;
}

export interface BsaasAnalytics {
  summary: BsaasAnalyticsSummary;
  perFeature: FeatureRevenueRow[];
  recentPurchases: RecentPurchaseRow[];
}

class AdminBsaasAnalyticsService extends AdminApiSingleton {
  private static instance: AdminBsaasAnalyticsService;

  private constructor() {
    super('AdminBsaasAnalyticsService');
  }

  static getInstance(): AdminBsaasAnalyticsService {
    if (!AdminBsaasAnalyticsService.instance) {
      AdminBsaasAnalyticsService.instance = new AdminBsaasAnalyticsService();
    }
    return AdminBsaasAnalyticsService.instance;
  }

  async getAnalytics(): Promise<BsaasAnalytics> {
    const result = await this.makeDefaultRequest<BsaasAnalytics>(
      '/api/admin/bsaas-analytics',
      {},
      'admin-bsaas-analytics',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch BSaaS analytics');
    }
    const data = (result.data as any)?.data || result.data;
    return data;
  }
}

export const adminBsaasAnalyticsService = AdminBsaasAnalyticsService.getInstance();
