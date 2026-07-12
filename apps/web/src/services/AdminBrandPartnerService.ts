/**
 * Admin Brand Partner Service
 *
 * Service for managing brand partner claims via admin API.
 * Extends AdminApiSingleton for automatic auth, caching, and audit headers.
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface AdminBrandPartnerClaim {
  id: string;
  brand_name: string;
  gtin: string;
  claim_type: string;
  supplier_id: string | null;
  admin_approved: boolean;
  contact_email: string | null;
}

export interface AdminBrandPartnerClaimsResponse {
  success: boolean;
  claims: AdminBrandPartnerClaim[];
  total: number;
}

export interface AdminBrandPartnerFilters {
  gtin?: string;
  brand_name?: string;
  approved?: string;
  limit?: number;
}

class AdminBrandPartnerService extends AdminApiSingleton {
  private static instance: AdminBrandPartnerService;

  private constructor() {
    super('AdminBrandPartnerService');
  }

  static getInstance(): AdminBrandPartnerService {
    if (!AdminBrandPartnerService.instance) {
      AdminBrandPartnerService.instance = new AdminBrandPartnerService();
    }
    return AdminBrandPartnerService.instance;
  }

  async listClaims(filters: AdminBrandPartnerFilters = {}): Promise<AdminBrandPartnerClaimsResponse> {
    const params = new URLSearchParams();
    if (filters.gtin) params.set('gtin', filters.gtin);
    if (filters.brand_name) params.set('brand_name', filters.brand_name);
    if (filters.approved && filters.approved !== 'all') params.set('approved', filters.approved);
    params.set('limit', String(filters.limit || 100));

    const result = await this.makeDefaultRequest<AdminBrandPartnerClaimsResponse>(
      `/api/admin/brand-partners/claims?${params}`,
      {},
      `admin-brand-partner-claims-${filters.gtin || ''}-${filters.brand_name || ''}-${filters.approved || ''}`,
      this.cacheTTL,
    );
    if (!result.success || !result.data) {
      return { success: false, claims: [], total: 0 };
    }
    return (result.data as any)?.data || result.data;
  }

  async approveClaim(claimId: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/admin/brand-partners/claims/${claimId}/approve`,
      {
        method: 'PUT',
      },
    );
    return result.success;
  }

  async rejectClaim(claimId: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/admin/brand-partners/claims/${claimId}`,
      {
        method: 'DELETE',
      },
    );
    return result.success;
  }
}

export const adminBrandPartnerService = AdminBrandPartnerService.getInstance();
export default adminBrandPartnerService;
