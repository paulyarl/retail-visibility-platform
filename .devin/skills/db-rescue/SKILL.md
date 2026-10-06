# DB Rescue Utility — User Guide

## Purpose

`apps/api/scripts/db-rescue.cjs` is the emergency diagnostics and cleanup tool for Supabase database-size/quota incidents. It answers "why is the database huge and what do I delete" in one command, then provides the surgical fixes: purge runaway log tables, install a circuit-breaker trigger against write spam, trim pg_cron history, dedupe runaway schedules, and vacuum-reclaim disk space.

Written in plain Node + `pg` (node-postgres) with **no build step** — works even when the TypeScript app won't compile. `pg` uses the simple query protocol: no prepared statements (pgbouncer-safe) and no implicit transaction wrapping (VACUUM-safe). It prefers `DIRECT_URL` and falls back to `DATABASE_URL`; no `psql` install needed.

Use this skill whenever: a Supabase "Database Size" quota warning appears, a table is growing abnormally fast, an error log is being spammed, or pg_cron jobs/history need auditing.

## How to run

Always run through Doppler so `DATABASE_URL`/`DIRECT_URL` resolve for the target environment — never hardcode credentials:

```bash
cd apps/api

# diagnostics against production
doppler run --config prd   -- node scripts/db-rescue.cjs report

# same against local/dev
doppler run --config local -- node scripts/db-rescue.cjs report
# or: doppler run --config <env> -- pnpm db:rescue <cmd>
```

No prerequisites beyond `node_modules` — the script talks to Postgres directly via `pg`, not the app's Prisma client.

## Incident workflow

1. **`report` first.** Shows `pg_database_size`, schema totals, top-20 tables by size with live/dead tuple counts, replication slots (inactive slots pin WAL and inflate the dashboard metric), error-log volume by day, top error messages, spam-guard status, cron job count + duplicate commands, and `job_run_details` age/size.
2. **Find the anomaly.** A table dominating the DB (`application_error_log` was 400MB of 656MB in the 2026-10-06 incident) or a day-count spike in the per-day volume table points at a write loop, not organic growth.
3. **Identify the source before purging.** `errors top` shows the repeated message; pull a stack trace via `sql` (`select left(stack_trace,2000) from application_error_log where message like '…' order by occurred_at desc limit 1`) — it names the dist file/line of the looping caller.
4. **Stop the write loop first** (deploy fix / kill job), or install `guard` as the interim circuit-breaker. Purging while the loop runs buys days at best.
5. **Purge + `vacuum --full`** to actually return disk space. A plain `DELETE` only marks tuples dead; `VACUUM FULL` rewrites the table and shrinks files (brief exclusive lock).
6. **Verify** with `report` again. Note: the Supabase **dashboard metric lags** and includes WAL — trust `pg_database_size`.

## Command reference

| Command | What it does |
|---|---|
| `report` | Full health snapshot (see workflow above). Read-only. |
| `errors top [--days N]` | Most frequent error-log messages in window (default 7d). |
| `errors purge --days N [--like 'pat%']` | Delete `application_error_log` rows older than N days; repeatable `--like` narrows to matching messages. **`--days` is required — refuses blanket deletes.** |
| `guard install --like 'pat%' [--like …]` | Installs `BEFORE INSERT` trigger `trg_rvp_rescue_skip` + function `rvp_rescue_skip_rows` that **silently drops** matching rows — the spam circuit-breaker. Reversible via `guard drop`. |
| `guard status` / `guard drop` | Show or remove the guard trigger/function. |
| `errors dedupe [--minutes N]` | **Generic** circuit-breaker trigger (`trg_rvp_error_log_dedupe`): drops an insert when an identical `md5(message)` row exists within N minutes (default 60). Keeps ≥1 row/message/window. Uses `idx_ael_message_md5`. |
| `errors dedupe-status` / `errors dedupe-drop` | Inspect / remove the dedupe trigger. |
| `cron list` | All pg_cron jobs: id, name, schedule, command, active. |
| `cron dupes` | Commands scheduled by more than one active job — the classic "two generations of refresh jobs" trap. |
| `cron trim [--days N]` | Delete `cron.job_run_details` older than N days (default 3) + `VACUUM`. |
| `cron retention [--days N]` | Install/update nightly `purge-cron-run-history` job (04:15 UTC). Idempotent by job name. |
| `cron unschedule <name>` | `cron.unschedule` by job name. |
| `vacuum <table> [--full]` | `VACUUM ANALYZE` (non-blocking, frees space for reuse) or `VACUUM FULL ANALYZE` (exclusive lock, returns disk space). Accepts `table` or `schema.table`. |
| `sql "select …"` | Read-only escape hatch — SELECT/WITH/EXPLAIN/SHOW only. |

Identifiers are regex-validated and LIKE patterns are single-quote-escaped; destructive paths require explicit flags.

## Currently installed (prod + staging, as of 2026-10-06)

- **Write-loop protection, two layers**: (1) `DatabaseTransport` in `apps/api/src/logger.ts` dedupes error inserts in-process — normalized-message fingerprint (UUIDs/ID digits collapsed), 60-min window, suppressed count surfaced in `context.dedupe_suppressed_count` and throttled console notes; `LOG_DB_DEDUPE=false` / `LOG_DB_DEDUPE_WINDOW_MS` to tune. (2) DB-side `trg_rvp_error_log_dedupe` BEFORE INSERT trigger (60-min window, `md5(message)` match) — catches writes that bypass the app logger entirely. Staging additionally still has the pattern-specific `trg_rvp_rescue_skip` guard until the fixed build deploys there.
- **Suppression accounting**: both layers upsert `public.error_log_dedupe_stats` (migration `314_error_log_dedupe_stats.sql`, one row per distinct `md5(message)`) — the logger batches pending counts on a 60s flush, the trigger upserts per dropped insert. Admin visibility: `GET /api/admin/errors/suppressions` (declared before `/:id` in `routes/admin/errors.ts` — route order matters) and the **Log Dedupe** tab on `/settings/admin/jobs` (`AdminErrorLogService.getSuppressions`).
- pg_cron jobs `purge-cron-run-history` (keeps 3 days) and `purge-application-error-log` (keeps 14 days) on both envs.
- ~24 duplicate pg_cron refresh jobs unscheduled on prod, 2 on staging; `cron dupes` on prod should only ever show the intentional `cleanup_featured_products` pair and the empty-command `security-alerts-*` pair.

## Origin / incident postmortem (2026-10-06)

Supabase free-plan warning: DB at 0.702/0.5 GB. Diagnosis: the **old `monthly-fee-summary` job** (pre-JobRegistry, self-scheduling `setTimeout` with a non-positive delay) ran `sendAllMonthlySummaries` in a continuous loop; each of 4 Stripe-Connect tenants × 3 unconfigured email providers (SES/SendGrid/Mailtrap) wrote 3 rows per attempt → **~135K rows/day, 717K rows / 400MB**. Fixed by: `trg_skip_email_spam` BEFORE INSERT guard → DELETE + `VACUUM FULL` → redeploy of the registry-clamped build → trigger dropped. Consolidated into this utility afterward.

## Safety notes

- `errors purge`, `cron trim`, `cron unschedule`, `guard install`, and `vacuum` **mutate production** when run under `--config prd`. Prefer `report`/`sql`/`dupes`/`status` for reconnaissance.
- `VACUUM FULL` takes an `ACCESS EXCLUSIVE` lock — fine on a 400MB table (seconds), think twice on multi-GB.
- `guard` drops rows silently — real errors matching the pattern are also lost while it's installed. Remove it (`guard drop`) once the source is fixed.
- `errors dedupe` collapses legitimately-repeating errors to ~1 row/hour — you keep the signal, lose the volume. Remove with `errors dedupe-drop` if you need raw counts.
- Destructive DB work done through this tool should still be announced to the operator; the script doesn't prompt.
