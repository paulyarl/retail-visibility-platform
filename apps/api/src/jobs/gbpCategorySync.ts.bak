import { setTimeout as wait } from 'timers/promises';
import { randomUUID } from 'crypto';
import { categoryMirrorSuccess, categoryMirrorFail, categoryMirrorDurationMs, categoryOutOfSyncDetected } from '../metrics';
import { prisma } from '../prisma';
import { gbpClient } from '../clients/gbp';
import { generateCategoryMirrorId } from '../lib/id-generator';

export type MirrorStrategy = 'platform_to_gbp' | 'gbp_to_platform';

export interface MirrorJobPayload {
  strategy: MirrorStrategy;
  tenant_id: string | null;
  requested_by: string | null;
  dry_run: boolean;
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
  const key = `${payload.strategy}:${payload.tenant_id ?? 'all'}`;
  // Create run record (pending)
  let runId: string | null = null;
  try {
    const run = await prisma.category_mirror_runs.create({
      data: {
        id: generateCategoryMirrorId("pending",payload.tenant_id??'all'),
        tenant_id: payload.tenant_id ?? null,
        strategy: payload.strategy,
        dry_run: !!(payload as any).dry_run,
        job_id: jobId,
        started_at: new Date(startedAt),
      },
      select: { id: true },
    });
    runId = run.id;
  } catch {}
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const dryRun = !!(payload as any).dryRun;
      // Cooldown guard
      const last = lastRunAt[key] || 0;
      if (Date.now() - last < COOLDOWN_MS) {
        console.log(`[GBP_SYNC][${jobId}] skipped due to cooldown for ${key}`);
        const summary = { created: 0, updated: 0, deleted: 0, skipped: true, reason: 'cooldown', dryRun } as const;
        try {
          await prisma.category_mirror_runs.create({
            data: {
              //id: randomUUID(),
              id: generateCategoryMirrorId("cooldown",payload.tenant_id ?? 'all'),
              tenant_id: payload.tenant_id ?? null,
              strategy: payload.strategy,
              dry_run: dryRun,
              created: 0,
              updated: 0,
              deleted: 0,
              skipped: true,
              reason: 'cooldown',
              job_id: jobId,
              started_at: new Date(startedAt),
              completed_at: new Date(),
            },
          });
        } catch {}
        categoryMirrorSuccess.inc({ strategy: payload.strategy, tenant: String(payload.tenant_id ?? 'all'), dryRun: String(dryRun), reason: 'cooldown' });
        categoryMirrorDurationMs.observe(Date.now() - startedAt, { strategy: payload.strategy, tenant: String(payload.tenant_id ?? 'all') });
        return summary;
      }

      console.log(`[GBP_SYNC][${jobId}] attempt ${attempt} strategy=${payload.strategy} tenant=${payload.tenant_id ?? 'all'} dryRun=${dryRun}`);
      // Fetch and diff
      const platformCats = await fetchPlatformCategories(payload.tenant_id ?? null);
      const gbpCats = await fetchGbpCategories(payload.tenant_id ?? null);
      const diff = computeDiff(platformCats, gbpCats);

      // Detect out-of-sync state
      const isOutOfSync = diff.counts.created > 0 || diff.counts.updated > 0 || diff.counts.deleted > 0;
      if (isOutOfSync) {
        categoryOutOfSyncDetected.inc({
          tenant: String(payload.tenant_id ?? 'all'),
          created: String(diff.counts.created),
          updated: String(diff.counts.updated),
          deleted: String(diff.counts.deleted),
        });
        console.log(`[GBP_SYNC][${jobId}] OUT-OF-SYNC detected: +${diff.counts.created} ~${diff.counts.updated} -${diff.counts.deleted}`);
      }

      if (!dryRun) {
        await applyDiffToGbp(diff, payload.tenant_id ?? null);
      }

      const summary = { ...diff.counts, dryRun };
      lastRunAt[key] = Date.now();
      categoryMirrorSuccess.inc({ strategy: payload.strategy, tenant: String(payload.tenant_id ?? 'all'), dryRun: String(dryRun) });
      categoryMirrorDurationMs.observe(Date.now() - startedAt, { strategy: payload.strategy, tenant: String(payload.tenant_id ?? 'all') });
      // Update run row
      try {
        if (runId) {
          await prisma.category_mirror_runs.update({
            where: { id: runId },
            data: {
              created: diff.counts.created,
              updated: diff.counts.updated,
              deleted: diff.counts.deleted,
              skipped: false,
              reason: null,
              completed_at: new Date(),
            },
          });
        } else {
          await prisma.category_mirror_runs.create({
            data: {              
              id: generateCategoryMirrorId("update",payload.tenant_id ?? 'all'),
              tenant_id: payload.tenant_id ?? null,
              strategy: payload.strategy,
              dry_run: dryRun,
              created: diff.counts.created,
              updated: diff.counts.updated,
              deleted: diff.counts.deleted,
              skipped: false,
              job_id: jobId,
              started_at: new Date(startedAt),
              completed_at: new Date(),
            },
          });
        }
      } catch {}
      console.log(`[GBP_SYNC][${jobId}] completed summary=${JSON.stringify(summary)}`);
      return summary;
    } catch (e) {
      const jitter = Math.floor(Math.random() * 250);
      console.warn(`[GBP_SYNC][${jobId}] error on attempt ${attempt}:`, e);
      await wait(backoffMs + jitter);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    }
  }

  categoryMirrorFail.inc({ strategy: payload.strategy, tenant: String(payload.tenant_id ?? 'all') });
  categoryMirrorDurationMs.observe(Date.now() - startedAt, { strategy: payload.strategy, tenant: String(payload.tenant_id ?? 'all') });
  console.error(`[GBP_SYNC][${jobId}] failed after ${maxAttempts} attempts`);
  // Record failure
  try {
    if (runId) {
      await prisma.category_mirror_runs.update({ where: { id: runId }, data: { error: 'failed', completed_at: new Date() } });
    } else {
      await prisma.category_mirror_runs.create({
        data: {
          id: generateCategoryMirrorId("failed",payload.tenant_id ?? 'all'),
          tenant_id: payload.tenant_id ?? null,
          strategy: payload.strategy,
          dry_run: !!(payload as any).dry_run,
          created: 0,
          updated: 0,
          deleted: 0,
          skipped: false,
          reason: null,
          error: 'failed',
          job_id: jobId,
          started_at: new Date(startedAt),
          completed_at: new Date(),
        },
      });
    }
  } catch {}
}

// Types and helper functions
type Cat = { id?: string | null; slug?: string | null; name: string };

async function fetchPlatformCategories(tenantId: string | null): Promise<Cat[]> {
  if (!tenantId) return [];
  try {
    const rows = await prisma.directory_category.findMany({
      where: { tenantId: tenantId, isActive: true },
      select: { slug: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(r => ({ slug: r.slug || null, name: r.name }));
  } catch {
    return [];
  }
}

async function fetchGbpCategories(tenantId: string | null): Promise<Cat[]> {
  const rows = await gbpClient.listCategories(tenantId);
  return rows.map(r => ({ id: r.id ?? null, slug: r.slug ?? null, name: r.name }));
}

function computeDiff(source: Cat[], target: Cat[]) {
  const bySlug = (arr: Cat[]) => new Map(arr.map(c => [String(c.slug ?? c.name).toLowerCase(), c]));
  const s = bySlug(source);
  const t = bySlug(target);
  const toCreate: Cat[] = [];
  const toUpdate: { from: Cat; to: Cat }[] = [];
  const toDelete: Cat[] = [];

  const sKeys = Array.from(s.keys());
  const tKeys = Array.from(t.keys());
  
  for (const slug of sKeys) {
    const sc = s.get(slug)!;
    const tc = t.get(slug);
    if (!tc) {
      toCreate.push(sc);
    } else if ((sc.name || '').trim() !== (tc.name || '').trim()) {
      toUpdate.push({ from: tc, to: sc });
    }
  }
  for (const slug of tKeys) {
    const tc = t.get(slug)!;
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
  for (const c of diff.toCreate) {
    await gbpClient.createCategory(tenantId, { slug: c.slug ?? null, name: c.name });
  }
  for (const u of diff.toUpdate) {
    await gbpClient.updateCategory(tenantId, { id: u.from.id ?? null, slug: u.from.slug ?? null, name: u.from.name }, { slug: u.to.slug ?? null, name: u.to.name });
  }
  for (const d of diff.toDelete) {
    await gbpClient.deleteCategory(tenantId, { id: d.id ?? null, slug: d.slug ?? null, name: d.name });
  }
}
