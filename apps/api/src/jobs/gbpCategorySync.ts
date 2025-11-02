import { setTimeout as wait } from 'timers/promises';

export type MirrorStrategy = 'platform_to_gbp' | 'gbp_to_platform';

export interface MirrorJobPayload {
  strategy: MirrorStrategy;
  tenantId?: string | null;
  requestedBy?: string | null;
}

// Very simple in-memory queue placeholder so we have a call site to evolve later.
// In production we should use a durable queue (e.g., PG-based table, Redis, or provider).
const queue: MirrorJobPayload[] = [];

export function queueGbpCategoryMirrorJob(payload: MirrorJobPayload): { jobId: string } {
  const jobId = `gbp-mirror-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  queue.push(payload);
  // Fire-and-forget run with basic retry/backoff placeholder
  runGbpCategoryMirrorJob(jobId, payload).catch(() => {});
  return { jobId };
}

export async function runGbpCategoryMirrorJob(jobId: string, payload: MirrorJobPayload) {
  const maxAttempts = 5;
  let attempt = 0;
  let backoffMs = 500; // start small, exponential backoff with jitter

  while (attempt < maxAttempts) {
    attempt++;
    try {
      console.log(`[GBP_SYNC][${jobId}] attempt ${attempt} strategy=${payload.strategy} tenant=${payload.tenantId ?? 'all'}`);
      // TODO: implement actual sync:
      // - Fetch source categories (platform or GBP)
      // - Compute diff
      // - Apply changes to target with safety checks
      // - Emit telemetry counters and audit events
      // For now, simulate work
      await wait(250);
      console.log(`[GBP_SYNC][${jobId}] completed`);
      return;
    } catch (e) {
      const jitter = Math.floor(Math.random() * 250);
      console.warn(`[GBP_SYNC][${jobId}] error on attempt ${attempt}:`, e);
      await wait(backoffMs + jitter);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    }
  }

  console.error(`[GBP_SYNC][${jobId}] failed after ${maxAttempts} attempts`);
}
