/**
 * Featured Products Expiry Monitor Job
 *
 * Scheduled job that runs daily to:
 * 1. Auto-unfeature expired featured products (auto_unfeature = true)
 * 2. Create CRM tasks for tenants with featured products expiring soon (3 days)
 * 3. Create CRM tasks for tenants with featured products that just expired
 *
 * Capability-gated: only tenants with 'featured_expiry_monitor' capability
 * (professional tier and above) receive proactive CRM task notifications.
 * Auto-unfeature applies to all tiers.
 *
 * Run schedule: Daily at midnight (00:00 UTC)
 */

import { prisma } from '../prisma';
import { CrmTaskService } from '../services/CrmTaskService';
import FeaturedOptionsService from '../services/FeaturedOptionsService';
import { logger } from '../logger';

export interface FeaturedExpiryMonitorResult {
  autoUnfeatured: number;
  expiringSoonAlerts: number;
  expiredAlerts: number;
  badgeRuleWarnings: number;
  errors: string[];
}

/**
 * Process featured products expiry — auto-unfeature expired, create CRM alerts
 */
export async function processFeaturedProductsExpiry(): Promise<FeaturedExpiryMonitorResult> {
  const result: FeaturedExpiryMonitorResult = {
    autoUnfeatured: 0,
    expiringSoonAlerts: 0,
    expiredAlerts: 0,
    badgeRuleWarnings: 0,
    errors: [],
  };

  const now = new Date();

  try {
    // 1. Auto-unfeature expired products where auto_unfeature = true
    const expiredActive = await prisma.featured_products.findMany({
      where: {
        is_active: true,
        auto_unfeature: true,
        featured_expires_at: { not: null, lte: now },
      },
      select: {
        id: true,
        tenant_id: true,
        featured_type: true,
        featured_expires_at: true,
        inventory_items: {
          select: { name: true },
        },
        tenants: {
          select: { name: true, subscription_tier: true },
        },
      },
    });

    if (expiredActive.length > 0) {
      const expiredIds = expiredActive.map(fp => fp.id);
      const updateResult = await prisma.featured_products.updateMany({
        where: { id: { in: expiredIds } },
        data: { is_active: false },
      });
      result.autoUnfeatured = updateResult.count;
      console.log(`[FeaturedExpiryMonitor] Auto-unfeatured ${updateResult.count} expired products`);
    }

    // 2. Group expired products by tenant for CRM task creation
    const expiredByTenant = groupByTenant(expiredActive);
    for (const [tenantId, products] of expiredByTenant) {
      const tenantName = products[0].tenants?.name || tenantId;

      // Check capability via FeaturedOptionsService (tier-gated + merchant gate)
      const featuredState = await FeaturedOptionsService.getInstance().resolveFeaturedOptionsState(tenantId);
      if (!featuredState.expiryMonitorEnabled) {
        continue; // Skip CRM task for tenants without this capability or with it disabled
      }

      try {
        const productNames = products.map(p => p.inventory_items?.name || p.featured_type).join(', ');
        await CrmTaskService.getInstance().create({
          tenant_id: tenantId,
          title: `Featured products expired — ${tenantName}`,
          description: `The following featured products have expired and been automatically unfeatured:\n\n${productNames}\n\nReview your featured landscape and consider renewing or adjusting your featured selections.\n\nManage featured products: ${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${tenantId}/products/featured`,
          priority: 'medium',
          created_by: 'system-featured-expiry-monitor',
        });
        result.expiredAlerts++;
      } catch (error: any) {
        logger.error(`[FeaturedExpiryMonitor] Failed to create expired CRM task for tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
        result.errors.push(`Expired CRM task ${tenantId}: ${error.message}`);
      }
    }

    // 3. Find products expiring within 3 days (warning alerts)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const expiringSoon = await prisma.featured_products.findMany({
      where: {
        is_active: true,
        featured_expires_at: { not: null, gt: now, lte: threeDaysFromNow },
      },
      select: {
        id: true,
        tenant_id: true,
        featured_type: true,
        featured_expires_at: true,
        inventory_items: {
          select: { name: true },
        },
        tenants: {
          select: { name: true, subscription_tier: true },
        },
      },
    });

    console.log(`[FeaturedExpiryMonitor] Found ${expiringSoon.length} products expiring within 3 days`);

    // 4. Group expiring-soon products by tenant for CRM task creation
    const expiringByTenant = groupByTenant(expiringSoon);
    for (const [tenantId, products] of expiringByTenant) {
      const tenantName = products[0].tenants?.name || tenantId;

      // Check capability via FeaturedOptionsService (tier-gated + merchant gate)
      const featuredState = await FeaturedOptionsService.getInstance().resolveFeaturedOptionsState(tenantId);
      if (!featuredState.expiryMonitorEnabled) {
        continue;
      }

      try {
        const productLines = products.map(p => {
          const name = p.inventory_items?.name || p.featured_type;
          const daysLeft = Math.ceil(((p.featured_expires_at?.getTime() || 0) - now.getTime()) / (1000 * 60 * 60 * 24));
          return `• ${name} (${p.featured_type}) — expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
        }).join('\n');

        const earliestExpiry = products
          .map(p => p.featured_expires_at!)
          .sort((a, b) => a.getTime() - b.getTime())[0];

        await CrmTaskService.getInstance().create({
          tenant_id: tenantId,
          title: `Featured products expiring soon — ${tenantName}`,
          description: `The following featured products are expiring within 3 days:\n\n${productLines}\n\nReview and extend or adjust your featured selections before they expire.\n\nManage featured products: ${process.env.WEB_URL || 'https://visibleshelf.com'}/t/${tenantId}/products/featured`,
          priority: 'high',
          due_date: earliestExpiry,
          created_by: 'system-featured-expiry-monitor',
        });
        result.expiringSoonAlerts++;
      } catch (error: any) {
        logger.error(`[FeaturedExpiryMonitor] Failed to create expiring CRM task for tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
        result.errors.push(`Expiring CRM task ${tenantId}: ${error.message}`);
      }
    }

    // 5. Badge rule validation — check for manual badges that contradict product state
    try {
      const { evaluateBadgeRulesForTenant } = await import('../services/BadgeRuleEngine');
      const allTenants = new Set<string>([
        ...Array.from(expiredByTenant.keys()),
        ...Array.from(expiringByTenant.keys()),
      ]);

      // Also check tenants with auto-assigned badges
      const autoAssignedTenants = await prisma.featured_products.findMany({
        where: { is_active: true, assignment_source: 'auto' },
        select: { tenant_id: true },
        distinct: ['tenant_id'],
      });
      autoAssignedTenants.forEach(t => allTenants.add(t.tenant_id));

      for (const tenantId of allTenants) {
        try {
          const evaluation = await evaluateBadgeRulesForTenant(tenantId);
          if (evaluation.conflicts.length > 0) {
            result.badgeRuleWarnings += evaluation.conflicts.length;
            console.log(`[FeaturedExpiryMonitor] Tenant ${tenantId}: ${evaluation.conflicts.length} badge rule conflicts detected`);
          }
        } catch (err) {
          // Non-fatal — rule engine may fail if registry not populated
        }
      }
    } catch (importErr) {
      // BadgeRuleEngine not available — skip rule validation
    }

    console.log(`[FeaturedExpiryMonitor] Complete. Unfeatured: ${result.autoUnfeatured}, Expiring alerts: ${result.expiringSoonAlerts}, Expired alerts: ${result.expiredAlerts}, Rule warnings: ${result.badgeRuleWarnings}, Errors: ${result.errors.length}`);

    return result;
  } catch (error: any) {
    logger.error('[FeaturedExpiryMonitor] Fatal error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    result.errors.push(`Fatal error: ${error.message}`);
    return result;
  }
}

/**
 * Group featured products by tenant_id
 */
function groupByTenant(products: any[]): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const product of products) {
    const tid = product.tenant_id;
    if (!map.has(tid)) map.set(tid, []);
    map.get(tid)!.push(product);
  }
  return map;
}

/**
 * Start the scheduled job
 * Runs daily at midnight
 */
let jobInterval: NodeJS.Timeout | null = null;

export function startFeaturedExpiryMonitor(): void {
  if (jobInterval) {
    console.log('[FeaturedExpiryMonitor] Job already running');
    return;
  }

  // Calculate time until next midnight
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 5, 0, 0); // 00:05 UTC to avoid collision with grace period job
  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  console.log(`[FeaturedExpiryMonitor] Scheduling first run in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);

  // Schedule first run at midnight
  setTimeout(() => {
    processFeaturedProductsExpiry().catch(console.error);

    // Then run every 24 hours
    jobInterval = setInterval(() => {
      processFeaturedProductsExpiry().catch(console.error);
    }, 24 * 60 * 60 * 1000);

    console.log('[FeaturedExpiryMonitor] Daily job started');
  }, msUntilMidnight);

  console.log('[FeaturedExpiryMonitor] Scheduler initialized');
}

/**
 * Stop the scheduled job
 */
export function stopFeaturedExpiryMonitor(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[FeaturedExpiryMonitor] Job stopped');
  }
}

/**
 * Manual trigger for testing
 */
export async function triggerFeaturedExpiryMonitor(): Promise<FeaturedExpiryMonitorResult> {
  console.log('[FeaturedExpiryMonitor] Manual trigger');
  return processFeaturedProductsExpiry();
}
