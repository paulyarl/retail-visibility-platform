/**
 * Brand Partner Service
 *
 * Service for brand partner self-service claim submission and lookup.
 * Extends AuthenticatedApiSingleton for automatic auth and caching.
 */

import { AuthenticatedApiSingleton } from '../providers/base/AuthenticatedApiSingleton';

export interface BrandPartnerClaim {
  id: string;
  brand_name: string;
  gtin: string;
  claim_type: string;
  admin_approved: boolean;
  contact_email: string | null;
}

export interface CreateClaimRequest {
  brand_name: string;
  gtin: string;
  claim_type: string;
  contact_email?: string;
}

class BrandPartnerService extends AuthenticatedApiSingleton {
  private static instance: BrandPartnerService;

  private constructor() {
    super('BrandPartnerService', { ttl: 2 * 60 * 1000 });
  }

  static getInstance(): BrandPartnerService {
    if (!BrandPartnerService.instance) {
      BrandPartnerService.instance = new BrandPartnerService();
    }
    return BrandPartnerService.instance;
  }

  async createClaim(req: CreateClaimRequest): Promise<{ success: boolean; claim?: BrandPartnerClaim; error?: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; claim?: BrandPartnerClaim; error?: string }>(
      '/api/brand-partners/claims',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      },
    );
    if (!result.success || !result.data) {
      return { success: false, error: typeof result.error === 'string' ? result.error : 'Failed to submit claim' };
    }
    return (result.data as any)?.data || result.data;
  }

  async getClaimsByGtin(gtin: string): Promise<BrandPartnerClaim[]> {
    const result = await this.makeDefaultRequest<{ success: boolean; claims: BrandPartnerClaim[] }>(
      `/api/brand-partners/claims?gtin=${encodeURIComponent(gtin)}`,
      {},
      `brand-partner-claims-${gtin}`,
      this.cacheTTL,
    );
    if (!result.success || !result.data) {
      return [];
    }
    const data = (result.data as any)?.data || result.data;
    return data.claims || [];
  }
}

export const brandPartnerService = BrandPartnerService.getInstance();
export default brandPartnerService;
