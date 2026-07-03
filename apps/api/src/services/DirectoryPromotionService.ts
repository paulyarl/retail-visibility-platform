/**
 * DirectoryPromotionService — Monetized directory store promotion
 *
 * Handles purchase, activation, renewal, grace period, and expiration for
 * directory promotion plans. Integrates with Stripe for one-time payments.
 * Updates directory_listings_list promotion columns on activation/expiration.
 *
 * Pattern: mirrors FeaturedPlacementService.ts
 * Design doc: docs/DIRECTORY_PROMOTION_SPRINT_PLAN.md (Sprint 1)
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { generatePromotionPurchaseId, generatePromotionCatalogId } from '../lib/id-generator';
import { getDirectPool } from '../utils/db-pool';
import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import { invalidateBadgeRegistryCache, getBadgeByKey } from './BadgeRegistryService';
import { getBillingNotificationService } from './subscription/BillingNotificationService';
import BotKnowledgeEmbeddingService from './BotKnowledgeEmbeddingService';
import Stripe from 'stripe';

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
  startsAt: Date | null;
  expiresAt: Date | null;
  gracePeriodEndsAt: Date | null;
  renewedFrom: string | null;
  createdAt: Date;
}

export interface PromotionRevenueSummary {
  totalRevenueCents: number;
  totalPurchases: number;
  activePurchases: number;
  revenueByTier: Record<string, { revenueCents: number; count: number }>;
}

export class DirectoryPromotionService extends BaseService {
  private static instance: DirectoryPromotionService;
  private stripe: Stripe | null = null;

  private constructor() {
    super();
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' as any });
    }
  }

  static getInstance(): DirectoryPromotionService {
    if (!DirectoryPromotionService.instance) {
      DirectoryPromotionService.instance = new DirectoryPromotionService();
    }
    return DirectoryPromotionService.instance;
  }

  // ====================
  // CATALOG (Admin CRUD)
  // ====================

  async listCatalogPlans(includeInactive = false): Promise<PromotionPlan[]> {
    const plans = await prisma.promotion_catalog.findMany({
      where: includeInactive ? {} : { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { price_cents: 'asc' }],
    });
    return plans.map(this.mapCatalogPlan);
  }

  async getCatalogPlan(planKey: string): Promise<PromotionPlan | null> {
    const plan = await prisma.promotion_catalog.findUnique({
      where: { plan_key: planKey },
    });
    return plan ? this.mapCatalogPlan(plan) : null;
  }

  async createCatalogPlan(data: {
    planKey: string;
    label: string;
    tier: string;
    durationDays: number;
    priceCents: number;
    currency?: string;
    sortOrder?: number;
  }): Promise<PromotionPlan> {
    const validTiers = ['basic', 'premium', 'featured'];
    if (!validTiers.includes(data.tier)) {
      throw new Error('invalid_tier');
    }

    const plan = await prisma.promotion_catalog.create({
      data: {
        id: generatePromotionCatalogId(),
        plan_key: data.planKey,
        label: data.label,
        tier: data.tier,
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
    tier?: string;
    durationDays?: number;
    priceCents?: number;
    currency?: string;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<PromotionPlan> {
    const updateData: any = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.tier !== undefined) updateData.tier = data.tier;
    if (data.durationDays !== undefined) updateData.duration_days = data.durationDays;
    if (data.priceCents !== undefined) updateData.price_cents = data.priceCents;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;

    const plan = await prisma.promotion_catalog.update({
      where: { plan_key: planKey },
      data: updateData,
    });
    return this.mapCatalogPlan(plan);
  }

  async deleteCatalogPlan(planKey: string): Promise<void> {
    await prisma.promotion_catalog.update({
      where: { plan_key: planKey },
      data: { is_active: false },
    });
  }

  // ====================
  // PURCHASE
  // ====================

  async createPurchase(data: {
    tenantId: string;
    planKey: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ purchaseId: string; checkoutUrl: string }> {
    const { tenantId, planKey, successUrl, cancelUrl } = data;

    const plan = await prisma.promotion_catalog.findUnique({
      where: { plan_key: planKey },
    });
    if (!plan || !plan.is_active) {
      throw new Error('plan_not_found_or_inactive');
    }

    // Tier gate: check tenant's plan allows this promotion tier
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps?.effective.directory_promotion?.enabled) {
      throw new Error('directory_promotion_not_available');
    }
    const allowedTiers = caps.effective.directory_promotion.allowed_tiers || [];
    if (!allowedTiers.includes(plan.tier as any)) {
      throw new Error('tier_not_available');
    }

    // Check for existing active promotion
    const existing = await prisma.promotion_purchases.findFirst({
      where: {
        tenant_id: tenantId,
        status: { in: ['active', 'grace_period', 'pending'] },
      },
    });
    if (existing) {
      throw new Error('tenant_already_has_active_promotion');
    }

    // Verify tenant has a directory listing
    const pool = getDirectPool();
    const listingCheck = await pool.query(
      'SELECT id FROM directory_listings_list WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );
    if (listingCheck.rows.length === 0) {
      throw new Error('tenant_has_no_directory_listing');
    }

    const purchaseId = generatePromotionPurchaseId(tenantId);
    await prisma.promotion_purchases.create({
      data: {
        id: purchaseId,
        tenant_id: tenantId,
        plan_key: planKey,
        tier: plan.tier,
        price_cents: plan.price_cents,
        currency: plan.currency || 'USD',
        duration_days: plan.duration_days,
        status: 'pending',
      },
    });

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
              metadata: { plan_key: planKey, tier: plan.tier },
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
        tier: plan.tier,
        type: 'directory_promotion',
      },
    });

    await prisma.promotion_purchases.update({
      where: { id: purchaseId },
      data: { stripe_checkout_session_id: session.id },
    });

    return {
      purchaseId,
      checkoutUrl: session.url!,
    };
  }

  // ====================
  // ACTIVATE (called from Stripe webhook)
  // ====================

  async activatePurchase(purchaseId: string, stripePaymentIntentId?: string): Promise<void> {
    const purchase = await prisma.promotion_purchases.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) {
      logger.error('[DirectoryPromotion] Purchase not found for activation', undefined, { purchaseId });
      return;
    }
    if (purchase.status === 'active') {
      logger.info('[DirectoryPromotion] Purchase already active, skipping', undefined, { purchaseId });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + purchase.duration_days * 24 * 60 * 60 * 1000);

    // Update purchase record
    await prisma.promotion_purchases.update({
      where: { id: purchaseId },
      data: {
        status: 'active',
        starts_at: now,
        expires_at: expiresAt,
        stripe_payment_intent_id: stripePaymentIntentId || purchase.stripe_payment_intent_id,
      },
    });

    // Update directory_listings_list promotion columns
    const pool = getDirectPool();
    await pool.query(
      `UPDATE directory_listings_list
       SET
         is_promoted = TRUE,
         promotion_tier = $1,
         promotion_started_at = $2,
         promotion_expires_at = $3,
         promotion_impressions = 0,
         promotion_clicks = 0
       WHERE tenant_id = $4`,
      [purchase.tier, now, expiresAt, purchase.tenant_id]
    );

    // Invalidate badge registry cache so directory_promoted badge appears immediately
    invalidateBadgeRegistryCache();

    const badge = await getBadgeByKey('directory_promoted');
    logger.info('[DirectoryPromotion] Purchase activated', undefined, {
      purchaseId,
      tenantId: purchase.tenant_id,
      tier: purchase.tier,
      expiresAt,
      promotionalPriority: badge?.promotionalPriority ?? 200,
    });

    // Send billing notification (email + CRM alert) — fire-and-forget
    const isRenewal = !!purchase.renewed_from;
    (async () => {
      try {
        await getBillingNotificationService().sendNotification({
          tenantId: purchase.tenant_id,
          type: isRenewal ? 'directory_promotion_renewal_success' : 'directory_promotion_purchased',
          amount: purchase.price_cents,
          metadata: {
            tier: purchase.tier,
            tierLabel: purchase.tier.charAt(0).toUpperCase() + purchase.tier.slice(1),
            purchaseId,
            durationDays: purchase.duration_days,
            expiresAt: expiresAt.toISOString(),
          },
        });
      } catch (err) {
        logger.warn('[DirectoryPromotion] Failed to send billing notification', undefined, { error: (err as Error).message });
      }
    })();

    // Refresh bot knowledge embeddings with promotion info — fire-and-forget
    (async () => {
      try {
        await BotKnowledgeEmbeddingService.getInstance().refreshPromotionEmbeddings(purchase.tenant_id);
      } catch (err) {
        logger.warn('[DirectoryPromotion] Failed to refresh promotion embeddings', undefined, { error: (err as Error).message });
      }
    })();
  }

  // ====================
  // DEACTIVATE / EXPIRE
  // ====================

  async deactivatePurchase(purchaseId: string, reason: string = 'expired'): Promise<void> {
    const purchase = await prisma.promotion_purchases.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) {
      throw new Error('purchase_not_found');
    }

    const now = new Date();

    await prisma.promotion_purchases.update({
      where: { id: purchaseId },
      data: {
        status: reason === 'cancelled' ? 'cancelled' : 'expired',
      },
    });

    // Clear promotion columns on directory_listings_list
    const pool = getDirectPool();
    await pool.query(
      `UPDATE directory_listings_list
       SET
         is_promoted = FALSE,
         promotion_tier = NULL,
         promotion_expires_at = NULL
       WHERE tenant_id = $1`,
      [purchase.tenant_id]
    );

    // Invalidate badge registry cache so directory_promoted badge is removed
    invalidateBadgeRegistryCache();

    logger.info('[DirectoryPromotion] Purchase deactivated', undefined, {
      purchaseId,
      tenantId: purchase.tenant_id,
      reason,
    });

    // Send billing notification (email + CRM alert) — fire-and-forget
    (async () => {
      try {
        await getBillingNotificationService().sendNotification({
          tenantId: purchase.tenant_id,
          type: 'directory_promotion_expired',
          metadata: {
            tier: purchase.tier,
            tierLabel: purchase.tier.charAt(0).toUpperCase() + purchase.tier.slice(1),
            purchaseId,
            reason,
          },
        });
      } catch (err) {
        logger.warn('[DirectoryPromotion] Failed to send expiration notification', undefined, { error: (err as Error).message });
      }
    })();

    // Refresh bot knowledge embeddings to clear stale promotion info — fire-and-forget
    (async () => {
      try {
        await BotKnowledgeEmbeddingService.getInstance().refreshPromotionEmbeddings(purchase.tenant_id);
      } catch (err) {
        logger.warn('[DirectoryPromotion] Failed to refresh promotion embeddings on deactivation', undefined, { error: (err as Error).message });
      }
    })();
  }

  // ====================
  // CANCEL (tenant-initiated, stops renewal, lets current period expire)
  // ====================

  async cancelPromotion(tenantId: string): Promise<void> {
    const active = await prisma.promotion_purchases.findFirst({
      where: {
        tenant_id: tenantId,
        status: { in: ['active', 'grace_period'] },
      },
    });
    if (!active) {
      throw new Error('no_active_promotion');
    }

    // Mark as cancelled — the expiration job will clear the listing columns when it expires
    // We don't immediately remove promotion since the tenant paid for the period
    await prisma.promotion_purchases.update({
      where: { id: active.id },
      data: { status: 'cancelled' },
    });

    logger.info('[DirectoryPromotion] Promotion cancelled by tenant', undefined, {
      purchaseId: active.id,
      tenantId,
      expiresAt: active.expires_at,
    });
  }

  // ====================
  // RENEW (manual — creates new pending purchase with Stripe checkout)
  // ====================

  async renewPurchase(data: {
    purchaseId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ newPurchaseId: string; checkoutUrl: string }> {
    const { purchaseId, successUrl, cancelUrl } = data;

    const existing = await prisma.promotion_purchases.findUnique({
      where: { id: purchaseId },
    });
    if (!existing) {
      throw new Error('purchase_not_found');
    }

    const plan = await prisma.promotion_catalog.findUnique({
      where: { plan_key: existing.plan_key },
    });
    if (!plan || !plan.is_active) {
      throw new Error('plan_not_found_or_inactive');
    }

    const newPurchaseId = generatePromotionPurchaseId(existing.tenant_id);
    await prisma.promotion_purchases.create({
      data: {
        id: newPurchaseId,
        tenant_id: existing.tenant_id,
        plan_key: existing.plan_key,
        tier: existing.tier,
        price_cents: plan.price_cents,
        currency: plan.currency || 'USD',
        duration_days: plan.duration_days,
        status: 'pending',
        renewed_from: purchaseId,
      },
    });

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
              metadata: { plan_key: existing.plan_key, tier: existing.tier },
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
        tier: existing.tier,
        type: 'directory_promotion_renewal',
      },
    });

    await prisma.promotion_purchases.update({
      where: { id: newPurchaseId },
      data: { stripe_checkout_session_id: session.id },
    });

    return {
      newPurchaseId,
      checkoutUrl: session.url!,
    };
  }

  // ====================
  // GRACE PERIOD (called by renewal job on failed payment)
  // ====================

  async enterGracePeriod(purchaseId: string): Promise<void> {
    const purchase = await prisma.promotion_purchases.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) {
      throw new Error('purchase_not_found');
    }

    const now = new Date();
    const graceEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await prisma.promotion_purchases.update({
      where: { id: purchaseId },
      data: {
        status: 'grace_period',
        grace_period_ends_at: graceEnds,
      },
    });

    logger.info('[DirectoryPromotion] Entered grace period', undefined, {
      purchaseId,
      tenantId: purchase.tenant_id,
      gracePeriodEndsAt: graceEnds,
    });

    // Send billing notification (email + CRM alert) — fire-and-forget
    (async () => {
      try {
        await getBillingNotificationService().sendNotification({
          tenantId: purchase.tenant_id,
          type: 'directory_promotion_grace_period_warning',
          gracePeriodDaysRemaining: 7,
          reason: 'Auto-renewal payment failed',
          metadata: {
            tier: purchase.tier,
            tierLabel: purchase.tier.charAt(0).toUpperCase() + purchase.tier.slice(1),
            purchaseId,
            gracePeriodEndsAt: graceEnds.toISOString(),
          },
        });
      } catch (err) {
        logger.warn('[DirectoryPromotion] Failed to send grace period notification', undefined, { error: (err as Error).message });
      }
    })();
  }

  // ====================
  // LIST / QUERY
  // ====================

  async getActivePurchase(tenantId: string): Promise<PromotionPurchase | null> {
    const purchase = await prisma.promotion_purchases.findFirst({
      where: {
        tenant_id: tenantId,
        status: { in: ['active', 'grace_period'] },
      },
      orderBy: { created_at: 'desc' },
    });
    return purchase ? this.mapPurchase(purchase) : null;
  }

  async listTenantPurchases(tenantId: string, filters: { status?: string } = {}): Promise<PromotionPurchase[]> {
    const where: any = { tenant_id: tenantId };
    if (filters.status) where.status = filters.status;

    const purchases = await prisma.promotion_purchases.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return purchases.map(this.mapPurchase);
  }

  async listAllPurchases(filters: { status?: string; tier?: string; tenantId?: string } = {}): Promise<PromotionPurchase[]> {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.tier) where.tier = filters.tier;
    if (filters.tenantId) where.tenant_id = filters.tenantId;

    const purchases = await prisma.promotion_purchases.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return purchases.map(this.mapPurchase);
  }

  async getPurchase(purchaseId: string): Promise<PromotionPurchase | null> {
    const purchase = await prisma.promotion_purchases.findUnique({
      where: { id: purchaseId },
    });
    return purchase ? this.mapPurchase(purchase) : null;
  }

  // ====================
  // REVENUE TRACKING
  // ====================

  async getRevenueSummary(filters: { tier?: string; startDate?: Date; endDate?: Date } = {}): Promise<PromotionRevenueSummary> {
    const where: any = { status: { in: ['active', 'expired', 'cancelled'] } };
    if (filters.tier) where.tier = filters.tier;
    if (filters.startDate || filters.endDate) {
      where.starts_at = {};
      if (filters.startDate) where.starts_at.gte = filters.startDate;
      if (filters.endDate) where.starts_at.lte = filters.endDate;
    }

    const purchases = await prisma.promotion_purchases.findMany({
      where,
      select: {
        tier: true,
        price_cents: true,
        status: true,
      },
    });

    const revenueByTier: Record<string, { revenueCents: number; count: number }> = {};
    let totalRevenueCents = 0;
    let totalPurchases = 0;
    let activePurchases = 0;

    for (const p of purchases) {
      totalRevenueCents += p.price_cents;
      totalPurchases++;
      if (p.status === 'active') activePurchases++;

      if (!revenueByTier[p.tier]) {
        revenueByTier[p.tier] = { revenueCents: 0, count: 0 };
      }
      revenueByTier[p.tier].revenueCents += p.price_cents;
      revenueByTier[p.tier].count++;
    }

    return {
      totalRevenueCents,
      totalPurchases,
      activePurchases,
      revenueByTier,
    };
  }

  // ====================
  // EXPIRATION QUERIES (used by renewal job)
  // ====================

  async findExpiringPurchases(daysBeforeExpiry: number): Promise<PromotionPurchase[]> {
    const now = new Date();
    const threshold = new Date(now.getTime() + daysBeforeExpiry * 24 * 60 * 60 * 1000);

    const purchases = await prisma.promotion_purchases.findMany({
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

  async findExpiredPurchases(): Promise<PromotionPurchase[]> {
    const now = new Date();

    const purchases = await prisma.promotion_purchases.findMany({
      where: {
        status: { in: ['active', 'cancelled'] },
        expires_at: { lte: now },
      },
    });
    return purchases.map(this.mapPurchase);
  }

  async findGracePeriodExpired(): Promise<PromotionPurchase[]> {
    const now = new Date();

    const purchases = await prisma.promotion_purchases.findMany({
      where: {
        status: 'grace_period',
        grace_period_ends_at: { lte: now },
      },
    });
    return purchases.map(this.mapPurchase);
  }

  // ====================
  // DASHBOARD STATS (for CRM admin widget)
  // ====================

  async getDashboardStats(): Promise<{
    activeCount: number;
    gracePeriodCount: number;
    expiredCount: number;
    totalRevenueCents: number;
    upcomingRenewals: PromotionPurchase[];
    gracePeriodPromotions: PromotionPurchase[];
    recentActivations: PromotionPurchase[];
  }> {
    const now = new Date();
    const renewalWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [activePurchases, gracePeriodPurchases, expiredPurchases, upcomingRenewals, recentActive] = await Promise.all([
      prisma.promotion_purchases.findMany({ where: { status: 'active' }, select: { id: true, price_cents: true } }),
      prisma.promotion_purchases.findMany({ where: { status: 'grace_period' }, orderBy: { grace_period_ends_at: 'asc' } }),
      prisma.promotion_purchases.findMany({ where: { status: 'expired' }, select: { id: true } }),
      prisma.promotion_purchases.findMany({
        where: { status: 'active', expires_at: { gte: now, lte: renewalWindow } },
        orderBy: { expires_at: 'asc' },
        take: 5,
      }),
      prisma.promotion_purchases.findMany({
        where: { status: 'active' },
        orderBy: { starts_at: 'desc' },
        take: 5,
      }),
    ]);

    const totalRevenueCents = activePurchases.reduce((sum, p) => sum + p.price_cents, 0);

    return {
      activeCount: activePurchases.length,
      gracePeriodCount: gracePeriodPurchases.length,
      expiredCount: expiredPurchases.length,
      totalRevenueCents,
      upcomingRenewals: upcomingRenewals.map(this.mapPurchase),
      gracePeriodPromotions: gracePeriodPurchases.map(this.mapPurchase),
      recentActivations: recentActive.map(this.mapPurchase),
    };
  }

  async findStalePending(olderThanHours: number = 24): Promise<PromotionPurchase[]> {
    const threshold = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const purchases = await prisma.promotion_purchases.findMany({
      where: {
        status: 'pending',
        created_at: { lte: threshold },
      },
    });
    return purchases.map(this.mapPurchase);
  }

  // ====================
  // HELPERS
  // ====================

  private mapCatalogPlan(p: any): PromotionPlan {
    return {
      id: p.id,
      planKey: p.plan_key,
      label: p.label,
      tier: p.tier,
      durationDays: p.duration_days,
      priceCents: p.price_cents,
      currency: p.currency || 'USD',
      isActive: p.is_active ?? true,
      sortOrder: p.sort_order ?? 0,
    };
  }

  private mapPurchase(p: any): PromotionPurchase {
    return {
      id: p.id,
      tenantId: p.tenant_id,
      planKey: p.plan_key,
      tier: p.tier,
      priceCents: p.price_cents,
      currency: p.currency || 'USD',
      durationDays: p.duration_days,
      status: p.status || 'pending',
      stripeCheckoutSessionId: p.stripe_checkout_session_id,
      stripePaymentIntentId: p.stripe_payment_intent_id,
      startsAt: p.starts_at,
      expiresAt: p.expires_at,
      gracePeriodEndsAt: p.grace_period_ends_at,
      renewedFrom: p.renewed_from,
      createdAt: p.created_at,
    };
  }
}

export default DirectoryPromotionService;
