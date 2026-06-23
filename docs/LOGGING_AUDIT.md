# Backend Logging Architecture Audit

**Date:** 2026-06-23  
**Scope:** `apps/api/src` — all logging, error tracking, and observability infrastructure  
**Status:** Audit complete — no implementation changes made

---

## Executive Summary

The platform has **three disconnected observability tools** (Sentry, New Relic, a custom `logger.ts`) but none of them are fully wired into the application. **5,469 `console.*` calls across 512 files** dominate the codebase, producing ephemeral output that vanishes on container restart. There is **no persistent exception store**, **no automated log purge**, and **no `uncaughtException`/`unhandledRejection` handler**. The custom `Logger` class in `logger.ts` is imported by only 76 files and its Express middleware (`requestLogger`, `logWithContext`) is **never mounted**.

---

## Current Inventory

### 1. Custom Logger (`logger.ts`)

`@/apps/api/src/logger.ts:1-271`

- **Levels:** `ERROR(0)`, `WARN(1)`, `INFO(2)`, `DEBUG(3)`
- **Transports:**
  - `ConsoleTransport` — always on, colorized in dev, JSON in prod
  - `FileTransport` — production only, writes to `./logs/app-YYYY-MM-DD.log`
- **File rotation:** size-based at 10 MB, renames to `.bak` (keeps max 5 backups per day-file)
- **Structured fields:** `timestamp`, `level`, `message`, `tenantId`, `region`, `method`, `path`, `statusCode`, `duration`, `userId`, `ip`, `userAgent`, `correlationId`, `error.{name,message,stack}`
- **Exports:** `logger` (singleton), `logWithContext()`, `requestLogger()` middleware

**Problems:**
- `requestLogger` and `logWithContext` are **never imported or mounted** in `index.ts` or any route file — the structured request logging pipeline is dead code
- Only **76 files** import from `logger.ts` vs. **512 files** using `console.*` directly
- `FileTransport.log()` uses `fs.appendFileSync` — **synchronous I/O** blocks the event loop on every log write
- File rotation only checks the current day's file — **old date-based files are never deleted** (no time-based retention)
- No async write stream (e.g., `fs.createWriteStream`) — unsuitable for high-throughput production

### 2. Sentry (`@sentry/node` v10.38.0)

`@/apps/api/src/index.ts:252-278`, `@/apps/api/src/index.ts:7990-7993`

- Initialized with DSN from `SENTRY_DSN` env var
- `tracesSampleRate: 0.1` (10% performance sampling)
- `beforeSend` returns `null` in development — errors are `console.error`'d but not sent
- `Sentry.setupExpressErrorHandler(app)` mounted after all routes — captures unhandled Express errors only
- `SentryApiService.ts` — admin endpoint to fetch Sentry project/issue/stats data

**Problems:**
- **Zero `Sentry.captureException()` calls** in any `catch` block across the entire codebase — all caught errors are swallowed by `console.error` and never reported to Sentry
- The Express error handler only catches errors that propagate up through `next(err)` — the majority of `catch` blocks handle errors inline and never reach it
- No `Sentry.withScope()` usage for enriching errors with tenant/user context

### 3. New Relic APM (`newrelic` v13.12.0)

`@/apps/api/src/newrelic.ts:1-40`

- Loaded via `require('newrelic')` in production only
- Configures: error collector, transaction tracer, distributed tracing, datastore tracer
- Custom attributes: `request.method`, `request.url`, `response.status`, `request.headers.user-agent`, `request.headers.x-tenant-id`, `request.headers.x-forwarded-for`

**Problems:**
- Runs as a black-box agent — no integration with the custom logger or Sentry
- No custom transaction naming or segment attributes for tenant-scoped operations
- License key not documented in `.env.example`

### 4. Morgan HTTP Request Logging

`@/apps/api/src/index.ts:364`

```typescript
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
```

- Logs to **stdout only** — no file or database transport
- "combined" format in production (Apache-style), "dev" in development
- **Not structured JSON** — cannot be easily parsed or queried
- Duplicates what `requestLogger` middleware was designed to do (but `requestLogger` is never mounted)

### 5. Audit Log System

`@/apps/api/src/audit.ts:1-81`

- Writes to `audit_log` PostgreSQL table
- Feature-flagged via `Flags.AUDIT_LOG`
- Captures business actions: `create`, `update`, `delete`, `sync`, `policyApply`, `oauthConnect`, `oauthRefresh`
- Errors are silently swallowed (`catch (e) {}`)

**Scope:** Business-level audit trail only. Does **not** capture errors, exceptions, or operational logs.

### 6. Domain-Specific Log Tables

The database has several specialized log tables, all narrowly scoped:

| Table | Purpose |
|---|---|
| `audit_log` | Business action audit trail |
| `clover_sync_logs_list` | Clover POS sync operations |
| `square_sync_logs_list` | Square POS sync operations |
| `webhook_events` | Generic webhook event records |
| `stripe_webhook_events` | Stripe webhook events |
| `notification_logs` | Notification delivery records |
| `login_attempts` / `failed_login_attempts` | Auth attempts |
| `location_status_logs` | Location status transitions |
| `directory_mv_refresh_log` / `storefront_mv_refresh_log` / etc. | Materialized view refresh logs |
| `inventory_sync_events` / `inventory_transfer_logs` | Inventory operations |
| `download_access_logs` | Digital asset access |
| `permission_audit_logs_list` | Permission changes |
| `tier_change_logs_list` | Tier assignment changes |

**No general-purpose error/exception log table exists.**

### 7. Process Error Handlers

`@/apps/api/src/index.ts:8086-8097`

- `SIGTERM` handler — graceful shutdown (closes server, exits 0)
- `server.on('error')` — handles `EADDRINUSE` and other server errors
- Fatal startup error `try/catch` — logs and exits 1

**Missing:**
- **No `process.on('uncaughtException')` handler** — uncaught errors crash the process with no log record
- **No `process.on('unhandledRejection')` handler** — unhandled promise rejections are silently dropped (Node 15+ exits with code 1, but no log is captured)

### 8. Environment Configuration

`.env.example` contains **zero logging-related variables**. The following are referenced in code but undocumented:

| Variable | Used In | Purpose |
|---|---|---|
| `SENTRY_DSN` | `index.ts` | Sentry error tracking DSN |
| `SENTRY_ENVIRONMENT` | `index.ts` | Sentry environment label |
| `SENTRY_API_TOKEN` | `sentry.ts` route | Sentry admin API access |
| `SENTRY_ORG_SLUG` | `sentry.ts` route | Sentry organization slug |
| `NEW_RELIC_LICENSE_KEY` | `newrelic.ts` | New Relic APM license |
| `NEW_RELIC_APP_NAME` | `newrelic.ts` | New Relic app name |
| `LOG_LEVEL` | `logger.ts` | Min log level (debug/warn/error/info) |
| `LOG_DIR` | `logger.ts` | File log directory (default `./logs`) |

---

## Gap Analysis

### Critical Gaps

| # | Gap | Impact | Affected Files |
|---|---|---|---|
| G1 | **No persistent exception store** — errors are `console.error`'d and lost on container restart | Cannot debug production incidents; no exception history | All 512 files with `console.*` |
| G2 | **5,469 `console.*` calls** bypass the structured logger | No tenant context, no correlation IDs, no structured JSON, no level filtering | 512 files |
| G3 | **`requestLogger` middleware never mounted** — structured request logging is dead code | No structured request/response logs with duration and status | `index.ts` (mount point missing) |
| G4 | **No `Sentry.captureException()` in catch blocks** | Caught errors never reach Sentry — only unhandled Express errors are reported | All route/service files |
| G5 | **No `uncaughtException` / `unhandledRejection` handlers** | Process crashes with zero log record | `index.ts` |
| G6 | **No automated log purge** — file logs grow indefinitely | Disk exhaustion on long-running deployments | `FileTransport` |

### High-Priority Gaps

| # | Gap | Impact |
|---|---|---|
| G7 | **Synchronous file I/O** in `FileTransport` (`fs.appendFileSync`) | Blocks event loop under high log volume |
| G8 | **No correlation ID propagation** — requests cannot be traced across services | Impossible to reconstruct request flows |
| G9 | **No log retention policy** — old log files never deleted | Unbounded disk usage |
| G10 | **Morgan logs to stdout only** — no structured JSON, no file/DB transport | HTTP logs lost on restart, not queryable |
| G11 | **No env vars documented** for logging/Sentry/New Relic | New developers cannot configure observability |

### Medium-Priority Gaps

| # | Gap | Impact |
|---|---|---|
| G12 | **Three disconnected tools** (logger.ts, Sentry, New Relic) with no integration | Context lost between tools — Sentry errors don't include structured log context |
| G13 | **No log sampling** in `logger.ts` — all logs at or above min level are written | Performance impact under high traffic |
| G14 | **No log-level override per module** — single global `LOG_LEVEL` | Cannot debug specific modules without flooding others |
| G15 | **Audit log silently swallows errors** | Audit failures are invisible |

---

## Architecture Assessment

### What Works

- **Sentry Express error handler** — captures unhandled route errors automatically
- **New Relic auto-instrumentation** — captures HTTP transactions, DB queries, and external calls without code changes
- **Audit log** — provides a business-level audit trail with tenant scoping
- **Domain-specific log tables** — sync logs, webhook events, and notification logs provide operational visibility for specific subsystems
- **`LogEntry` interface design** — well-structured with tenant, region, correlation ID, and error fields

### What Doesn't Work

- **The structured logger is effectively unused.** 76 imports out of 512+ files means ~85% of the codebase bypasses it. The `requestLogger` middleware and `logWithContext` helper are dead code.
- **Sentry is passive-only.** It relies entirely on the Express error handler. The 5,000+ `catch` blocks that `console.error` an error and continue never report to Sentry.
- **File logging is not production-grade.** Synchronous I/O, no retention policy, no compression, no async streams.
- **No centralized error/exception table.** The database has 15+ specialized log tables but no general-purpose `error_log` or `application_log` table for persisting exceptions with stack traces, tenant context, and request metadata.

---

## Recommended Target Architecture

### Phase 1: Database-Backed Exception Store (P0)

Create an `application_error_log` PostgreSQL table to persist exceptions with full context:

```
application_error_log
├── id              UUID PK
├── occurred_at     timestamptz DEFAULT now()
├── level           varchar(10)     -- error | warn | fatal
├── message         text
├── stack_trace     text
├── error_name      varchar(255)    -- e.g., "PrismaClientKnownRequestError"
├── tenant_id       varchar(255)
├── user_id         varchar(255)
├── request_method  varchar(10)
├── request_path    text
├── request_query   jsonb
├── status_code     integer
├── correlation_id  varchar(255)
├── service         varchar(100)    -- e.g., "gmc-sync", "stripe-webhook"
├── context         jsonb           -- arbitrary metadata
├── sentry_event_id varchar(255)    -- cross-reference to Sentry
└── resolved        boolean DEFAULT false
```

**Indexes:** `(tenant_id, occurred_at DESC)`, `(level, occurred_at DESC)`, `(service, occurred_at DESC)`

**Rationale:** PostgreSQL is already the primary datastore. A dedicated error table gives queryable, tenant-scoped exception history without external dependencies. The `sentry_event_id` column creates a bridge to Sentry for stack traces and breadcrumb context.

### Phase 2: Wire the Structured Logger (P0)

1. **Mount `requestLogger` middleware** in `index.ts` (replace or augment Morgan)
2. **Add a `DatabaseTransport`** to `logger.ts` that writes ERROR-level entries to `application_error_log`
3. **Add `Sentry.captureException()`** to the `DatabaseTransport` — every logged error is also sent to Sentry with tenant/user scope
4. **Replace `fs.appendFileSync`** with `fs.createWriteStream` (async, non-blocking)
5. **Add correlation ID middleware** — generate `req.ctx.correlationId` via `crypto.randomUUID()` and set on response header `X-Correlation-Id`

### Phase 3: Process Error Handlers (P0)

Add to `index.ts`:

```typescript
process.on('uncaughtException', (error) => {
  logger.error('uncaughtException', undefined, {
    error: { name: error.name, message: error.message, stack: error.stack },
  });
  Sentry.captureException(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', undefined, {
    error: { name: 'UnhandledRejection', message: String(reason) },
  });
  Sentry.captureException(reason as Error);
});
```

### Phase 4: Automated Log Purge Job (P1)

Create `apps/api/src/jobs/log-purge.ts` following the existing job pattern (e.g., `subscription-grace-period.ts`):

- **Schedule:** Daily at 2 AM (off-peak)
- **Database:** `DELETE FROM application_error_log WHERE occurred_at < NOW() - INTERVAL '90 days' AND resolved = true`
- **File logs:** Delete files in `LOG_DIR` older than `LOG_RETENTION_DAYS` (default 30)
- **Config:** `LOG_RETENTION_DAYS` env var (default 30 for files, 90 for DB)
- **Mount:** In `index.ts` startup block alongside other scheduled jobs

### Phase 5: Console Migration (P1)

Incrementally replace `console.*` calls with `logger.*` across the codebase. Priority order:

1. **`index.ts`** (498 matches) — startup, shutdown, route mounting
2. **Route files** — error handlers in `catch` blocks
3. **Service files** — business logic errors
4. **Job files** — scheduled job status and failures

**Strategy:** Use `eslint` rule `no-console` with `allow: ['warn']` to enforce migration. Keep `console.warn` temporarily for dev-only diagnostic output.

### Phase 6: Admin Observability API (P2)

Extend the existing `/api/admin/sentry` route to also query `application_error_log`:

- `GET /api/admin/errors` — paginated error list with filters (tenant, level, service, date range)
- `GET /api/admin/errors/:id` — full error detail with stack trace and context
- `POST /api/admin/errors/:id/resolve` — mark error as resolved
- `GET /api/admin/errors/stats` — error count by level/service/tenant over time

### Phase 7: Documentation (P2)

- Add all logging env vars to `.env.example`
- Update `apps/api/observability/README.md` with the new architecture
- Add logging guidelines to backend dev standards

---

## Migration Risk Assessment

| Risk | Mitigation |
|---|---|
| Database write on every error adds latency | Use fire-and-forget with `setImmediate`; batch writes via buffer flush every 5s |
| Log table grows unbounded | Phase 4 purge job with 90-day retention for resolved errors |
| Replacing 5,469 console calls is a large effort | Phase 5 is incremental — `console.*` still works, logger is additive |
| Sentry rate limits from sudden captureException volume | Use `Sentry.beforeSend` to sample known-noisy errors |
| Synchronous DB transport blocks event loop | Use async write with `Promise.race` timeout (500ms) — fall back to console on timeout |

---

## File Reference

| Component | Path |
|---|---|
| Custom logger | `apps/api/src/logger.ts` |
| Sentry init | `apps/api/src/index.ts:252-278` |
| Sentry error handler | `apps/api/src/index.ts:7990-7993` |
| Sentry API service | `apps/api/src/services/SentryApiService.ts` |
| Sentry admin route | `apps/api/src/routes/admin/sentry.ts` |
| New Relic config | `apps/api/src/newrelic.ts` |
| Morgan mount | `apps/api/src/index.ts:364` |
| Audit log | `apps/api/src/audit.ts` |
| Request context | `apps/api/src/context.ts` |
| Process handlers | `apps/api/src/index.ts:8076-8097` |
| Scheduled jobs | `apps/api/src/jobs/` |
| Observability README | `apps/api/observability/README.md` |
| Dashboard JSON | `apps/api/observability/dashboards/latency-by-region.json` |
| Prisma schema | `apps/api/prisma/schema.prisma` |
| Package.json deps | `apps/api/package.json` (lines 69, 87, 90) |
| Env example | `apps/api/.env.example` |

---

## Metrics Summary

| Metric | Value |
|---|---|
| Total `console.*` calls | 5,469 |
| Files using `console.*` | 512 |
| Files importing `logger.ts` | 76 |
| `Sentry.captureException()` calls | 0 |
| `requestLogger` mount points | 0 |
| `uncaughtException` handlers | 0 |
| `unhandledRejection` handlers | 0 |
| Log purge jobs | 0 |
| General-purpose error log tables | 0 |
| Domain-specific log tables | 15+ |
| Logging env vars documented in `.env.example` | 0 |
