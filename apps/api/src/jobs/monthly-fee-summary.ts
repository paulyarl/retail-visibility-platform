/**
 * Monthly Fee Summary Job
 *
 * Scheduled job that runs on the 1st of each month to send
 * fee summary emails to all merchants with Stripe Connect.
 *
 * Run schedule: 1st of each month at 00:05 UTC
 *
 * Scheduling/execution is owned by the JobRegistry (./registry.ts) — runs are
 * recorded in scheduled_job_runs and the job can be killed from the admin
 * Scheduled Jobs UI. The period guard below additionally prevents a second
 * send for the same month within one process.
 */

import { getPlatformFeeSummaryEmailService } from '../services/email/PlatformFeeSummaryEmailService';
import { scheduleJob, stopJob, runJobNow } from './registry';

export interface MonthlyFeeSummaryResult {
  sent: number;
  failed: number;
  errors: string[];
}

const JOB_NAME = 'monthly-fee-summary';

let lastRunPeriod: string | null = null;

function getSummaryPeriodKey(): string {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${periodStart.getUTCFullYear()}-${periodStart.getUTCMonth()}`;
}

/**
 * Send monthly fee summaries to all merchants
 */
export async function sendMonthlyFeeSummaries(): Promise<MonthlyFeeSummaryResult> {
  const periodKey = getSummaryPeriodKey();
  if (lastRunPeriod === periodKey) {
    console.log(`[MonthlyFeeSummaryJob] Skipping — summaries for period ${periodKey} already sent by this process`);
    return { sent: 0, failed: 0, errors: [] };
  }
  lastRunPeriod = periodKey;

  console.log('[MonthlyFeeSummaryJob] Starting monthly fee summary send...');

  const service = getPlatformFeeSummaryEmailService();
  const result = await service.sendAllMonthlySummaries();

  console.log(`[MonthlyFeeSummaryJob] Complete. Sent: ${result.sent}, Failed: ${result.failed}`);

  return result;
}

/**
 * ms until the next 1st-of-month 00:05 UTC — always a future delay.
 */
function nextFirstOfMonthDelay(): number {
  const now = new Date();
  let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 5, 0, 0));

  if (next.getTime() <= now.getTime()) {
    next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 5, 0, 0));
  }

  return next.getTime() - now.getTime();
}

/**
 * Start the scheduled job
 * Runs on the 1st of each month at 00:05 UTC
 */
export function startMonthlyFeeSummaryJob(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Sends Stripe Connect fee summaries to all onboarded merchants',
    scheduleLabel: '1st of each month at 00:05 UTC',
    envDisableVar: 'DISABLE_MONTHLY_FEE_SUMMARY_JOB',
    computeNextDelay: nextFirstOfMonthDelay,
    handler: async () => sendMonthlyFeeSummaries(),
  });
}

/**
 * Stop the scheduled job
 */
export function stopMonthlyFeeSummaryJob(): void {
  stopJob(JOB_NAME);
  console.log('[MonthlyFeeSummaryJob] Stopped');
}

/**
 * Manual trigger for testing
 */
export async function triggerMonthlyFeeSummary(): Promise<MonthlyFeeSummaryResult> {
  console.log('[MonthlyFeeSummaryJob] Manual trigger');
  const { result, skipped } = await runJobNow(JOB_NAME, 'manual');
  if (skipped) return { sent: 0, failed: 0, errors: [skipped] };
  return (result as MonthlyFeeSummaryResult) ?? { sent: 0, failed: 0, errors: [] };
}
