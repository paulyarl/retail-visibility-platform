/**
 * Badge Analytics Service (Frontend Singleton)
 *
 * Fetches badge analytics data from the backend API.
 * Used by the badge analytics dashboard page.
 * Extends TenantApiSingleton for automatic auth, caching, and cache invalidation.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export type PeriodType = 'day' | 'week' | 'month';

export interface BadgeAnalyticsSummary {
  badgeKey: string;
  badgeLabel: string;
  badgeColor: string | null;
  badgeIcon: string | null;
  totalViews: number;
  totalClicks: number;
  addToCartCount: number;
  orderCount: number;
  unitsSold: number;
  revenueCents: number;
  ctr: number;
  conversionRate: number;
  avgOrderValueCents: number;
  revenueLift: number;
  productCount: number;
  trend: 'up' | 'down' | 'flat';
  trendPercent: number;
}

export interface BadgeAnalyticsDashboard {
  period: PeriodType;
  startDate: string;
  endDate: string;
  badges: BadgeAnalyticsSummary[];
  totals: {
    totalViews: number;
    totalClicks: number;
    addToCartCount: number;
    orderCount: number;
    unitsSold: number;
    revenueCents: number;
    activeBadgeCount: number;
  };
}

export interface BadgeTimeSeriesPoint {
  periodStart: string;
  views: number;
  clicks: number;
  orders: number;
  revenueCents: number;
  ctr: number;
}

export interface BadgeROIRow {
  badgeKey: string;
  badgeLabel: string;
  badgedRevenueCents: number;
  unbadgedRevenueCents: number;
  revenueLift: number;
  incrementalRevenueCents: number;
}

class BadgeAnalyticsServiceClass extends TenantApiSingleton {
  private static instance: BadgeAnalyticsServiceClass;

  private constructor() {
    super('badge-analytics-singleton', { ttl: 5 * 60 * 1000 });
  }

  public static getInstance(): BadgeAnalyticsServiceClass {
    if (!BadgeAnalyticsServiceClass.instance) {
      BadgeAnalyticsServiceClass.instance = new BadgeAnalyticsServiceClass();
    }
    return BadgeAnalyticsServiceClass.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['badge-analytics-dashboard-*', 'badge-analytics-timeseries-*', 'badge-analytics-roi-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`badge-analytics-dashboard-${tenantId}`);
      this.invalidateCache(`badge-analytics-timeseries-${tenantId}`);
      this.invalidateCache(`badge-analytics-roi-${tenantId}`);
    }
  }

  async getDashboard(
    tenantId: string,
    period: PeriodType = 'day',
    daysBack: number = 30
  ): Promise<BadgeAnalyticsDashboard> {
    const result = await this.makeDefaultRequest<BadgeAnalyticsDashboard>(
      `/api/tenants/${tenantId}/badge-analytics?period=${period}&daysBack=${daysBack}`,
      {},
      `badge-analytics-dashboard-${tenantId}-${period}-${daysBack}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      const errMsg = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errMsg || 'Failed to fetch badge analytics');
    }
    return result.data;
  }

  async getTimeSeries(
    tenantId: string,
    badgeKey: string,
    period: PeriodType = 'day',
    daysBack: number = 30
  ): Promise<BadgeTimeSeriesPoint[]> {
    const result = await this.makeDefaultRequest<{ data: BadgeTimeSeriesPoint[] }>(
      `/api/tenants/${tenantId}/badge-analytics/timeseries?badgeKey=${encodeURIComponent(badgeKey)}&period=${period}&daysBack=${daysBack}`,
      {},
      `badge-analytics-timeseries-${tenantId}-${badgeKey}-${period}-${daysBack}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return [];
    }
    return result.data.data || [];
  }

  async getROIReport(
    tenantId: string,
    period: PeriodType = 'day',
    daysBack: number = 30
  ): Promise<BadgeROIRow[]> {
    const result = await this.makeDefaultRequest<{ badges: BadgeROIRow[] }>(
      `/api/tenants/${tenantId}/badge-analytics/roi?period=${period}&daysBack=${daysBack}`,
      {},
      `badge-analytics-roi-${tenantId}-${period}-${daysBack}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return [];
    }
    return result.data.badges || [];
  }

  async triggerAggregation(
    tenantId: string,
    period: PeriodType = 'day'
  ): Promise<{ success: boolean; rowsComputed: number; errors: string[] }> {
    const result = await this.makeDefaultRequest<{ success: boolean; rowsComputed: number; errors: string[] }>(
      `/api/tenants/${tenantId}/badge-analytics/aggregate?period=${period}`,
      { method: 'POST' },
      undefined,
      undefined,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      const errMsg = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errMsg || 'Failed to trigger aggregation');
    }
    await this.invalidateServiceCaches(tenantId);
    return result.data;
  }

  formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }

  formatPercent(value: number, decimals: number = 1): string {
    return `${(value * 100).toFixed(decimals)}%`;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }
}

export const BadgeAnalyticsService = BadgeAnalyticsServiceClass.getInstance();
export default BadgeAnalyticsService;
