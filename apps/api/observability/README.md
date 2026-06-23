# Observability Setup

**REQ:** REQ-2025-904 (Observability tags and dashboards)

## Overview

This directory contains observability scaffolding for multi-region monitoring:
- **Dashboards:** Grafana/Datadog JSON definitions
- **Alerts:** Placeholder alert configurations (disabled by default)

## Current State

- **Region tagging:** All requests tagged with `region` from `tenant.region` (default: `us-east-1`)
- **Tenant tagging:** Requests tagged with `tenant_id` when available
- **Correlation IDs:** Every request gets a tenant-scoped `corr-{tk|GLBL}-{nanoid}` ID via `generateCorrelationId()` from `id-generator.ts`. Propagated via `X-Correlation-Id` response header.
- **Structured Logger:** `logger.ts` with 4 transports (console, file, database, Sentry)
- **Error Persistence:** `application_error_log` PostgreSQL table stores ERROR-level entries with tenant context, stack traces, and Sentry cross-references
- **Automated Purge:** Daily job at 2 AM UTC purges resolved errors >90 days, unresolved >180 days, file logs >30 days
- **Admin API:** `GET /api/admin/errors` for browsing, filtering, and resolving persisted errors
- **Dashboards:** Placeholder panel for "Latency by Region" (single bucket expected)

## Architecture

### Logger Transports

| Transport | Level | Purpose | Config |
|-----------|-------|---------|--------|
| Console | All | Colorized in dev, JSON in prod | Always on |
| File | All | Async writes via `fs.createWriteStream` | `LOG_DIR` (default `./logs`) |
| Database | ERROR | Persist to `application_error_log` | `LOG_DB_ENABLED` or auto in production |
| Sentry | ERROR | Forward to Sentry with tenant/correlation scope | `SENTRY_DSN` |

### Correlation ID Flow

```
Request → context.ts middleware
  ├─ Extract tenantId from query/body/params
  ├─ Generate corr-{tenantKey}-{nanoid} via generateCorrelationId(tenantId)
  │   (or honor incoming x-correlation-id header for distributed tracing)
  ├─ Set X-Correlation-Id response header
  └─ Attach to req.ctx.correlationId

Logger → all transports include correlation_id in output
  ├─ Console: JSON field
  ├─ File: JSON field
  ├─ Database: correlation_id column
  └─ Sentry: tag
```

### Process Error Handlers

- `uncaughtException` — logs to all transports, then exits with code 1
- `unhandledRejection` — logs to all transports, does not crash

### Log Purge Job

- **Schedule:** Daily at 2 AM UTC
- **DB:** Resolved errors >90 days deleted, unresolved >180 days deleted
- **Files:** `.log`/`.bak` files in `LOG_DIR` older than `LOG_RETENTION_DAYS` (default 30) deleted
- **Config:** `LOG_RETENTION_DAYS` env var

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Minimum log level (debug, info, warn, error) |
| `LOG_DIR` | `./logs` | File log directory |
| `LOG_DB_ENABLED` | `false` | Force-enable DB error logging in dev (auto in production) |
| `LOG_RETENTION_DAYS` | `30` | File log retention in days |
| `SENTRY_DSN` | — | Sentry error tracking DSN |
| `SENTRY_ENVIRONMENT` | `NODE_ENV` | Sentry environment label |
| `SENTRY_API_TOKEN` | — | Sentry API token for admin dashboard |
| `SENTRY_ORG_SLUG` | — | Sentry organization slug |
| `NEW_RELIC_LICENSE_KEY` | — | New Relic APM license key |
| `NEW_RELIC_APP_NAME` | — | New Relic app name |

## Admin API

### Error Log Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/errors` | Paginated list (filters: tenant_id, level, service, resolved, from, to, correlation_id) |
| GET | `/api/admin/errors/stats` | Aggregate stats (by level, service, tenant; default 7 days) |
| GET | `/api/admin/errors/:id` | Full error detail with stack trace and context |
| POST | `/api/admin/errors/:id/resolve` | Mark error as resolved |

### Sentry Endpoints

Existing routes at `/api/admin/sentry` fetch Sentry project/issue data via Sentry API.

## Setup

### 1. Logger Integration

The `logger.ts` module tags logs with:
```json
{
  "timestamp": "2025-01-21T12:00:00.000Z",
  "level": "info",
  "message": "request_completed",
  "tenant_id": "demo-tenant",
  "region": "us-east-1",
  "correlation_id": "corr-A3K9-x7y2z9k4",
  "method": "GET",
  "path": "/items"
}
```

### 2. APM Integration

New Relic is configured via `newrelic.ts` and activated when `NEW_RELIC_LICENSE_KEY` is set. Custom attributes include `tenant_id` and `region`.

### 3. Dashboard Import

Import `dashboards/latency-by-region.json` into Grafana:
1. Go to Dashboards → Import
2. Upload JSON file
3. Select Prometheus datasource
4. Save dashboard

## Metrics to Collect

For full observability, instrument your app to expose:

- `http_request_duration_seconds_bucket{region, tenant_id, method, path, status}`
- `http_requests_total{region, tenant_id, method, path, status}`
- `http_request_size_bytes{region, tenant_id}`
- `http_response_size_bytes{region, tenant_id}`

## Alert Thresholds (Disabled by Default)

- **High Latency:** p95 > 2s for 5 minutes
- **High Error Rate:** 5xx rate > 5% for 5 minutes
- **Feed Success Rate:** < 90% for 30 minutes (placeholder)

## File References

- `apps/api/src/logger.ts` — Structured logger with 4 transports
- `apps/api/src/context.ts` — Request context middleware with correlation ID
- `apps/api/src/jobs/log-purge.ts` — Daily log purge job
- `apps/api/src/routes/admin/errors.ts` — Admin error log API
- `apps/api/src/routes/admin/sentry.ts` — Admin Sentry monitoring API
- `apps/api/src/newrelic.ts` — New Relic APM configuration
- `apps/api/prisma/schema.prisma` — `application_error_log` model
- `database/migrations/051_application_error_log.sql` — Error log table migration
- `docs/LOGGING_AUDIT.md` — Full logging strategy audit

## Next Steps

1. Deploy APM agent (Datadog, New Relic, etc.)
2. Configure log aggregation (Loki, CloudWatch, etc.)
3. Enable alerts and configure notification channels
4. Add custom metrics for business KPIs (feed success rate, photo upload success, etc.)
5. Incrementally migrate remaining `console.*` calls to `logger.*` (see LOGGING_AUDIT.md Phase 5)
