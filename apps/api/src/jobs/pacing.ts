/**
 * Drip pacing for per-tenant sweep jobs.
 *
 * The badge/analytics sync jobs loop every active tenant per run. Previously
 * they used a fixed ~300–500 ms delay, so each run was a minutes-long burst
 * of DB reads — multiplied by every API replica (the run-row lease makes the
 * multiplication single-runner now, but one replica still bursts).
 *
 * dripPaceMs spreads the sweep evenly across `fill` of the job's interval so
 * the same total work arrives as a low-rate stream instead of a spike. The
 * unused tail of the interval is idle time between cycles.
 */

export interface DripPaceOptions {
  /** Fraction of the interval the sweep should occupy (default 0.7 — leaves
   *  ~30% idle before the next tick). */
  fill?: number;
  /** Floor per-item delay (default 1s). */
  minMs?: number;
  /** Cap per-item delay (default 2 min — small tenant counts finish early
   *  rather than stretching absurdly). */
  maxMs?: number;
}

export function dripPaceMs(itemCount: number, intervalMs: number, opts: DripPaceOptions = {}): number {
  const { fill = 0.7, minMs = 1_000, maxMs = 120_000 } = opts;
  if (itemCount <= 0) return minMs;
  return Math.min(maxMs, Math.max(minMs, Math.floor((intervalMs * fill) / itemCount)));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
