'use client';

import { useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { flushErrors } from '@/lib/error-reporter';

/**
 * GlobalErrorHandler — mounts window-level error listeners.
 *
 * Captures:
 * - window.onerror — uncaught errors
 * - window.unhandledrejection — unhandled promise rejections
 *
 * Both are routed through clientLogger (Sentry + console + backend persistence).
 * Also flushes pending error reports on page unload via beforeunload.
 */
export default function GlobalErrorHandler() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const error = event.error || new Error(event.message || 'Unknown error');
      clientLogger.error(`Uncaught: ${error.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const error = reason instanceof Error ? reason : new Error(String(reason));
      clientLogger.error(`Unhandled rejection: ${error.message}`, {
        reason: String(reason),
      });
    };

    const handleBeforeUnload = () => {
      flushErrors();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return null;
}
