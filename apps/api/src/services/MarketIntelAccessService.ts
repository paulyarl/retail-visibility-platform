/**
 * MarketIntelAccessService — access control + unlock records for the
 * Market Intel sidebar (spec §8.2).
 *
 * Responsibilities:
 * - `getAccessTier(customerId, surfaceType, surfaceKey)` — returns tier
 *   (0 anonymous / 1 free / 2 paid / 3 owner). Tier 3 only on `place`.
 * - `canAccessFull(customerId, surfaceType, surfaceKey)` — boolean.
 * - `recordUnlock(tenantId, customerId, surfaceType, surfaceKey,
 *    unlockType, paymentIntentId?)` — UPSERT on the unique key
 *    (re-purchase / re-claim updates rather than 23505).
 * - `isOwner(customerId, businessSlug)` — `place` only. Resolves
 *   slug → seed's tenant_id → user_tenants(OWNER) → customer.linked_user_id.
 *   NOTE: `CustomerAuthService.resolveOwnedTenantId()` returns the FIRST
 *   owned tenant only — this is a tenant-scoped variant keyed on the
 *   seed's tenant_id so multi-claim owners don't get false negatives.
 * - `resolveTenantForPurchase(customerId)` — returns the customer's
 *   tenant (via linked_user_id → user_tenants) or null; null → paywall
 *   step 1 (tenant registration).
 */
import { BaseService } from './BaseService';
import { logger } from '../logger';

export type SurfaceType = 'place' | 'category' | 'city';
export type UnlockType = 'single_report' | 'subscription' | 'owner_claim';

/** Access tiers per spec §6.1. */
export const enum AccessTier {
  Anonymous = 0,
  Free = 1,
  Paid = 2,
  Owner = 3,
}

class MarketIntelAccessService extends BaseService {
  private static instance: MarketIntelAccessService;

  private constructor() {
    super();
  }

  public static getInstance(): MarketIntelAccessService {
    if (!MarketIntelAccessService.instance) {
      MarketIntelAccessService.instance = new MarketIntelAccessService();
    }
    return MarketIntelAccessService.instance;
  }

  /**
   * Resolve the access tier for a customer on a surface.
   *
   * Tier 3 (owner) only applies on `place` surfaces — category/city
   * surfaces have no owner claim path.
   */
  async getAccessTier(
    customerId: string | null,
    surfaceType: SurfaceType,
    surfaceKey: string,
  ): Promise<AccessTier> {
    // Tier 0 — anonymous.
    if (!customerId) return AccessTier.Anonymous;

    // Tier 3 — owner (place only).
    if (surfaceType === 'place') {
      const owner = await this.isOwner(customerId, surfaceKey);
      if (owner) return AccessTier.Owner;
    }

    // Tier 2 — paid unlock.
    const tenantId = await this.resolveTenantForPurchase(customerId);
    if (tenantId) {
      const paid = await this.hasUnlock(tenantId, surfaceType, surfaceKey);
      if (paid) return AccessTier.Paid;
    }

    // Tier 1 — logged-in free shopper.
    return AccessTier.Free;
  }

  /** Boolean convenience wrapper. */
  async canAccessFull(
    customerId: string | null,
    surfaceType: SurfaceType,
    surfaceKey: string,
  ): Promise<boolean> {
    const tier = await this.getAccessTier(customerId, surfaceType, surfaceKey);
    return tier === AccessTier.Paid || tier === AccessTier.Owner;
  }

  /**
   * Check whether a tenant has an active unlock for the surface.
   * `single_report` and `owner_claim` are permanent (no expires_at);
   * `subscription` honors expires_at when present.
   */
  async hasUnlock(
    tenantId: string,
    surfaceType: SurfaceType,
    surfaceKey: string,
  ): Promise<boolean> {
    try {
      const rows = await this.prisma.market_intel_unlocks.findMany({
        where: { tenant_id: tenantId, surface_type: surfaceType, surface_key: surfaceKey },
        select: { unlock_type: true, expires_at: true },
      });
      const now = new Date();
      return rows.some((r) => !r.expires_at || r.expires_at > now);
    } catch (error) {
      logger.error('[MarketIntelAccessService.hasUnlock] Error', undefined, {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Record an unlock. UPSERTs on (tenant_id, surface_type, surface_key,
   * unlock_type) — a second purchase or re-claim updates unlocked_at /
   * payment_intent_id rather than violating the unique constraint.
   */
  async recordUnlock(params: {
    tenantId: string;
    customerId: string;
    surfaceType: SurfaceType;
    surfaceKey: string;
    unlockType: UnlockType;
    paymentIntentId?: string | null;
  }): Promise<void> {
    const { tenantId, customerId, surfaceType, surfaceKey, unlockType, paymentIntentId } = params;
    try {
      await this.prisma.market_intel_unlocks.upsert({
        where: {
          tenant_id_surface_type_surface_key_unlock_type: {
            tenant_id: tenantId,
            surface_type: surfaceType,
            surface_key: surfaceKey,
            unlock_type: unlockType,
          },
        },
        update: {
          customer_id: customerId,
          payment_intent_id: paymentIntentId ?? null,
          unlocked_at: new Date(),
          updated_at: new Date(),
        },
        create: {
          tenant_id: tenantId,
          customer_id: customerId,
          surface_type: surfaceType,
          surface_key: surfaceKey,
          unlock_type: unlockType,
          payment_intent_id: paymentIntentId ?? null,
        },
      });
    } catch (error) {
      logger.error('[MarketIntelAccessService.recordUnlock] Error', undefined, {
        error: (error as Error).message,
        tenantId,
        surfaceType,
        surfaceKey,
      });
      throw error;
    }
  }

  /**
   * Resolve whether the customer owns the seed for a `place` surface.
   *
   * Chain: slug → directory_listings_list → directory_presence_seeds
   * → tenant_id → user_tenants(role='OWNER') → customers.linked_user_id.
   *
   * This is a tenant-scoped variant of
   * `CustomerAuthService.resolveOwnedTenantId()` — that method returns
   * the FIRST owned tenant only, which gives false negatives for
   * multi-claim owners. Here we resolve the seed's tenant_id first and
   * check that specific tenant for an OWNER row linked to the customer.
   */
  async isOwner(customerId: string, businessSlug: string): Promise<boolean> {
    try {
      // slug → listing → seed.tenant_id
      const listing = await this.prisma.directory_listings_list.findFirst({
        where: { slug: businessSlug },
        select: { id: true },
      });
      if (!listing) return false;

      const seed = await this.prisma.directory_presence_seeds.findUnique({
        where: { listing_id: listing.id },
        select: { tenant_id: true },
      });
      if (!seed) return false;

      // customer.linked_user_id → user_tenants(OWNER) for that tenant.
      const customer = await this.prisma.customers.findUnique({
        where: { id: customerId },
        select: { linked_user_id: true },
      });
      if (!customer?.linked_user_id) return false;

      const ownerRow = await this.prisma.user_tenants.findFirst({
        where: {
          user_id: customer.linked_user_id,
          tenant_id: seed.tenant_id,
          role: 'OWNER',
        },
        select: { id: true },
      });
      return !!ownerRow;
    } catch (error) {
      logger.error('[MarketIntelAccessService.isOwner] Error', undefined, {
        error: (error as Error).message,
        customerId,
        businessSlug,
      });
      return false;
    }
  }

  /**
   * Resolve the tenant the customer can purchase under (via
   * linked_user_id → user_tenants). Returns the FIRST owned tenant, or
   * null if the customer doesn't own a tenant yet (paywall step 1:
   * tenant registration).
   */
  async resolveTenantForPurchase(customerId: string): Promise<string | null> {
    try {
      const customer = await this.prisma.customers.findUnique({
        where: { id: customerId },
        select: { linked_user_id: true },
      });
      if (!customer?.linked_user_id) return null;

      const ownerRow = await this.prisma.user_tenants.findFirst({
        where: {
          user_id: customer.linked_user_id,
          role: 'OWNER',
        },
        select: { tenant_id: true },
        orderBy: { created_at: 'asc' },
      });
      return ownerRow?.tenant_id ?? null;
    } catch (error) {
      logger.error('[MarketIntelAccessService.resolveTenantForPurchase] Error', undefined, {
        error: (error as Error).message,
        customerId,
      });
      return null;
    }
  }
}

const marketIntelAccessService = MarketIntelAccessService.getInstance();
export default marketIntelAccessService;
export { MarketIntelAccessService };
