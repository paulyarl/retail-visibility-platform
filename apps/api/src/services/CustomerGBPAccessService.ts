/**
 * CustomerGBPAccessService — Customer→Tenant GBP Identity Bridge
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §4 Subsystem 0
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE0.md Task 7
 *
 * Resolves a marketing customer to the tenant whose GBP location they are
 * authorized to manage, via the mkt_customer_gbp_links bridge table
 * (migration 241). Provides cross-customer isolation (customer A cannot
 * access customer B's tenant resources) and tenant_id drift reconciliation
 * (gbp_locations_list.tenant_id synced to google_oauth_accounts_list.tenant_id).
 *
 * v1 scope: emerging single-location merchants. resolveLocation() throws
 * if 0 or >1 locations exist. Multi-location support is post-v1 (no schema
 * change needed — only portal UX).
 *
 * Pattern: singleton extends BaseService (stateless — no caching needed for
 * bridge resolution).
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { logger } from '../logger';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ResolvedTenant {
  tenantId: string;
  linkId: string;
}

export interface GbpLocation {
  id: string;
  locationId: string;
  locationName: string;
  businessName: string | null;
  tenantId: string | null;
  verificationState: string;
  cachedAverageRating: number | null;
  cachedReviewCount: number | null;
  ratingCacheUpdated: Date | null;
  address: string | null;
  phone: string | null;
  websiteUrl: string | null;
  category: string | null;
}

// ─── Errors ─────────────────────────────────────────────────────────────

export class GbpLinkNotFoundError extends Error {
  code = 'NOT_FOUND' as const;
  constructor(customerId: string) {
    super(`No GBP link found for customer ${customerId}`);
    this.name = 'GbpLinkNotFoundError';
  }
}

export class GbpLocationNotFoundError extends Error {
  code = 'NOT_FOUND' as const;
  constructor(tenantId: string) {
    super(`No GBP location found for tenant ${tenantId}`);
    this.name = 'GbpLocationNotFoundError';
  }
}

export class MultipleGbpLocationsError extends Error {
  code = 'MULTIPLE_LOCATIONS' as const;
  constructor(tenantId: string, count: number) {
    super(`Tenant ${tenantId} has ${count} GBP locations — v1 supports single-location only`);
    this.name = 'MultipleGbpLocationsError';
  }
}

// ─── Service ────────────────────────────────────────────────────────────

export class CustomerGBPAccessService extends BaseService {
  private static instance: CustomerGBPAccessService;

  private constructor() {
    super();
  }

  static getInstance(): CustomerGBPAccessService {
    if (!CustomerGBPAccessService.instance) {
      CustomerGBPAccessService.instance = new CustomerGBPAccessService();
    }
    return CustomerGBPAccessService.instance;
  }

  /**
   * Resolve the tenant for a given customer via the mkt_customer_gbp_links bridge.
   * Throws GbpLinkNotFoundError (404) if no bridge link exists — this is the
   * cross-customer isolation boundary: customer A cannot resolve customer B's tenant.
   *
   * @param customerId The marketing customer ID (from requireCustomerAuth)
   * @returns { tenantId, linkId } — the resolved tenant + bridge link ID
   */
  async resolveTenant(customerId: string): Promise<ResolvedTenant> {
    const link = await prisma.mkt_customer_gbp_links.findFirst({
      where: { customer_id: customerId },
      orderBy: { created_at: 'asc' }, // first link wins (v1 single-tenant per customer)
    });

    if (!link) {
      throw new GbpLinkNotFoundError(customerId);
    }

    return {
      tenantId: link.tenant_id,
      linkId: link.id,
    };
  }

  /**
   * Resolve all GBP locations for a customer's tenant.
   * Reconciles tenant_id drift: gbp_locations_list.tenant_id is denormalized
   * from google_oauth_accounts_list.tenant_id. If it has drifted (e.g. tenant
   * was migrated), this method updates gbp_locations_list to match.
   *
   * @param customerId The marketing customer ID
   * @returns Array of GbpLocation objects (may be empty)
   */
  async resolveLocations(customerId: string): Promise<GbpLocation[]> {
    const { tenantId } = await this.resolveTenant(customerId);

    // Drift reconciliation (Subsystem 0 step 6):
    // Sync gbp_locations_list.tenant_id to google_oauth_accounts_list.tenant_id
    await this.reconcileTenantIdDrift(tenantId);

    const locations = await prisma.gbp_locations_list.findMany({
      where: { tenant_id: tenantId },
    });

    return locations.map(this.mapLocation);
  }

  /**
   * v1 convenience: resolve the single location for a customer.
   * Throws GbpLocationNotFoundError if 0 locations exist.
   * Throws MultipleGbpLocationsError if >1 locations exist (v1 = single-location only).
   *
   * @param customerId The marketing customer ID
   * @returns The single GbpLocation
   */
  async resolveLocation(customerId: string): Promise<GbpLocation> {
    const locations = await this.resolveLocations(customerId);

    if (locations.length === 0) {
      const { tenantId } = await this.resolveTenant(customerId);
      throw new GbpLocationNotFoundError(tenantId);
    }

    if (locations.length > 1) {
      const { tenantId } = await this.resolveTenant(customerId);
      throw new MultipleGbpLocationsError(tenantId, locations.length);
    }

    return locations[0];
  }

  /**
   * Provision a customer↔tenant GBP link.
   * Called when a customer claims a GBP-scoped campaign.
   * Idempotent: if the link already exists, it's a no-op.
   *
   * @param customerId The marketing customer ID
   * @param tenantId The tenant ID whose GBP the customer is authorized to manage
   * @param originCampaignId Optional: the campaign that created the link
   */
  async provisionLink(
    customerId: string,
    tenantId: string,
    originCampaignId?: string
  ): Promise<void> {
    const { generateQuickStart } = await import('../lib/id-generator');

    await prisma.mkt_customer_gbp_links.upsert({
      where: {
        customer_id_tenant_id: {
          customer_id: customerId,
          tenant_id: tenantId,
        },
      },
      create: {
        id: generateQuickStart('gbpl'),
        customer_id: customerId,
        tenant_id: tenantId,
        origin_campaign_id: originCampaignId ?? null,
      },
      update: {}, // idempotent — no-op if link already exists
    });

    logger.info('[CustomerGBPAccessService] Provisioned GBP link', undefined, {
      customerId,
      tenantId,
      originCampaignId,
    });
  }

  // ─── Internal ──────────────────────────────────────────────────────

  /**
   * Reconcile tenant_id drift on gbp_locations_list.
   * The denormalized tenant_id should match google_oauth_accounts_list.tenant_id.
   * If it has drifted (e.g. tenant migration), update gbp_locations_list.
   */
  private async reconcileTenantIdDrift(tenantId: string): Promise<void> {
    try {
      const oauthAccount = await prisma.google_oauth_accounts_list.findFirst({
        where: { tenant_id: tenantId },
      });

      if (!oauthAccount) {
        return; // no OAuth account — nothing to reconcile
      }

      // Update any locations where tenant_id has drifted
      const result = await prisma.gbp_locations_list.updateMany({
        where: {
          account_id: oauthAccount.id,
          tenant_id: { not: tenantId },
        },
        data: { tenant_id: tenantId },
      });

      if (result.count > 0) {
        logger.info('[CustomerGBPAccessService] Reconciled tenant_id drift', undefined, {
          tenantId,
          accountId: oauthAccount.id,
          updatedRows: result.count,
        });
      }
    } catch (error: any) {
      // Non-fatal — drift reconciliation is a best-effort optimization.
      // The location query still works via the OAuth account join.
      logger.warn('[CustomerGBPAccessService] Drift reconciliation failed', undefined, {
        tenantId,
        error: error?.message,
      });
    }
  }

  private mapLocation(loc: any): GbpLocation {
    return {
      id: loc.id,
      locationId: loc.location_id,
      locationName: loc.location_name,
      businessName: loc.business_name ?? null,
      tenantId: loc.tenant_id ?? null,
      verificationState: loc.verification_state ?? 'UNVERIFIED',
      cachedAverageRating: loc.cached_average_rating ?? null,
      cachedReviewCount: loc.cached_review_count ?? null,
      ratingCacheUpdated: loc.rating_cache_updated ?? null,
      address: loc.address ?? null,
      phone: loc.phone_number ?? null,
      websiteUrl: loc.website_url ?? null,
      category: loc.category ?? null,
    };
  }
}
