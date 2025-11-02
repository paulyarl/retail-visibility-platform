import { setTimeout as wait } from 'timers/promises';
import { categoryMirrorSuccess, categoryMirrorFail, categoryMirrorDurationMs } from '../metrics';

export type MirrorStrategy = 'platform_to_gbp' | 'gbp_to_platform';

export interface MirrorJobPayload {
  strategy: MirrorStrategy;
  tenantId?: string | null;
  requestedBy?: string | null;
  dryRun?: boolean;
}

// Very simple in-memory queue placeholder so we have a call site to evolve later.
// In production we should use a durable queue (e.g., PG-based table, Redis, or provider).
const queue: MirrorJobPayload[] = [];
const lastRunAt: Record<string, number> = {};
const COOLDOWN_MS = 60_000; // 1 minute basic cooldown per key

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
  const startedAt = Date.now();
  const key = `${payload.strategy}:${payload.tenantId ?? 'all'}`;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const dryRun = !!payload.dryRun;
      // Cooldown guard (best-effort, in-memory only)
      const last = lastRunAt[key] || 0;
      if (Date.now() - last < COOLDOWN_MS) {
        console.log(`[GBP_SYNC][${jobId}] skipped due to cooldown for ${key}`);
        const summary = { created: 0, updated: 0, deleted: 0, skipped: true, reason: 'cooldown', dryRun } as const;
        categoryMirrorSuccess.inc({ strategy: payload.strategy, tenant: String(payload.tenantId ?? 'all'), dryRun: String(dryRun), reason: 'cooldown' });
        categoryMirrorDurationMs.observe(Date.now() - startedAt, { strategy: payload.strategy, tenant: String(payload.tenantId ?? 'all') });
        return summary;
      }

      console.log(`[GBP_SYNC][${jobId}] attempt ${attempt} strategy=${payload.strategy} tenant=${payload.tenantId ?? 'all'} dryRun=${dryRun}`);
      // Placeholder fetchers
      const platformCats = await fetchPlatformCategories(payload.tenantId ?? null);
      const gbpCats = await fetchGbpCategories(payload.tenantId ?? null);
      const diff = computeDiff(platformCats, gbpCats);

      if (!dryRun) {
        await applyDiffToGbp(diff, payload.tenantId ?? null);
      }

      const summary = { ...diff.counts, dryRun };
      lastRunAt[key] = Date.now();
      categoryMirrorSuccess.inc({ strategy: payload.strategy, tenant: String(payload.tenantId ?? 'all'), dryRun: String(dryRun) });
      categoryMirrorDurationMs.observe(Date.now() - startedAt, { strategy: payload.strategy, tenant: String(payload.tenantId ?? 'all') });
      console.log(`[GBP_SYNC][${jobId}] completed summary=${JSON.stringify(summary)}`);
      return summary;
    } catch (e) {
      const jitter = Math.floor(Math.random() * 250);
      console.warn(`[GBP_SYNC][${jobId}] error on attempt ${attempt}:`, e);
      await wait(backoffMs + jitter);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    }
  }

  categoryMirrorFail.inc({ strategy: payload.strategy, tenant: String(payload.tenantId ?? 'all') });
  categoryMirrorDurationMs.observe(Date.now() - startedAt, { strategy: payload.strategy, tenant: String(payload.tenantId ?? 'all') });
  console.error(`[GBP_SYNC][${jobId}] failed after ${maxAttempts} attempts`);
}

// Types and placeholder helpers
type Cat = { id?: string | null; slug?: string | null; name: string };

async function fetchPlatformCategories(tenantId: string | null): Promise<Cat[]> {
  // TODO: Replace with real Prisma queries (platform-level categories by tenant context if needed)
  await wait(50);
  return [];
}

async function fetchGbpCategories(tenantId: string | null): Promise<Cat[]> {
  // TODO: Replace with real GBP fetch via Google API client
  await wait(50);
  return [];
}

function computeDiff(source: Cat[], target: Cat[]) {
  const bySlug = (arr: Cat[]) => new Map(arr.map(c => [String(c.slug ?? c.name).toLowerCase(), c]));
  const s = bySlug(source);
  const t = bySlug(target);
  const toCreate: Cat[] = [];
  const toUpdate: { from: Cat; to: Cat }[] = [];
  const toDelete: Cat[] = [];

  for (const [slug, sc] of s) {
    const tc = t.get(slug);
    if (!tc) {
      toCreate.push(sc);
    } else if ((sc.name || '').trim() !== (tc.name || '').trim()) {
      toUpdate.push({ from: tc, to: sc });
    }
  }
  for (const [slug, tc] of t) {
    if (!s.has(slug)) toDelete.push(tc);
  }

  return {
    toCreate,
    toUpdate,
    toDelete,
    counts: { created: toCreate.length, updated: toUpdate.length, deleted: toDelete.length },
  };
}

async function applyDiffToGbp(diff: ReturnType<typeof computeDiff>, tenantId: string | null) {
  // TODO: Implement create/update/delete against GBP; ensure rate limits and backoff
  // For now, simulate work based on counts
  const ops = diff.counts.created + diff.counts.updated + diff.counts.deleted;
  await wait(Math.min(500 + ops * 50, 5000));
}
