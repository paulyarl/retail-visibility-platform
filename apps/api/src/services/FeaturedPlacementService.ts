/**
 * FeaturedPlacementService — Monetized featured product placements
 *
 * Handles purchase, renewal, revocation, and revenue tracking for
 * featured placement plans. Integrates with Stripe for one-time payments
 * and CrmAlertService for lifecycle notifications.
 *
 * Design doc: docs/FEATURED_VISIBILITY_CHANNELS_DESIGN.md (Phase 4)
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { generatePlacementPurchaseId } from '../lib/id-generator';
import { invalidateActiveFeaturedCache } from './ActiveFeaturedResolver';
import { invalidateEffectiveCapabilities } from './EffectiveCapabilityResolver';
import CrmAlertService from './CrmAlertService';
import BotKnowledgeEmbeddingService from './BotKnowledgeEmbeddingService';
import Stripe from 'stripe';

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
  purchasedAt: Date;
  activatedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  renewedFrom: string | null;
}

export interface RevenueSummary {
  totalRevenueCents: number;
  totalPurchases: number;
  activePurchases: number;
  revenueBySurface: Record<string, { revenueCents: number; count: number }>;
}

export class FeaturedPlacementService extends BaseService {
  private static instance: FeaturedPlacementService;
  private stripe: Stripe | null = null;

  private constructor() {
    super();
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' as any });
    }
  }

  static getInstance(): FeaturedPlacementService {
    if (!FeaturedPlacementService.instance) {
      FeaturedPlacementService.instance = new FeaturedPlacementService();
    }
    return FeaturedPlacementService.instance;
  }

  // ====================
  // CATALOG (Admin CRUD)
  // ====================

  async listCatalogPlans(includeInactive = false): Promise<PlacementPlan[]> {
    const plans = await prisma.featured_placement_catalog.findMany({
      where: includeInactive ? {} : { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { price_cents: 'asc' }],
    });
    return plans.map(this.mapCatalogPlan);
  }

  async getCatalogPlan(planKey: string): Promise<PlacementPlan | null> {
    const plan = await prisma.featured_placement_catalog.findUnique({
      where: { plan_key: planKey },
    });
    return plan ? this.mapCatalogPlan(plan) : null;
  }

  async createCatalogPlan(data: {
    planKey: string;
    label: string;
    surface: string;
    durationDays: number;
    priceCents: number;
    currency?: string;
    sortOrder?: number;
  }): Promise<PlacementPlan> {
    const { generatePlacementCatalogId } = await import('../lib/id-generator');
    const plan = await prisma.featured_placement_catalog.create({
      data: {
        id: generatePlacementCatalogId(),
        plan_key: data.planKey,
        label: data.label,
        surface: data.surface,
        duration_days: data.durationDays,
        price_cents: data.priceCents,
        currency: data.currency || 'USD',
        sort_order: data.sortOrder || 0,
      },
    });
    return this.mapCatalogPlan(plan);
  }

  async updateCatalogPlan(planKey: string, data: {
    label?: string;
    surface?: string;
    durationDays?: number;
    priceCents?: number;
    currency?: string;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<PlacementPlan> {
    const updateData: any = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.surface !== undefined) updateData.surface = data.surface;
    if (data.durationDays !== undefined) updateData.duration_days = data.durationDays;
    if (data.priceCents !== undefined) updateData.price_cents = data.priceCents;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;

    const plan = await prisma.featured_placement_catalog.update({
      where: { plan_key: planKey },
      data: updateData,
    });
    return this.mapCatalogPlan(plan);
  }

  async deleteCatalogPlan(planKey: string): Promise<void> {
    await prisma.featured_placement_catalog.delete({
      where: { plan_key: planKey },
    });
  }

  // ====================
  // PURCHASE
  // ====================

  async createPurchase(data: {
    tenantId: string;
    inventoryItemId: string;
    planKey: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ purchaseId: string; checkoutUrl: string }> {
    const { tenantId, inventoryItemId, planKey, successUrl, cancelUrl } = data;

    // Validate plan exists and is active
    const plan = await prisma.featured_placement_catalog.findUnique({
      where: { plan_key: planKey },
    });
    if (!plan || !plan.is_active) {
      throw new Error('plan_not_found_or_inactive');
    }

    // Validate product exists and belongs to tenant
    const item = await prisma.inventory_items.findFirst({
      where: { id: inventoryItemId, tenant_id: tenantId },
    });
    if (!item) {
      throw new Error('product_not_found');
    }

    // Check for existing active placement on this product
    const existing = await prisma.featured_placement_purchases.findFirst({
      where: {
        tenant_id: tenantId,
        inventory_item_id: inventoryItemId,
        status: 'active',
      },
    });
    if (existing) {
      throw new Error('product_already_has_active_placement');
    }

    // Capability awareness: log warning if tenant tier lacks featured_options capability.
    // This is informational only — the placement payment IS the entitlement, and
    // activatePurchase will soft-enable the capability via companion purchases.
    const featuredInTier = await this.isFeatureInTier(tenantId, 'featured_enabled');
    if (!featuredInTier) {
      logger.info('[FeaturedPlacement] Tenant tier does not include featured_enabled — companion purchase will be created on activation', undefined, { tenantId, planKey });
    }

    // Create purchase record (pending)
    const purchaseId = generatePlacementPurchaseId(tenantId);
    await prisma.featured_placement_purchases.create({
      data: {
        id: purchaseId,
        tenant_id: tenantId,
        inventory_item_id: inventoryItemId,
        plan_key: planKey,
        surface: plan.surface,
        price_cents: plan.price_cents,
        currency: plan.currency,
        duration_days: plan.duration_days,
        status: 'pending',
      },
    });

    // Create Stripe checkout session
    if (!this.stripe) {
      throw new Error('stripe_not_configured');
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency || 'USD',
            unit_amount: plan.price_cents,
            product_data: {
              name: plan.label,
              metadata: { plan_key: planKey, surface: plan.surface },
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tenantId,
        purchaseId,
        planKey,
        inventoryItemId,
        surface: plan.surface,
        type: 'featured_placement',
      },
    });

    // Store checkout session ID
    await prisma.featured_placement_purchases.update({
      where: { id: purchaseId },
      data: { stripe_checkout_session_id: session.id },
    });

    return {
      purchaseId,
      checkoutUrl: session.url!,
    };
  }

  // ====================
  // CAPABILITY COMPANION PURCHASES
  // ====================

  /**
   * Ensure the tenant has active companion purchases for the featured_options
   * capability parent gate (featured_enabled) and the individual 'featured' type
   * (featured_featured). If the tenant's tier already includes these features,
   * no companion is created. This guarantees that a paid featured placement
   * is visible on all surfaces (storefront, cross-tenant, directory) regardless
   * of tier — the placement payment IS the entitlement.
   *
   * Pattern mirrors ensureCompanionPurchase() in bsaas-purchases.ts.
   */
  private async ensureFeaturedCapabilityCompanions(tenantId: string): Promise<void> {
    const companionFeatureKeys = ['featured_enabled', 'featured_featured'];

    for (const featureKey of companionFeatureKeys) {
      // Check if already in tier
      const inTier = await this.isFeatureInTier(tenantId, featureKey);
      if (inTier) continue;

      // Check if companion or real purchase already exists
      const existing = await prisma.tenant_feature_purchases.findUnique({
        where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: featureKey } },
      });
      if (existing && ['active', 'past_due', 'trial'].includes(existing.status)) continue;

      // Create zero-cost companion purchase
      await prisma.tenant_feature_purchases.upsert({
        where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: featureKey } },
        update: {
          source: 'companion',
          status: 'active',
          expires_at: null,
          metadata: {
            companion_for: 'featured_placement',
            price_cents: 0,
            created_reason: 'auto_companion_featured_placement',
          },
          updated_at: new Date(),
        },
        create: {
          tenant_id: tenantId,
          feature_key: featureKey,
          source: 'companion',
          status: 'active',
          expires_at: null,
          metadata: {
            companion_for: 'featured_placement',
            price_cents: 0,
            created_reason: 'auto_companion_featured_placement',
          },
        },
      });

      logger.info('[FeaturedPlacement] Created companion purchase for ' + featureKey, undefined, { tenantId });
    }

    invalidateEffectiveCapabilities(tenantId);
  }

  /**
   * When a placement expires or is revoked, check if any other active placements
   * remain for the tenant. If not, cancel companion purchases for featured_enabled
   * and featured_featured (unless a BSaaS purchase or tier feature still needs them).
   *
   * Pattern mirrors maybeCancelCompanion() in bsaas-purchases.ts.
   */
  private async maybeCancelFeaturedCapabilityCompanions(tenantId: string): Promise<void> {
    // Check if any other active placements exist for this tenant
    const activePlacements = await prisma.featured_placement_purchases.count({
      where: {
        tenant_id: tenantId,
        status: 'active',
      },
    });

    if (activePlacements > 0) return;

    // Check if any active real (non-companion) BSaaS purchases exist for featured_* features
    const activeBsaasPurchases = await prisma.tenant_feature_purchases.count({
      where: {
        tenant_id: tenantId,
        feature_key: { startsWith: 'featured_' },
        status: { in: ['active', 'past_due', 'trial'] },
        source: { not: 'companion' },
      },
    });

    if (activeBsaasPurchases > 0) return;

    // No active placements or BSaaS purchases — cancel companions
    const companionFeatureKeys = ['featured_enabled', 'featured_featured'];
    for (const featureKey of companionFeatureKeys) {
      // Don't cancel if the tier already provides this feature (companion wasn't created by us)
      const inTier = await this.isFeatureInTier(tenantId, featureKey);
      if (inTier) continue;

      await prisma.tenant_feature_purchases.updateMany({
        where: {
          tenant_id: tenantId,
          feature_key: featureKey,
          source: 'companion',
          status: { in: ['active', 'past_due'] },
        },
        data: {
          status: 'expired',
          updated_at: new Date(),
        },
      });

      logger.info('[FeaturedPlacement] Cancelled companion purchase for ' + featureKey, undefined, { tenantId });
    }

    invalidateEffectiveCapabilities(tenantId);
  }

  /**
   * Check if a feature key is enabled in the tenant's tier (or org tier).
   */
  private async isFeatureInTier(tenantId: string, featureKey: string): Promise<boolean> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        organization_id: true,
        organizations_list: { select: { subscription_tier: true } },
      },
    });
    if (!tenant) return false;

    const tierKeys = [tenant.subscription_tier, tenant.organizations_list?.subscription_tier]
      .filter((k): k is string => !!k);
    if (tierKeys.length === 0) return false;

    const tiers = await prisma.subscription_tiers_list.findMany({
      where: { tier_key: { in: tierKeys } },
      select: { id: true },
    });
    const tierIds = tiers.map(t => t.id);

    const tierFeature = await prisma.tier_features_list.findFirst({
      where: {
        tier_id: { in: tierIds },
        feature_key: featureKey,
        is_enabled: true,
      },
    });

    return !!tierFeature;
  }

  // ====================
  // ACTIVATE (called from Stripe webhook)
  // ====================

  async activatePurchase(purchaseId: string, stripePaymentIntentId?: string): Promise<void> {
    const purchase = await prisma.featured_placement_purchases.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) {
      logger.error('[FeaturedPlacement] Purchase not found for activation', undefined, { purchaseId });
      return;
    }
    if (purchase.status === 'active') {
      logger.info('[FeaturedPlacement] Purchase already active, skipping', undefined, { purchaseId });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + purchase.duration_days * 24 * 60 * 60 * 1000);

    // Update purchase record
    await prisma.featured_placement_purchases.update({
      where: { id: purchaseId },
      data: {
        status: 'active',
        activated_at: now,
        expires_at: expiresAt,
        stripe_payment_intent_id: stripePaymentIntentId || purchase.stripe_payment_intent_id,
      },
    });

    // Create or update featured_products row (payment = approval)
    const existing = await prisma.featured_products.findFirst({
      where: {
        inventory_item_id: purchase.inventory_item_id,
        featured_type: 'featured',
      },
    });

    if (existing) {
      // Update existing — extend expiration
      await prisma.featured_products.update({
        where: { id: existing.id },
        data: {
          is_active: true,
          admin_approved: true,
          assignment_source: 'manual',
          auto_unfeature: true,
          featured_expires_at: expiresAt,
        },
      });
    } else {
      // Create new featured_products row
      await prisma.featured_products.create({
        data: {
          inventory_item_id: purchase.inventory_item_id,
          tenant_id: purchase.tenant_id,
          featured_type: 'featured',
          featured_priority: 50,
          featured_at: now,
          featured_expires_at: expiresAt,
          auto_unfeature: true,
          is_active: true,
          admin_approved: true,
          assignment_source: 'manual',
          bucket_type: 'store_selection',
        },
      });
    }

    // Invalidate cache
    invalidateActiveFeaturedCache(purchase.tenant_id, purchase.surface);
    invalidateActiveFeaturedCache(null);

    // Ensure featured_options capability companions (featured_enabled + featured_featured)
    // so the placement is visible on ALL surfaces regardless of tier
    await this.ensureFeaturedCapabilityCompanions(purchase.tenant_id);

    // Emit badge_event
    try {
      await prisma.badge_events.create({
        data: {
          tenant_id: purchase.tenant_id,
          inventory_item_id: purchase.inventory_item_id,
          badge_key: 'featured',
          event_type: 'placement_bought',
        },
      });
    } catch (err) {
      logger.warn('[FeaturedPlacement] Failed to create badge_event', undefined, { error: (err as Error).message });
    }

    // Create CRM alert (fire-and-forget)
    CrmAlertService.getInstance().createFeaturedPlacementAlert({
      tenantId: purchase.tenant_id,
      placementId: purchaseId,
      productName: await this.getProductName(purchase.inventory_item_id),
      planKey: purchase.plan_key,
      surface: purchase.surface,
      expiresAt,
      durationDays: purchase.duration_days,
      priceCents: purchase.price_cents,
      alertType: 'featured_placement_active',
    }).catch(err => logger.warn('[FeaturedPlacement] Failed to create activation alert', undefined, { error: (err as Error).message }));

    // Refresh bot knowledge embeddings with featured placement info — fire-and-forget
    (async () => {
      try {
        await BotKnowledgeEmbeddingService.getInstance().refreshFeaturedPlacementEmbeddings(purchase.tenant_id);
      } catch (err) {
        logger.warn('[FeaturedPlacement] Failed to refresh featured placement embeddings', undefined, { error: (err as Error).message });
      }
    })();

    // Send billing notification (email + CRM alert) — fire-and-forget
    (async () => {
      try {
        const { getBillingNotificationService } = await import('./subscription/BillingNotificationService');
        await getBillingNotificationService().sendNotification({
          tenantId: purchase.tenant_id,
          type: 'featured_placement_purchased',
          amount: purchase.price_cents,
          metadata: {
            planKey: purchase.plan_key,
            planLabel: purchase.plan_key,
            surface: purchase.surface,
            placementId: purchaseId,
            durationDays: purchase.duration_days,
            expiresAt: expiresAt.toISOString(),
          },
        });
      } catch (err) {
        logger.warn('[FeaturedPlacement] Failed to send billing notification', undefined, { error: (err as Error).message });
      }
    })();

    logger.info('[FeaturedPlacement] Purchase activated', undefined, { purchaseId, expiresAt });
  }

  // ====================
  // RENEW
  // ====================

  async renewPurchase(data: {
    purchaseId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ newPurchaseId: string; checkoutUrl: string }> {
    const { purchaseId, successUrl, cancelUrl } = data;

    const existing = await prisma.featured_placement_purchases.findUnique({
      where: { id: purchaseId },
    });
    if (!existing) {
      throw new Error('purchase_not_found');
    }

    const plan = await prisma.featured_placement_catalog.findUnique({
      where: { plan_key: existing.plan_key },
    });
    if (!plan || !plan.is_active) {
      throw new Error('plan_not_found_or_inactive');
    }

    // Create new purchase record linked to the old one
    const newPurchaseId = generatePlacementPurchaseId(existing.tenant_id);
    await prisma.featured_placement_purchases.create({
      data: {
        id: newPurchaseId,
        tenant_id: existing.tenant_id,
        inventory_item_id: existing.inventory_item_id,
        plan_key: existing.plan_key,
        surface: existing.surface,
        price_cents: plan.price_cents,
        currency: plan.currency,
        duration_days: plan.duration_days,
        status: 'pending',
        renewed_from: purchaseId,
      },
    });

    // Create Stripe checkout session
    if (!this.stripe) {
      throw new Error('stripe_not_configured');
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency || 'USD',
            unit_amount: plan.price_cents,
            product_data: {
              name: `Renewal: ${plan.label}`,
              metadata: { plan_key: existing.plan_key, surface: existing.surface },
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tenantId: existing.tenant_id,
        purchaseId: newPurchaseId,
        planKey: existing.plan_key,
        inventoryItemId: existing.inventory_item_id,
        surface: existing.surface,
        type: 'featured_placement_renewal',
      },
    });

    await prisma.featured_placement_purchases.update({
      where: { id: newPurchaseId },
      data: { stripe_checkout_session_id: session.id },
    });

    return {
      newPurchaseId,
      checkoutUrl: session.url!,
    };
  }

  // ====================
  // REVOKE (Admin)
  // ====================

  async revokePurchase(purchaseId: string, reason: string): Promise<void> {
    const purchase = await prisma.featured_placement_purchases.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) {
      throw new Error('purchase_not_found');
    }

    const now = new Date();

    // Update purchase
    await prisma.featured_placement_purchases.update({
      where: { id: purchaseId },
      data: {
        status: 'revoked',
        revoked_at: now,
        revoked_reason: reason,
      },
    });

    // Deactivate featured_products row
    await prisma.featured_products.updateMany({
      where: {
        inventory_item_id: purchase.inventory_item_id,
        tenant_id: purchase.tenant_id,
        featured_type: 'featured',
        is_active: true,
      },
      data: { is_active: false },
    });

    // Invalidate cache
    invalidateActiveFeaturedCache(purchase.tenant_id, purchase.surface);
    invalidateActiveFeaturedCache(null);

    // Cancel companion purchases if no other active placements remain
    await this.maybeCancelFeaturedCapabilityCompanions(purchase.tenant_id);

    // Create CRM alert
    CrmAlertService.getInstance().createFeaturedPlacementAlert({
      tenantId: purchase.tenant_id,
      placementId: purchaseId,
      productName: await this.getProductName(purchase.inventory_item_id),
      planKey: purchase.plan_key,
      surface: purchase.surface,
      expiresAt: purchase.expires_at || now,
      durationDays: purchase.duration_days,
      priceCents: purchase.price_cents,
      alertType: 'featured_placement_expired',
    }).catch(err => logger.warn('[FeaturedPlacement] Failed to create revocation alert', undefined, { error: (err as Error).message }));

    // Refresh bot knowledge embeddings to clear stale featured placement info — fire-and-forget
    (async () => {
      try {
        await BotKnowledgeEmbeddingService.getInstance().refreshFeaturedPlacementEmbeddings(purchase.tenant_id);
      } catch (err) {
        logger.warn('[FeaturedPlacement] Failed to refresh featured placement embeddings on revocation', undefined, { error: (err as Error).message });
      }
    })();

    logger.info('[FeaturedPlacement] Purchase revoked', undefined, { purchaseId, reason });
  }

  // ====================
  // LIST / QUERY
  // ====================

  async listTenantPurchases(tenantId: string, filters: { status?: string } = {}): Promise<PlacementPurchase[]> {
    const where: any = { tenant_id: tenantId };
    if (filters.status) where.status = filters.status;

    const purchases = await prisma.featured_placement_purchases.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return purchases.map(this.mapPurchase);
  }

  async listAllPurchases(filters: { status?: string; surface?: string; tenantId?: string } = {}): Promise<PlacementPurchase[]> {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.surface) where.surface = filters.surface;
    if (filters.tenantId) where.tenant_id = filters.tenantId;

    const purchases = await prisma.featured_placement_purchases.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return purchases.map(this.mapPurchase);
  }

  async getPurchase(purchaseId: string): Promise<PlacementPurchase | null> {
    const purchase = await prisma.featured_placement_purchases.findUnique({
      where: { id: purchaseId },
    });
    return purchase ? this.mapPurchase(purchase) : null;
  }

  // ====================
  // REVENUE TRACKING
  // ====================

  async getRevenueSummary(filters: { surface?: string; startDate?: Date; endDate?: Date } = {}): Promise<RevenueSummary> {
    const where: any = { status: { in: ['active', 'expired'] } };
    if (filters.surface) where.surface = filters.surface;
    if (filters.startDate || filters.endDate) {
      where.activated_at = {};
      if (filters.startDate) where.activated_at.gte = filters.startDate;
      if (filters.endDate) where.activated_at.lte = filters.endDate;
    }

    const purchases = await prisma.featured_placement_purchases.findMany({
      where,
      select: {
        surface: true,
        price_cents: true,
        status: true,
      },
    });

    const revenueBySurface: Record<string, { revenueCents: number; count: number }> = {};
    let totalRevenueCents = 0;
    let totalPurchases = 0;
    let activePurchases = 0;

    for (const p of purchases) {
      totalRevenueCents += p.price_cents;
      totalPurchases++;
      if (p.status === 'active') activePurchases++;

      if (!revenueBySurface[p.surface]) {
        revenueBySurface[p.surface] = { revenueCents: 0, count: 0 };
      }
      revenueBySurface[p.surface].revenueCents += p.price_cents;
      revenueBySurface[p.surface].count++;
    }

    return {
      totalRevenueCents,
      totalPurchases,
      activePurchases,
      revenueBySurface,
    };
  }

  // ====================
  // EXPIRATION WARNINGS
  // ====================

  async findExpiringPlacements(daysBeforeExpiry: number): Promise<PlacementPurchase[]> {
    const now = new Date();
    const threshold = new Date(now.getTime() + daysBeforeExpiry * 24 * 60 * 60 * 1000);

    const purchases = await prisma.featured_placement_purchases.findMany({
      where: {
        status: 'active',
        expires_at: {
          gte: now,
          lte: threshold,
        },
      },
    });
    return purchases.map(this.mapPurchase);
  }

  async findExpiredPlacements(): Promise<PlacementPurchase[]> {
    const now = new Date();

    const purchases = await prisma.featured_placement_purchases.findMany({
      where: {
        status: 'active',
        expires_at: { lte: now },
      },
    });
    return purchases.map(this.mapPurchase);
  }

  // ====================
  // HELPERS
  // ====================

  private async getProductName(inventoryItemId: string): Promise<string> {
    try {
      const item = await prisma.inventory_items.findUnique({
        where: { id: inventoryItemId },
        select: { name: true },
      });
      return item?.name || 'Unknown product';
    } catch {
      return 'Unknown product';
    }
  }

  private mapCatalogPlan(p: any): PlacementPlan {
    return {
      id: p.id,
      planKey: p.plan_key,
      label: p.label,
      surface: p.surface,
      durationDays: p.duration_days,
      priceCents: p.price_cents,
      currency: p.currency,
      isActive: p.is_active,
      sortOrder: p.sort_order,
    };
  }

  private mapPurchase(p: any): PlacementPurchase {
    return {
      id: p.id,
      tenantId: p.tenant_id,
      inventoryItemId: p.inventory_item_id,
      planKey: p.plan_key,
      surface: p.surface,
      priceCents: p.price_cents,
      currency: p.currency,
      durationDays: p.duration_days,
      stripeCheckoutSessionId: p.stripe_checkout_session_id,
      stripePaymentIntentId: p.stripe_payment_intent_id,
      status: p.status,
      purchasedAt: p.purchased_at,
      activatedAt: p.activated_at,
      expiresAt: p.expires_at,
      revokedAt: p.revoked_at,
      revokedReason: p.revoked_reason,
      renewedFrom: p.renewed_from,
    };
  }
}

export default FeaturedPlacementService;
