/**
 * DirectoryPromotionService — Frontend singleton
 *
 * Merchant-facing API client for directory promotion purchases.
 * Extends TenantApiSingleton for tenant-scoped auth and caching.
 */

import TenantApiSingleton from '../providers/base/TenantApiSingleton';

export interface PromotionPlan {
  id: string;
  planKey: string;
  label: string;
  tier: string;
  durationDays: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}

export interface PromotionPurchase {
  id: string;
  tenantId: string;
  planKey: string;
  tier: string;
  priceCents: number;
  currency: string;
  durationDays: number;
  status: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  gracePeriodEndsAt: string | null;
  renewedFrom: string | null;
  createdAt: string;
}

export interface PromotionRevenueSummary {
  totalRevenueCents: number;
  totalPurchases: number;
  activePurchases: number;
  revenueByTier: Record<string, { revenueCents: number; count: number }>;
}

interface ApiEnvelope<T> {
  plans?: T;
  purchases?: T;
  plan?: PromotionPlan;
  purchase?: PromotionPurchase;
  summary?: PromotionRevenueSummary;
  purchaseId?: string;
  newPurchaseId?: string;
  checkoutUrl?: string;
  success?: boolean;
  error?: string;
  [key: string]: any;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) return (error as any).message;
  return 'Unknown error';
}

class DirectoryPromotionServiceClass extends TenantApiSingleton {
  private static instance: DirectoryPromotionServiceClass;

  private constructor() {
    super('directory-promotion', { ttl: 2 * 60 * 1000 });
  }

  static getInstance(): DirectoryPromotionServiceClass {
    if (!DirectoryPromotionServiceClass.instance) {
      DirectoryPromotionServiceClass.instance = new DirectoryPromotionServiceClass();
    }
    return DirectoryPromotionServiceClass.instance;
  }

  getServiceCachePatterns(): string[] {
    return [
      'directory-promotion-plans-*',
      'directory-promotion-purchases-*',
      'directory-promotion-status-*',
    ];
  }

  async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`directory-promotion-purchases-${tenantId}`);
      this.invalidateCache(`directory-promotion-status-${tenantId}`);
    }
  }

  // ====================
  // STATUS
  // ====================

  async getStatus(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/promotion/status`,
      { method: 'GET' },
      `directory-promotion-status-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    return result.data;
  }

  // ====================
  // CATALOG (public plans)
  // ====================

  async listPlans(tenantId: string): Promise<PromotionPlan[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<PromotionPlan[]>>(
      `/api/tenants/${tenantId}/promotion/plans`,
      { method: 'GET' },
      `directory-promotion-plans-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    return result.data.plans || [];
  }

  // ====================
  // PURCHASES
  // ====================

  async listPurchases(tenantId: string, status?: string): Promise<PromotionPurchase[]> {
    const qs = status ? `?status=${status}` : '';
    const result = await this.makeDefaultRequest<ApiEnvelope<PromotionPurchase[]>>(
      `/api/tenants/${tenantId}/promotion/purchases${qs}`,
      { method: 'GET' },
      `directory-promotion-purchases-${tenantId}${qs}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    return result.data.purchases || [];
  }

  async createPurchase(
    tenantId: string,
    data: { planKey: string; successUrl: string; cancelUrl: string }
  ): Promise<{ purchaseId: string; checkoutUrl: string }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/promotion/purchase`,
      { method: 'POST', body: JSON.stringify(data) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    await this.invalidateServiceCaches(tenantId);
    return {
      purchaseId: result.data.purchaseId!,
      checkoutUrl: result.data.checkoutUrl!,
    };
  }

  async renewPurchase(
    tenantId: string,
    purchaseId: string,
    data: { successUrl: string; cancelUrl: string }
  ): Promise<{ newPurchaseId: string; checkoutUrl: string }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/promotion/renew`,
      { method: 'POST', body: JSON.stringify({ purchaseId, ...data }) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    await this.invalidateServiceCaches(tenantId);
    return {
      newPurchaseId: result.data.newPurchaseId!,
      checkoutUrl: result.data.checkoutUrl!,
    };
  }

  async cancelPromotion(tenantId: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/promotion/cancel`,
      { method: 'POST' },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    await this.invalidateServiceCaches(tenantId);
  }

  // ====================
  // ANALYTICS
  // ====================

  async getAnalytics(tenantId: string): Promise<{
    isPromoted: boolean;
    promotionTier: string | null;
    promotionStartedAt: string | null;
    promotionExpiresAt: string | null;
    impressions: number;
    clicks: number;
    clickThroughRate: number;
    daysActive: number;
    avgImpressionsPerDay: number;
    avgClicksPerDay: number;
  }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/promotion/analytics`,
      { method: 'GET' },
      `directory-promotion-analytics-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    return {
      isPromoted: result.data.isPromoted,
      promotionTier: result.data.promotionTier,
      promotionStartedAt: result.data.promotionStartedAt,
      promotionExpiresAt: result.data.promotionExpiresAt,
      impressions: result.data.impressions,
      clicks: result.data.clicks,
      clickThroughRate: result.data.clickThroughRate,
      daysActive: result.data.daysActive,
      avgImpressionsPerDay: result.data.avgImpressionsPerDay,
      avgClicksPerDay: result.data.avgClicksPerDay,
    };
  }

  // ====================
  // TRACKING (fire-and-forget, no caching)
  // ====================

  async trackImpression(tenantId: string): Promise<void> {
    try {
      await this.makeDefaultRequest<ApiEnvelope<any>>(
        `/api/tenants/${tenantId}/promotion/track-impression`,
        { method: 'POST' },
        undefined,
        undefined
      );
    } catch {
      // fire-and-forget — silent failure
    }
  }

  async trackClick(tenantId: string): Promise<void> {
    try {
      await this.makeDefaultRequest<ApiEnvelope<any>>(
        `/api/tenants/${tenantId}/promotion/track-click`,
        { method: 'POST' },
        undefined,
        undefined
      );
    } catch {
      // fire-and-forget — silent failure
    }
  }

  // ====================
  // ADMIN: CATALOG CRUD
  // ====================

  async adminListPlans(includeInactive = false): Promise<PromotionPlan[]> {
    const qs = includeInactive ? '?includeInactive=true' : '';
    const result = await this.makeDefaultRequest<ApiEnvelope<PromotionPlan[]>>(
      `/api/admin/promotion/catalog${qs}`,
      { method: 'GET' },
      `directory-promotion-admin-plans${qs}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data.plans || [];
  }

  async adminGetLevels(): Promise<string[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ levels: string[] }>>(
      `/api/admin/promotion/levels`,
      { method: 'GET' },
      `directory-promotion-admin-levels`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data.levels || ['basic', 'premium', 'featured'];
  }

  async adminCreatePlan(data: {
    label: string;
    tier: string;
    durationDays: number;
    priceCents: number;
    currency?: string;
    sortOrder?: number;
  }): Promise<PromotionPlan> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ plan: PromotionPlan }>>(
      `/api/admin/promotion/catalog`,
      { method: 'POST', body: JSON.stringify(data) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    this.invalidateCache('directory-promotion-admin-plans');
    this.invalidateCache('directory-promotion-plans');
    return result.data.plan!;
  }

  async adminUpdatePlan(planKey: string, data: Partial<{
    label: string;
    tier: string;
    durationDays: number;
    priceCents: number;
    currency: string;
    isActive: boolean;
    sortOrder: number;
  }>): Promise<PromotionPlan> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ plan: PromotionPlan }>>(
      `/api/admin/promotion/catalog/${planKey}`,
      { method: 'PUT', body: JSON.stringify(data) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (result.data.error) throw new Error(result.data.error);
    this.invalidateCache('directory-promotion-admin-plans');
    this.invalidateCache('directory-promotion-plans');
    return result.data.plan!;
  }

  async adminDeletePlan(planKey: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/admin/promotion/catalog/${planKey}`,
      { method: 'DELETE' },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    this.invalidateCache('directory-promotion-admin-plans');
    this.invalidateCache('directory-promotion-plans');
  }

  // ====================
  // ADMIN: PURCHASES & REVENUE
  // ====================

  async adminListPurchases(filters: { status?: string; tier?: string; tenantId?: string } = {}): Promise<PromotionPurchase[]> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.tier) params.append('tier', filters.tier);
    if (filters.tenantId) params.append('tenantId', filters.tenantId);
    const qs = params.toString();

    const result = await this.makeDefaultRequest<ApiEnvelope<PromotionPurchase[]>>(
      `/api/admin/promotion/purchases${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      `directory-promotion-admin-purchases${qs ? `-${qs}` : ''}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data.purchases || [];
  }

  async adminGetRevenue(filters: { tier?: string; startDate?: string; endDate?: string } = {}): Promise<PromotionRevenueSummary> {
    const params = new URLSearchParams();
    if (filters.tier) params.append('tier', filters.tier);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const qs = params.toString();

    const result = await this.makeDefaultRequest<ApiEnvelope<PromotionRevenueSummary>>(
      `/api/admin/promotion/revenue${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      `directory-promotion-revenue${qs ? `-${qs}` : ''}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data.summary || {
      totalRevenueCents: 0,
      totalPurchases: 0,
      activePurchases: 0,
      revenueByTier: {},
    };
  }

  // ====================
  // HELPERS
  // ====================

  formatCurrency(cents: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  }

  formatTier(tier: string): string {
    const labels: Record<string, string> = {
      basic: 'Basic',
      premium: 'Premium',
      featured: 'Featured',
    };
    return labels[tier] || tier;
  }

  formatStatus(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      active: 'Active',
      expired: 'Expired',
      cancelled: 'Cancelled',
      grace_period: 'Grace Period',
    };
    return labels[status] || status;
  }

  formatExpiry(expiresAt: string | null): string {
    if (!expiresAt) return '—';
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    return `Expires in ${diffDays} days (${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  }
}

export const DirectoryPromotionService = DirectoryPromotionServiceClass.getInstance();
export default DirectoryPromotionService;
