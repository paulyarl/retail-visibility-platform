/**
 * GBP Monitor Service
 *
 * Extends AdminApiSingleton to provide cross-tenant GBP health monitoring
 * for platform admins.
 *
 * Base URL: /api/admin/gbp-monitor
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

// ====================
// TYPES
// ====================

export interface GbpOverviewStats {
  connections: number;
  locations: {
    verified: number;
    unverified: number;
    total: number;
  };
  reviews: {
    total: number;
    last7Days: number;
  };
  posts: {
    total: number;
    stuckScheduled: number;
    failed: number;
  };
  media: {
    total: number;
  };
  merchantGates: Array<{
    reviewsDisplay: boolean;
    contentDisplay: boolean;
    count: number;
  }>;
}

export interface GbpTenantStatus {
  tenantId: string;
  tenantName: string;
  tenantSlug: string | null;
  tier: string | null;
  connected: boolean;
  connectedAt: string;
  verificationState: string;
  businessName: string | null;
  cachedRating: number | null;
  cachedReviewCount: number;
  reviewCount: number;
  postCount: number;
  mediaCount: number;
  merchantGate: {
    reviewsDisplay: boolean;
    contentDisplay: boolean;
    configured: boolean;
  };
}

export interface GbpTenantsResponse {
  tenants: GbpTenantStatus[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GbpJobHealth {
  reviewIngestion: {
    reviewsLastHour: number;
    reviewsAwaitingReply: number;
    healthy: boolean;
  };
  postScheduler: {
    stuckScheduled: Array<{
      id: string;
      tenant_id: string;
      topic_type: string | null;
      summary: string | null;
      scheduled_for: string | null;
      status: string;
    }>;
    failed: Array<{
      id: string;
      tenant_id: string;
      topic_type: string | null;
      summary: string | null;
      status: string;
      created_at: string;
    }>;
    publishedLast15Min: number;
    stuckCount: number;
    failedCount: number;
  };
}

export interface GbpEntitlementSummary {
  tierEntitlements: Array<{
    tierKey: string;
    tierName: string;
    featureKey: string;
    featureName: string;
  }>;
  bsaasPurchases: Array<{
    tenantId: string;
    featureKey: string;
    source: string;
    status: string;
    expiresAt: string | null;
  }>;
  featureGrants: Array<{
    tenantId: string;
    featureKey: string;
    grantedBy: string;
    reason: string;
  }>;
  merchantGateDisabled: Array<{
    tenantId: string;
    reviewsDisplay: boolean;
    contentDisplay: boolean;
  }>;
}

// ====================
// SERVICE
// ====================

const BASE_URL = '/api/admin/gbp-monitor';

class GbpMonitorService extends AdminApiSingleton {
  private static instance: GbpMonitorService;

  private constructor() {
    super('GbpMonitorService');
  }

  static getInstance(): GbpMonitorService {
    if (!GbpMonitorService.instance) {
      GbpMonitorService.instance = new GbpMonitorService();
    }
    return GbpMonitorService.instance;
  }

  async getOverview(): Promise<GbpOverviewStats> {
    const result = await this.makeDefaultRequest<any>(`${BASE_URL}/overview`, {}, 'gbp-monitor-overview', 30000);
    return result.data?.data ?? result.data;
  }

  async getTenants(params?: {
    page?: number;
    limit?: number;
    search?: string;
    verification?: string;
  }): Promise<GbpTenantsResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.verification) query.set('verification', params.verification);

    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/tenants?${query.toString()}`,
      {},
      'gbp-monitor-tenants',
      30000
    );
    return result.data?.data ?? result.data;
  }

  async getJobHealth(): Promise<GbpJobHealth> {
    const result = await this.makeDefaultRequest<any>(`${BASE_URL}/jobs`, {}, 'gbp-monitor-jobs', 30000);
    return result.data?.data ?? result.data;
  }

  async getEntitlements(): Promise<GbpEntitlementSummary> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/entitlements`,
      {},
      'gbp-monitor-entitlements',
      30000
    );
    return result.data?.data ?? result.data;
  }
}

export const gbpMonitorService = GbpMonitorService.getInstance();
export default gbpMonitorService;
