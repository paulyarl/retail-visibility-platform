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
import {
  invalidateEffectiveCapabilities,
  resolveEffectiveCapabilities,
} from '../services/EffectiveCapabilityResolver';
import {
  generateFlyerId,
  generateFlyerItemId,
  generateFlyerShareCode,
} from '../lib/id-generator';

export interface FlyerEnforcerResult {
  published: number;
  expired: number;
  rolled: number;
  variantsDeactivated: number;
  errors: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Create the successor window for a recurring flyer (spec §3 — daily/weekly
 * auto-roll). Advances starts_at by whole intervals until it's in the future,
 * preserving window duration. Idempotent via (tenant_id, title, starts_at).
 * The successor is 'scheduled' — its item refs keep variants active in the
 * orphan-release sweep that follows.
 */
async function rollRecurringFlyer(
  flyer: {
    id: string;
    tenant_id: string;
    title: string;
    summary: string | null;
    hero_image_url: string | null;
    cta_mode: string;
    recurrence: string;
    starts_at: Date;
    ends_at: Date;
  },
  now: Date,
): Promise<boolean> {
  if (flyer.recurrence !== 'daily' && flyer.recurrence !== 'weekly') return false;

  // Tier gate — capability can be revoked between publish and roll
  const caps = await resolveEffectiveCapabilities(flyer.tenant_id);
  if (!caps?.effective?.flyer?.recurring) return false;

  const intervalMs = flyer.recurrence === 'daily' ? DAY_MS : 7 * DAY_MS;
  const durationMs = flyer.ends_at.getTime() - flyer.starts_at.getTime();
  let nextStart = new Date(flyer.starts_at.getTime() + intervalMs);
  while (nextStart.getTime() <= now.getTime()) {
    nextStart = new Date(nextStart.getTime() + intervalMs);
  }
  const nextEnd = new Date(nextStart.getTime() + durationMs);

  const dupe = await prisma.tenant_flyers.findFirst({
    where: { tenant_id: flyer.tenant_id, title: flyer.title, starts_at: nextStart },
    select: { id: true },
  });
  if (dupe) return false;

  const items = await prisma.tenant_flyer_items.findMany({
    where: { flyer_id: flyer.id },
    select: { variant_id: true, inventory_item_id: true, note: true, sort_order: true },
  });

  const successor = await prisma.tenant_flyers.create({
    data: {
      id: generateFlyerId(flyer.tenant_id),
      tenant_id: flyer.tenant_id,
      title: flyer.title,
      summary: flyer.summary,
      hero_image_url: flyer.hero_image_url,
      starts_at: nextStart,
      ends_at: nextEnd,
      status: 'scheduled',
      cta_mode: flyer.cta_mode,
      recurrence: flyer.recurrence,
      share_code: generateFlyerShareCode(),
    },
  });

  if (items.length > 0) {
    await prisma.tenant_flyer_items.createMany({
      data: items.map((item) => ({
        id: generateFlyerItemId(flyer.tenant_id),
        flyer_id: successor.id,
        variant_id: item.variant_id,
        inventory_item_id: item.inventory_item_id,
        note: item.note,
        sort_order: item.sort_order,
      })),
    });
  }

  logger.info('[FlyerExpiryEnforcer] Rolled recurring flyer', undefined, {
    flyerId: flyer.id,
    successorId: successor.id,
    recurrence: flyer.recurrence,
    nextStart: nextStart.toISOString(),
  });
  return true;
}

export async function processFlyerWindows(): Promise<FlyerEnforcerResult> {
  const result: FlyerEnforcerResult = { published: 0, expired: 0, rolled: 0, variantsDeactivated: 0, errors: [] };
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
      select: {
        id: true, tenant_id: true, title: true, summary: true,
        hero_image_url: true, cta_mode: true, recurrence: true,
        starts_at: true, ends_at: true,
      },
    });
    if (ending.length > 0) {
      const endedIds = ending.map(f => f.id);
      const expired = await prisma.tenant_flyers.updateMany({
        where: { id: { in: endedIds } },
        data: { status: 'expired', updated_at: now },
      });
      result.expired = expired.count;

      // 2a. Roll recurring flyers into their next window BEFORE the orphan
      //     sweep — the successor's item refs keep variants active.
      for (const flyer of ending) {
        try {
          if (await rollRecurringFlyer(flyer, now)) result.rolled++;
        } catch (rollError) {
          result.errors.push(`roll ${flyer.id}: ${(rollError as Error).message}`);
        }
      }

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

    if (result.published > 0 || result.expired > 0 || result.rolled > 0) {
      logger.info(`[FlyerExpiryEnforcer] published=${result.published} expired=${result.expired} rolled=${result.rolled} variantsDeactivated=${result.variantsDeactivated}`);
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
