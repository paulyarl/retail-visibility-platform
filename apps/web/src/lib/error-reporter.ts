/**
 * Error reporter — batched client-side error reporting to the backend.
 *
 * Queues errors and flushes them via POST /api/client-errors every 5 seconds
 * or when 10 errors accumulate. Uses navigator.sendBeacon for reliability
 * during page unload.
 *
 * Rate limited: max 10 errors/minute/client (excess dropped, logged to console).
 * Deduplicated: skips if same message+stack hash sent in last 60s.
 */

import { getOrCreateCorrelationId, getCorrelationId } from './correlation-id';

interface ClientErrorReport {
  message: string;
  stack_trace?: string;
  error_name?: string;
  tenant_id?: string;
  user_id?: string;
  correlation_id?: string;
  url: string;
  user_agent: string;
  timestamp: string;
  context?: Record<string, any>;
}

const API_ENDPOINT = '/api/client-errors';
const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE_SIZE = 10;
const MAX_ERRORS_PER_MINUTE = 10;
const DEDUP_WINDOW_MS = 60_000;

let queue: ClientErrorReport[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let errorTimestamps: number[] = [];
let dedupMap = new Map<string, number>();

let currentTenantId: string | undefined;
let currentUserId: string | undefined;

export function setReporterTenantId(tenantId: string | undefined): void {
  currentTenantId = tenantId;
}

export function setReporterUserId(userId: string | undefined): void {
  currentUserId = userId;
}

function hashError(message: string, stack?: string): string {
  const input = `${message}::${stack || ''}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}

function isRateLimited(): boolean {
  const now = Date.now();
  errorTimestamps = errorTimestamps.filter((ts) => now - ts < 60_000);
  if (errorTimestamps.length >= MAX_ERRORS_PER_MINUTE) return true;
  errorTimestamps.push(now);
  return false;
}

function isDuplicated(message: string, stack?: string): boolean {
  const hash = hashError(message, stack);
  const now = Date.now();
  const lastSent = dedupMap.get(hash);
  if (lastSent && now - lastSent < DEDUP_WINDOW_MS) return true;
  dedupMap.get(hash);
  dedupMap.set(hash, now);
  // Clean old dedup entries
  for (const [key, ts] of dedupMap.entries()) {
    if (now - ts > DEDUP_WINDOW_MS) dedupMap.delete(key);
  }
  return false;
}

function buildReport(
  error: Error | string,
  context?: Record<string, any>
): ClientErrorReport {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    message: err.message,
    stack_trace: err.stack,
    error_name: err.name,
    tenant_id: currentTenantId,
    user_id: currentUserId,
    correlation_id: getCorrelationId() || getOrCreateCorrelationId(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timestamp: new Date().toISOString(),
    context,
  };
}

function startFlushTimer(): void {
  if (flushTimer || typeof window === 'undefined') return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
}

async function flush(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);

  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const url = `${apiBaseUrl}${API_ENDPOINT}`;

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ errors: batch })], {
        type: 'application/json',
      });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errors: batch }),
      keepalive: true,
    });
  } catch {
    // Re-queue on failure (best-effort, don't infinite-loop)
    queue.unshift(...batch.slice(0, MAX_QUEUE_SIZE - queue.length));
  }
}

/**
 * Report an error to the backend. Fire-and-forget — never throws.
 */
export function reportError(
  error: Error | string,
  context?: Record<string, any>
): void {
  if (typeof window === 'undefined') return;

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  if (isRateLimited()) return;
  if (isDuplicated(message, stack)) return;

  queue.push(buildReport(error, context));

  if (queue.length >= MAX_QUEUE_SIZE) {
    flush();
  } else {
    startFlushTimer();
  }
}

/**
 * Flush immediately (e.g., on page unload).
 */
export function flushErrors(): void {
  flush();
}
