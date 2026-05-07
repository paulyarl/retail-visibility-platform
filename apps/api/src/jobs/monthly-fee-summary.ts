/**
 * Monthly Fee Summary Job
 * 
 * Scheduled job that runs on the 1st of each month to send
 * fee summary emails to all merchants with Stripe Connect.
 * 
 * Run schedule: 1st of each month at 00:05 UTC
 */

import { getPlatformFeeSummaryEmailService } from '../services/email/PlatformFeeSummaryEmailService';

export interface MonthlyFeeSummaryResult {
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * Send monthly fee summaries to all merchants
 */
export async function sendMonthlyFeeSummaries(): Promise<MonthlyFeeSummaryResult> {
  console.log('[MonthlyFeeSummaryJob] Starting monthly fee summary send...');
  
  const service = getPlatformFeeSummaryEmailService();
  const result = await service.sendAllMonthlySummaries();
  
  console.log(`[MonthlyFeeSummaryJob] Complete. Sent: ${result.sent}, Failed: ${result.failed}`);
  
  return result;
}

/**
 * Start the scheduled job
 * Runs on the 1st of each month at 00:05 UTC
 */
let jobInterval: NodeJS.Timeout | null = null;

export function startMonthlyFeeSummaryJob(): void {
  if (jobInterval) {
    console.log('[MonthlyFeeSummaryJob] Job already running');
    return;
  }

  // Calculate time until next run (1st of next month at 00:05 UTC)
  const getNextRunTime = (): number => {
    const now = new Date();
    const next = new Date();
    
    // Set to 1st of next month at 00:05 UTC
    if (now.getUTCDate() === 1 && now.getUTCHours() < 1) {
      // Today is the 1st and before 1am, run today at 00:05
      next.setUTCHours(0, 5, 0, 0);
    } else {
      // Run on the 1st of next month
      next.setUTCMonth(next.getUTCMonth() + 1, 1);
      next.setUTCHours(0, 5, 0, 0);
    }
    
    return next.getTime() - now.getTime();
  };

  const scheduleNext = () => {
    const delay = getNextRunTime();
    
    console.log(`[MonthlyFeeSummaryJob] Next run in ${Math.round(delay / 1000 / 60 / 60)} hours`);
    
    jobInterval = setTimeout(async () => {
      try {
        await sendMonthlyFeeSummaries();
      } catch (error) {
        console.error('[MonthlyFeeSummaryJob] Error:', error);
      }
      
      // Schedule next run
      scheduleNext();
    }, delay);
  };

  scheduleNext();
  console.log('[MonthlyFeeSummaryJob] Started');
}

/**
 * Stop the scheduled job
 */
export function stopMonthlyFeeSummaryJob(): void {
  if (jobInterval) {
    clearTimeout(jobInterval);
    jobInterval = null;
    console.log('[MonthlyFeeSummaryJob] Stopped');
  }
}

/**
 * Manual trigger for testing
 */
export async function triggerMonthlyFeeSummary(): Promise<MonthlyFeeSummaryResult> {
  console.log('[MonthlyFeeSummaryJob] Manual trigger');
  return sendMonthlyFeeSummaries();
}
