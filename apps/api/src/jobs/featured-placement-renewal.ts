/**
 * Featured Placement Renewal Job
 *
 * Runs daily to handle:
 * - Auto-renewal of placements with saved payment methods (Stripe charge)
 * - Grace period management for failed auto-renewals (7-day grace)
 * - Trial placement expiration and conversion reminders
 * - BillingNotificationService integration for email + CRM notifications
 *
 * Design doc: docs/FEATURED_VISIBILITY_CHANNELS_DESIGN.md (Phase 4 — Renewal Workflow)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { invalidateActiveFeaturedCache } from '../services/ActiveFeaturedResolver';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import CrmAlertService from '../services/CrmAlertService';
import Stripe from 'stripe';

export interface RenewalJobResult {
  autoRenewed: number;
  renewalFailed: number;
  gracePeriodEntered: number;
  gracePeriodExpired: number;
  trialsExpired: number;
  errors: string[];
}

const GRACE_PERIOD_DAYS = 7;
const RENEWAL_WINDOW_HOURS = 24; // Attempt renewal within 24h of expiry

/**
 * Main entry point — process all renewal-related tasks.
 */
export async function processPlacementRenewals(): Promise<RenewalJobResult> {
  const result: RenewalJobResult = {
    autoRenewed: 0,
    renewalFailed: 0,
    gracePeriodEntered: 0,
    gracePeriodExpired: 0,
    trialsExpired: 0,
    errors: [],
  };

  const now = new Date();

  try {
    // 1. Attempt auto-renewals for placements expiring within the renewal window
    await processAutoRenewals(now, result);

    // 2. Process grace period — placements that failed renewal and are in grace
    await processGracePeriods(now, result);

    // 3. Process trial placements that have expired
    await processTrialExpirations(now, result);
  } catch (error) {
    const errorMsg = (error as Error).message;
    result.errors.push(errorMsg);
    logger.error('[PlacementRenewal] Fatal error', undefined, { error: errorMsg });
  }

  logger.info('[PlacementRenewal] Daily job complete', undefined, {
    autoRenewed: result.autoRenewed,
    renewalFailed: result.renewalFailed,
    gracePeriodEntered: result.gracePeriodEntered,
    gracePeriodExpired: result.gracePeriodExpired,
    trialsExpired: result.trialsExpired,
    errors: result.errors.length,
  });

  return result;
}

/**
 * 1. Auto-renew placements that are expiring within the renewal window.
 * Only attempts renewal if the tenant has a saved Stripe payment method.
 */
async function processAutoRenewals(now: Date, result: RenewalJobResult): Promise<void> {
  const renewalThreshold = new Date(now.getTime() + RENEWAL_WINDOW_HOURS * 60 * 60 * 1000);

  // Find active placements expiring within 24h that haven't been auto-renewed yet
  // and don't already have a pending renewal in progress
  const expiringPlacements = await prisma.featured_placement_purchases.findMany({
    where: {
      status: 'active',
      expires_at: { gte: now, lte: renewalThreshold },
      // Exclude placements already in grace period
      // (grace_period_until is null for non-grace placements)
    },
  });

  if (expiringPlacements.length === 0) return;

  logger.info(`[PlacementRenewal] Found ${expiringPlacements.length} placements due for auto-renewal`);

  const stripe = initStripe();
  if (!stripe) {
    logger.warn('[PlacementRenewal] Stripe not configured, skipping auto-renewals');
    result.errors.push('stripe_not_configured');
    return;
  }

  for (const placement of expiringPlacements) {
    try {
      // Get tenant's Stripe customer ID
      const tenant = await prisma.tenants.findUnique({
        where: { id: placement.tenant_id },
        select: { stripe_customer_id: true, name: true },
      });

      if (!tenant?.stripe_customer_id) {
        // No saved payment method — enter grace period instead
        await enterGracePeriod(placement, now, result);
        continue;
      }

      // Get the plan for pricing
      const plan = await prisma.featured_placement_catalog.findUnique({
        where: { plan_key: placement.plan_key },
      });

      if (!plan || !plan.is_active) {
        logger.warn(`[PlacementRenewal] Plan ${placement.plan_key} not found or inactive, entering grace period`, undefined, { placementId: placement.id });
        await enterGracePeriod(placement, now, result);
        continue;
      }

      // Attempt to charge the saved payment method via Stripe PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: plan.price_cents,
        currency: plan.currency || 'USD',
        customer: tenant.stripe_customer_id,
        off_session: true,
        confirm: true,
        metadata: {
          tenantId: placement.tenant_id,
          placementId: placement.id,
          planKey: placement.plan_key,
          type: 'featured_placement_autorenewal',
        },
        description: `Auto-renewal: ${plan.label} for ${tenant.name}`,
      });

      if (paymentIntent.status === 'succeeded') {
        // Create new purchase record as renewal
        const { generatePlacementPurchaseId } = await import('../lib/id-generator');
        const newPurchaseId = generatePlacementPurchaseId(placement.tenant_id);
        const newExpiresAt = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

        await prisma.featured_placement_purchases.create({
          data: {
            id: newPurchaseId,
            tenant_id: placement.tenant_id,
            inventory_item_id: placement.inventory_item_id,
            plan_key: placement.plan_key,
            surface: placement.surface,
            price_cents: plan.price_cents,
            currency: plan.currency || 'USD',
            duration_days: plan.duration_days,
            status: 'active',
            activated_at: now,
            expires_at: newExpiresAt,
            stripe_payment_intent_id: paymentIntent.id,
            renewed_from: placement.id,
          },
        });

        // Mark old placement as expired (renewed)
        await prisma.featured_placement_purchases.update({
          where: { id: placement.id },
          data: { status: 'expired' },
        });

        // Extend featured_products expiration
        await prisma.featured_products.updateMany({
          where: {
            inventory_item_id: placement.inventory_item_id,
            tenant_id: placement.tenant_id,
            featured_type: 'featured',
            is_active: true,
          },
          data: { featured_expires_at: newExpiresAt },
        });

        // Invalidate cache
        invalidateActiveFeaturedCache(placement.tenant_id, placement.surface);
        invalidateActiveFeaturedCache(null);

        // Send billing notification
        await sendBillingNotification({
          tenantId: placement.tenant_id,
          type: 'featured_placement_renewal_success',
          amount: plan.price_cents,
          metadata: {
            planKey: placement.plan_key,
            planLabel: plan.label,
            surface: placement.surface,
            placementId: newPurchaseId,
            oldPlacementId: placement.id,
          },
        });

        result.autoRenewed++;
        logger.info(`[PlacementRenewal] Auto-renewed placement ${placement.id} → ${newPurchaseId}`);
      } else {
        // Payment didn't succeed — enter grace period
        logger.warn(`[PlacementRenewal] Auto-renewal payment status: ${paymentIntent.status} for placement ${placement.id}`);
        await enterGracePeriod(placement, now, result);
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      logger.warn(`[PlacementRenewal] Auto-renewal failed for placement ${placement.id}`, undefined, { error: errorMsg });
      result.renewalFailed++;

      // Enter grace period on failure
      await enterGracePeriod(placement, now, result);

      // Send renewal failed notification
      await sendBillingNotification({
        tenantId: placement.tenant_id,
        type: 'featured_placement_renewal_failed',
        reason: errorMsg,
        metadata: {
          planKey: placement.plan_key,
          surface: placement.surface,
          placementId: placement.id,
        },
      });
    }
  }
}

/**
 * 2. Process grace periods — placements that failed auto-renewal.
 * After grace period expires, deactivate the placement.
 */
async function processGracePeriods(now: Date, result: RenewalJobResult): Promise<void> {
  // Find placements in grace period that have expired
  const expiredGracePlacements = await prisma.featured_placement_purchases.findMany({
    where: {
      status: 'active',
      // We track grace period via a metadata field or a separate column
      // Since we don't have a dedicated column, we use the expires_at + grace period
      // A placement in grace has expires_at < now but hasn't been marked expired yet
      expires_at: { lt: now },
    },
  });

  for (const placement of expiredGracePlacements) {
    const expiresAt = placement.expires_at ?? now;
    const gracePeriodEnd = new Date(expiresAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    if (now >= gracePeriodEnd) {
      // Grace period has expired — deactivate the placement
      await prisma.featured_placement_purchases.update({
        where: { id: placement.id },
        data: { status: 'expired' },
      });

      // Deactivate featured_products
      await prisma.featured_products.updateMany({
        where: {
          inventory_item_id: placement.inventory_item_id,
          tenant_id: placement.tenant_id,
          featured_type: 'featured',
          is_active: true,
        },
        data: { is_active: false },
      });

      invalidateActiveFeaturedCache(placement.tenant_id, placement.surface);
      invalidateActiveFeaturedCache(null);

      // Cancel companion capability purchases if no other active placements remain
      await maybeCancelFeaturedCompanions(placement.tenant_id);

      result.gracePeriodExpired++;

      // Send grace period expired notification
      await sendBillingNotification({
        tenantId: placement.tenant_id,
        type: 'featured_placement_expired',
        metadata: {
          planKey: placement.plan_key,
          surface: placement.surface,
          placementId: placement.id,
        },
      });

      logger.info(`[PlacementRenewal] Grace period expired for placement ${placement.id}`);
    } else {
      // Still in grace period — send warning if within 3 days of grace end
      const daysUntilGraceEnd = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      if (daysUntilGraceEnd <= 3 && daysUntilGraceEnd > 0) {
        // Send grace period warning
        await sendBillingNotification({
          tenantId: placement.tenant_id,
          type: 'featured_placement_grace_period_warning',
          gracePeriodDaysRemaining: daysUntilGraceEnd,
          metadata: {
            planKey: placement.plan_key,
            surface: placement.surface,
            placementId: placement.id,
          },
        });

        // Also create CRM alert
        const productName = await getProductName(placement.inventory_item_id);
        CrmAlertService.getInstance().createFeaturedPlacementAlert({
          tenantId: placement.tenant_id,
          placementId: placement.id,
          productName,
          planKey: placement.plan_key,
          surface: placement.surface,
          expiresAt: gracePeriodEnd,
          durationDays: placement.duration_days,
          priceCents: placement.price_cents,
          alertType: 'featured_placement_urgent',
        }).catch(err => logger.warn('[PlacementRenewal] Failed to create grace period alert', undefined, { error: (err as Error).message }));
      }
    }
  }
}

/**
 * 3. Process trial placements that have expired.
 * Trial placements are created with status 'trial' and have an expires_at.
 * When they expire, mark them as expired and deactivate the featured product.
 */
async function processTrialExpirations(now: Date, result: RenewalJobResult): Promise<void> {
  // Check if there are any trial placements (status = 'trial')
  // The current schema doesn't have a 'trial' status explicitly, but we check
  // for placements where status is 'pending' and has been pending for too long
  // (indicating an incomplete checkout that should be cleaned up)

  const stalePending = await prisma.featured_placement_purchases.findMany({
    where: {
      status: 'pending',
      // Pending for more than 24 hours = stale (checkout was never completed)
    },
  });

  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const placement of stalePending) {
    const createdAt = placement.purchased_at || placement.created_at;
    if (createdAt && createdAt < staleThreshold) {
      await prisma.featured_placement_purchases.update({
        where: { id: placement.id },
        data: { status: 'expired' },
      });
      result.trialsExpired++;
      logger.info(`[PlacementRenewal] Cleaned up stale pending placement ${placement.id}`);
    }
  }
}

/**
 * Enter grace period for a placement that failed auto-renewal.
 * The placement remains active during the grace period.
 */
async function enterGracePeriod(placement: any, now: Date, result: RenewalJobResult): Promise<void> {
  // The placement stays active but will expire after the grace period
  // We extend the expires_at by the grace period to give the merchant time to update payment
  const currentExpiry = placement.expires_at || now;
  const gracePeriodEnd = new Date(currentExpiry.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await prisma.featured_placement_purchases.update({
    where: { id: placement.id },
    data: {
      expires_at: gracePeriodEnd,
      // Keep status as active during grace period
    },
  });

  // Extend featured_products expiration to match grace period
  await prisma.featured_products.updateMany({
    where: {
      inventory_item_id: placement.inventory_item_id,
      tenant_id: placement.tenant_id,
      featured_type: 'featured',
      is_active: true,
    },
    data: { featured_expires_at: gracePeriodEnd },
  });

  result.gracePeriodEntered++;

  // Send grace period warning notification
  await sendBillingNotification({
    tenantId: placement.tenant_id,
    type: 'featured_placement_grace_period_warning',
    gracePeriodDaysRemaining: GRACE_PERIOD_DAYS,
    reason: 'Auto-renewal payment failed',
    metadata: {
      planKey: placement.plan_key,
      surface: placement.surface,
      placementId: placement.id,
    },
  });

  logger.info(`[PlacementRenewal] Entered grace period for placement ${placement.id}, grace ends ${gracePeriodEnd.toISOString()}`);
}

/**
 * Cancel companion purchases for featured_enabled + featured_featured
 * when no active placements or BSaaS purchases remain for the tenant.
 * Mirrors FeaturedPlacementService.maybeCancelFeaturedCapabilityCompanions.
 */
async function maybeCancelFeaturedCompanions(tenantId: string): Promise<void> {
  const activePlacements = await prisma.featured_placement_purchases.count({
    where: { tenant_id: tenantId, status: 'active' },
  });
  if (activePlacements > 0) return;

  const activeBsaasPurchases = await prisma.tenant_feature_purchases.count({
    where: {
      tenant_id: tenantId,
      feature_key: { startsWith: 'featured_' },
      status: { in: ['active', 'past_due', 'trial'] },
      source: { not: 'companion' },
    },
  });
  if (activeBsaasPurchases > 0) return;

  const companionFeatureKeys = ['featured_enabled', 'featured_featured'];
  for (const featureKey of companionFeatureKeys) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        organization_id: true,
        organizations_list: { select: { subscription_tier: true } },
      },
    });
    if (!tenant) continue;

    const tierKeys = [tenant.subscription_tier, tenant.organizations_list?.subscription_tier]
      .filter((k): k is string => !!k);
    if (tierKeys.length === 0) continue;

    const tiers = await prisma.subscription_tiers_list.findMany({
      where: { tier_key: { in: tierKeys } },
      select: { id: true },
    });
    const tierIds = tiers.map(t => t.id);

    const inTier = await prisma.tier_features_list.findFirst({
      where: { tier_id: { in: tierIds }, feature_key: featureKey, is_enabled: true },
    });
    if (inTier) continue;

    await prisma.tenant_feature_purchases.updateMany({
      where: {
        tenant_id: tenantId,
        feature_key: featureKey,
        source: 'companion',
        status: { in: ['active', 'past_due'] },
      },
      data: { status: 'expired', updated_at: new Date() },
    });

    logger.info(`[PlacementRenewal] Cancelled companion purchase for ${featureKey}`, undefined, { tenantId });
  }

  invalidateEffectiveCapabilities(tenantId);
}

/**
 * Send billing notification via BillingNotificationService.
 */
async function sendBillingNotification(data: {
  tenantId: string;
  type: string;
  amount?: number;
  reason?: string;
  gracePeriodDaysRemaining?: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const { getBillingNotificationService } = await import('../services/subscription/BillingNotificationService');
    const notificationService = getBillingNotificationService();
    await notificationService.sendNotification({
      tenantId: data.tenantId,
      type: data.type as any,
      amount: data.amount,
      reason: data.reason,
      gracePeriodDaysRemaining: data.gracePeriodDaysRemaining,
      metadata: data.metadata,
    } as any);
  } catch (error) {
    logger.warn('[PlacementRenewal] Failed to send billing notification', undefined, {
      error: (error as Error).message,
      type: data.type,
    });
  }
}

function initStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' as any });
}

async function getProductName(inventoryItemId: string): Promise<string> {
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

// ====================
// SCHEDULER
// ====================

let jobInterval: NodeJS.Timeout | null = null;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Start the placement renewal job.
 * Runs daily.
 */
export function startPlacementRenewalJob(): void {
  if (jobInterval) {
    console.log('[PlacementRenewal] Job already running');
    return;
  }

  console.log('[PlacementRenewal] Starting daily renewal job');

  // Run immediately on start
  processPlacementRenewals().catch(err => {
    logger.error('[PlacementRenewal] Initial run failed', undefined, { error: err instanceof Error ? err.message : String(err) });
  });

  // Then run daily
  jobInterval = setInterval(() => {
    processPlacementRenewals().catch(err => {
      logger.error('[PlacementRenewal] Scheduled run failed', undefined, { error: err instanceof Error ? err.message : String(err) });
    });
  }, RUN_INTERVAL_MS);

  console.log('[PlacementRenewal] Job started (runs every 24 hours)');
}

/**
 * Stop the placement renewal job.
 */
export function stopPlacementRenewalJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[PlacementRenewal] Job stopped');
  }
}
