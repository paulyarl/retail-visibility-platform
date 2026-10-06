/**
 * Log Purge Job
 *
 * Scheduled job that runs daily at 2 AM (off-peak) to:
 * 1. Delete resolved application_error_log entries older than 90 days
 * 2. Delete unresolved application_error_log entries older than 180 days
 * 3. Delete file logs in LOG_DIR older than LOG_RETENTION_DAYS (default 30)
 *
 * Run schedule: Daily at 2:00 AM UTC
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';

export interface LogPurgeResult {
  dbRowsDeleted: number;
  filesDeleted: number;
  errors: string[];
}

const DB_RETENTION_DAYS_RESOLVED = 90;
const DB_RETENTION_DAYS_UNRESOLVED = 180;
const FILE_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || '30', 10);

/**
 * Purge old error log entries from the database
 */
async function purgeDatabaseLogs(): Promise<number> {
  const resolvedCutoff = new Date(Date.now() - DB_RETENTION_DAYS_RESOLVED * 24 * 60 * 60 * 1000);
  const unresolvedCutoff = new Date(Date.now() - DB_RETENTION_DAYS_UNRESOLVED * 24 * 60 * 60 * 1000);

  // Delete resolved errors older than 90 days
  const resolvedDeleted = await prisma.application_error_log.deleteMany({
    where: {
      resolved: true,
      occurred_at: { lt: resolvedCutoff },
    },
  });

  // Delete unresolved errors older than 180 days (safety net — don't keep forever)
  const unresolvedDeleted = await prisma.application_error_log.deleteMany({
    where: {
      resolved: false,
      occurred_at: { lt: unresolvedCutoff },
    },
  });

  const total = resolvedDeleted.count + unresolvedDeleted.count;
  logger.info(`[LogPurgeJob] DB purge: ${resolvedDeleted.count} resolved (>${DB_RETENTION_DAYS_RESOLVED}d), ${unresolvedDeleted.count} unresolved (>${DB_RETENTION_DAYS_UNRESOLVED}d)`);
  return total;
}

/**
 * Purge old file logs from LOG_DIR
 */
function purgeFileLogs(): number {
  const logDir = process.env.LOG_DIR || './logs';
  if (!fs.existsSync(logDir)) return 0;

  const cutoff = Date.now() - FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  try {
    const files = fs.readdirSync(logDir);
    for (const file of files) {
      if (!file.endsWith('.log') && !file.endsWith('.bak')) continue;

      const filePath = path.join(logDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      } catch {
        // best-effort — skip files we can't stat/delete
      }
    }
  } catch {
    // best-effort — skip dirs we can't read
  }

  logger.info(`[LogPurgeJob] File purge: ${deleted} files older than ${FILE_RETENTION_DAYS}d from ${logDir}`);
  return deleted;
}

/**
 * Run the purge job
 */
export async function runLogPurge(): Promise<LogPurgeResult> {
  const result: LogPurgeResult = { dbRowsDeleted: 0, filesDeleted: 0, errors: [] };

  try {
    result.dbRowsDeleted = await purgeDatabaseLogs();
  } catch (error: any) {
    logger.error('[LogPurgeJob] DB purge failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    result.errors.push(`DB purge: ${error.message}`);
  }

  try {
    result.filesDeleted = purgeFileLogs();
  } catch (error: any) {
    logger.error('[LogPurgeJob] File purge failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    result.errors.push(`File purge: ${error.message}`);
  }

  logger.info(`[LogPurgeJob] Complete. DB rows: ${result.dbRowsDeleted}, Files: ${result.filesDeleted}, Errors: ${result.errors.length}`);
  return result;
}

/**
 * Start the scheduled job — runs daily at 2 AM UTC
 */
const JOB_NAME = 'log-purge';

/** ms until the next 2:00 AM UTC — always a future delay. */
function nextDailyRunDelay(): number {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(2, 0, 0, 0);
  return next.getTime() - Date.now();
}

export function startLogPurgeJob(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Purges old application logs (DB + file)',
    scheduleLabel: 'daily at 2 AM UTC',
    computeNextDelay: nextDailyRunDelay,
    handler: async () => runLogPurge(),
  });
}

/**
 * Stop the scheduled job
 */
export function stopLogPurgeJob(): void {
  stopJob(JOB_NAME);
}
