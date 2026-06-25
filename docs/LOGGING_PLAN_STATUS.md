# Logging Alignment — Plan Status & Remaining Effort

**Date:** 2026-06-24
**Scope:** Structured logging + correlation ID architecture across `apps/api` and `apps/web`
**Status:** Core infrastructure complete — remaining work is incremental migration and hardening

---

## Executive Summary

The logging alignment has moved the platform from a fragmented `console.*`-only state to a centralized, correlation-ID-driven observability stack. The foundational pieces (backend logger, frontend logger, database error table, admin API, correlation ID propagation, log purge, process handlers) are **implemented and running**. The remaining effort is **incremental**: migrating the thousands of remaining `console.*` calls to `logger.*`/`clientLogger.*`, adding a few hardening items, and improving admin UI/UX for log browsing.

---

## Completed (P0/P1 Infrastructure)

| Component | Status | Evidence |
|-----------|--------|----------|
| Backend structured logger (`logger.ts`) | ✅ Complete | 4 transports: console, file (async streams), database (`application_error_log`), Sentry |
| Request context + correlation ID (`context.ts`) | ✅ Complete | `setRequestContext` middleware generates `corr-{tenantKey}-{nanoid}` and honors `x-correlation-id` header |
| Request logging middleware (`requestLogger`) | ✅ Mounted | Mounted in `index.ts` after `setRequestContext` |
| Client error endpoint (`client-errors.ts`) | ✅ Mounted | `POST /api/client-errors` with rate limiting + deduplication, mounted before auth |
| Admin error API (`admin/errors.ts`) | ✅ Complete | List/stats/detail/resolve endpoints with tenant/date/level/correlation filters |
| Process error handlers | ✅ Complete | `uncaughtException` and `unhandledRejection` handlers in `index.ts` |
| Log purge job (`jobs/log-purge.ts`) | ✅ Running | Daily 2 AM UTC purge of DB errors and file logs |
| Client correlation ID (`correlation-id.ts`) | ✅ Complete | sessionStorage-based, generates `corr-CL-{nanoid}`, adopts server ID from response |
| Client logger (`client-logger.ts`) | ✅ Complete | Sentry + console + backend batched persistence |
| Client error reporter (`error-reporter.ts`) | ✅ Complete | 5s batch flush, 10/min rate limit, 60s dedup, `navigator.sendBeacon` on unload |
| Global error handlers | ✅ Complete | `GlobalErrorHandler`, `ErrorBoundary`, `global-error.tsx` all route through `clientLogger` |
| Auth context integration | ✅ Complete | `AuthContext` syncs `tenantId`/`userId` to `clientLogger` |
| Correlation ID propagation on fetch | ✅ Complete | `FlexibleApiSingleton` injects `x-correlation-id` and adopts response header |
| Sentry client config | ✅ Fixed | `instrumentation-client.ts` uses `NEXT_PUBLIC_SENTRY_DSN`, 10% sampling, `sendDefaultPii: false`, dev disabled |
| DB migration for error log | ✅ Migrated | `database/migrations/051_application_error_log.sql` + Prisma model |
| Backend env vars documented | ✅ Complete | `apps/api/.env.example` includes `LOG_LEVEL`, `LOG_DIR`, `LOG_DB_ENABLED`, `LOG_RETENTION_DAYS`, `SENTRY_*`, `NEW_RELIC_*` |
| Logging skill docs | ✅ Complete | `.devin/skills/structured-logging.md`, `.devin/skills/correlation-id-troubleshooting.md` |

---

## Current State — Quantified

| Metric | Backend (`apps/api/src`) | Frontend (`apps/web/src`) |
|--------|---------------------------|---------------------------|
| Files still using `console.*` | **516** | **831** |
| `console.*` calls remaining | **5,517** | **5,605** |
| Files importing structured logger | **77** | **5** |
| Change since audit (2026-06-23) | -52 calls, +1 logger import | -742 calls, new client logger stack |

**Interpretation:** The core infrastructure is wired in, but the codebase is still dominated by `console.*` calls. The logger is additive, so this is not an immediate risk — it is a long-tail migration.

---

## Remaining Gaps (P2/P3)

### High Priority

| ID | Gap | Impact | Owner |
|----|-----|--------|-------|
| G1 | `Morgan` HTTP logger still mounted alongside `requestLogger` | Duplicate, non-structured HTTP logs | Backend |
| G2 | `application_error_log` has no admin UI page | Admins must use curl/raw API to browse errors | Frontend |
| G3 | Frontend `.env.local.example` missing `NEXT_PUBLIC_LOG_LEVEL` | New devs can't set client log level | Frontend |
| G4 | No validation schema for `/api/client-errors` | Malformed payloads can cause 500s | Backend |

### Medium Priority

| ID | Gap | Impact | Owner |
|----|-----|--------|-------|
| G5 | Bulk `console.*` → `logger.*` migration in backend | Most errors still lack context/correlation IDs | Backend |
| G6 | Bulk `console.*` → `clientLogger.*` migration in frontend | Client errors lack context/correlation IDs | Frontend |
| G7 | No `no-console` ESLint rule | New code continues to add `console.*` | Both |
| G8 | `context.ts` only discovers tenantId from query/body/params | Tenant-scoped correlation IDs missing for routes using auth tokens | Backend |
| G9 | No module-level log level override | Cannot debug one service without flooding others | Backend |
| G10 | No alert/monitoring on error spikes | Incidents detected by users, not by platform | Backend |

### Low Priority

| ID | Gap | Impact | Owner |
|----|-----|--------|-------|
| G11 | File logs not aggregated to external log sink | Long-term storage and search limited | Backend |
| G12 | No structured request logs in frontend SSR | Server-side rendering errors lack correlation IDs | Frontend |
| G13 | Log rotation only handles `.log` and `.bak` extensions | Compressed/archived logs may not be purged | Backend |

---

## Phased Remaining Effort Plan

### Phase 1: Hardening (1–2 days)

**Goal:** Fix the remaining structural gaps that make the logging system harder to operate or less reliable.

1. **Add `NEXT_PUBLIC_LOG_LEVEL` to `apps/web/.env.local.example`**
   - Default: `info`
   - Document valid values: `debug`, `info`, `warn`, `error`
2. **Add input validation to `/api/client-errors`**
   - Use Zod to validate the batch schema
   - Prevent malformed payloads from causing server errors
3. **Decide on Morgan**
   - Option A: Remove `morgan` entirely (recommend) — `requestLogger` already covers HTTP logging
   - Option B: Keep Morgan for raw access logs in a specific format
   - Decision needed from team
4. **Improve `context.ts` tenant discovery**
   - Add best-effort extraction from `req.user` / auth context when available
   - Ensures tenant-scoped correlation IDs for authenticated routes
5. **Smoke test end-to-end flow**
   - Trigger a client error → verify it appears in `application_error_log` with `service='client'`
   - Trigger a server error → verify it appears in DB + Sentry + file log
   - Verify correlation ID matches across client and server

**Acceptance criteria:**
- No hardcoded DSNs or secrets
- Client log level documented
- `/api/client-errors` has Zod validation
- Morgan decision recorded
- End-to-end smoke test passes

---

### Phase 2: Admin Error Log UI (2–3 days)

**Goal:** Build a frontend page for platform admins to browse, filter, and resolve errors without using curl.

1. **Create `/settings/admin/errors` page**
   - Paginated table of `application_error_log` entries
   - Columns: occurred_at, level, tenant, service, request_path, status_code, message
2. **Add filters**
   - tenant_id, level, service, resolved, correlation_id, date range
3. **Add error detail drawer/modal**
   - Show stack_trace, context JSON, user agent, IP, Sentry event link
4. **Add resolve action**
   - Button to call `POST /api/admin/errors/:id/resolve`
   - Bulk resolve option (optional)
5. **Add stats dashboard**
   - Show total/unresolved/error counts by day, service, tenant
   - Reuse `GET /api/admin/errors/stats`

**Acceptance criteria:**
- Admin can find errors by correlation ID in under 30 seconds
- Admin can resolve errors from the UI
- Stats page shows error trends

---

### Phase 3: Backend Console Migration (Ongoing — 2–4 weeks)

**Goal:** Migrate backend `console.*` calls to `logger.*` in priority order.

**Priority order:**
1. `index.ts` startup/shutdown/route mounting (highest noise, lowest risk)
2. Route file `catch` blocks (direct observability win)
3. Service file error handling (business logic coverage)
4. Job files (scheduled task failures)
5. Debug/verbose `console.log` in low-level utilities (lowest priority)

**Approach:**
- File-by-file or subsystem-by-subsystem
- Use multi-edit for mechanical replacements
- Preserve behavior: `console.error` → `logger.error`, `console.warn` → `logger.warn`, `console.log` debug noise → `logger.debug`
- Add tenant context where `req.ctx` or `tenantId` is available
- Add error context where an `Error` object is present

**Enforcement:**
- Add `eslint` `no-console` rule with `allow: ['warn']` for intentional console warnings during transition
- Gradually tighten to `error` severity

**Acceptance criteria:**
- `console.*` calls in backend reduced by 50% (target: ~2,500 remaining)
- All new catch blocks use `logger.error`
- ESLint rule active in CI

---

### Phase 4: Frontend Console Migration (Ongoing — 2–4 weeks)

**Goal:** Migrate frontend `console.*` calls to `clientLogger.*`.

**Priority order:**
1. `ErrorBoundary`, `GlobalErrorHandler`, `global-error.tsx` (already done)
2. Service file catch blocks (`TenantInfoService.ts`, `FlexibleApiSingleton.ts`, `PlatformHomeSingletonService.ts`, etc.)
3. Provider/Context files (auth, cart, tenant providers)
4. Component error states
5. Debug/verbose `console.log` → `clientLogger.debug`

**Approach:**
- Start with the high-volume files identified in the audit
- Replace `console.error` with `clientLogger.error` and add context (tenantId, userId, URL)
- Replace `console.warn` with `clientLogger.warn`
- Replace debug `console.log` with `clientLogger.debug` (dev-only)

**Enforcement:**
- Add `eslint` `no-console` for frontend
- Allow `console.warn` only in logger infrastructure and test files

**Acceptance criteria:**
- `console.*` calls in frontend reduced by 50% (target: ~2,500 remaining)
- High-volume service files migrated first
- ESLint rule active in CI

---

### Phase 5: Observability Hardening (1 week)

**Goal:** Make the logging system self-monitoring and easier to operate at scale.

1. **Module-level log level override**
   - Allow `LOG_LEVEL_{MODULE}` env vars (e.g., `LOG_LEVEL_GMC=debug`)
   - Or support a simple module prefix in `logger.ts`
2. **Error spike alerting**
   - Add a lightweight threshold check in the stats endpoint or a scheduled job
   - Alert via admin notification or email when unresolved errors exceed a threshold in 5 minutes
3. **Background job correlation ID propagation**
   - Ensure all scheduled jobs that originate from requests carry the correlation ID
   - Generate a new correlation ID for cron-only jobs and log it
4. **Log sink integration (optional)**
   - Forward file logs to an external aggregator (e.g., Datadog, CloudWatch, Loki)
   - Document config in `.env.example`

**Acceptance criteria:**
- Can enable debug logging per module without global flood
- Platform detects error spikes automatically
- All jobs log with correlation IDs

---

## Recommended Execution Order

```
Phase 1 (Hardening)        → 1–2 days  → do first, no dependencies
Phase 2 (Admin UI)         → 2–3 days  → depends on Phase 1 validation
Phase 3 (Backend Migration)  → ongoing   → parallel with Phase 4
Phase 4 (Frontend Migration) → ongoing → parallel with Phase 3
Phase 5 (Hardening)        → 1 week    → after Phase 1 and some migration progress
```

**Suggested cadence:** Run Phase 1 + Phase 2 as a single focused sprint. Then run Phase 3 and Phase 4 in parallel as background migration work (a few files per PR) while continuing feature work. Phase 5 can be picked up once migration coverage is meaningful.

---

## Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| Migrating 11,000+ `console.*` calls is a large effort | Incremental, file-by-file; targets 50% reduction, not 100% |
| `logger.error` DB writes add latency | Already fire-and-forget via `setImmediate`; add timeout if needed |
| Sentry quota exhaustion from newly captured client errors | 10% sampling, dev disabled, rate limiting + dedup on client |
| Removing Morgan may break existing log parsing | Decision required; if kept, document rationale |
| ESLint `no-console` breaks legacy files | Use `allow: ['warn']` initially, then tighten |

---

## File References

- `apps/api/src/logger.ts` — backend logger
- `apps/api/src/context.ts` — request context / correlation ID
- `apps/api/src/routes/admin/errors.ts` — admin error log API
- `apps/api/src/routes/client-errors.ts` — client error endpoint
- `apps/api/src/jobs/log-purge.ts` — log purge job
- `apps/api/src/index.ts` — middleware mounting, process handlers
- `apps/web/src/lib/client-logger.ts` — client logger
- `apps/web/src/lib/correlation-id.ts` — client correlation ID
- `apps/web/src/lib/error-reporter.ts` — batched client error reporting
- `apps/web/src/components/GlobalErrorHandler.tsx` — global window error handlers
- `apps/web/src/components/ErrorBoundary.tsx` — React error boundary
- `apps/web/src/app/global-error.tsx` — Next.js global error page
- `apps/web/src/contexts/AuthContext.tsx` — clientLogger context sync
- `apps/web/src/instrumentation-client.ts` — client Sentry config
- `apps/web/src/providers/base/FlexibleApiSingleton.ts` — correlation ID injection
- `.devin/skills/structured-logging.md` — developer logging guide
- `.devin/skills/correlation-id-troubleshooting.md` — incident response guide

---

## Open Decisions

1. **Morgan removal**: Should we remove `morgan` now that `requestLogger` is active?
2. **Admin error UI scope**: Should the UI include real-time websocket updates, or is polling sufficient?
3. **Error spike alerting**: What threshold should trigger an alert? (e.g., 50 unresolved errors in 5 minutes)
4. **Migration target**: Is 50% reduction acceptable, or do we want 80% before declaring Phase 3/4 complete?
