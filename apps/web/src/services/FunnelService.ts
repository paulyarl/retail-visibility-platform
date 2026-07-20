/**
 * FunnelService — Frontend singleton
 *
 * Merchant-facing API client for sales funnels CRUD and analytics.
 * Extends TenantApiSingleton for tenant-scoped auth and caching.
 */

import TenantApiSingleton from '../providers/base/TenantApiSingleton';

export type FunnelStepType = 'order_bump' | 'upsell' | 'downsell' | 'oto' | 'coupon_offer';

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

export interface FunnelOptionsSettings {
  funnel_options_enabled: boolean;
  order_bump_enabled: boolean;
  upsell_enabled: boolean;
  downsell_enabled: boolean;
  oto_enabled: boolean;
  coupon_offer_enabled: boolean;
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

export interface FunnelAovComparison {
  aov_with_funnel_cents: number;
  aov_without_funnel_cents: number;
  orders_with_funnel: number;
  orders_without_funnel: number;
  uplift_percent: number;
}

export interface FunnelOptionsSettings {
  funnel_options_enabled: boolean;
  order_bump_enabled: boolean;
  upsell_enabled: boolean;
  downsell_enabled: boolean;
  oto_enabled: boolean;
  coupon_offer_enabled: boolean;
}

interface ApiEnvelope<T> {
  success?: boolean;
  error?: string;
  funnel?: T;
  funnels?: T;
  summary?: FunnelAnalyticsSummary;
  steps?: FunnelStepConversion[];
  timeseries?: FunnelTimeSeries[];
  aov?: FunnelAovComparison;
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
  ): Promise<{ summary: FunnelAnalyticsSummary | null; steps: FunnelStepConversion[]; timeseries: FunnelTimeSeries[]; aov: FunnelAovComparison | null }> {
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
      aov: result.data.aov || null,
    };
  }

  async getFunnelOptionsSettings(tenantId: string): Promise<FunnelOptionsSettings> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FunnelOptionsSettings>>(
      `/api/tenants/${tenantId}/funnels/options`,
      { method: 'GET' },
      `funnel-options-settings-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    return (result.data.data as FunnelOptionsSettings) || {
      funnel_options_enabled: true,
      order_bump_enabled: true,
      upsell_enabled: true,
      downsell_enabled: true,
      oto_enabled: true,
      coupon_offer_enabled: true,
    };
  }

  async updateFunnelOptionsSettings(tenantId: string, settings: FunnelOptionsSettings): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/funnels/options`,
      { method: 'PUT', body: JSON.stringify({
        funnelOptionsEnabled: settings.funnel_options_enabled,
        orderBumpEnabled: settings.order_bump_enabled,
        upsellEnabled: settings.upsell_enabled,
        downsellEnabled: settings.downsell_enabled,
        otoEnabled: settings.oto_enabled,
        couponOfferEnabled: settings.coupon_offer_enabled,
      }) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    this.invalidateCache(`funnel-options-settings-${tenantId}`);
  }

  async getSettings(tenantId: string): Promise<FunnelOptionsSettings> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ settings: FunnelOptionsSettings }>>(
      `/api/tenants/${tenantId}/funnels/settings`,
      { method: 'GET' },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    return result.data.settings;
  }

  async updateSettings(tenantId: string, settings: Partial<FunnelOptionsSettings>): Promise<FunnelOptionsSettings> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ settings: FunnelOptionsSettings }>>(
      `/api/tenants/${tenantId}/funnels/settings`,
      { method: 'PUT', body: JSON.stringify(settings) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    return result.data.settings;
  }
}

export const FunnelService = FunnelServiceClass.getInstance();
export default FunnelService;
