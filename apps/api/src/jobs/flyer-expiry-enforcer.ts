/**
 * Flyer Expiry Enforcer Job
 *
 * Runs every 5 minutes to:
 * - Flip scheduled flyers to published once starts_at arrives
 * - Flip published flyers to expired once ends_at passes
 * - Deactivate variants linked only to expired/archived flyers (spec §3 —
 *   variants are the merchant's permanent repertoire, never deleted)
 *
 * Public queries also enforce the window predicate, so a delayed run never
 * leaks an expired flyer onto a surface — this job only maintains state.
 *
 * Spec: docs/LocalBiz/FLYER_SURFACE_SPEC.md §3.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

export interface FlyerEnforcerResult {
  published: number;
  expired: number;
  variantsDeactivated: number;
  errors: string[];
}

export async function processFlyerWindows(): Promise<FlyerEnforcerResult> {
  const result: FlyerEnforcerResult = { published: 0, expired: 0, variantsDeactivated: 0, errors: [] };
  const now = new Date();

  try {
    // 1. scheduled → published when the window opens
    const due = await prisma.tenant_flyers.updateMany({
      where: { status: 'scheduled', starts_at: { lte: now }, ends_at: { gt: now } },
      data: { status: 'published', updated_at: now },
    });
    result.published = due.count;

    // 2. published → expired when the window closes
    const ending = await prisma.tenant_flyers.findMany({
      where: { status: 'published', ends_at: { lte: now } },
      select: { id: true, tenant_id: true },
    });
    if (ending.length > 0) {
      const endedIds = ending.map(f => f.id);
      const expired = await prisma.tenant_flyers.updateMany({
        where: { id: { in: endedIds } },
        data: { status: 'expired', updated_at: now },
      });
      result.expired = expired.count;

      // 3. Deactivate variants whose ONLY remaining flyer references are
      //    expired/archived — the dish stays in the repertoire inactive.
      const linked = await prisma.tenant_flyer_items.findMany({
        where: { flyer_id: { in: endedIds }, variant_id: { not: null } },
        select: { variant_id: true },
      });
      for (const { variant_id } of linked) {
        const liveRefs = await prisma.tenant_flyer_items.count({
          where: {
            variant_id: variant_id!,
            tenant_flyers: { status: { in: ['draft', 'scheduled', 'published'] } },
          },
        });
        if (liveRefs === 0) {
          await prisma.product_variants.updateMany({
            where: { id: variant_id!, is_active: true },
            data: { is_active: false },
          });
          result.variantsDeactivated++;
        }
      }

      const affectedTenants = new Set(ending.map(f => f.tenant_id));
      for (const tenantId of affectedTenants) {
        invalidateEffectiveCapabilities(tenantId);
      }
    }

    if (result.published > 0 || result.expired > 0) {
      logger.info(`[FlyerExpiryEnforcer] published=${result.published} expired=${result.expired} variantsDeactivated=${result.variantsDeactivated}`);
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    result.errors.push(errorMsg);
    logger.error('[FlyerExpiryEnforcer] Failed to process flyer windows', undefined, { error: errorMsg });
  }

  return result;
}

// ====================
// SCHEDULER
// ====================

const JOB_NAME = 'flyer-expiry-enforcer';
const RUN_INTERVAL_MS = 5 * 60 * 1000;
let firstRun = true;

export function startFlyerExpiryEnforcer(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Transitions flyer windows (scheduled→published→expired) and releases orphan variants',
    scheduleLabel: 'every 5 minutes',
    computeNextDelay: () => (firstRun ? ((firstRun = false), 5_000) : RUN_INTERVAL_MS),
    handler: async () => processFlyerWindows(),
  });
}

export function stopFlyerExpiryEnforcer(): void {
  stopJob(JOB_NAME);
}
