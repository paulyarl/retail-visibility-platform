/**
 * Admin Wholesale Matching Service
 *
 * Service for admin-level wholesale matching endpoints.
 * Extends AdminApiSingleton for automatic auth, caching, and audit headers.
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface AdminSupplierMatch {
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

export interface AdminAffiliateAnalytics {
  total_clicks: number;
  pending: number;
  converted: number;
  expired: number;
  total_commission: number;
}

export interface AdminSupplierListResult {
  items: AdminSupplierMatch[];
  total: number;
}

class AdminWholesaleService extends AdminApiSingleton {
  private static instance: AdminWholesaleService;

  private constructor() {
    super('AdminWholesaleService');
  }

  static getInstance(): AdminWholesaleService {
    if (!AdminWholesaleService.instance) {
      AdminWholesaleService.instance = new AdminWholesaleService();
    }
    return AdminWholesaleService.instance;
  }

  async getAllSuppliers(limit = 50, offset = 0): Promise<AdminSupplierListResult> {
    const result = await this.makeDefaultRequest<{ success: boolean; items: AdminSupplierMatch[]; total: number }>(
      `/api/admin/wholesale/suppliers?limit=${limit}&offset=${offset}`,
      {},
      `admin-wholesale-suppliers-${limit}-${offset}`,
      this.cacheTTL,
    );
    if (!result.success || !result.data) {
      return { items: [], total: 0 };
    }
    const data = result.data as any;
    return { items: data.items || [], total: data.total || 0 };
  }

  async getAffiliateAnalytics(tenantId?: string): Promise<AdminAffiliateAnalytics> {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const result = await this.makeDefaultRequest<{ success: boolean; analytics: AdminAffiliateAnalytics }>(
      `/api/admin/wholesale/affiliate/analytics${query}`,
      {},
      `admin-wholesale-analytics-${tenantId || 'all'}`,
      this.cacheTTL,
    );
    if (!result.success || !result.data) {
      return { total_clicks: 0, pending: 0, converted: 0, expired: 0, total_commission: 0 };
    }
    const data = result.data as any;
    return data.analytics || data;
  }
}

export const adminWholesaleService = AdminWholesaleService.getInstance();
export default adminWholesaleService;
