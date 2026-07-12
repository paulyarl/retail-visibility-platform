/**
 * Wholesale Matching Service (Frontend Singleton)
 *
 * Fetches wholesale supplier matches, Faire search results, and affiliate
 * link data from the backend API.
 * Extends TenantApiSingleton for automatic auth, caching, and cache invalidation.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface SupplierMatch {
  id: string;
  gtin: string;
  supplier_name: string;
  supplier_type: string;
  moq: number;
  min_order_value: number | null;
  external_link: string | null;
  affiliate_params: any;
  region: string;
  claim_type: string;
  brand_partner_id: string | null;
}

export interface FaireSearchResult {
  supplier_name: string;
  brand: string;
  product_url: string;
  moq: number;
  wholesale_price: number | null;
  image_url: string | null;
}

export interface AffiliateLinkResult {
  click_id: string;
  affiliate_url: string;
  expires_at: string;
}

export interface AffiliateAnalytics {
  total_clicks: number;
  pending: number;
  converted: number;
  expired: number;
  total_commission: number;
}

export interface WholesaleDashboardData {
  analytics: AffiliateAnalytics;
  recentSuppliers: SupplierMatch[];
}

export type WholesaleMatchingTier = 'none' | 'search' | 'full';

export interface WholesaleMatchingState {
  enabled: boolean;
  tier: WholesaleMatchingTier;
  canCheckSupplierMatch: boolean;
  canSearchFaire: boolean;
  canBuildAffiliateLink: boolean;
  isFlexible: boolean;
}

class WholesaleMatchingServiceClass extends TenantApiSingleton {
  private static instance: WholesaleMatchingServiceClass;

  private constructor() {
    super('wholesale-matching-singleton', { ttl: 5 * 60 * 1000 });
  }

  public static getInstance(): WholesaleMatchingServiceClass {
    if (!WholesaleMatchingServiceClass.instance) {
      WholesaleMatchingServiceClass.instance = new WholesaleMatchingServiceClass();
    }
    return WholesaleMatchingServiceClass.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['wholesale-check-*', 'wholesale-search-*', 'wholesale-suppliers-*', 'wholesale-dashboard-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`wholesale-check-${tenantId}`);
      this.invalidateCache(`wholesale-search-${tenantId}`);
      this.invalidateCache(`wholesale-suppliers-${tenantId}`);
      this.invalidateCache(`wholesale-dashboard-${tenantId}`);
    }
  }

  async checkMatch(tenantId: string, gtin: string): Promise<SupplierMatch[]> {
    const result = await this.makeDefaultRequest<{ matches: SupplierMatch[] }>(
      `/api/tenants/${tenantId}/wholesale/check?gtin=${encodeURIComponent(gtin)}`,
      {},
      `wholesale-check-${tenantId}-${gtin}`,
      2 * 60 * 1000,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return [];
    }
    return result.data.matches || [];
  }

  async searchSuppliers(tenantId: string, query: string, page: number = 1): Promise<FaireSearchResult[]> {
    const result = await this.makeDefaultRequest<{ results: FaireSearchResult[] }>(
      `/api/tenants/${tenantId}/wholesale/search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, page }),
      },
      undefined,
      undefined,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return [];
    }
    return result.data.results || [];
  }

  async buildAffiliateLink(
    tenantId: string,
    supplierId: string,
    gtin: string
  ): Promise<AffiliateLinkResult | null> {
    const result = await this.makeDefaultRequest<AffiliateLinkResult>(
      `/api/tenants/${tenantId}/wholesale/affiliate-link`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId, gtin }),
      },
      undefined,
      undefined,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return null;
    }
    return result.data;
  }

  async listSuppliers(
    tenantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ items: SupplierMatch[]; total: number }> {
    const result = await this.makeDefaultRequest<{ items: SupplierMatch[]; total: number }>(
      `/api/tenants/${tenantId}/wholesale/suppliers?limit=${limit}&offset=${offset}`,
      {},
      `wholesale-suppliers-${tenantId}-${limit}-${offset}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return { items: [], total: 0 };
    }
    return result.data;
  }

  async getDashboard(tenantId: string): Promise<WholesaleDashboardData> {
    const result = await this.makeDefaultRequest<WholesaleDashboardData>(
      `/api/tenants/${tenantId}/wholesale/dashboard`,
      {},
      `wholesale-dashboard-${tenantId}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return { analytics: { total_clicks: 0, pending: 0, converted: 0, expired: 0, total_commission: 0 }, recentSuppliers: [] };
    }
    return result.data;
  }

  formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }
}

export const WholesaleMatchingService = WholesaleMatchingServiceClass.getInstance();
export default WholesaleMatchingService;
