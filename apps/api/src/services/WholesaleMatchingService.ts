/**
 * WholesaleMatchingService
 *
 * Handles B2B wholesale supplier matching, Faire supplier search,
 * affiliate link generation, and brand partner claim lookups.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import {
  generateProductSupplierId,
  generateAffiliateClickId,
  generateBrandPartnerClaimId,
} from '../lib/id-generator';

// ── Types ──────────────────────────────────────────────────────────────

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
  expires_at: Date;
}

export interface BrandPartnerClaimDTO {
  id: string;
  brand_name: string;
  gtin: string;
  claim_type: string;
  supplier_id: string | null;
  admin_approved: boolean;
  contact_email: string | null;
}

export interface AffiliateAnalytics {
  total_clicks: number;
  pending: number;
  converted: number;
  expired: number;
  total_commission: number;
}

// ── Claim type priority (exclusive > preferred > verified) ─────────────

const CLAIM_PRIORITY: Record<string, number> = {
  exclusive: 0,
  preferred: 1,
  verified: 2,
};

// ── Service ────────────────────────────────────────────────────────────

class WholesaleMatchingServiceClass {
  /**
   * Check for supplier matches by GTIN.
   * Returns matches sorted by claim_type hierarchy (exclusive first).
   */
  async checkSupplierMatch(gtin: string): Promise<SupplierMatch[]> {
    try {
      const rows = await prisma.product_suppliers.findMany({
        where: { gtin },
        orderBy: { claim_type: 'asc' },
      });

      const sorted = rows.sort((a, b) => {
        const pa = CLAIM_PRIORITY[a.claim_type] ?? 99;
        const pb = CLAIM_PRIORITY[b.claim_type] ?? 99;
        return pa - pb;
      });

      return sorted.map((r) => ({
        id: r.id,
        gtin: r.gtin,
        supplier_name: r.supplier_name,
        supplier_type: r.supplier_type,
        moq: r.moq,
        min_order_value: r.min_order_value ? Number(r.min_order_value) : null,
        external_link: r.external_link,
        affiliate_params: r.affiliate_params as any,
        region: r.region,
        claim_type: r.claim_type,
        brand_partner_id: r.brand_partner_id,
      }));
    } catch (err) {
      logger.error('WholesaleMatchingService.checkSupplierMatch failed', undefined, {
        gtin,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Search Faire for suppliers by text query.
   * Calls Faire API (verify endpoint availability via partner program).
   */
  async searchFaireSuppliers(query: string, page: number = 1): Promise<FaireSearchResult[]> {
    const apiKey = process.env.FAIRE_API_KEY;
    if (!apiKey) {
      logger.warn('Faire API key not configured', undefined, { envVar: 'FAIRE_API_KEY' });
      return [];
    }

    const apiUrl = process.env.FAIRE_API_URL || 'https://api.faire.com/wholesale';
    const url = `${apiUrl}/products?query=${encodeURIComponent(query)}&page=${page}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        logger.warn('Faire API returned non-OK status', undefined, {
          status: res.status,
          query,
        });
        return [];
      }

      const data = await res.json() as any;
      const products = data.products || data.items || [];

      return products.map((p: any) => ({
        supplier_name: p.brand?.name || p.supplier_name || 'Unknown',
        brand: p.brand?.name || '',
        product_url: p.url || p.product_url || '',
        moq: p.minimum_order_quantity || p.moq || 1,
        wholesale_price: p.wholesale_price ? Number(p.wholesale_price) : null,
        image_url: p.image_url || p.thumbnail_url || null,
      }));
    } catch (err) {
      logger.error('Faire supplier search failed', undefined, {
        query,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Build an affiliate link for a supplier, creating an affiliate_clicks record.
   * The link includes tracking params (ref, click_id, utm_*).
   */
  async buildAffiliateLink(
    supplier: SupplierMatch,
    tenantId: string
  ): Promise<AffiliateLinkResult> {
    const clickId = generateAffiliateClickId(tenantId);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const baseUrl = supplier.external_link || '';
    const params = new URLSearchParams({
      ref: 'visibleshelf',
      click_id: clickId,
      utm_source: 'visibleshelf',
      utm_medium: 'wholesale_match',
      utm_campaign: tenantId,
    });

    const affiliateUrl = baseUrl
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${params.toString()}`
      : `https://faire.com/?${params.toString()}`;

    try {
      await prisma.affiliate_clicks.create({
        data: {
          id: clickId,
          tenant_id: tenantId,
          gtin: supplier.gtin,
          supplier_id: supplier.id,
          click_id: clickId,
          external_url: affiliateUrl,
          status: 'pending',
          expires_at: expiresAt,
        },
      });

      logger.info('Affiliate link created', undefined, {
        clickId,
        tenantId,
        gtin: supplier.gtin,
        supplierId: supplier.id,
      });
    } catch (err) {
      logger.error('Failed to create affiliate click record', undefined, {
        clickId,
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      click_id: clickId,
      affiliate_url: affiliateUrl,
      expires_at: expiresAt,
    };
  }

  /**
   * Track an affiliate click — update status (e.g. from Faire webhook).
   */
  async trackAffiliateClick(
    clickId: string,
    status: 'pending' | 'converted' | 'expired',
    commissionAmount?: number
  ): Promise<void> {
    try {
      const click = await prisma.affiliate_clicks.findFirst({
        where: { click_id: clickId },
      });

      if (!click) {
        logger.warn('Affiliate click not found for tracking', undefined, { clickId });
        return;
      }

      await prisma.affiliate_clicks.update({
        where: { id: click.id },
        data: {
          status,
          ...(status === 'converted' && { converted_at: new Date() }),
          ...(commissionAmount !== undefined && { commission_amount: commissionAmount }),
        },
      });

      logger.info('Affiliate click tracked', undefined, { clickId, status, commissionAmount });
    } catch (err) {
      logger.error('Failed to track affiliate click', undefined, {
        clickId,
        status,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Get brand partner claims for a GTIN.
   */
  async getBrandPartnerClaims(gtin: string): Promise<BrandPartnerClaimDTO[]> {
    try {
      const rows = await prisma.brand_partner_claims.findMany({
        where: { gtin },
        orderBy: { claim_type: 'asc' },
      });

      return rows.map((r) => ({
        id: r.id,
        brand_name: r.brand_name,
        gtin: r.gtin,
        claim_type: r.claim_type,
        supplier_id: r.supplier_id,
        admin_approved: r.admin_approved,
        contact_email: r.contact_email,
      }));
    } catch (err) {
      logger.error('Failed to get brand partner claims', undefined, {
        gtin,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Save (upsert) a supplier match into product_suppliers.
   */
  async saveSupplierMatch(
    gtin: string,
    supplierData: Partial<SupplierMatch>
  ): Promise<SupplierMatch | null> {
    const id = generateProductSupplierId();
    const supplierName = supplierData.supplier_name || 'Unknown Supplier';

    try {
      const existing = await prisma.product_suppliers.findFirst({
        where: { gtin, supplier_name: supplierName },
      });

      const payload = {
        supplier_type: supplierData.supplier_type || 'wholesale',
        moq: supplierData.moq || 1,
        min_order_value: supplierData.min_order_value || null,
        external_link: supplierData.external_link || null,
        affiliate_params: supplierData.affiliate_params || {},
        region: supplierData.region || 'US',
        claim_type: supplierData.claim_type || 'verified',
        brand_partner_id: supplierData.brand_partner_id || null,
      };

      let row;
      if (existing) {
        row = await prisma.product_suppliers.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        row = await prisma.product_suppliers.create({
          data: {
            id,
            gtin,
            supplier_name: supplierName,
            ...payload,
          },
        });
      }

      return {
        id: row.id,
        gtin: row.gtin,
        supplier_name: row.supplier_name,
        supplier_type: row.supplier_type,
        moq: row.moq,
        min_order_value: row.min_order_value ? Number(row.min_order_value) : null,
        external_link: row.external_link,
        affiliate_params: row.affiliate_params as any,
        region: row.region,
        claim_type: row.claim_type,
        brand_partner_id: row.brand_partner_id,
      };
    } catch (err) {
      logger.error('Failed to save supplier match', undefined, {
        gtin,
        supplierName,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Create a brand partner claim.
   */
  async createBrandPartnerClaim(
    brandName: string,
    gtin: string,
    claimType: string = 'verified',
    contactEmail?: string
  ): Promise<BrandPartnerClaimDTO | null> {
    const id = generateBrandPartnerClaimId();

    try {
      const row = await prisma.brand_partner_claims.create({
        data: {
          id,
          brand_name: brandName,
          gtin,
          claim_type: claimType,
          contact_email: contactEmail || null,
          admin_approved: false,
        },
      });

      return {
        id: row.id,
        brand_name: row.brand_name,
        gtin: row.gtin,
        claim_type: row.claim_type,
        supplier_id: row.supplier_id,
        admin_approved: row.admin_approved,
        contact_email: row.contact_email,
      };
    } catch (err) {
      logger.error('Failed to create brand partner claim', undefined, {
        brandName,
        gtin,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Approve a brand partner claim (admin only).
   */
  async approveBrandPartnerClaim(claimId: string): Promise<boolean> {
    try {
      await prisma.brand_partner_claims.update({
        where: { id: claimId },
        data: { admin_approved: true },
      });
      return true;
    } catch (err) {
      logger.error('Failed to approve brand partner claim', undefined, {
        claimId,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Reject (delete) a brand partner claim (admin only).
   */
  async rejectBrandPartnerClaim(claimId: string): Promise<boolean> {
    try {
      await prisma.brand_partner_claims.delete({
        where: { id: claimId },
      });
      return true;
    } catch (err) {
      logger.error('Failed to reject brand partner claim', undefined, {
        claimId,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * List all brand partner claims with optional filtering and pagination.
   */
  async listAllBrandPartnerClaims(
    filters?: { gtin?: string; brandName?: string; claimType?: string; approved?: boolean },
    limit: number = 50,
    offset: number = 0
  ): Promise<{ items: BrandPartnerClaimDTO[]; total: number }> {
    try {
      const where: any = {};
      if (filters?.gtin) where.gtin = filters.gtin;
      if (filters?.brandName) where.brand_name = { contains: filters.brandName, mode: 'insensitive' };
      if (filters?.claimType) where.claim_type = filters.claimType;
      if (filters?.approved !== undefined) where.admin_approved = filters.approved;

      const [rows, total] = await Promise.all([
        prisma.brand_partner_claims.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: Math.min(limit, 200),
          skip: offset,
        }),
        prisma.brand_partner_claims.count({ where }),
      ]);

      return {
        items: rows.map((r) => ({
          id: r.id,
          brand_name: r.brand_name,
          gtin: r.gtin,
          claim_type: r.claim_type,
          supplier_id: r.supplier_id,
          admin_approved: r.admin_approved,
          contact_email: r.contact_email,
        })),
        total,
      };
    } catch (err) {
      logger.error('Failed to list brand partner claims', undefined, {
        filters,
        error: err instanceof Error ? err.message : String(err),
      });
      return { items: [], total: 0 };
    }
  }

  /**
   * Expire stale affiliate clicks (pending clicks older than 30 days).
   */
  async expireStaleClicks(): Promise<number> {
    try {
      const result = await prisma.affiliate_clicks.updateMany({
        where: {
          status: 'pending',
          expires_at: { lt: new Date() },
        },
        data: { status: 'expired' },
      });
      if (result.count > 0) {
        logger.info('Expired stale affiliate clicks', undefined, { count: result.count });
      }
      return result.count;
    } catch (err) {
      logger.error('Failed to expire stale affiliate clicks', undefined, {
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
  }

  /**
   * Get affiliate click analytics for admin dashboard.
   */
  async getAffiliateAnalytics(tenantId?: string): Promise<AffiliateAnalytics> {
    try {
      const where = tenantId ? { tenant_id: tenantId } : {};
      const rows = await prisma.affiliate_clicks.findMany({ where });

      const total = rows.length;
      const pending = rows.filter((r) => r.status === 'pending').length;
      const converted = rows.filter((r) => r.status === 'converted').length;
      const expired = rows.filter((r) => r.status === 'expired').length;
      const totalCommission = rows.reduce((sum, r) => {
        return sum + (r.commission_amount ? Number(r.commission_amount) : 0);
      }, 0);

      return {
        total_clicks: total,
        pending,
        converted,
        expired,
        total_commission: totalCommission,
      };
    } catch (err) {
      logger.error('Failed to get affiliate analytics', undefined, {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        total_clicks: 0,
        pending: 0,
        converted: 0,
        expired: 0,
        total_commission: 0,
      };
    }
  }

  /**
   * Get all known suppliers (admin dashboard).
   */
  async getAllSuppliers(limit: number = 50, offset: number = 0): Promise<{
    items: SupplierMatch[];
    total: number;
  }> {
    try {
      const [rows, total] = await Promise.all([
        prisma.product_suppliers.findMany({
          take: Math.min(limit, 200),
          skip: offset,
          orderBy: { created_at: 'desc' },
        }),
        prisma.product_suppliers.count(),
      ]);

      return {
        items: rows.map((r) => ({
          id: r.id,
          gtin: r.gtin,
          supplier_name: r.supplier_name,
          supplier_type: r.supplier_type,
          moq: r.moq,
          min_order_value: r.min_order_value ? Number(r.min_order_value) : null,
          external_link: r.external_link,
          affiliate_params: r.affiliate_params as any,
          region: r.region,
          claim_type: r.claim_type,
          brand_partner_id: r.brand_partner_id,
        })),
        total,
      };
    } catch (err) {
      logger.error('Failed to get all suppliers', undefined, {
        error: err instanceof Error ? err.message : String(err),
      });
      return { items: [], total: 0 };
    }
  }
}

const wholesaleMatchingService = new WholesaleMatchingServiceClass();
export default wholesaleMatchingService;
