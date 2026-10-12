/**
 * Custom Domain Sweeper (sprint plan B4/2.3)
 *
 * Pull-only lifecycle otherwise strands verified-but-never-rechecked domains
 * forever — a tenant who configures DNS and walks away without clicking
 * "Check status" would sit in pending_verification indefinitely. The sweeper
 * re-runs the same checkDomain path (Vercel verify → misconfigured → HTTPS
 * probe → active) on a cadence for every non-terminal row.
 *
 * Runs unconditionally — a platform-flag-off tenant can still be mid-
 * verification and deserves to finish; the flag gates the write path,
 * not the lifecycle of rows that already exist.
 *
 * Schedule: every 15 minutes.
 */

import { customDomainService } from '../services/CustomDomainService';
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'custom-domain-sweeper';
const SWEEP_LIMIT = 50;
const INTERVAL_MS = 15 * 60 * 1000;

export interface CustomDomainSweepResult {
  checked: number;
  activated: number;
  verified: number;
  errors: number;
}

export async function processCustomDomainSweep(): Promise<CustomDomainSweepResult> {
  const result: CustomDomainSweepResult = { checked: 0, activated: 0, verified: 0, errors: 0 };

  let rows;
  try {
    rows = await customDomainService.listSweepable(SWEEP_LIMIT);
  } catch (error: any) {
    logger.error('[CustomDomainSweeper] failed to list sweepable domains', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    return { ...result, errors: 1 };
  }

  for (const row of rows) {
    result.checked++;
    try {
      const check = await customDomainService.checkDomain(row.tenant_id, row.id);
      if (check.ok && check.transitionedTo === 'active') result.activated++;
      else if (check.ok && check.transitionedTo === 'verified') result.verified++;
      else if (!check.ok) result.errors++;
    } catch (error: any) {
      result.errors++;
      logger.error(`[CustomDomainSweeper] check failed for ${row.domain}`, undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error) },
        tenantId: row.tenant_id, domain: row.domain,
      });
    }
  }

  if (result.checked > 0) {
    logger.info(
      `[CustomDomainSweeper] swept ${result.checked}: ${result.activated} active, ${result.verified} verified, ${result.errors} errors`,
    );
  }
  return result;
}

export function startCustomDomainSweeperJob(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Re-checks pending/verified custom domains and promotes to active',
    scheduleLabel: 'every 15 minutes',
    computeNextDelay: () => INTERVAL_MS,
    handler: async () => processCustomDomainSweep(),
  });
}

export function stopCustomDomainSweeperJob(): void {
  stopJob(JOB_NAME);
}
