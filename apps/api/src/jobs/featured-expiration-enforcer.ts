/**
 * Featured Expiration Enforcer Job
 *
 * Runs every 5 minutes to:
 * - Deactivate expired featured products (is_active = false where featured_expires_at <= NOW())
 * - Create 3-day and 1-day expiration warning CRM alerts for active placement purchases
 * - Create expired placement CRM alerts and mark purchases as expired
 * - Invalidates ActiveFeaturedResolver cache
 * - Emits badge_events for expired products (for analytics)
 *
 * This job handles the expiration enforcement for the Active Featured Resolution system.
 * It is distinct from the existing featured-products-expiry-monitor.ts job, which
 * handles CRM task creation and tier-gated notifications.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { invalidateActiveFeaturedCache } from '../services/ActiveFeaturedResolver';
import CrmAlertService from '../services/CrmAlertService';

export interface ExpirationEnforcerResult {
  deactivated: number;
  warningsCreated: number;
  expiredAlertsCreated: number;
  errors: string[];
}

/**
 * Process expired featured products — deactivate them.
 */
export async function processExpiredFeatured(): Promise<ExpirationEnforcerResult> {
  const result: ExpirationEnforcerResult = {
    deactivated: 0,
    warningsCreated: 0,
    expiredAlertsCreated: 0,
    errors: [],
  };

  const now = new Date();

  try {
    // Find all active featured products that have expired
    const expired = await prisma.featured_products.findMany({
      where: {
        is_active: true,
        featured_expires_at: { not: null, lte: now },
      },
      select: {
        id: true,
        tenant_id: true,
        inventory_item_id: true,
        featured_type: true,
      },
    });

    if (expired.length > 0) {

    // Deactivate all expired featured products
    const expiredIds = expired.map(fp => fp.id);
    const updateResult = await prisma.featured_products.updateMany({
      where: { id: { in: expiredIds } },
      data: { is_active: false },
    });

    result.deactivated = updateResult.count;
    logger.info(`[FeaturedExpirationEnforcer] Deactivated ${updateResult.count} expired featured products`);

    // Invalidate ActiveFeaturedResolver cache for affected tenants
    const affectedTenants = new Set(expired.map(fp => fp.tenant_id));
    for (const tenantId of affectedTenants) {
      invalidateActiveFeaturedCache(tenantId);
    }
    // Also invalidate platform-level cache
    invalidateActiveFeaturedCache(null);

    // Emit badge_events for analytics (fire-and-forget)
    try {
      const events = expired.map(fp => ({
        tenant_id: fp.tenant_id,
        inventory_item_id: fp.inventory_item_id,
        badge_key: fp.featured_type,
        event_type: 'featured_expired',
        created_at: now,
      }));

      await prisma.badge_events.createMany({
        data: events,
        skipDuplicates: true,
      });
    } catch (eventError) {
      // Non-fatal — analytics events are best-effort
      logger.warn('[FeaturedExpirationEnforcer] Failed to create badge_events', undefined, {
        error: (eventError as Error).message,
      });
    }
    } // end if expired.length > 0

    // Process placement purchase expiration warnings and alerts
    await processPlacementExpirationAlerts(now, result);
  } catch (error) {
    const errorMsg = (error as Error).message;
    result.errors.push(errorMsg);
    logger.error('[FeaturedExpirationEnforcer] Failed to process expired featured products', undefined, {
      error: errorMsg,
    });
  }

  return result;
}

/**
 * Process placement purchase expiration warnings (3-day, 1-day) and expired alerts.
 * Creates CRM alerts via CrmAlertService (fire-and-forget pattern).
 */
async function processPlacementExpirationAlerts(now: Date, result: ExpirationEnforcerResult): Promise<void> {
  try {
    // 1. Find active placements expiring within 3 days (for 3-day warning)
    const threeDayThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const oneDayThreshold = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // Find placements that need 3-day warning (expires between now+2.9d and now+3d to avoid duplicates)
    // We use a tighter window to avoid sending the same alert every 5 minutes
    const threeDayWindowStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const expiringThreeDay = await prisma.featured_placement_purchases.findMany({
      where: {
        status: 'active',
        expires_at: { gte: threeDayWindowStart, lte: threeDayThreshold },
      },
    });

    // Find placements that need 1-day warning (expires between now+0.9d and now+1d)
    const oneDayWindowStart = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const expiringOneDay = await prisma.featured_placement_purchases.findMany({
      where: {
        status: 'active',
        expires_at: { gte: oneDayWindowStart, lte: oneDayThreshold },
      },
    });

    // Find expired placements that need expired alert + status update
    const expiredPlacements = await prisma.featured_placement_purchases.findMany({
      where: {
        status: 'active',
        expires_at: { lte: now },
      },
    });

    const alertService = CrmAlertService.getInstance();

    // 3-day warnings
    for (const placement of expiringThreeDay) {
      const productName = await getProductName(placement.inventory_item_id);
      alertService.createFeaturedPlacementAlert({
        tenantId: placement.tenant_id,
        placementId: placement.id,
        productName,
        planKey: placement.plan_key,
        surface: placement.surface,
        expiresAt: placement.expires_at!,
        durationDays: placement.duration_days,
        priceCents: placement.price_cents,
        alertType: 'featured_placement_expiring',
      }).catch(err => logger.warn('[FeaturedExpirationEnforcer] Failed to create 3-day warning', undefined, { error: (err as Error).message, placementId: placement.id }));
      result.warningsCreated++;
    }

    // 1-day warnings
    for (const placement of expiringOneDay) {
      const productName = await getProductName(placement.inventory_item_id);
      alertService.createFeaturedPlacementAlert({
        tenantId: placement.tenant_id,
        placementId: placement.id,
        productName,
        planKey: placement.plan_key,
        surface: placement.surface,
        expiresAt: placement.expires_at!,
        durationDays: placement.duration_days,
        priceCents: placement.price_cents,
        alertType: 'featured_placement_urgent',
      }).catch(err => logger.warn('[FeaturedExpirationEnforcer] Failed to create 1-day warning', undefined, { error: (err as Error).message, placementId: placement.id }));
      result.warningsCreated++;
    }

    // Expired placements — update status + create alert
    for (const placement of expiredPlacements) {
      await prisma.featured_placement_purchases.update({
        where: { id: placement.id },
        data: { status: 'expired' },
      }).catch(err => logger.warn('[FeaturedExpirationEnforcer] Failed to mark placement expired', undefined, { error: (err as Error).message, placementId: placement.id }));

      const productName = await getProductName(placement.inventory_item_id);
      alertService.createFeaturedPlacementAlert({
        tenantId: placement.tenant_id,
        placementId: placement.id,
        productName,
        planKey: placement.plan_key,
        surface: placement.surface,
        expiresAt: placement.expires_at || now,
        durationDays: placement.duration_days,
        priceCents: placement.price_cents,
        alertType: 'featured_placement_expired',
      }).catch(err => logger.warn('[FeaturedExpirationEnforcer] Failed to create expired alert', undefined, { error: (err as Error).message, placementId: placement.id }));
      result.expiredAlertsCreated++;
    }

    if (result.warningsCreated > 0 || result.expiredAlertsCreated > 0) {
      logger.info(`[FeaturedExpirationEnforcer] Placement alerts: ${result.warningsCreated} warnings, ${result.expiredAlertsCreated} expired`);
    }
  } catch (error) {
    logger.warn('[FeaturedExpirationEnforcer] Failed to process placement expiration alerts', undefined, {
      error: (error as Error).message,
    });
  }
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
const RUN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Start the expiration enforcer job.
 * Runs every 5 minutes.
 */
export function startFeaturedExpirationEnforcer(): void {
  if (jobInterval) {
    console.log('[FeaturedExpirationEnforcer] Job already running');
    return;
  }

  console.log('[FeaturedExpirationEnforcer] Starting job (runs every 5 minutes)');

  // Run immediately on start
  processExpiredFeatured().catch(err => {
    logger.error('[FeaturedExpirationEnforcer] Initial run failed', undefined, { error: err instanceof Error ? err.message : String(err) });
  });

  // Then run on interval
  jobInterval = setInterval(() => {
    processExpiredFeatured().catch(err => {
      logger.error('[FeaturedExpirationEnforcer] Scheduled run failed', undefined, { error: err instanceof Error ? err.message : String(err) });
    });
  }, RUN_INTERVAL_MS);

  console.log('[FeaturedExpirationEnforcer] Job started');
}

/**
 * Stop the expiration enforcer job.
 */
export function stopFeaturedExpirationEnforcer(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[FeaturedExpirationEnforcer] Job stopped');
  }
}
