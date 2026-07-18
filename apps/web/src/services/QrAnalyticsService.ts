/**
 * QR Analytics Service (Frontend Singleton)
 *
 * Fetches QR analytics data from the backend API.
 * Used by the merchant QR analytics dashboard page.
 * Extends TenantApiSingleton for automatic auth, caching, and cache invalidation.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export type QrSurfaceType = 'storefront' | 'product' | 'directory' | 'qr_landing' | 'promo' | 'private_grant' | 'general';
export type QrConsumerType = 'merchant' | 'admin';
export type PeriodType = 'day' | 'week' | 'month';

export interface QrAnalyticsSummary {
  surface: QrSurfaceType;
  surfaceLabel: string;
  totalScans: number;
  uniqueVisitors: number;
  conversionCount: number;
  revenueCents: number;
  conversionRate: number;
  avgRevenuePerScan: number;
  topCountry: string | null;
  topCity: string | null;
  mobileScans: number;
  desktopScans: number;
  tabletScans: number;
  trend: 'up' | 'down' | 'flat';
  trendPercent: number;
}

export interface QrAnalyticsDashboard {
  period: PeriodType;
  startDate: string;
  endDate: string;
  surfaces: QrAnalyticsSummary[];
  totals: {
    totalScans: number;
    uniqueVisitors: number;
    conversionCount: number;
    revenueCents: number;
    activeSurfaceCount: number;
  };
}

export interface QrTimeSeriesPoint {
  periodStart: string;
  totalScans: number;
  uniqueVisitors: number;
  conversionCount: number;
  revenueCents: number;
}

export interface AdminQrAnalyticsResult {
  filters: {
    consumer?: QrConsumerType;
    surface?: QrSurfaceType;
    tenantId?: string;
    daysBack: number;
  };
  totals: {
    totalScans: number;
    uniqueVisitors: number;
    tenantCount: number;
  };
  byConsumer: Array<{
    consumer: QrConsumerType;
    totalScans: number;
    uniqueVisitors: number;
    tenantCount: number;
  }>;
  bySurface: Array<{
    surface: QrSurfaceType;
    totalScans: number;
    uniqueVisitors: number;
  }>;
  recentScans: Array<{
    id: string;
    tenantId: string;
    surface: string;
    consumer: string;
    source: string | null;
    geoCountry: string | null;
    deviceType: string | null;
    createdAt: string;
  }>;
}

const SURFACE_LABELS: Record<QrSurfaceType, string> = {
  storefront: 'Storefront',
  product: 'Product',
  directory: 'Directory',
  qr_landing: 'QR Landing',
  promo: 'Promo',
  private_grant: 'Private Grant',
  general: 'General',
};

class QrAnalyticsServiceClass extends TenantApiSingleton {
  private static instance: QrAnalyticsServiceClass;

  private constructor() {
    super('qr-analytics-singleton', { ttl: 5 * 60 * 1000 });
  }

  public static getInstance(): QrAnalyticsServiceClass {
    if (!QrAnalyticsServiceClass.instance) {
      QrAnalyticsServiceClass.instance = new QrAnalyticsServiceClass();
    }
    return QrAnalyticsServiceClass.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['qr-analytics-dashboard-*', 'qr-analytics-timeseries-*', 'qr-analytics-admin-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`qr-analytics-dashboard-${tenantId}`);
      this.invalidateCache(`qr-analytics-timeseries-${tenantId}`);
    }
  }

  async getDashboard(
    tenantId: string,
    period: PeriodType = 'day',
    daysBack: number = 30
  ): Promise<QrAnalyticsDashboard> {
    const result = await this.makeDefaultRequest<QrAnalyticsDashboard>(
      `/api/tenants/${tenantId}/qr-analytics?period=${period}&daysBack=${daysBack}`,
      {},
      `qr-analytics-dashboard-${tenantId}-${period}-${daysBack}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      const errMsg = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errMsg || 'Failed to fetch QR analytics');
    }
    return result.data;
  }

  async getTimeSeries(
    tenantId: string,
    surface: QrSurfaceType,
    period: PeriodType = 'day',
    daysBack: number = 30
  ): Promise<QrTimeSeriesPoint[]> {
    const result = await this.makeDefaultRequest<{ data: QrTimeSeriesPoint[] }>(
      `/api/tenants/${tenantId}/qr-analytics/timeseries?surface=${surface}&period=${period}&daysBack=${daysBack}`,
      {},
      `qr-analytics-timeseries-${tenantId}-${surface}-${period}-${daysBack}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return [];
    }
    return result.data.data || [];
  }

  async triggerAggregation(
    tenantId: string,
    period: PeriodType = 'day'
  ): Promise<{ success: boolean; rowsComputed: number; errors: string[] }> {
    const result = await this.makeDefaultRequest<{ success: boolean; rowsComputed: number; errors: string[] }>(
      `/api/tenants/${tenantId}/qr-analytics/aggregate`,
      { method: 'POST', body: JSON.stringify({ period }) },
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

  async getAdminAnalytics(
    daysBack: number = 30,
    filters?: { consumer?: QrConsumerType; surface?: QrSurfaceType; tenantId?: string }
  ): Promise<AdminQrAnalyticsResult> {
    const params = new URLSearchParams({ daysBack: String(daysBack) });
    if (filters?.consumer) params.set('consumer', filters.consumer);
    if (filters?.surface) params.set('surface', filters.surface);
    if (filters?.tenantId) params.set('tenantId', filters.tenantId);

    const result = await this.makeDefaultRequest<AdminQrAnalyticsResult>(
      `/api/admin/qr-analytics?${params.toString()}`,
      {},
      `qr-analytics-admin-${daysBack}-${filters?.consumer || ''}-${filters?.surface || ''}-${filters?.tenantId || ''}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation }
    );
    if (!result.success || !result.data) {
      const errMsg = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errMsg || 'Failed to fetch admin QR analytics');
    }
    return result.data;
  }

  async trackScanEvent(event: {
    tenantId: string;
    surface?: QrSurfaceType;
    consumer?: QrConsumerType;
    productId?: string;
    sessionId?: string;
    source?: string;
    referrer?: string;
    userAgent?: string;
    geoCountry?: string;
    geoCity?: string;
  }): Promise<void> {
    try {
      await fetch('/api/public/qr-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch {
      // Silent fail — tracking should never break the page
    }
  }

  getSurfaceLabel(surface: QrSurfaceType): string {
    return SURFACE_LABELS[surface] || surface;
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

export const QrAnalyticsService = QrAnalyticsServiceClass.getInstance();
export default QrAnalyticsService;
