/**
 * Directory Promotion Renewal Job
 *
 * Runs daily to handle:
 * - Auto-renewal of promotions with saved payment methods (Stripe off-session charge)
 * - Grace period management for failed auto-renewals (7-day grace)
 * - Expiration of promotions whose period has ended
 * - Cleanup of stale pending purchases (incomplete checkouts > 24h)
 *
 * Pattern: mirrors featured-placement-renewal.ts
 * Design doc: docs/DIRECTORY_PROMOTION_SPRINT_PLAN.md (Sprint 1)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getDirectPool } from '../utils/db-pool';
import Stripe from 'stripe';

export interface PromotionRenewalJobResult {
  autoRenewed: number;
  renewalFailed: number;
  gracePeriodEntered: number;
  expired: number;
  stalePendingCleaned: number;
  errors: string[];
}

const GRACE_PERIOD_DAYS = 7;
const RENEWAL_WINDOW_HOURS = 24;

export async function processPromotionRenewals(): Promise<PromotionRenewalJobResult> {
  const result: PromotionRenewalJobResult = {
    autoRenewed: 0,
    renewalFailed: 0,
    gracePeriodEntered: 0,
    expired: 0,
    stalePendingCleaned: 0,
    errors: [],
  };

  const now = new Date();

  try {
    await processAutoRenewals(now, result);
    await processGracePeriods(now, result);
    await processExpirations(now, result);
    await processStalePending(now, result);
  } catch (error) {
    const errorMsg = (error as Error).message;
    result.errors.push(errorMsg);
    logger.error('[PromotionRenewal] Fatal error', undefined, { error: errorMsg });
  }

  logger.info('[PromotionRenewal] Daily job complete', undefined, {
    autoRenewed: result.autoRenewed,
    renewalFailed: result.renewalFailed,
    gracePeriodEntered: result.gracePeriodEntered,
    expired: result.expired,
    stalePendingCleaned: result.stalePendingCleaned,
    errors: result.errors.length,
  });

  return result;
}

/**
 * 1. Auto-renew promotions expiring within the renewal window.
 */
async function processAutoRenewals(now: Date, result: PromotionRenewalJobResult): Promise<void> {
  const renewalThreshold = new Date(now.getTime() + RENEWAL_WINDOW_HOURS * 60 * 60 * 1000);

  const expiring = await prisma.promotion_purchases.findMany({
    where: {
      status: 'active',
      expires_at: { gte: now, lte: renewalThreshold },
    },
  });

  if (expiring.length === 0) return;

  logger.info(`[PromotionRenewal] Found ${expiring.length} promotions due for auto-renewal`);

  const stripe = initStripe();
  if (!stripe) {
    logger.warn('[PromotionRenewal] Stripe not configured, skipping auto-renewals');
    result.errors.push('stripe_not_configured');
    return;
  }

  for (const purchase of expiring) {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: purchase.tenant_id },
        select: { stripe_customer_id: true, name: true },
      });

      if (!tenant?.stripe_customer_id) {
        await enterGracePeriod(purchase, now, result);
        continue;
      }

      const plan = await prisma.promotion_catalog.findUnique({
        where: { plan_key: purchase.plan_key },
      });

      if (!plan || !plan.is_active) {
        logger.warn(`[PromotionRenewal] Plan ${purchase.plan_key} not found or inactive, entering grace period`, undefined, { purchaseId: purchase.id });
        await enterGracePeriod(purchase, now, result);
        continue;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: plan.price_cents,
        currency: plan.currency || 'USD',
        customer: tenant.stripe_customer_id,
        off_session: true,
        confirm: true,
        metadata: {
          tenantId: purchase.tenant_id,
          purchaseId: purchase.id,
          planKey: purchase.plan_key,
          type: 'directory_promotion_autorenewal',
        },
        description: `Auto-renewal: ${plan.label} for ${tenant.name}`,
      });

      if (paymentIntent.status === 'succeeded') {
        const { generatePromotionPurchaseId } = await import('../lib/id-generator');
        const newPurchaseId = generatePromotionPurchaseId(purchase.tenant_id);
        const newExpiresAt = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

        await prisma.promotion_purchases.create({
          data: {
            id: newPurchaseId,
            tenant_id: purchase.tenant_id,
            plan_key: purchase.plan_key,
            tier: purchase.tier,
            price_cents: plan.price_cents,
            currency: plan.currency || 'USD',
            duration_days: plan.duration_days,
            status: 'active',
            starts_at: now,
            expires_at: newExpiresAt,
            stripe_payment_intent_id: paymentIntent.id,
            renewed_from: purchase.id,
          },
        });

        await prisma.promotion_purchases.update({
          where: { id: purchase.id },
          data: { status: 'expired' },
        });

        // Update directory_listings_list with new expiration
        const pool = getDirectPool();
        await pool.query(
          `UPDATE directory_listings_list
           SET promotion_expires_at = $1
           WHERE tenant_id = $2 AND is_promoted = TRUE`,
          [newExpiresAt, purchase.tenant_id]
        );

        result.autoRenewed++;
        logger.info(`[PromotionRenewal] Auto-renewed promotion ${purchase.id} → ${newPurchaseId}`);
      } else {
        logger.warn(`[PromotionRenewal] Auto-renewal payment status: ${paymentIntent.status} for promotion ${purchase.id}`);
        await enterGracePeriod(purchase, now, result);
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      logger.warn(`[PromotionRenewal] Auto-renewal failed for promotion ${purchase.id}`, undefined, { error: errorMsg });
      result.renewalFailed++;
      await enterGracePeriod(purchase, now, result);
    }
  }
}

/**
 * 2. Process grace periods — promotions that failed auto-renewal.
 */
async function processGracePeriods(now: Date, result: PromotionRenewalJobResult): Promise<void> {
  const inGrace = await prisma.promotion_purchases.findMany({
    where: {
      status: 'grace_period',
    },
  });

  for (const purchase of inGrace) {
    const graceEnds = purchase.grace_period_ends_at || purchase.expires_at || now;

    if (now >= graceEnds) {
      // Grace period expired — deactivate promotion
      await prisma.promotion_purchases.update({
        where: { id: purchase.id },
        data: { status: 'expired' },
      });

      // Clear promotion columns
      const pool = getDirectPool();
      await pool.query(
        `UPDATE directory_listings_list
         SET is_promoted = FALSE, promotion_tier = NULL, promotion_expires_at = NULL
         WHERE tenant_id = $1`,
        [purchase.tenant_id]
      );

      result.expired++;
      logger.info(`[PromotionRenewal] Grace period expired for promotion ${purchase.id}`);
    }
  }
}

/**
 * 3. Process expired promotions — active or cancelled promotions whose time is up.
 */
async function processExpirations(now: Date, result: PromotionRenewalJobResult): Promise<void> {
  const expired = await prisma.promotion_purchases.findMany({
    where: {
      status: { in: ['active', 'cancelled'] },
      expires_at: { lte: now },
    },
  });

  for (const purchase of expired) {
    await prisma.promotion_purchases.update({
      where: { id: purchase.id },
      data: { status: 'expired' },
    });

    // Clear promotion columns
    const pool = getDirectPool();
    await pool.query(
      `UPDATE directory_listings_list
       SET is_promoted = FALSE, promotion_tier = NULL, promotion_expires_at = NULL
       WHERE tenant_id = $1`,
      [purchase.tenant_id]
    );

    result.expired++;
    logger.info(`[PromotionRenewal] Promotion ${purchase.id} expired for tenant ${purchase.tenant_id}`);
  }
}

/**
 * 4. Clean up stale pending purchases (incomplete checkouts > 24h).
 */
async function processStalePending(now: Date, result: PromotionRenewalJobResult): Promise<void> {
  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const stale = await prisma.promotion_purchases.findMany({
    where: {
      status: 'pending',
      created_at: { lte: staleThreshold },
    },
  });

  for (const purchase of stale) {
    await prisma.promotion_purchases.update({
      where: { id: purchase.id },
      data: { status: 'expired' },
    });
    result.stalePendingCleaned++;
    logger.info(`[PromotionRenewal] Cleaned up stale pending promotion ${purchase.id}`);
  }
}

/**
 * Enter grace period for a promotion that failed auto-renewal.
 */
async function enterGracePeriod(purchase: any, now: Date, result: PromotionRenewalJobResult): Promise<void> {
  const graceEnds = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await prisma.promotion_purchases.update({
    where: { id: purchase.id },
    data: {
      status: 'grace_period',
      grace_period_ends_at: graceEnds,
    },
  });

  result.gracePeriodEntered++;
  logger.info(`[PromotionRenewal] Entered grace period for promotion ${purchase.id}, grace ends ${graceEnds.toISOString()}`);
}

function initStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' as any });
}

// ====================
// SCHEDULER
// ====================

let jobInterval: NodeJS.Timeout | null = null;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startPromotionRenewalJob(): void {
  if (jobInterval) {
    console.log('[PromotionRenewal] Job already running');
    return;
  }

  console.log('[PromotionRenewal] Starting daily renewal job');

  processPromotionRenewals().catch(err => {
    logger.error('[PromotionRenewal] Initial run failed', undefined, { error: err instanceof Error ? err.message : String(err) });
  });

  jobInterval = setInterval(() => {
    processPromotionRenewals().catch(err => {
      logger.error('[PromotionRenewal] Scheduled run failed', undefined, { error: err instanceof Error ? err.message : String(err) });
    });
  }, RUN_INTERVAL_MS);

  console.log('[PromotionRenewal] Job started (runs every 24 hours)');
}

export function stopPromotionRenewalJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[PromotionRenewal] Job stopped');
  }
}
