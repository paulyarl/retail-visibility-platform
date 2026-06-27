/**
 * Badge Rule Auto-Assign Job
 *
 * Scheduled job that runs every 4 hours to:
 * 1. Read auto_assign_rule and auto_remove_rule from featured_type_registry
 * 2. Evaluate rules against product data (inventory_items)
 * 3. Auto-assign badges with assignment_source = 'auto'
 * 4. Auto-remove badges where conditions no longer match
 * 5. Log conflicts (badges that can't be assigned due to conflict_with rules)
 *
 * Only processes tenant-controlled badges with rules (sale, new_arrival, clearance).
 * Platform-controlled badges (trending, bestseller, etc.) are handled by the
 * platform-badge-sync job.
 */

import { prisma } from '../prisma';
import { evaluateBadgeRulesForTenant } from '../services/BadgeRuleEngine';
import { FeaturedProductsService } from '../services/FeaturedProductsService';

const SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const STARTUP_DELAY_MS = 3 * 60 * 1000; // 3 minutes (before platform badge sync at 5 min)
let syncIntervalId: NodeJS.Timeout | null = null;

export interface BadgeRuleSyncResult {
  tenantsProcessed: number;
  assigned: number;
  removed: number;
  conflicts: number;
  errors: string[];
}

/**
 * Get all active tenant IDs.
 */
async function getAllTenantIds(): Promise<string[]> {
  try {
    const tenants = await prisma.tenants.findMany({
      where: { subscription_status: { not: 'cancelled' } },
      select: { id: true },
    });
    return tenants.map(t => t.id);
  } catch (error) {
    console.error('[BadgeRuleSync] Error fetching tenants:', error);
    return [];
  }
}

/**
 * Run badge rule evaluation and auto-assign/remove for all tenants.
 */
async function runScheduledSync(): Promise<BadgeRuleSyncResult> {
  const result: BadgeRuleSyncResult = {
    tenantsProcessed: 0,
    assigned: 0,
    removed: 0,
    conflicts: 0,
    errors: [],
  };

  console.log('[BadgeRuleSync] Starting scheduled badge rule sync...');
  const startTime = Date.now();

  try {
    const tenantIds = await getAllTenantIds();
    console.log(`[BadgeRuleSync] Found ${tenantIds.length} active tenants`);

    if (tenantIds.length === 0) {
      console.log('[BadgeRuleSync] No tenants, skipping');
      return result;
    }

    for (const tenantId of tenantIds) {
      try {
        const evaluation = await evaluateBadgeRulesForTenant(tenantId);

        // Process auto-assigns
        for (const assign of evaluation.toAssign) {
          try {
            await FeaturedProductsService.addFeaturedType(
              assign.inventoryItemId,
              tenantId,
              assign.badgeKey as any,
              {
                featured_priority: 50,
                auto_unfeature: false,
                assignment_source: 'auto',
              }
            );
            result.assigned++;
          } catch (error: any) {
            console.error(`[BadgeRuleSync] Error assigning ${assign.badgeKey} to ${assign.inventoryItemId}:`, error);
            result.errors.push(`Assign ${tenantId}/${assign.badgeKey}: ${error.message}`);
          }
        }

        // Process auto-removes
        for (const remove of evaluation.toRemove) {
          try {
            await prisma.featured_products.updateMany({
              where: {
                inventory_item_id: remove.inventoryItemId,
                featured_type: remove.badgeKey,
                assignment_source: 'auto',
                is_active: true,
              },
              data: {
                is_active: false,
                rule_evaluated_at: new Date(),
              },
            });
            result.removed++;
          } catch (error: any) {
            console.error(`[BadgeRuleSync] Error removing ${remove.badgeKey} from ${remove.inventoryItemId}:`, error);
            result.errors.push(`Remove ${tenantId}/${remove.badgeKey}: ${error.message}`);
          }
        }

        // Log conflicts
        if (evaluation.conflicts.length > 0) {
          result.conflicts += evaluation.conflicts.length;
          console.log(`[BadgeRuleSync] Tenant ${tenantId}: ${evaluation.conflicts.length} conflicts (skipped)`);
        }

        result.tenantsProcessed++;
      } catch (error: any) {
        console.error(`[BadgeRuleSync] Error processing tenant ${tenantId}:`, error);
        result.errors.push(`Tenant ${tenantId}: ${error.message}`);
      }

      // Small delay between tenants
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[BadgeRuleSync] Completed in ${duration}s: ${result.tenantsProcessed} tenants, ` +
      `${result.assigned} assigned, ${result.removed} removed, ${result.conflicts} conflicts, ${result.errors.length} errors`
    );
  } catch (error) {
    console.error('[BadgeRuleSync] Fatal error:', error);
    result.errors.push(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * Start the scheduled badge rule sync job.
 */
export async function startBadgeRuleSync(): Promise<void> {
  if (process.env.DISABLE_BADGE_RULE_SYNC === 'true') {
    console.log('[BadgeRuleSync] Disabled via DISABLE_BADGE_RULE_SYNC env var');
    return;
  }

  if (syncIntervalId) {
    console.log('[BadgeRuleSync] Already running');
    return;
  }

  console.log(`[BadgeRuleSync] Starting scheduler (every 4 hours)`);

  setTimeout(() => {
    runScheduledSync().catch(console.error);
  }, STARTUP_DELAY_MS);

  syncIntervalId = setInterval(() => {
    runScheduledSync().catch(console.error);
  }, SYNC_INTERVAL_MS);
}

/**
 * Stop the scheduled badge rule sync job.
 */
export function stopBadgeRuleSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[BadgeRuleSync] Stopped');
  }
}

/**
 * Manually trigger badge rule sync for a single tenant.
 */
export async function triggerManualBadgeRuleSync(tenantId: string): Promise<{
  assigned: number;
  removed: number;
  conflicts: number;
}> {
  const evaluation = await evaluateBadgeRulesForTenant(tenantId);

  let assigned = 0;
  let removed = 0;

  for (const assign of evaluation.toAssign) {
    try {
      await FeaturedProductsService.addFeaturedType(
        assign.inventoryItemId,
        tenantId,
        assign.badgeKey as any,
        {
          featured_priority: 50,
          auto_unfeature: false,
          assignment_source: 'auto',
        }
      );
      assigned++;
    } catch (error) {
      console.error(`[BadgeRuleSync] Manual assign error:`, error);
    }
  }

  for (const remove of evaluation.toRemove) {
    try {
      await prisma.featured_products.updateMany({
        where: {
          inventory_item_id: remove.inventoryItemId,
          featured_type: remove.badgeKey,
          assignment_source: 'auto',
          is_active: true,
        },
        data: {
          is_active: false,
          rule_evaluated_at: new Date(),
        },
      });
      removed++;
    } catch (error) {
      console.error(`[BadgeRuleSync] Manual remove error:`, error);
    }
  }

  return { assigned, removed, conflicts: evaluation.conflicts.length };
}
