/**
 * gbp-admin-drift — daily sweep confirming the platform still holds an admin
 * row on every managed GBP location (model B drift check, spec §3.3).
 *
 * Revocations flip claim_state → 'revoked', fire a critical ops alert, and
 * write an ops-internal activity event. Locations in 'handoff_pending' are
 * skipped — our admin row is expected to leave during offboarding.
 *
 * Kill switches: DISABLE_GBP_ADMIN_DRIFT=1 (env) + the JobRegistry DB switch.
 */
import { prisma } from '../prisma';
import { logger } from '../logger';
import { CrmAlertService } from '../services/CrmAlertService';
import { PLATFORM_SCOPE } from '../lib/platform-scope';
import { emitGbpActivity } from '../lib/google/gbp-activity';
import { generateQuickStart } from '../lib/id-generator';
import { resolvePlatformGbpIdentity, checkDrift } from '../lib/google/gbp-platform';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'gbp-admin-drift';
const SCHEDULE_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const STARTUP_DELAY_MS = 10 * 60 * 1000; // 10 min after boot

export async function runGbpAdminDriftCheck(): Promise<{ checked: number; revoked: number; failed: number }> {
  const identity = await resolvePlatformGbpIdentity();
  if (!identity) {
    logger.warn('[GbpAdminDrift] platform identity unavailable — skipping pass', undefined);
    return { checked: 0, revoked: 0, failed: 0 };
  }

  const managed = await prisma.gbp_locations_list.findMany({
    where: { managed_by: 'platform', claim_state: 'active' },
    select: { id: true, tenant_id: true, location_id: true, granted_via: true },
  });

  const results = await checkDrift(identity, managed as any);
  let revoked = 0;
  let failed = 0;

  for (const r of results) {
    if (r.outcome === 'revoked') {
      revoked++;
      await prisma.gbp_locations_list.update({
        where: { id: r.gbpLocationId },
        data: { claim_state: 'revoked', updated_at: new Date() },
      });
      await emitGbpActivity({
        tenantId: r.tenantId!,
        gbpLocationId: r.gbpLocationId,
        action: 'access_revoked',
        actor: 'system',
        detail: { locationId: r.gbpLocationId },
        visibleToMerchant: false,
      });
      try {
        await CrmAlertService.getInstance().create({
          id: generateQuickStart('cra'),
          tenant_id: r.tenantId!,
          scope: PLATFORM_SCOPE,
          type: 'gbp_access_revoked',
          severity: 'critical',
          title: 'GBP platform access revoked',
          message: `Platform admin row removed from location ${r.gbpLocationId} — managed work is blocked until re-granted.`,
          dedupe_key: `gbp-revoked-${r.gbpLocationId}`,
        } as any);
      } catch (alertErr) {
        logger.warn('[GbpAdminDrift] revoke alert failed', undefined, { error: (alertErr as Error).message });
      }
    } else if (r.outcome === 'check_failed') {
      failed++;
      logger.warn('[GbpAdminDrift] drift check failed for location', undefined, {
        locationId: r.gbpLocationId,
        note: r.note,
      });
    }
  }

  logger.info('[GbpAdminDrift] sweep complete', undefined, {
    checked: results.length,
    revoked,
    failed,
  });
  return { checked: results.length, revoked, failed };
}

export function initializeGbpAdminDriftJob(): void {
  if (process.env.DISABLE_GBP_ADMIN_DRIFT === '1' || process.env.DISABLE_GBP_ADMIN_DRIFT === 'true') {
    logger.info('[GbpAdminDrift] disabled via DISABLE_GBP_ADMIN_DRIFT');
    return;
  }

  scheduleJob(JOB_NAME, runGbpAdminDriftCheck, {
    intervalMs: SCHEDULE_INTERVAL_MS,
    startDelayMs: STARTUP_DELAY_MS,
    maxRunMs: 10 * 60 * 1000,
  });
}

export function stopGbpAdminDriftJob(): void {
  stopJob(JOB_NAME);
}
