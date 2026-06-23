# Structured Logging Skill

Use this skill when writing or reviewing code that logs errors, warnings, or operational messages — on either the backend (server logger) or frontend (client logger). Ensures all logging goes through the centralized structured logger with proper correlation IDs, context, and error persistence.

---

## Quick Reference

### Import the logger

```typescript
import { logger } from '../logger';
// or from the root:
import { logger } from './logger';
```

### Log levels — when to use each

| Level | Use for | Persisted to DB? | Sent to Sentry? |
|-------|---------|-------------------|-----------------|
| `logger.error()` | Unhandled failures, exceptions, broken flows | Yes (production) | Yes (production) |
| `logger.warn()` | Degraded behavior, rate limits, retries, fallbacks | No | No |
| `logger.info()` | Startup, shutdown, job status, lifecycle events | No | No |
| `logger.debug()` | Verbose diagnostics (dev only) | No | No |

### Basic usage

```typescript
// Simple message
logger.info('Server started on port 4000');
logger.warn('Rate limit exceeded for IP 1.2.3.4');

// With tenant context
logger.error('Failed to sync inventory', tenantId, {
  error: { name: err.name, message: err.message, stack: err.stack },
});

// With extra context (appears in JSON output, DB context column, Sentry tags)
logger.error('Stripe webhook failed', tenantId, {
  error: { name: err.name, message: err.message, stack: err.stack },
  webhookId: 'evt_123',
  eventType: 'payment_intent.payment_failed',
});
```

### Error logging pattern in catch blocks

```typescript
try {
  await someOperation();
} catch (error: any) {
  logger.error('Descriptive message about what failed', tenantId, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    // Include any relevant context that would help debugging
    itemId: req.params.id,
    operation: 'inventory_sync',
  });
  res.status(500).json({ error: 'internal_error' });
}
```

### Error logging without tenant context (platform-level)

```typescript
try {
  await startScheduledJob();
} catch (error: any) {
  logger.error('Job failed to start', undefined, {
    error: {
      name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
  });
}
```

---

## Correlation IDs

Every request automatically gets a tenant-scoped correlation ID via `context.ts` middleware. The format is `corr-{tenantKey}-{nanoid}` (e.g., `corr-A3K9-x7y2z9k4`).

### How it works

1. `setRequestContext` middleware generates the ID (or honors incoming `x-correlation-id` header)
2. ID is attached to `req.ctx.correlationId`
3. ID is set on the `X-Correlation-Id` response header
4. `requestLogger` middleware logs every request with the correlation ID
5. All `logger.*` calls within a request automatically include the correlation ID

### Using correlation IDs for debugging

```bash
# Find all logs for a specific request
grep "corr-A3K9-x7y2z9k4" logs/app-2026-06-23.log

# Find all errors for a tenant in the DB
curl /api/admin/errors?correlation_id=corr-A3K9-x7y2z9k4

# Find all errors for a tenant
curl /api/admin/errors?tenant_id=tid-fjwr30ib
```

### Passing correlation ID to background jobs

When a job is triggered from a request, pass the correlation ID so logs can be traced across the request and the job:

```typescript
logger.info('Sync job queued', tenantId, {
  correlationId: req.ctx?.correlationId,
  jobId: queuedJobId,
});
```

---

## What NOT to do

### Don't use console.* in new code

```typescript
// ❌ Bad — ephemeral, not persisted, no correlation ID, no Sentry
console.error('Failed to process payment', error);
console.log('Job completed successfully');

// ✅ Good — structured, persisted, correlated, forwarded to Sentry
logger.error('Failed to process payment', tenantId, {
  error: { name: error.name, message: error.message, stack: error.stack },
});
logger.info('Job completed successfully', tenantId);
```

### Don't log sensitive data

```typescript
// ❌ Bad
logger.info('User logged in', tenantId, {
  password: user.passwordHash,  // never log secrets
  authToken: token,             // never log tokens
});

// ✅ Good
logger.info('User logged in', tenantId, {
  userId: user.id,
  email: user.email,
});
```

### Don't swallow errors silently

```typescript
// ❌ Bad — error is caught but never logged
try {
  await riskyOperation();
} catch (e) {
  // silently ignored
}

// ✅ Good — error is logged with context
try {
  await riskyOperation();
} catch (error: any) {
  logger.error('riskyOperation failed', tenantId, {
    error: { name: error.name, message: error.message, stack: error.stack },
  });
}
```

### Don't use logger for high-volume request logging

The `requestLogger` middleware already logs every request. Don't add `logger.info()` at the top of every route handler — it creates duplicate entries.

---

## Admin API Reference

### List errors

```
GET /api/admin/errors?page=1&limit=50&tenant_id=tid-xxx&level=error&resolved=false&from=2026-06-01&to=2026-06-23
```

Response:
```json
{
  "errors": [
    {
      "id": "uuid",
      "occurred_at": "2026-06-23T12:00:00Z",
      "level": "error",
      "message": "Failed to sync inventory",
      "error_name": "PrismaClientKnownRequestError",
      "tenant_id": "tid-fjwr30ib",
      "correlation_id": "corr-A3K9-x7y2z9k4",
      "service": null,
      "resolved": false
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 127, "totalPages": 3 }
}
```

### Get error detail

```
GET /api/admin/errors/:id
```

Returns full error including `stack_trace`, `context` JSON, `request_method`, `request_path`, `status_code`, `sentry_event_id`.

### Get stats

```
GET /api/admin/errors/stats?days=7
```

Returns aggregate counts by level, service, and tenant.

### Resolve an error

```
POST /api/admin/errors/:id/resolve
```

Marks the error as resolved with the admin user's ID.

---

## Architecture Overview

### Logger transports

| Transport | Level | Purpose | Config |
|-----------|-------|---------|--------|
| Console | All | Colorized in dev, JSON in prod | Always on |
| File | All | Async writes via `fs.createWriteStream` | `LOG_DIR` (default `./logs`) |
| Database | ERROR | Persist to `application_error_log` table | Auto in production, `LOG_DB_ENABLED=true` in dev |
| Sentry | ERROR | Forward to Sentry with tenant/correlation scope | `SENTRY_DSN` |

### Error persistence

ERROR-level logs are written to the `application_error_log` PostgreSQL table with:
- `tenant_id`, `user_id`, `correlation_id` for traceability
- `stack_trace`, `error_name` for debugging
- `request_method`, `request_path`, `status_code` for request context
- `context` JSON for arbitrary metadata
- `sentry_event_id` for cross-referencing Sentry
- `resolved` flag for triage workflow

Writes are fire-and-forget via `setImmediate()` — never blocks the event loop.

### Automated purge

A scheduled job runs daily at 2 AM UTC:
- Resolved DB errors older than 90 days: deleted
- Unresolved DB errors older than 180 days: deleted
- File logs older than `LOG_RETENTION_DAYS` (default 30): deleted

### Process error handlers

- `uncaughtException` — logged to all transports, then `process.exit(1)`
- `unhandledRejection` — logged to all transports, process continues

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Minimum log level (debug, info, warn, error) |
| `LOG_DIR` | `./logs` | File log directory |
| `LOG_DB_ENABLED` | `false` | Force-enable DB error logging in dev |
| `LOG_RETENTION_DAYS` | `30` | File log retention in days |
| `SENTRY_DSN` | — | Sentry DSN (enables Sentry transport) |
| `SENTRY_ENVIRONMENT` | `NODE_ENV` | Sentry environment label |

---

## File References

- `apps/api/src/logger.ts` — Logger implementation with 4 transports
- `apps/api/src/context.ts` — Request context + correlation ID middleware
- `apps/api/src/jobs/log-purge.ts` — Daily log purge job
- `apps/api/src/routes/admin/errors.ts` — Admin error log API
- `apps/api/prisma/schema.prisma` — `application_error_log` model
- `database/migrations/051_application_error_log.sql` — Error log table migration
- `apps/api/observability/README.md` — Full architecture documentation
- `docs/LOGGING_AUDIT.md` — Original audit and strategy document

---

## Migration Guide: console.* → logger.*

When refactoring existing code, follow this mapping:

| console.* | logger.* | Notes |
|-----------|----------|-------|
| `console.log('✅ Started')` | `logger.info('Started')` | Drop emoji, logger adds timestamp |
| `console.error('Failed:', err)` | `logger.error('Failed', tenantId, { error: { name: err.name, message: err.message, stack: err.stack } })` | Add tenant context when available |
| `console.warn('Deprecated')` | `logger.warn('Deprecated')` | Direct mapping |
| `console.log(JSON.stringify({...}))` | `logger.info('Event name', tenantId, { ...fields })` | Pass object directly, not stringified |

### Priority order for migration

1. `index.ts` startup/shutdown/error handlers (done in P1)
2. Route file catch blocks (incremental)
3. Service file error handling (incremental)
4. Job files (incremental)

### When it's OK to keep console.*

- `console.*` in test files (test runners capture console output differently)
- `console.*` in scripts/ that run outside the API server process
- `console.*` in the logger.ts itself (to avoid circular dependency)

---

## Frontend Logging

The frontend has a parallel logging stack that mirrors the backend: structured logger, correlation IDs, Sentry integration, and backend persistence via batched POST.

### Import the client logger

```typescript
import { clientLogger } from '@/lib/client-logger';
```

### Client log levels

| Level | Use for | Sentry? | Backend DB? | Console? |
|-------|---------|---------|-------------|----------|
| `clientLogger.error()` | Unhandled failures, broken flows | Yes | Yes (batched) | Yes |
| `clientLogger.warn()` | Degraded behavior, fallbacks | Yes (warning) | No | Yes |
| `clientLogger.info()` | Lifecycle events, user actions | No | No | Dev only |
| `clientLogger.debug()` | Verbose diagnostics | No | No | Dev only |

### Basic usage

```typescript
// Simple error
clientLogger.error('Payment failed', { orderId: '123' });

// Warning with context
clientLogger.warn('Rate limit approaching', { endpoint: '/api/products' });

// Info (dev console only)
clientLogger.info('User logged in');

// Debug (dev console only)
clientLogger.debug('Cache hit', { key: 'product-123' });
```

### Error logging in catch blocks

```typescript
try {
  await fetchOrder(orderId);
} catch (error) {
  clientLogger.error(`Failed to fetch order ${orderId}`, {
    error: error instanceof Error ? error.message : String(error),
  });
}
```

### Setting tenant/user context

Tenant and user IDs are automatically synced from `AuthContext` — no manual setup needed. They flow to Sentry tags and backend error reports.

```typescript
// These are called automatically by AuthContext:
clientLogger.setTenantId(currentTenantId);
clientLogger.setUserId(user?.id);

// On logout, context is cleared:
clientLogger.setTenantId(undefined);
clientLogger.setUserId(undefined);
```

---

## Correlation ID Flow (Client ↔ Server)

Correlation IDs propagate bidirectionally between client and server:

```
Client (browser)                        Server (API)
─────────────────                       ──────────────
1. getOrCreateCorrelationId()
   → corr-CL-{nanoid}
   stored in sessionStorage

2. fetch(url, {
     headers: { x-correlation-id: corr-CL-... }
   })
                          ──────►      3. setRequestContext middleware
                                        honors x-correlation-id header
                                        or generates new corr-{tenant}-{nanoid}

                                        4. All logger.* calls include
                                           correlation ID automatically

                          ◄──────      5. Response header:
                                           X-Correlation-Id: corr-{tenant}-...

6. setCorrelationId(serverId)
   adopts server's ID as
   authoritative for
   subsequent requests
```

### Key points

- **Client generates initial ID** (`corr-CL-{nanoid}`) on first API call
- **Server is authoritative** — if server returns `X-Correlation-Id`, client adopts it
- **ID persists in sessionStorage** across page navigations within the same tab
- **ID is cleared on logout** to prevent cross-user correlation
- **All `FlexibleApiSingleton` fetch calls** automatically inject the header — no manual setup needed

### Tracing across client and server

```bash
# Find client-reported errors with a correlation ID
curl /api/admin/errors?correlation_id=corr-A3K9-x7y2z9k4

# Client errors have service='client' in the DB
curl /api/admin/errors?service=client

# Cross-reference: same correlation ID appears in:
# 1. Client console (JSON in production)
# 2. Sentry (tag: correlation_id)
# 3. application_error_log (column: correlation_id)
# 4. Server file logs (grep corr-xxx)
```

---

## Frontend Error Reporting

### How client errors reach the backend

1. `clientLogger.error()` queues the error via `error-reporter.ts`
2. Errors are batched (max 10) and flushed every 5 seconds
3. `POST /api/client-errors` persists them to `application_error_log`
4. On page unload, `navigator.sendBeacon` ensures delivery

### Rate limiting & deduplication

- **Client-side**: max 10 errors/min, duplicate messages within 60s are dropped
- **Server-side**: max 10 errors/min per IP, batch cap of 20

### Global error handlers

`GlobalErrorHandler` component (mounted in `ClientRootLayout`) captures:
- `window.onerror` — uncaught errors
- `unhandledrejection` — unhandled promise rejections
- `beforeunload` — flushes pending error reports

`ErrorBoundary` and `global-error.tsx` route errors through `clientLogger.error()`.

---

## Frontend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | — | Sentry DSN for client-side error tracking (empty = disabled) |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `NODE_ENV` | Sentry environment label |
| `NEXT_PUBLIC_LOG_LEVEL` | `info` | Minimum client log level (debug, info, warn, error) |
| `NEXT_PUBLIC_API_URL` | — | API base URL (used by error reporter) |

### Sentry config notes

- Sentry is **disabled in development** to avoid noise and quota usage
- `sendDefaultPii` is `false` — no user PII sent to Sentry by default
- `tracesSampleRate` is `0.1` (10%) — matches server/edge configs
- `instrumentation-client.ts` is the single source of truth (legacy `sentry.client.config.ts` removed)

---

## Frontend File References

- `apps/web/src/lib/client-logger.ts` — Client logger (Sentry + console + error reporter)
- `apps/web/src/lib/correlation-id.ts` — Correlation ID generation, sessionStorage, header constants
- `apps/web/src/lib/error-reporter.ts` — Batched POST to `/api/client-errors` with rate limiting
- `apps/web/src/instrumentation-client.ts` — Sentry client initialization
- `apps/web/src/components/GlobalErrorHandler.tsx` — window.onerror + unhandledrejection handlers
- `apps/web/src/components/ErrorBoundary.tsx` — React error boundary (uses clientLogger)
- `apps/web/src/app/global-error.tsx` — Next.js global error page (uses clientLogger)
- `apps/web/src/contexts/AuthContext.tsx` — Syncs tenant/user IDs to clientLogger
- `apps/web/src/providers/base/FlexibleApiSingleton.ts` — Injects correlation ID header on all fetch calls
- `apps/api/src/routes/client-errors.ts` — POST endpoint for client error persistence
