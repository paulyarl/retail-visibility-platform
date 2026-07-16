# Correlation-ID-Driven Troubleshooting Skill

Use this skill when debugging production issues, tracing errors across client and server, or investigating incidents using correlation IDs. Provides a step-by-step methodology for tracing a single request from browser through API to database.

---

## Architecture Quick Reference

```
Browser (client)                       API server
─────────────────                      ──────────────
corr-CL-{tenantKey}-{nanoid}           corr-{tenantKey}-{nanoid}
  │                                      │
  ├─ sessionStorage                      ├─ req.ctx.correlationId
  ├─ vs_correlation_tenant_key           ├─ X-Correlation-Id header (resp)
  ├─ x-correlation-id header (out)       ├─ logger.error/warn/info/debug()
  ├─ clientLogger.error()                ├─ DatabaseTransport → application_error_log
  ├─ error-reporter.ts → POST            ├─ SentryTransport → Sentry
  │   /api/client-errors                 ├─ FileTransport → logs/app-YYYY-MM-DD.log
  │                                      └─ ConsoleTransport → stdout
  │
  └─ Server adopts or overrides client ID via response header
```

### Where correlation IDs appear

| Source | Location | How to access |
|--------|----------|---------------|
| Browser sessionStorage | `vs_correlation_id` key | DevTools → Application → Session Storage |
| Browser sessionStorage | `vs_correlation_tenant_key` key | Stores the tenant key used to scope the client correlation ID |
| HTTP request header | `x-correlation-id` | DevTools → Network → Request Headers |
| HTTP response header | `X-Correlation-Id` | DevTools → Network → Response Headers |
| Server file logs | JSON `correlationId` field | `grep "corr-XXX" logs/app-YYYY-MM-DD.log` |
| Database (`application_error_log`) | `correlation_id` column | `GET /api/admin/errors?correlation_id=corr-XXX` |
| Sentry | `correlation_id` tag | Sentry dashboard → Search by tag |
| Client error reports | `correlation_id` in POST body | `GET /api/admin/errors?service=client` |

### Key source files

- `apps/api/src/context.ts` — Server correlation ID middleware (generates or honors incoming header)
- `apps/api/src/logger.ts` — Server logger with 4 transports (console, file, DB, Sentry)
- `apps/api/src/routes/admin/errors.ts` — Admin error log query API
- `apps/api/src/routes/client-errors.ts` — Client error persistence endpoint
- `apps/web/src/lib/correlation-id.ts` — Client correlation ID generation/storage
- `apps/web/src/lib/client-logger.ts` — Client logger (Sentry + console + backend reporting)
- `apps/web/src/lib/error-reporter.ts` — Batched POST to `/api/client-errors`
- `apps/web/src/providers/base/FlexibleApiSingleton.ts` — Injects correlation ID header on all fetch calls

---

## Step 0: Obtain a Correlation ID

### Option A: From a user report

Ask the user to open DevTools (F12) → **Application** → **Session Storage** → site URL → copy the `vs_correlation_id` value (e.g., `corr-CL-A3K9-x7y2z9k4`).

### Option B: From browser DevTools Network tab

1. Open DevTools → **Network** tab
2. Reproduce the issue
3. Click any failed API request
4. Check **Request Headers** for `x-correlation-id`
5. Check **Response Headers** for `X-Correlation-Id` (server-authoritative version)

### Option C: From the admin error log API

```bash
# Recent unresolved errors
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.example.com/api/admin/errors?resolved=false&limit=20"

# Filter by tenant
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.example.com/api/admin/errors?tenant_id=tid-xxx&limit=20"

# Filter by date range
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.example.com/api/admin/errors?from=2026-06-23T00:00:00Z&to=2026-06-23T23:59:59Z&limit=50"
```

Pick a `correlation_id` from the results.

### Option D: From server file logs

```bash
# Recent error-level entries (level 0 = ERROR)
grep '"level":0' logs/app-2026-06-23.log | tail -20

# Search by tenant
grep '"tenantId":"tid-xxx"' logs/app-2026-06-23.log | tail -20
```

Extract the `correlationId` field from any matching JSON log line.

### Option E: From Sentry

Go to Sentry dashboard → filter by `correlation_id` tag or `tenant_id` tag → copy the tag value from a recent event.

---

## Step 1: Query the Database Error Log

Start here once you have a correlation ID. The `application_error_log` table is the central persistent store — both server and client errors land here.

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.example.com/api/admin/errors?correlation_id=corr-A3K9-x7y2z9k4&limit=100"
```

### What to look for

```json
{
  "errors": [{
    "id": "uuid",
    "occurred_at": "2026-06-23T12:00:00Z",
    "level": "error",
    "message": "Failed to sync inventory",
    "error_name": "PrismaClientKnownRequestError",
    "tenant_id": "tid-fjwr30ib",
    "user_id": "auth0|xxx",
    "request_method": "POST",
    "request_path": "/api/tenant/tid-fjwr30ib/inventory/sync",
    "status_code": 500,
    "correlation_id": "corr-A3K9-x7y2z9k4",
    "service": "client",
    "resolved": false
  }],
  "pagination": { "page": 1, "limit": 100, "total": 3, "totalPages": 1 }
}
```

**Key fields:**
- **`service`**: `"client"` = browser-reported, `null` = server-side
- **`request_method` + `request_path`**: which endpoint failed (`"CLIENT"` = client-only error)
- **`status_code`**: HTTP status (500 = server error, 4xx = client error)
- **`error_name`**: exception class for identifying failure type
- **`occurred_at`**: timestamp for timeline building

### Get full detail (stack trace + context)

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.example.com/api/admin/errors/{ERROR_ID}"
```

Returns full record: `stack_trace`, `context` JSON (IP, user agent, duration, custom fields), `sentry_event_id`.

### Interpret multiple errors with the same correlation ID

Multiple errors = **causal chain**:
1. Earliest by `occurred_at` is usually the **root cause**
2. Subsequent errors are **cascading failures** (DB error → API 500 → client error report)
3. Sort by `occurred_at` ascending to build the timeline

---

## Step 2: Search Server File Logs

File logs contain **all levels** (INFO, WARN, ERROR, DEBUG) — the full request lifecycle, not just failures.

```bash
# All entries for this correlation ID
grep "corr-A3K9-x7y2z9k4" logs/app-2026-06-23.log

# Pretty-print JSON lines
grep "corr-A3K9-x7y2z9k4" logs/app-2026-06-23.log | jq .

# Errors only (level 0)
grep "corr-A3K9-x7y2z9k4" logs/app-2026-06-23.log | grep '"level":0'

# Warnings and above (levels 0-1)
grep "corr-A3K9-x7y2z9k4" logs/app-2026-06-23.log | grep -E '"level":[01]'

# Multi-day search
grep "corr-A3K9-x7y2z9k4" logs/app-2026-06-2*.log
```

### Build a request timeline

Sort grep output by `timestamp` to reconstruct the flow:

1. **Request received** — `requestLogger` logs `Request: {METHOD} {PATH}`
2. **Processing** — `logger.info/debug` calls in route handlers or services
3. **Warning signs** — `logger.warn` entries (degraded behavior, retries, fallbacks)
4. **Error** — `logger.error` entry with stack trace
5. **Response sent** — `requestLogger` logs `Response: {METHOD} {PATH} {STATUS} {duration}ms`

The `duration` field tells you end-to-end request time.

---

## Step 3: Check Client-Side Errors

Client errors are in the same `application_error_log` table with `service='client'`.

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.example.com/api/admin/errors?correlation_id=corr-A3K9-x7y2z9k4&service=client"
```

### What client errors tell you

- **React component crashes** — caught by `ErrorBoundary`, reported via `clientLogger.error()`
- **Unhandled promise rejections** — caught by `GlobalErrorHandler` window listener
- **Uncaught exceptions** — caught by `window.onerror` handler
- **API call failures** — `FlexibleApiSingleton` fetch failures

Client error context includes: `url` (page URL), `user_agent`, `client_timestamp`, `stack_trace`.

### Stack trace quality

Client error `stack_trace` values contain the **real error location** (not the logger internals) because all error capture surfaces (`GlobalErrorHandler`, `ErrorBoundary`, `global-error.tsx`) pass the original `Error` object to `clientLogger.error()`. In production, stack traces are minified — Sentry de-minifies them using source maps uploaded during build (see `structured-logging.md` → Sentry config notes).

### Correlating client and server errors

- **Both client + server errors with same ID**: server error is likely root cause; client error is downstream symptom
- **Only client error**: may be purely client-side (React crash, JS error) or API call failed before reaching server (network, CORS, timeout)
- Check `context.url` to see which page triggered it

---

## Step 4: Cross-Reference Sentry

If `SENTRY_DSN` is configured, all ERROR-level logs are forwarded to Sentry with `correlation_id` as a tag.

1. Go to Sentry dashboard
2. Search by tag: `correlation_id:corr-A3K9-x7y2z9k4`
3. Sentry provides **breadcrumbs** — events leading up to the error (HTTP calls, console messages, DOM clicks)
4. Cross-reference using `sentry_event_id` from the database error record

### Sentry vs database: what each gives you

| Source | Strength | Limitation |
|--------|----------|------------|
| Database (`application_error_log`) | Queryable by tenant, date, level, service; persistent | Only ERROR-level; no breadcrumbs |
| Sentry | Breadcrumbs, release tracking, user impact, replay | Rate-limited sampling; retained per Sentry plan |
| File logs | All log levels; full request lifecycle | Ephemeral on container restart; manual grep |

---

## Step 5: Check Error Stats for Patterns

Use the stats endpoint to see if this is an isolated incident or part of a pattern.

```bash
# Last 7 days summary
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.example.com/api/admin/errors/stats?days=7"

# Last 30 days
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.example.com/api/admin/errors/stats?days=30"
```

Returns counts by level, service, and tenant. Use to answer:
- Is this tenant producing more errors than usual?
- Is this service (`error_name` or `request_path`) a repeat offender?
- Are error rates spiking after a recent deploy?

---

## Step 6: Resolve and Document

Once root cause is identified and fixed:

```bash
# Mark the error as resolved
curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.example.com/api/admin/errors/{ERROR_ID}/resolve"
```

This sets `resolved=true`, `resolved_at=now()`, and `resolved_by=<admin_user_id>`. Resolved errors are purged after 90 days; unresolved after 180 days.

---

## Troubleshooting Scenarios

### Scenario A: API returns 500 to a tenant

1. Get correlation ID from the user (Step 0, Option A or B)
2. Query DB: `GET /api/admin/errors?correlation_id=corr-XXX`
3. Get full detail: `GET /api/admin/errors/{id}` — read `stack_trace`
4. Grep file logs for the full request lifecycle (Step 2)
5. Check if it's a recurring pattern: `GET /api/admin/errors?tenant_id=tid-xxx&level=error&from=2026-06-20`
6. Fix root cause, deploy, then resolve the error (Step 6)

### Scenario B: User reports broken page (no API error)

1. Get correlation ID from sessionStorage (Step 0, Option A)
2. Query DB for client errors: `GET /api/admin/errors?correlation_id=corr-XXX&service=client`
3. Read `stack_trace` and `context.url` to identify the React component or JS error
4. Check Sentry for breadcrumbs leading up to the crash
5. If no DB results: the error may not have reached the backend (rate-limited or deduplicated). Check Sentry directly.

### Scenario C: Webhook or background job failure

1. Background jobs may not have a client-side correlation ID. Search by tenant or date:
   `GET /api/admin/errors?tenant_id=tid-xxx&from=2026-06-23T00:00:00Z&to=2026-06-23T23:59:59Z`
2. Grep file logs for the job name or service:
   `grep "inventory_sync" logs/app-2026-06-23.log | grep '"level":0'`
3. Check if the job logs a correlation ID — if it was triggered from a request, the ID propagates:
   ```typescript
   logger.info('Sync job queued', tenantId, {
     correlationId: req.ctx?.correlationId,
     jobId: queuedJobId,
   });
   ```
4. Use the correlation ID from the job log to trace back to the originating request

### Scenario D: Intermittent failures (flaky errors)

1. Query stats: `GET /api/admin/errors/stats?days=30` — check if error count is trending
2. Query by error_name: `GET /api/admin/errors?level=error&from=2026-06-01` — look for same `error_name` recurring
3. Collect multiple correlation IDs for the same error — grep each in file logs
4. Compare timelines: are they all hitting the same endpoint? Same time of day? Same tenant?
5. Check for patterns: rate limiting, connection pool exhaustion, external API throttling

### Scenario E: Performance degradation (slow but successful)

1. These won't appear in `application_error_log` (only ERROR-level is persisted)
2. Grep file logs for the correlation ID — look at `duration` in the response log
3. Check for WARN-level entries: retries, timeouts, fallbacks
4. Compare with normal request durations for the same endpoint
5. Look for `logger.debug` entries if `LOG_LEVEL=debug` was set

---

## Common Pitfalls

- **Client ID vs server ID**: The client generates `corr-CL-{tenantKey}-{nanoid}` when a tenant context is available, or `corr-CL-{nanoid}` when no tenant is known. The server may override it with `corr-{tenantKey}-{nanoid}` via the `X-Correlation-Id` response header. Always use the **server's** ID when searching server logs and DB — it's the authoritative one.
- **Tenant-scoped IDs regenerate on tenant change**: `getOrCreateCorrelationId(tenantId)` stores the tenant key in `vs_correlation_tenant_key`. If the user switches tenants and the stored key differs, the client generates a new correlation ID with the new tenant key.
- **Rate-limited client errors**: The client drops errors exceeding 10/min. If a user reports an issue but no client error appears in the DB, it may have been rate-limited. Check Sentry as a fallback.
- **Deduplicated errors**: Same message + stack hash within 60s is deduplicated on the client. Check Sentry for the original event.
- **sessionStorage cleared on logout**: `clearCorrelationId()` is called on logout. If a user logs out and back in, they get a new correlation ID — the old one won't trace subsequent requests.
- **Background jobs without correlation ID**: Jobs triggered by cron (not by a request) won't have a correlation ID unless the job code explicitly generates one. Search by tenant or service name instead.
- **File logs on container restart**: If the API runs in a container, file logs may be lost on restart. The database is the persistent source of truth for errors.
- **Minified client stack traces**: In production, client `stack_trace` values are minified (e.g., `at o.aW (chunk-abc.js:1:2345)`). Sentry de-minifies these using source maps uploaded during build. The admin error log API returns the raw minified stack — use Sentry's UI or the `sentry_event_id` cross-reference for readable traces. Source map upload requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` env vars at build time.

---

## Quick Command Reference

```bash
# === Database queries ===
# By correlation ID
curl -H "Auth: Bearer X" "api/admin/errors?correlation_id=corr-XXX&limit=100"
# By tenant
curl -H "Auth: Bearer X" "api/admin/errors?tenant_id=tid-xxx&limit=50"
# By service (client vs server)
curl -H "Auth: Bearer X" "api/admin/errors?service=client&limit=50"
# Unresolved only
curl -H "Auth: Bearer X" "api/admin/errors?resolved=false&limit=50"
# Full detail
curl -H "Auth: Bearer X" "api/admin/errors/{id}"
# Stats
curl -H "Auth: Bearer X" "api/admin/errors/stats?days=7"
# Resolve
curl -X POST -H "Auth: Bearer X" "api/admin/errors/{id}/resolve"

# === File log searches ===
grep "corr-XXX" logs/app-YYYY-MM-DD.log          # all entries
grep "corr-XXX" logs/app-YYYY-MM-DD.log | jq .   # pretty-print
grep "corr-XXX" logs/app-YYYY-MM-DD.log | grep '"level":0'  # errors only

# === Sentry ===
# Search by tag: correlation_id:corr-XXX
# Search by tag: tenant_id:tid-xxx
```

---

## Related Documents

- `.devin/skills/structured-logging.md` — How to write structured logs (developer guide)
- `docs/LOGGING_AUDIT.md` — Backend logging architecture audit
- `docs/FRONTEND_LOGGING_AUDIT.md` — Frontend logging architecture audit
- `apps/api/observability/README.md` — Full observability architecture documentation
