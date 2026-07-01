/**
 * FeaturedPlacementPurchaseService — Frontend singleton
 *
 * Merchant-facing API client for featured placement purchases.
 * Extends TenantApiSingleton for tenant-scoped auth and caching.
 */

import TenantApiSingleton from '../providers/base/TenantApiSingleton';

export interface PlacementPlan {
  id: string;
  planKey: string;
  label: string;
  surface: string;
  durationDays: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}

export interface PlacementPurchase {
  id: string;
  tenantId: string;
  inventoryItemId: string;
  planKey: string;
  surface: string;
  priceCents: number;
  currency: string;
  durationDays: number;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  status: string;
  purchasedAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  renewedFrom: string | null;
}

export interface RevenueSummary {
  totalRevenueCents: number;
  totalPurchases: number;
  activePurchases: number;
  revenueBySurface: Record<string, { revenueCents: number; count: number }>;
}

interface ApiEnvelope<T> {
  plans?: T;
  purchases?: T;
  purchase?: PlacementPurchase;
  summary?: RevenueSummary;
  purchaseId?: string;
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

class FeaturedPlacementPurchaseServiceClass extends TenantApiSingleton {
  private static instance: FeaturedPlacementPurchaseServiceClass;

  private constructor() {
    super('featured-placement-purchase', { ttl: 2 * 60 * 1000 });
  }

  static getInstance(): FeaturedPlacementPurchaseServiceClass {
    if (!FeaturedPlacementPurchaseServiceClass.instance) {
      FeaturedPlacementPurchaseServiceClass.instance = new FeaturedPlacementPurchaseServiceClass();
    }
    return FeaturedPlacementPurchaseServiceClass.instance;
  }

  getServiceCachePatterns(): string[] {
    return [
      'featured-placement-plans-*',
      'featured-placement-purchases-*',
      'featured-placement-purchase-detail-*',
    ];
  }

  async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`featured-placement-purchases-${tenantId}`);
      this.invalidateCache(`featured-placement-purchase-detail-${tenantId}`);
    }
  }

  // ====================
  // CATALOG (public plans)
  // ====================

  async listPlans(): Promise<PlacementPlan[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<PlacementPlan[]>>(
      `/api/admin/featured-placement/catalog`,
      { method: 'GET' },
      `featured-placement-plans`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load plans');
    return result.data.plans || [];
  }

  // ====================
  // PURCHASES
  // ====================

  async listPurchases(tenantId: string, status?: string): Promise<PlacementPurchase[]> {
    const qs = status ? `?status=${status}` : '';
    const result = await this.makeDefaultRequest<ApiEnvelope<PlacementPurchase[]>>(
      `/api/tenants/${tenantId}/featured-placements${qs}`,
      { method: 'GET' },
      `featured-placement-purchases-${tenantId}${qs}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load purchases');
    return result.data.purchases || [];
  }

  async getPurchase(tenantId: string, purchaseId: string): Promise<PlacementPurchase> {
    const result = await this.makeDefaultRequest<ApiEnvelope<PlacementPurchase>>(
      `/api/tenants/${tenantId}/featured-placements/${purchaseId}`,
      { method: 'GET' },
      `featured-placement-purchase-detail-${tenantId}-${purchaseId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load purchase');
    return result.data.purchase!;
  }

  async createPurchase(
    tenantId: string,
    data: { inventoryItemId: string; planKey: string; successUrl: string; cancelUrl: string }
  ): Promise<{ purchaseId: string; checkoutUrl: string }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/featured-placements`,
      { method: 'POST', body: JSON.stringify(data) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success && result.data.error) throw new Error(result.data.error);
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
      `/api/tenants/${tenantId}/featured-placements/${purchaseId}/renew`,
      { method: 'POST', body: JSON.stringify(data) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success && result.data.error) throw new Error(result.data.error);
    await this.invalidateServiceCaches(tenantId);
    return {
      newPurchaseId: result.data.newPurchaseId || result.data.purchaseId!,
      checkoutUrl: result.data.checkoutUrl!,
    };
  }

  // ====================
  // ADMIN: CATALOG CRUD
  // ====================

  async adminListPlans(includeInactive = false): Promise<PlacementPlan[]> {
    const qs = includeInactive ? '?includeInactive=true' : '';
    const result = await this.makeDefaultRequest<ApiEnvelope<PlacementPlan[]>>(
      `/api/admin/featured-placement/catalog${qs}`,
      { method: 'GET' },
      `featured-placement-admin-plans${qs}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data.plans || [];
  }

  async adminCreatePlan(data: {
    planKey: string;
    label: string;
    surface: string;
    durationDays: number;
    priceCents: number;
    currency?: string;
    sortOrder?: number;
  }): Promise<PlacementPlan> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ plan: PlacementPlan }>>(
      `/api/admin/featured-placement/catalog`,
      { method: 'POST', body: JSON.stringify(data) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to create plan');
    this.invalidateCache('featured-placement-admin-plans');
    this.invalidateCache('featured-placement-plans');
    return result.data.plan;
  }

  async adminUpdatePlan(planKey: string, data: Partial<{
    label: string;
    surface: string;
    durationDays: number;
    priceCents: number;
    currency: string;
    isActive: boolean;
    sortOrder: number;
  }>): Promise<PlacementPlan> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ plan: PlacementPlan }>>(
      `/api/admin/featured-placement/catalog/${planKey}`,
      { method: 'PUT', body: JSON.stringify(data) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to update plan');
    this.invalidateCache('featured-placement-admin-plans');
    this.invalidateCache('featured-placement-plans');
    return result.data.plan;
  }

  async adminDeletePlan(planKey: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/admin/featured-placement/catalog/${planKey}`,
      { method: 'DELETE' },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    this.invalidateCache('featured-placement-admin-plans');
    this.invalidateCache('featured-placement-plans');
  }

  // ====================
  // ADMIN: PURCHASES & REVENUE
  // ====================

  async adminListPurchases(filters: { status?: string; surface?: string; tenantId?: string } = {}): Promise<PlacementPurchase[]> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.surface) params.append('surface', filters.surface);
    if (filters.tenantId) params.append('tenantId', filters.tenantId);
    const qs = params.toString();

    const result = await this.makeDefaultRequest<ApiEnvelope<PlacementPurchase[]>>(
      `/api/admin/featured-placement/purchases${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      `featured-placement-admin-purchases${qs ? `-${qs}` : ''}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data.purchases || [];
  }

  async adminRevokePurchase(purchaseId: string, reason: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/admin/featured-placement/purchases/${purchaseId}/revoke`,
      { method: 'POST', body: JSON.stringify({ reason }) },
      undefined,
      undefined
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to revoke');
  }

  async adminGetRevenue(filters: { surface?: string; startDate?: string; endDate?: string } = {}): Promise<RevenueSummary> {
    const params = new URLSearchParams();
    if (filters.surface) params.append('surface', filters.surface);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const qs = params.toString();

    const result = await this.makeDefaultRequest<ApiEnvelope<RevenueSummary>>(
      `/api/admin/featured-placement/revenue${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      `featured-placement-revenue${qs ? `-${qs}` : ''}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data.summary || {
      totalRevenueCents: 0,
      totalPurchases: 0,
      activePurchases: 0,
      revenueBySurface: {},
    };
  }

  // ====================
  // HELPERS
  // ====================

  formatCurrency(cents: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  }

  formatSurface(surface: string): string {
    const labels: Record<string, string> = {
      storefront_spotlight: 'Storefront Spotlight',
      cross_tenant_shops: 'Shops Page',
      directory: 'Directory',
    };
    return labels[surface] || surface;
  }

  formatStatus(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      active: 'Active',
      expired: 'Expired',
      revoked: 'Revoked',
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

export const FeaturedPlacementPurchaseService = FeaturedPlacementPurchaseServiceClass.getInstance();
export default FeaturedPlacementPurchaseService;
