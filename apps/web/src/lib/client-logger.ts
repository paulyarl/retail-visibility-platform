/**
 * Client-side structured logger.
 *
 * Wraps Sentry and console with correlation ID support.
 * Error-level logs are also queued for backend persistence via error-reporter.
 *
 * Usage:
 *   import { clientLogger } from '@/lib/client-logger';
 *   clientLogger.error('Payment failed', { orderId: '123' });
 *   clientLogger.warn('Rate limit approaching');
 *   clientLogger.info('User logged in');
 *   clientLogger.debug('Cache hit', { key: 'product-123' });
 */

import * as Sentry from '@sentry/nextjs';
import { getCorrelationId } from './correlation-id';
import { reportError, setReporterTenantId, setReporterUserId } from './error-reporter';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const DEV = process.env.NODE_ENV === 'development';
const MIN_LEVEL: LogLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || 'info';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[MIN_LEVEL];
}

let currentTenantId: string | undefined;
let currentUserId: string | undefined;

class ClientLogger {
  /**
   * Set tenant context for Sentry tags and error reports.
   */
  setTenantId(tenantId: string | undefined): void {
    currentTenantId = tenantId;
    setReporterTenantId(tenantId);
    if (tenantId) {
      Sentry.getCurrentScope().setTag('tenant_id', tenantId);
    }
  }

  /**
   * Set user context for Sentry tags and error reports.
   */
  setUserId(userId: string | undefined): void {
    currentUserId = userId;
    setReporterUserId(userId);
    if (userId) {
      Sentry.getCurrentScope().setUser({ id: userId });
    }
  }

  /**
   * Log an error. Sends to Sentry, console.error, and backend persistence.
   */
  error(message: string, context?: Record<string, any>): void {
    if (!shouldLog('error')) return;

    const correlationId = getCorrelationId();

    Sentry.captureException(new Error(message), {
      tags: {
        ...(correlationId && { correlation_id: correlationId }),
        ...(currentTenantId && { tenant_id: currentTenantId }),
      },
      contexts: context ? { custom: context } : undefined,
    });

    if (DEV) {
      console.error(`[ERROR] ${message}`, context || '');
    } else {
      console.error(JSON.stringify({
        level: 'error',
        message,
        correlation_id: correlationId,
        tenant_id: currentTenantId,
        user_id: currentUserId,
        context,
        timestamp: new Date().toISOString(),
      }));
    }

    reportError(message, context);
  }

  /**
   * Log a warning. Sends to Sentry as a warning message, console.warn.
   */
  warn(message: string, context?: Record<string, any>): void {
    if (!shouldLog('warn')) return;

    const correlationId = getCorrelationId();

    Sentry.captureMessage(message, 'warning');

    if (DEV) {
      console.warn(`[WARN] ${message}`, context || '');
    } else {
      console.warn(JSON.stringify({
        level: 'warn',
        message,
        correlation_id: correlationId,
        context,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  /**
   * Log an info message. Console only (dev), no Sentry, no backend.
   */
  info(message: string, context?: Record<string, any>): void {
    if (!shouldLog('info')) return;

    if (DEV) {
      console.info(`[INFO] ${message}`, context || '');
    }
  }

  /**
   * Log a debug message. Console only (dev), no Sentry, no backend.
   */
  debug(message: string, context?: Record<string, any>): void {
    if (!shouldLog('debug')) return;

    if (DEV) {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  }
}

export const clientLogger = new ClientLogger();
