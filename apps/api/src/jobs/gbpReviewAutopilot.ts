/**
 * GBP Review Autopilot Job (Tier B) — PLUMBING ONLY, NOT SCHEDULED.
 *
 * Tier B publishes AI-drafted replies to positive reviews without human
 * review. It is deliberately inert until the platform gives the green light:
 *
 *   1. This module is a catalog-only JobRegistry entry (see index.ts
 *      `declareJobs`) — it has no timer and never runs on a schedule.
 *   2. `startGbpReviewAutopilot()` below is the one-line flip. It is not
 *      called from index.ts; wire it there (next to startGbpReviewIngestion)
 *      to go live.
 *   3. Even when scheduled, `GBPReviewReplyService.runAutopilot` no-ops unless
 *      `GBP_AUTOPILOT_ENABLED=true` AND the tenant is entitled AND the merchant
 *      has opted in (`tenant_gbp_options_settings.gbp_autopilot_enabled`).
 *
 * So activation is two independent switches — an operator flag and a per-tenant
 * merchant opt-in — and neither can publish a reply on its own.
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §4 Subsystem 2 / §9 Phase 2.5
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { GBPReviewReplyService, type AutopilotResult } from '../services/GBPReviewReplyService';
import { unifiedConfig } from '../config/unifiedConfig';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'gbp-review-autopilot';
const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000; // hourly
const STARTUP_DELAY_MS = 5 * 60 * 1000;

let firstRun = true;

export interface AutopilotPassSummary {
  tenantsScanned: number;
  published: number;
  failed: number;
  results: Array<{ tenantId: string } & AutopilotResult>;
}

/**
 * Run one autopilot pass across every tenant that has opted in.
 *
 * Only tenants with `gbp_autopilot_enabled = true` are considered, so an
 * unscheduled invocation (admin trigger / tests) can't accidentally reply on
 * behalf of a merchant who never asked for it.
 */
export async function runGbpReviewAutopilotPass(opts?: { tenantIds?: string[] }): Promise<AutopilotPassSummary> {
  const service = GBPReviewReplyService.getInstance();

  let tenantIds: string[] = opts?.tenantIds ?? [];
  if (!opts?.tenantIds) {
    const optedIn = await (prisma as any).tenant_gbp_options_settings?.findMany({
      where: { gbp_autopilot_enabled: true },
      select: { tenant_id: true },
    });
    tenantIds = (optedIn ?? []).map((r: { tenant_id: string }) => r.tenant_id);
  }

  const results: AutopilotPassSummary['results'] = [];
  let published = 0;
  let failed = 0;

  for (const tenantId of tenantIds) {
    try {
      const result = await service.runAutopilot(tenantId);
      published += result.published;
      failed += result.failed;
      results.push({ tenantId, ...result });
    } catch (error) {
      failed++;
      results.push({
        tenantId,
        activated: false,
        reason: 'not_activated',
        scanned: 0,
        published: 0,
        skipped: 0,
        failed: 1,
      });
      logger.warn('[GbpReviewAutopilot] Tenant pass failed', undefined, {
        tenantId,
        error: (error as Error).message,
      });
    }
  }

  return { tenantsScanned: tenantIds.length, published, failed, results };
}

async function runAutopilotPass(): Promise<void> {
  logger.info('[GbpReviewAutopilot] Starting autopilot pass...');
  try {
    const summary = await runGbpReviewAutopilotPass();
    logger.info('[GbpReviewAutopilot] Pass complete', undefined, {
      tenantsScanned: summary.tenantsScanned,
      published: summary.published,
      failed: summary.failed,
    });
  } catch (error) {
    logger.error('[GbpReviewAutopilot] Pass failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
        stack: (error as Error)?.stack,
      },
    });
  }
}

/**
 * GREEN-LIGHT FLIP — schedule the hourly autopilot pass.
 *
 * Intentionally not called from index.ts. To activate: import and call this
 * next to `startGbpReviewIngestion()`, and set `GBP_AUTOPILOT_ENABLED=true`.
 * Disable without a deploy via `DISABLE_GBP_REVIEW_AUTOPILOT=true`.
 */
export async function startGbpReviewAutopilot(): Promise<void> {
  scheduleJob({
    name: JOB_NAME,
    description: 'Tier B: auto-publishes AI review replies for opted-in tenants',
    scheduleLabel: 'hourly',
    envDisableVar: 'DISABLE_GBP_REVIEW_AUTOPILOT',
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : SCHEDULER_INTERVAL_MS),
    handler: async () => {
      if (!unifiedConfig.gbpAutopilotEnabled) {
        return { skipped: 'autopilot_not_activated' };
      }
      return runAutopilotPass();
    },
  });
}

export function stopGbpReviewAutopilot(): void {
  stopJob(JOB_NAME);
}
