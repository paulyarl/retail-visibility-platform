/**
 * FunnelService — Frontend singleton
 *
 * Merchant-facing API client for sales funnels CRUD and analytics.
 * Extends TenantApiSingleton for tenant-scoped auth and caching.
 */

import TenantApiSingleton from '../providers/base/TenantApiSingleton';

export type FunnelStepType = 'order_bump' | 'upsell' | 'downsell' | 'oto';

export interface FunnelStep {
  id: string;
  funnel_id: string;
  step_type: string;
  offer_item_id: string;
  display_title: string | null;
  display_description: string | null;
  price_cents: number | null;
  discount_cents: number;
  sort_order: number;
  accept_to_step_id: string | null;
  skip_to_step_id: string | null;
  is_active: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface FunnelWithSteps {
  id: string;
  tenant_id: string;
  name: string;
  entry_item_id: string | null;
  trigger_type: string;
  min_cart_value_cents: number | null;
  is_active: boolean;
  is_default: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  steps: FunnelStep[];
}

export interface FunnelStepInput {
  id?: string;
  step_type: FunnelStepType;
  offer_item_id: string;
  display_title?: string | null;
  display_description?: string | null;
  price_cents?: number | null;
  discount_cents?: number;
  sort_order?: number;
  accept_to_step_id?: string | null;
  skip_to_step_id?: string | null;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface FunnelInput {
  name: string;
  entry_item_id?: string | null;
  trigger_type?: 'product' | 'cart_value' | 'always';
  min_cart_value_cents?: number | null;
  is_active?: boolean;
  is_default?: boolean;
  metadata?: Record<string, any>;
  steps: FunnelStepInput[];
}

export interface FunnelAnalyticsSummary {
  total_views: number;
  total_accepts: number;
  total_skips: number;
  total_revenue_cents: number;
  conversion_rate: number;
  revenue_uplift_cents: number;
}

export interface FunnelStepConversion {
  step_id: string;
  step_type: string;
  views: number;
  accepts: number;
  skips: number;
  revenue_cents: number;
  conversion_rate: number;
}

export interface FunnelTimeSeries {
  date: string;
  views: number;
  accepts: number;
  revenue_cents: number;
}

interface ApiEnvelope<T> {
  success?: boolean;
  error?: string;
  funnel?: T;
  funnels?: T;
  summary?: FunnelAnalyticsSummary;
  steps?: FunnelStepConversion[];
  timeseries?: FunnelTimeSeries[];
  [key: string]: any;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) return (error as any).message;
  return 'Unknown error';
}

class FunnelServiceClass extends TenantApiSingleton {
  private static instance: FunnelServiceClass;

  private constructor() {
    super('funnel-service', { ttl: 2 * 60 * 1000 });
  }

  static getInstance(): FunnelServiceClass {
    if (!FunnelServiceClass.instance) {
      FunnelServiceClass.instance = new FunnelServiceClass();
    }
    return FunnelServiceClass.instance;
  }

  getServiceCachePatterns(): string[] {
    return [
      'funnel-list-*',
      'funnel-detail-*',
      'funnel-analytics-*',
    ];
  }

  async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`funnel-list-${tenantId}`);
      this.invalidateCache(`funnel-detail-${tenantId}`);
      this.invalidateCache(`funnel-analytics-${tenantId}`);
    }
  }

  async listFunnels(tenantId: string, includeInactive?: boolean): Promise<FunnelWithSteps[]> {
    const qs = includeInactive ? '?includeInactive=true' : '';
    const result = await this.makeDefaultRequest<ApiEnvelope<FunnelWithSteps[]>>(
      `/api/tenants/${tenantId}/funnels${qs}`,
      { method: 'GET' },
      `funnel-list-${tenantId}${qs}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    return result.data.funnels || [];
  }

  async getFunnel(tenantId: string, funnelId: string): Promise<FunnelWithSteps> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FunnelWithSteps>>(
      `/api/tenants/${tenantId}/funnels/${funnelId}`,
      { method: 'GET' },
      `funnel-detail-${tenantId}-${funnelId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    return result.data.funnel!;
  }

  async createFunnel(tenantId: string, data: FunnelInput): Promise<FunnelWithSteps> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FunnelWithSteps>>(
      `/api/tenants/${tenantId}/funnels`,
      { method: 'POST', body: JSON.stringify(data) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    await this.invalidateServiceCaches(tenantId);
    return result.data.funnel!;
  }

  async updateFunnel(tenantId: string, funnelId: string, data: Partial<FunnelInput>): Promise<FunnelWithSteps> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FunnelWithSteps>>(
      `/api/tenants/${tenantId}/funnels/${funnelId}`,
      { method: 'PUT', body: JSON.stringify(data) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    await this.invalidateServiceCaches(tenantId);
    return result.data.funnel!;
  }

  async deleteFunnel(tenantId: string, funnelId: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/funnels/${funnelId}`,
      { method: 'DELETE' },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    await this.invalidateServiceCaches(tenantId);
  }

  async getFunnelAnalytics(
    tenantId: string,
    funnelId: string
  ): Promise<{ summary: FunnelAnalyticsSummary | null; steps: FunnelStepConversion[]; timeseries: FunnelTimeSeries[] }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/funnels/${funnelId}/analytics`,
      { method: 'GET' },
      `funnel-analytics-${tenantId}-${funnelId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    return {
      summary: result.data.summary || null,
      steps: result.data.steps || [],
      timeseries: result.data.timeseries || [],
    };
  }
}

export const FunnelService = FunnelServiceClass.getInstance();
export default FunnelService;
