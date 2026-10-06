/**
 * JobRegistry — central scheduled-job module
 *
 * One place that knows about every background job: its schedule, enabled
 * state, last/next run, run history, and captured logs. Backs the admin
 * Scheduled Jobs UI (/settings/admin/jobs) and the /api/admin/jobs routes.
 *
 * Two levels of participation:
 *
 *   declareJob(name, meta) — catalog-only entry. Shows in the UI with its
 *     schedule but no run data until the job is migrated. Use for jobs that
 *     still self-schedule with their own setTimeout/setInterval.
 *
 *   scheduleJob(opts) — fully instrumented. The registry owns the timer,
 *     enforces the always-future-delay contract (a non-positive delay is
 *     clamped instead of firing in a loop — the bug that spammed merchants),
 *     records every run in scheduled_job_runs with captured console output,
 *     and honors the DB-backed enabled kill switch.
 *
 * All DB access is fail-safe: if the scheduled_jobs tables don't exist yet
 * on a given environment, the registry degrades to in-memory state and jobs
 * keep running — visibility is lost, execution is not.
 */

import os from 'os';
import util from 'util';
import { AsyncLocalStorage } from 'async_hooks';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { nextCronRun, isValidCron } from './cronSpec';

export type JobTrigger = 'schedule' | 'manual' | 'api';

export interface JobRunContext {
  jobName: string;
  runId: string;
  trigger: JobTrigger;
  startedAt: Date;
}

export type JobHandler = (ctx: JobRunContext) => Promise<unknown>;

export interface ScheduleJobOptions {
  name: string;
  description?: string;
  scheduleLabel: string;
  /** ms until the next run — MUST be a future delay; non-positive values are clamped */
  computeNextDelay: () => number;
  handler: JobHandler;
  /** env var that disables scheduling entirely (existing DISABLE_* convention) */
  envDisableVar?: string;
}

type ScheduleOverrideKind = 'interval' | 'cron';

interface RegisteredJob {
  name: string;
  description?: string;
  scheduleLabel?: string;
  instrumented: boolean;
  envDisabled: boolean;
  enabled: boolean;      // DB kill switch; in-memory default true
  running: boolean;
  nextRunAt: Date | null;
  timer: NodeJS.Timeout | null;
  computeNextDelay?: () => number;
  handler?: JobHandler;
  /** DB-backed schedule override — null/null = use computeNextDelay */
  overrideKind: ScheduleOverrideKind | null;
  overrideValue: string | null;
}

type RunStatus = 'running' | 'success' | 'failed' | 'skipped';

const jobs = new Map<string, RegisteredJob>();
const HOSTNAME = `${os.hostname()}:${process.pid}`;

// ── Per-run console capture (AsyncLocalStorage so lines attribute to the
//    run that produced them even when jobs overlap) ────────────────────────

interface RunLogSink {
  lines: string[];
  truncated: boolean;
}
const runLogContext = new AsyncLocalStorage<RunLogSink>();
const MAX_LOG_LINES = 500;
const MAX_LOG_CHARS = 64 * 1024;

let consolePatched = false;
function ensureConsolePatched() {
  if (consolePatched) return;
  consolePatched = true;
  for (const method of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[method].bind(console);
    (console as any)[method] = (...args: unknown[]) => {
      const sink = runLogContext.getStore();
      if (sink && !sink.truncated) {
        const line = `[${method.toUpperCase()}] ${util.format(...args)}`;
        const chars = sink.lines.reduce((n, l) => n + l.length, 0);
        if (sink.lines.length >= MAX_LOG_LINES || chars + line.length > MAX_LOG_CHARS) {
          sink.truncated = true;
          sink.lines.push('[registry] log output truncated');
        } else {
          sink.lines.push(line);
        }
      }
      original(...args);
    };
  }
}

// ── Fail-safe DB helpers ──────────────────────────────────────────────────

let dbAvailable: boolean | null = null;
let dbDownSince: number | null = null;
const DB_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

async function withJobDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (dbAvailable === false && dbDownSince && Date.now() - dbDownSince < DB_RETRY_COOLDOWN_MS) {
    return null;
  }
  try {
    const result = await fn();
    if (dbAvailable === false) {
      logger.info('[JobRegistry] scheduled_jobs tables reachable again — run persistence resumed');
    }
    dbAvailable = true;
    dbDownSince = null;
    return result;
  } catch (error: any) {
    if (dbAvailable !== false) {
      logger.warn('[JobRegistry] scheduled_jobs tables unavailable — running in memory-only mode', undefined, {
        error: error?.message || String(error),
      });
    }
    dbAvailable = false;
    dbDownSince = Date.now();
    return null;
  }
}

async function seedJobRow(job: RegisteredJob): Promise<void> {
  await withJobDb(() =>
    prisma.scheduled_jobs.upsert({
      where: { name: job.name },
      // Never overwrite `enabled` — that's the operator kill switch.
      update: {
        description: job.description ?? undefined,
        schedule_label: job.scheduleLabel ?? undefined,
      },
      create: {
        name: job.name,
        description: job.description,
        schedule_label: job.scheduleLabel,
      },
    })
  );
}

async function refreshJobState(job: RegisteredJob): Promise<boolean> {
  const row = await withJobDb(() =>
    prisma.scheduled_jobs.findUnique({
      where: { name: job.name },
      select: { enabled: true, schedule_override_kind: true, schedule_override: true },
    })
  );
  if (row) {
    job.enabled = row.enabled;
    // Sync overrides too — lets another replica's reschedule propagate
    // within one cycle instead of requiring a restart.
    job.overrideKind = (row.schedule_override_kind as ScheduleOverrideKind | null) ?? null;
    job.overrideValue = row.schedule_override;
  }
  return job.enabled && !job.envDisabled;
}

// ── Registration ──────────────────────────────────────────────────────────

/** Catalog-only entry for a job that still self-schedules. */
export function declareJob(name: string, meta: { description?: string; scheduleLabel?: string } = {}): void {
  const existing = jobs.get(name);
  if (existing) {
    existing.description = existing.description ?? meta.description;
    existing.scheduleLabel = existing.scheduleLabel ?? meta.scheduleLabel;
    return;
  }
  jobs.set(name, {
    name,
    description: meta.description,
    scheduleLabel: meta.scheduleLabel,
    instrumented: false,
    envDisabled: false,
    enabled: true,
    running: false,
    nextRunAt: null,
    timer: null,
    overrideKind: null,
    overrideValue: null,
  });
}

/** Batch-declare catalog entries. */
export function declareJobs(entries: Array<{ name: string; description?: string; scheduleLabel?: string }>): void {
  for (const entry of entries) declareJob(entry.name, entry);
}

/** ms until the next run honoring a DB schedule override, else the job's
 *  code-defined computeNextDelay. Returns NaN when nothing can compute one. */
function effectiveNextDelay(job: RegisteredJob): number {
  if (job.overrideKind === 'interval') {
    const minutes = parseInt(job.overrideValue ?? '', 10);
    if (Number.isFinite(minutes) && minutes > 0) return minutes * 60_000;
    logger.warn(`[JobRegistry] ${job.name} has invalid interval override '${job.overrideValue}' — falling back to default schedule`);
  } else if (job.overrideKind === 'cron') {
    const next = job.overrideValue ? nextCronRun(job.overrideValue) : null;
    if (next) return next.getTime() - Date.now();
    logger.warn(`[JobRegistry] ${job.name} has invalid cron override '${job.overrideValue}' — falling back to default schedule`);
  }
  return job.computeNextDelay ? job.computeNextDelay() : NaN;
}

/** Node setTimeout overflows above ~24.86 days (32-bit signed ms) and fires
 *  almost immediately — delays beyond this must hop via intermediate timers. */
const MAX_TIMER_MS = 2_147_483_647;

/** Arm (or re-arm) the next-run timer. Centralizing this enforces the
 *  always-future-delay contract — a non-positive/NaN delay is clamped to 60s
 *  rather than firing in a tight loop (the monthly-fee-summary spam bug),
 *  and delays beyond the setTimeout 32-bit limit hop instead of running. */
function armTimer(job: RegisteredJob): void {
  if (job.timer) {
    clearTimeout(job.timer);
    job.timer = null;
  }
  if (job.envDisabled) {
    job.nextRunAt = null;
    return;
  }

  let delay = Number(effectiveNextDelay(job));
  if (!Number.isFinite(delay) || delay <= 0) {
    logger.warn(`[JobRegistry] ${job.name} computed non-positive next-run delay (${delay}ms) — clamping to 60s`);
    delay = 60_000;
  }
  const targetAt = Date.now() + delay;
  job.nextRunAt = new Date(targetAt);

  job.timer = setTimeout(async () => {
    if (Date.now() < targetAt) {
      armTimer(job); // overflow hop — re-arm, don't run
      return;
    }
    try {
      await executeRun(job, 'schedule');
    } catch (error: any) {
      logger.error(`[JobRegistry] ${job.name} run failed`, undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack },
      });
    }
    armTimer(job);
  }, Math.min(delay, MAX_TIMER_MS));
  if (job.timer.unref) job.timer.unref();
}

/**
 * Fully instrumented scheduling: registry owns the timer and records runs.
 * computeNextDelay must return a FUTURE delay; non-positive/NaN results are
 * clamped to 60s with a warning rather than firing immediately (which is how
 * the monthly-fee-summary loop spammed merchants).
 */
export function scheduleJob(opts: ScheduleJobOptions): void {
  ensureConsolePatched();

  const envDisabled = !!(opts.envDisableVar && process.env[opts.envDisableVar] === 'true');
  const job: RegisteredJob = {
    name: opts.name,
    description: opts.description,
    scheduleLabel: opts.scheduleLabel,
    instrumented: true,
    envDisabled,
    enabled: true,
    running: false,
    nextRunAt: null,
    timer: null,
    computeNextDelay: opts.computeNextDelay,
    handler: opts.handler,
    overrideKind: null,
    overrideValue: null,
  };
  jobs.set(opts.name, job);

  if (envDisabled) {
    logger.info(`[JobRegistry] ${opts.name} disabled by ${opts.envDisableVar}`);
    void seedJobRow(job);
    return;
  }

  void seedJobRow(job).then(() => refreshJobState(job)).then(() => armTimer(job));
  logger.info(`[JobRegistry] ${opts.name} scheduled (${opts.scheduleLabel})`);
}

export function stopJob(name: string): void {
  const job = jobs.get(name);
  if (job?.timer) {
    clearTimeout(job.timer);
    job.timer = null;
    job.nextRunAt = null;
  }
}

// ── Execution ─────────────────────────────────────────────────────────────

async function executeRun(job: RegisteredJob, trigger: JobTrigger): Promise<{ skipped?: string; runId?: string; result?: unknown }> {
  if (!job.handler) return { skipped: 'not_instrumented' };
  if (job.running) return { skipped: 'already_running' };

  if (!(await refreshJobState(job))) {
    // Record skips only for manual/api triggers — a disabled job on a tight
    // schedule (e.g. every 5 min) would otherwise flood the run table.
    if (trigger !== 'schedule') {
      await withJobDb(() =>
        prisma.scheduled_job_runs.create({
          data: {
            job_name: job.name,
            status: 'skipped' as RunStatus,
            trigger_source: trigger,
            finished_at: new Date(),
            duration_ms: 0,
            error: job.envDisabled ? 'disabled_by_env' : 'disabled_by_admin',
            hostname: HOSTNAME,
          },
        })
      );
    }
    return { skipped: job.envDisabled ? 'disabled_by_env' : 'disabled_by_admin' };
  }

  job.running = true;
  const startedAt = new Date();

  const run = await withJobDb(() =>
    prisma.scheduled_job_runs.create({
      data: { job_name: job.name, trigger_source: trigger, started_at: startedAt, hostname: HOSTNAME },
      select: { id: true },
    })
  );
  const runId = run?.id ?? `mem-${Date.now()}`;

  const sink: RunLogSink = { lines: [], truncated: false };
  let status: RunStatus = 'success';
  let errorText: string | null = null;
  let resultJson: unknown = null;

  try {
    resultJson = await runLogContext.run(sink, () =>
      job.handler!({ jobName: job.name, runId, trigger, startedAt })
    );
    if (resultJson !== undefined) {
      try {
        JSON.stringify(resultJson);
      } catch {
        resultJson = String(resultJson);
      }
    }
  } catch (error: any) {
    status = 'failed';
    errorText = error?.stack || error?.message || String(error);
  } finally {
    job.running = false;
  }

  const finishedAt = new Date();
  await withJobDb(() =>
    prisma.scheduled_job_runs.update({
      where: { id: runId },
      data: {
        status,
        finished_at: finishedAt,
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        error: errorText,
        result: resultJson === null || resultJson === undefined ? undefined : (resultJson as any),
        logs: sink.lines.length ? sink.lines.join('\n') : null,
      },
    })
  );

  if (status === 'failed') {
    throw new Error((errorText || 'job failed').split('\n')[0]);
  }
  return { runId, result: resultJson };
}

/** Manually execute a registered job through the instrumented path. */
export async function runJobNow(name: string, trigger: JobTrigger = 'manual'): Promise<{ runId?: string; skipped?: string; result?: unknown }> {
  const job = jobs.get(name);
  if (!job) return { skipped: 'not_found' };
  if (!job.instrumented || !job.handler) return { skipped: 'not_instrumented' };
  return executeRun(job, trigger);
}

// ── Admin queries ─────────────────────────────────────────────────────────

export interface JobListEntry {
  name: string;
  description: string | null;
  scheduleLabel: string | null;
  /** Human-readable effective schedule — the override when set, else scheduleLabel */
  effectiveSchedule: string | null;
  scheduleOverride: { kind: ScheduleOverrideKind; value: string } | null;
  instrumented: boolean;
  enabled: boolean;
  envDisabled: boolean;
  running: boolean;
  nextRunAt: string | null;
  lastRun: {
    id: string;
    status: string;
    trigger_source: string;
    started_at: string;
    finished_at: string | null;
    duration_ms: number | null;
    error: string | null;
  } | null;
  stats30d: { runs: number; failures: number };
}

export async function listJobs(): Promise<JobListEntry[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [dbJobs, recentRuns] = await Promise.all([
    withJobDb(() => prisma.scheduled_jobs.findMany()),
    withJobDb(() =>
      prisma.scheduled_job_runs.findMany({
        where: { started_at: { gte: since } },
        orderBy: { started_at: 'desc' },
        take: 2000,
        select: {
          id: true, job_name: true, status: true, trigger_source: true,
          started_at: true, finished_at: true, duration_ms: true, error: true,
        },
      })
    ),
  ]);

  // Union of DB-known and registry-known jobs
  const names = new Set<string>([...jobs.keys(), ...(dbJobs ?? []).map((j) => j.name)]);
  const lastRunByJob = new Map<string, (typeof recentRuns extends (infer T)[] | null ? T : never)>();
  const statsByJob = new Map<string, { runs: number; failures: number }>();
  for (const r of recentRuns ?? []) {
    if (!lastRunByJob.has(r.job_name)) lastRunByJob.set(r.job_name, r);
    const s = statsByJob.get(r.job_name) ?? { runs: 0, failures: 0 };
    s.runs++;
    if (r.status === 'failed') s.failures++;
    statsByJob.set(r.job_name, s);
  }

  return [...names].sort().map((name) => {
    const reg = jobs.get(name);
    const db = dbJobs?.find((j) => j.name === name);
    const last = lastRunByJob.get(name);
    const overrideKind = (reg?.overrideKind ?? db?.schedule_override_kind ?? null) as ScheduleOverrideKind | null;
    const overrideValue = reg?.overrideValue ?? db?.schedule_override ?? null;
    const hasOverride = overrideKind !== null && overrideValue !== null;
    return {
      name,
      description: reg?.description ?? db?.description ?? null,
      scheduleLabel: reg?.scheduleLabel ?? db?.schedule_label ?? null,
      effectiveSchedule: hasOverride
        ? overrideKind === 'interval'
          ? `every ${overrideValue} min (override)`
          : `cron: ${overrideValue}`
        : (reg?.scheduleLabel ?? db?.schedule_label ?? null),
      scheduleOverride: hasOverride ? { kind: overrideKind, value: overrideValue! } : null,
      instrumented: reg?.instrumented ?? false,
      enabled: db?.enabled ?? reg?.enabled ?? true,
      envDisabled: reg?.envDisabled ?? false,
      running: reg?.running ?? last?.status === 'running',
      nextRunAt: reg?.nextRunAt?.toISOString() ?? null,
      lastRun: last
        ? {
            id: last.id,
            status: last.status,
            trigger_source: last.trigger_source,
            started_at: last.started_at.toISOString(),
            finished_at: last.finished_at?.toISOString() ?? null,
            duration_ms: last.duration_ms,
            error: last.error,
          }
        : null,
      stats30d: statsByJob.get(name) ?? { runs: 0, failures: 0 },
    };
  });
}

export async function listRuns(jobName: string, page = 1, limit = 25) {
  const take = Math.min(100, Math.max(1, limit));
  const skip = (Math.max(1, page) - 1) * take;

  const rows = await withJobDb(async () => {
    const [runs, total] = await Promise.all([
      prisma.scheduled_job_runs.findMany({
        where: { job_name: jobName },
        orderBy: { started_at: 'desc' },
        skip,
        take,
        // Summary fields only — logs/result load via getRun() on demand
        select: {
          id: true, job_name: true, status: true, trigger_source: true,
          started_at: true, finished_at: true, duration_ms: true,
          error: true, hostname: true, created_at: true,
        },
      }),
      prisma.scheduled_job_runs.count({ where: { job_name: jobName } }),
    ]);
    return { runs, total };
  });

  if (!rows) return { runs: [], pagination: { page, limit: take, total: 0, totalPages: 0 } };
  return {
    runs: rows.runs,
    pagination: { page, limit: take, total: rows.total, totalPages: Math.ceil(rows.total / take) },
  };
}

export async function getRun(runId: string) {
  return withJobDb(() => prisma.scheduled_job_runs.findUnique({ where: { id: runId } }));
}

/** Admin kill switch — persists to DB so it survives restarts and (with
 *  multi-instance deployments) propagates on each job's next enabled check. */
export async function setJobEnabled(name: string, enabled: boolean): Promise<boolean> {
  const job = jobs.get(name);
  const result = await withJobDb(() =>
    prisma.scheduled_jobs.upsert({
      where: { name },
      update: { enabled, updated_at: new Date() },
      create: {
        name,
        enabled,
        description: job?.description,
        schedule_label: job?.scheduleLabel,
      },
    })
  );
  if (result === null) return false; // DB unavailable — can't persist
  if (job) job.enabled = enabled;
  return true;
}

const MAX_INTERVAL_MINUTES = 30 * 24 * 60; // 30 days

/**
 * Set (or clear) a job's schedule override. Persists to scheduled_jobs and
 * re-arms the registry timer immediately when the job is instrumented.
 *
 * kind='default'  → clear the override, back to the code-defined schedule
 * kind='interval' → value = minutes between runs (1 … 43200)
 * kind='cron'     → value = 5-field cron expression (UTC) or @-shorthand
 */
export async function setJobSchedule(
  name: string,
  kind: 'default' | ScheduleOverrideKind,
  value?: string,
): Promise<{ ok: boolean; error?: string; nextRunAt?: string | null }> {
  let overrideKind: ScheduleOverrideKind | null = null;
  let overrideValue: string | null = null;

  if (kind === 'interval') {
    const minutes = parseInt(value ?? '', 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > MAX_INTERVAL_MINUTES) {
      return { ok: false, error: `interval must be 1–${MAX_INTERVAL_MINUTES} minutes` };
    }
    overrideKind = 'interval';
    overrideValue = String(minutes);
  } else if (kind === 'cron') {
    const expr = (value ?? '').trim();
    if (!expr || !isValidCron(expr)) {
      return { ok: false, error: 'invalid cron expression (5 fields: minute hour dom month dow, UTC)' };
    }
    overrideKind = 'cron';
    overrideValue = expr;
  } else if (kind !== 'default') {
    return { ok: false, error: 'kind must be default | interval | cron' };
  }

  const job = jobs.get(name);
  const saved = await withJobDb(() =>
    prisma.scheduled_jobs.upsert({
      where: { name },
      update: {
        schedule_override_kind: overrideKind,
        schedule_override: overrideValue,
        updated_at: new Date(),
      },
      create: {
        name,
        schedule_override_kind: overrideKind,
        schedule_override: overrideValue,
        description: job?.description,
        schedule_label: job?.scheduleLabel,
      },
    })
  );
  if (saved === null) return { ok: false, error: 'persistence unavailable — DB unreachable or migration not applied' };

  if (job) {
    job.overrideKind = overrideKind;
    job.overrideValue = overrideValue;
    if (job.instrumented) {
      armTimer(job); // re-arm with the new cadence
      logger.info(`[JobRegistry] ${name} schedule override → ${overrideKind ?? 'default'}${overrideValue ? ` (${overrideValue})` : ''}`);
    }
    return { ok: true, nextRunAt: job.nextRunAt?.toISOString() ?? null };
  }
  return { ok: true, nextRunAt: null };
}

/** Graceful shutdown — clears all registry-owned timers. */
export function stopAllJobs(): void {
  for (const job of jobs.values()) {
    if (job.timer) clearTimeout(job.timer);
    job.timer = null;
    job.nextRunAt = null;
  }
}
