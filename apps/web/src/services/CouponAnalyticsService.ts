/**
 * CouponAnalyticsService — Frontend analytics service
 * Extends TenantApiSingleton
 */
import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';

export class CouponAnalyticsService extends TenantApiSingleton {
  private static instance: CouponAnalyticsService;

  private constructor() {
    super('coupon-analytics-service', { ttl: 10 * 60 * 1000 });
  }

  public static getInstance(): CouponAnalyticsService {
    if (!CouponAnalyticsService.instance) {
      CouponAnalyticsService.instance = new CouponAnalyticsService();
    }
    return CouponAnalyticsService.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['coupon-analytics-*', 'coupon-timeseries-*', 'coupon-funnel-*', 'coupon-roi-*'];
  }

  public async invalidateServiceCaches(tenantId?: string, ...params: any[]): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`coupon-analytics-${tenantId}`);
      this.invalidateCache(`coupon-timeseries-${tenantId}`);
      this.invalidateCache(`coupon-funnel-${tenantId}`);
      this.invalidateCache(`coupon-roi-${tenantId}`);
    }
  }

  async getDashboard(tenantId: string, period?: string, daysBack?: number): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/coupon-analytics`,
      {},
      `coupon-analytics-${tenantId}-${period || 'day'}-${daysBack || 30}`,
      this.cacheTTL,
      { tenantId }
    );
    const responseData = result.data?.data || result.data;
    return responseData;
  }

  async getTimeSeries(tenantId: string, couponId?: string, period?: string, daysBack?: number): Promise<any> {
    const url = `/api/tenants/${tenantId}/coupon-analytics/timeseries` +
      (couponId ? `?couponId=${couponId}` : '') +
      (period ? `&period=${period}` : '') +
      (daysBack ? `&daysBack=${daysBack}` : '');
    const result = await this.makeDefaultRequest<any>(url, {}, `coupon-timeseries-${tenantId}-${couponId || 'all'}`, this.cacheTTL, { tenantId });
    const responseData = result.data?.data || result.data;
    return responseData;
  }

  async getFunnelReport(tenantId: string, daysBack?: number): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/coupon-analytics/funnel`,
      {},
      `coupon-funnel-${tenantId}-${daysBack || 30}`,
      this.cacheTTL,
      { tenantId }
    );
    const responseData = result.data?.data || result.data;
    return responseData;
  }

  async getROIReport(tenantId: string, period?: string, daysBack?: number): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/coupon-analytics/roi`,
      {},
      `coupon-roi-${tenantId}-${period || 'day'}-${daysBack || 30}`,
      this.cacheTTL,
      { tenantId }
    );
    const responseData = result.data?.data || result.data;
    return responseData;
  }

  async triggerAggregation(tenantId: string, period?: string): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/coupon-analytics/aggregate?period=${period || 'day'}`,
      { method: 'POST' },
      undefined,
      0,
      { tenantId }
    );
    await this.invalidateServiceCaches(tenantId);
  }

  static formatCurrency(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  static formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  static formatNumber(value: number): string {
    return value.toLocaleString('en-US');
  }

  async getAdminAnalytics(): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      '/api/admin/coupon-analytics',
      {},
      'coupon-admin-analytics',
      this.cacheTTL,
      undefined
    );
    const responseData = result.data?.data || result.data;
    return responseData;
  }
}
