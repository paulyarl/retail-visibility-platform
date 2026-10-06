/**
 * Proving Ground Hold-Release Job
 *
 * Runs hourly to release proving-ground prospects parked in `hold` whose
 * `next_touch_at` has passed back into the `queued` worklist. The cadence
 * spec §4.6 mandates `hold ──due date──▶ queued` (re-enter cadence); without
 * this sweep the +60d nurture re-entry only happens if an operator manually
 * logs a touch on the row.
 *
 * Wired into server startup in index.ts (following the existing job pattern).
 * Can be disabled via DISABLE_PROVING_GROUND_HOLD_RELEASE_JOB env var.
 */

import { logger } from '../logger';
import ProvingGroundCadenceService from '../services/ProvingGroundCadenceService';
import { unifiedConfig } from '../config/unifiedConfig';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'proving-ground-hold-release';
const STARTUP_DELAY_MS = 3 * 60 * 1000; // 3 minutes

let configuredIntervalMs = 60 * 60 * 1000;
let firstRun = true;

async function runProvingGroundHoldRelease(): Promise<void> {
  logger.info('[ProvingGroundHoldRelease] Starting due-hold release sweep...');

  try {
    const released = await ProvingGroundCadenceService.releaseDueHolds({ region: 'us-east-1' });
    logger.info(`[ProvingGroundHoldRelease] Completed: ${released.length} hold(s) released to queued`, undefined, { released: released.length });
  } catch (error) {
    logger.error('[ProvingGroundHoldRelease] Failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
        stack: (error as Error)?.stack,
      },
    });
  }
}

export async function startProvingGroundHoldRelease(): Promise<void> {
  const intervalHours = unifiedConfig.provingGroundHoldReleaseIntervalHours;
  configuredIntervalMs = intervalHours * 60 * 60 * 1000;
  logger.info(`[ProvingGroundHoldRelease] Starting scheduler (every ${intervalHours}h)`);

  scheduleJob({
    name: JOB_NAME,
    description: 'Re-enters hold prospects into the queued worklist',
    scheduleLabel: `every ${intervalHours} hour(s)`,
    envDisableVar: 'DISABLE_PROVING_GROUND_HOLD_RELEASE_JOB',
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : configuredIntervalMs),
    handler: async () => runProvingGroundHoldRelease(),
  });
}

export function stopProvingGroundHoldRelease(): void {
  stopJob(JOB_NAME);
}
