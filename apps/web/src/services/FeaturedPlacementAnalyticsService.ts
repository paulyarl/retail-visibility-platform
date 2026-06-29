/**
 * Featured Placement Analytics Service (Frontend)
 *
 * Sprint 6: Analytics & Revenue
 *
 * Two singletons:
 * - FeaturedPlacementAnalyticsService (TenantApiSingleton) — merchant endpoints
 * - FeaturedPlacementAdminAnalyticsService (AdminApiSingleton) — platform admin endpoints
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

// ====================
// TYPES
// ====================

export interface PlacementMetrics {
  purchaseId: string;
  tenantId: string;
  inventoryItemId: string;
  planKey: string;
  surface: string;
  priceCents: number;
  durationDays: number;
  status: string;
  purchasedAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  productName: string;
  views: number;
  clicks: number;
  ctr: number;
  addToCartCount: number;
  orderCount: number;
  unitsSold: number;
  revenueCents: number;
  conversionRate: number;
  baselineViews: number;
  baselineClicks: number;
  baselineOrderCount: number;
  baselineRevenueCents: number;
  viewsLift: number;
  clicksLift: number;
  ordersLift: number;
  revenueLift: number;
  roi: number;
}

export interface PlacementAnalyticsResult {
  placements: PlacementMetrics[];
  totals: {
    totalPlacements: number;
    activePlacements: number;
    totalSpendCents: number;
    totalRevenueCents: number;
    totalOrders: number;
    totalViews: number;
    avgRoi: number;
    avgRevenueLift: number;
    renewalRate: number;
  };
}

export interface StoreAnalyticsResult {
  purchases: Array<{
    purchaseId: string;
    planKey: string;
    surface: string;
    priceCents: number;
    durationDays: number;
    status: string;
    purchasedAt: string | null;
    activatedAt: string | null;
    expiresAt: string | null;
    renewedFrom: string | null;
    productName: string;
  }>;
  spendSummary: {
    totalSpendCents: number;
    spendBySurface: Record<string, number>;
    spendByMonth: Record<string, number>;
  };
  renewalRate: number;
  activeCount: number;
}

export interface PlatformRevenueAnalytics {
  totalRevenueCents: number;
  totalPurchases: number;
  activePurchases: number;
  trialPurchases: number;
  trialConversionRate: number;
  churnRate: number;
  renewalRate: number;
  revenueBySurface: Record<string, { revenueCents: number; count: number }>;
  revenueByPlan: Record<string, { revenueCents: number; count: number; label: string }>;
  topSpenders: Array<{ tenantId: string; tenantName: string; totalSpendCents: number; purchaseCount: number }>;
  monthlyRevenue: Array<{ month: string; revenueCents: number; count: number }>;
}

// ====================
// SERVICE
// ====================

class FeaturedPlacementAnalyticsServiceClass extends TenantApiSingleton {
  private static instance: FeaturedPlacementAnalyticsServiceClass;

  private constructor() {
    super('featured-placement-analytics-singleton', { ttl: 5 * 60 * 1000 });
  }

  public static getInstance(): FeaturedPlacementAnalyticsServiceClass {
    if (!FeaturedPlacementAnalyticsServiceClass.instance) {
      FeaturedPlacementAnalyticsServiceClass.instance = new FeaturedPlacementAnalyticsServiceClass();
    }
    return FeaturedPlacementAnalyticsServiceClass.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['featured-placement-analytics-*', 'featured-placement-store-analytics-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`featured-placement-analytics-${tenantId}`);
      this.invalidateCache(`featured-placement-store-analytics-${tenantId}`);
    }
  }

  async getPlacementAnalytics(
    tenantId: string,
    status?: string
  ): Promise<PlacementAnalyticsResult> {
    const qs = status ? `?status=${status}` : '';
    const result = await this.makeDefaultRequest<PlacementAnalyticsResult>(
      `/api/tenants/${tenantId}/featured-placements/analytics${qs}`,
      {},
      `featured-placement-analytics-${tenantId}${qs}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      throw new Error(getErrorMessage(result.error) || 'Failed to fetch placement analytics');
    }
    return result.data;
  }

  async getStoreAnalytics(tenantId: string): Promise<StoreAnalyticsResult> {
    const result = await this.makeDefaultRequest<StoreAnalyticsResult>(
      `/api/tenants/${tenantId}/featured-placements/store-analytics`,
      {},
      `featured-placement-store-analytics-${tenantId}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      throw new Error(getErrorMessage(result.error) || 'Failed to fetch store analytics');
    }
    return result.data;
  }

  formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }

  formatPercent(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }
}

// ====================
// ADMIN SERVICE (AdminApiSingleton)
// ====================

class FeaturedPlacementAdminAnalyticsServiceClass extends AdminApiSingleton {
  private static instance: FeaturedPlacementAdminAnalyticsServiceClass;

  private constructor() {
    super('featured-placement-admin-analytics-singleton', { ttl: 5 * 60 * 1000 });
  }

  public static getInstance(): FeaturedPlacementAdminAnalyticsServiceClass {
    if (!FeaturedPlacementAdminAnalyticsServiceClass.instance) {
      FeaturedPlacementAdminAnalyticsServiceClass.instance = new FeaturedPlacementAdminAnalyticsServiceClass();
    }
    return FeaturedPlacementAdminAnalyticsServiceClass.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['featured-placement-admin-analytics-*'];
  }

  public async invalidateServiceCaches(): Promise<void> {
    this.invalidateCache('featured-placement-admin-analytics');
  }

  async getPlatformRevenueAnalytics(
    startDate?: string,
    endDate?: string
  ): Promise<PlatformRevenueAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const result = await this.makeDefaultRequest<PlatformRevenueAnalytics>(
      `/api/admin/featured-placements/revenue-analytics${qs}`,
      {},
      `featured-placement-admin-analytics${qs}`,
      this.cacheTTL
    );
    if (!result.success || !result.data) {
      throw new Error(getErrorMessage(result.error) || 'Failed to fetch platform revenue analytics');
    }
    return result.data;
  }

  formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }

  formatPercent(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }
}

export const FeaturedPlacementAnalyticsService = FeaturedPlacementAnalyticsServiceClass.getInstance();
export const FeaturedPlacementAdminAnalyticsService = FeaturedPlacementAdminAnalyticsServiceClass.getInstance();
export default FeaturedPlacementAnalyticsService;
