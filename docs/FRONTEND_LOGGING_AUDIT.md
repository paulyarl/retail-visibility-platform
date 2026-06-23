# Frontend Logging Architecture Audit

**Date:** 2026-06-23
**Scope:** `apps/web/src` — all client-side and server-side logging, error tracking, and observability infrastructure
**Status:** Audit complete — implementation phased plan below

---

## Executive Summary

The frontend has **Sentry configured** across client, server, and edge runtimes, but the integration is **incomplete and inconsistent**. **6,347 `console.*` calls across 869 files** dominate the codebase with ephemeral output. The `ErrorBoundary` component catches React errors but logs them via `console.error` instead of `Sentry.captureException`. The `instrumentation-client.ts` file has a **hardcoded Sentry DSN** instead of using an environment variable. There is **no correlation ID propagation** between client and API — the backend generates tenant-scoped correlation IDs, but the frontend never sends or receives them. There is **no mechanism to persist client-side errors** to the backend `application_error_log` table.

---

## Current Inventory

### 1. Sentry (`@sentry/nextjs`)

**Client config:** `apps/web/sentry.client.config.ts`
- Uses `NEXT_PUBLIC_SENTRY_DSN` env var (correct)
- Disabled in development via `NODE_ENV` check
- `tracesSampleRate: 0.1` (10% performance sampling)
- `replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0`
- Filters browser extension errors in `beforeSend`
- Ignores common noise errors (ResizeObserver, NetworkError, etc.)

**Server config:** `apps/web/sentry.server.config.ts`
- Uses `NEXT_PUBLIC_SENTRY_DSN` env var
- Disabled in development
- `tracesSampleRate: 0.1`

**Edge config:** `apps/web/sentry.edge.config.ts`
- Uses `NEXT_PUBLIC_SENTRY_DSN` env var
- Disabled in development

**Instrumentation:** `apps/web/src/instrumentation.ts`
- Registers server config for Node.js runtime
- Registers edge config for Edge runtime
- `onRequestError = Sentry.captureRequestError` — captures Next.js request errors

**Instrumentation client:** `apps/web/src/instrumentation-client.ts`
- **HARDCODED DSN** — `https://288a1838ecf20ccbfce55e51644b212b@o4510592047513600.ingest.us.sentry.io/4510592106430464` instead of using `NEXT_PUBLIC_SENTRY_DSN`
- `tracesSampleRate: 1` (100% — very aggressive, should be 0.1 like other configs)
- `enableLogs: true` — sends logs to Sentry (may increase cost)
- `sendDefaultPii: true` — sends PII to Sentry
- `Sentry.replayIntegration()` enabled
- **Not disabled in development** — will send errors from dev sessions

**Problems:**
- `instrumentation-client.ts` duplicates `sentry.client.config.ts` — both initialize Sentry on the client, potentially causing double initialization
- Hardcoded DSN in `instrumentation-client.ts` is a security risk and prevents environment-specific configuration
- 100% trace sampling in `instrumentation-client.ts` will consume Sentry quota rapidly
- `sendDefaultPii: true` may violate GDPR/CCPA if not explicitly consented

### 2. Error Boundaries

**`apps/web/src/components/ErrorBoundary.tsx`**
- Class component, wraps the entire app in `ClientRootLayout.tsx`
- `getDerivedStateFromError` — filters `Node.removeChild` DOM errors (dev-only noise)
- `componentDidCatch` — uses `console.error('ErrorBoundary caught:', error, errorInfo)` instead of `Sentry.captureException`
- Renders a fallback UI with reload button
- **Does not send errors to Sentry** — defeats the purpose of having Sentry configured

**`apps/web/src/app/global-error.tsx`**
- Next.js App Router global error page
- Correctly calls `Sentry.captureException(error)` in `useEffect`
- Renders a generic error page

### 3. Console Usage

**6,347 `console.*` matches across 869 files** in `apps/web/src`

Top offenders:
- `TenantInfoService.ts` — 153 matches
- `FlexibleApiSingleton.ts` — 91 matches
- `PlatformHomeSingletonService.ts` — 90 matches
- `TenantFeaturedProductsSingleton.ts` — 74 matches
- `cacheManager.ts` — 74 matches
- `UniversalSingleton.ts` — 73 matches

**Pattern:** Most `console.*` calls are in service files and singleton providers for debug logging, cache hit/miss tracking, and error reporting. They are ephemeral and disappear on page refresh.

### 4. Correlation IDs

**Zero correlation ID usage in the frontend.** The backend generates tenant-scoped `corr-{tk|GLBL}-{nanoid}` IDs via `context.ts` middleware and sets them on the `X-Correlation-Id` response header, but the frontend:
- Never reads the `X-Correlation-Id` response header
- Never sends `x-correlation-id` on outgoing API requests
- Has no mechanism to generate or propagate correlation IDs for client-side errors

### 5. Environment Variables

`apps/web/.env.local.example` contains:
- Auth0 configuration
- API URL (`NEXT_PUBLIC_API_URL`)
- Feature flags

**Missing:**
- `NEXT_PUBLIC_SENTRY_DSN` — not documented (used in sentry configs but not in env example)
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT` — not documented
- `NEXT_PUBLIC_LOG_LEVEL` — doesn't exist
- `NEXT_PUBLIC_CORRELATION_ID_ENABLED` — doesn't exist

### 6. Global Error Handlers

**No explicit `window.onerror` or `unhandledrejection` handlers.** Sentry's browser SDK automatically hooks these, so uncaught errors and unhandled promise rejections are captured by Sentry. However, they are not persisted to the backend `application_error_log` table and cannot be browsed via the admin API.

---

## Gap Analysis

| Gap | Impact | Severity |
|-----|--------|----------|
| `ErrorBoundary` doesn't call `Sentry.captureException` | React component errors are invisible to Sentry | High |
| `instrumentation-client.ts` hardcoded DSN | Security risk, prevents env-specific config | High |
| `instrumentation-client.ts` 100% trace sampling | Sentry quota exhaustion in production | High |
| Duplicate Sentry init (client config + instrumentation-client) | Potential double events, confusing config | Medium |
| No correlation ID propagation | Cannot trace a user request from browser → API → DB | High |
| No client error persistence to backend | Client errors invisible to `/api/admin/errors` | Medium |
| 6,347 `console.*` calls | Ephemeral, no persistence, no correlation | Low (incremental) |
| `sendDefaultPii: true` without consent | GDPR/CCPA compliance risk | Medium |
| No `NEXT_PUBLIC_SENTRY_DSN` in env example | New devs can't configure Sentry | Low |

---

## Target Architecture

### Client-Side Logger (`lib/client-logger.ts`)

A thin client-side logger that wraps Sentry and console, with correlation ID support:

```
client-logger.ts
├── error(message, context?)  → Sentry.captureException + console.error + POST /api/client-errors
├── warn(message, context?)   → Sentry.captureMessage (level: warning) + console.warn
├── info(message, context?)   → console.info (dev only)
├── debug(message, context?)  → console.debug (dev only)
└── setCorrelationId(id)      → stores in module-scoped variable, included in all logs
```

### Correlation ID Flow

```
Browser → API request
  ├─ Generate corr-{GLBL}-{nanoid} if no existing ID (stored in sessionStorage)
  ├─ Set x-correlation-id header on fetch/axios
  └─ API response includes X-Correlation-Id (same ID or new one from server)

API response → Browser
  ├─ Read X-Correlation-Id response header
  ├─ Store in sessionStorage for subsequent requests
  └─ Include in error reports to Sentry + backend

Client error → Backend persistence
  ├─ POST /api/client-errors with correlation_id, tenant_id, error details
  └─ Backend writes to application_error_log via prisma
```

### Error Persistence Pipeline

```
Client error (uncaught, ErrorBoundary, or explicit logger.error)
  ├─ Sentry.captureException (immediate, async)
  ├─ console.error (immediate, for devtools)
  └─ POST /api/client-errors (batched, fire-and-forget)
      ├─ Rate limited: max 10 errors / minute / client
      ├─ Deduplicated by message + stack hash
      └─ Written to application_error_log with source='client'
```

---

## Phased Implementation Plan

### Phase 0 (P0): Fix Critical Sentry Issues

**Priority:** P0 — Fix security and quota risks
**Estimated effort:** 0.5 days
**Depends on:** Nothing

**Tasks:**
1. Fix `instrumentation-client.ts`:
   - Replace hardcoded DSN with `NEXT_PUBLIC_SENTRY_DSN` env var
   - Set `tracesSampleRate: 0.1` (match other configs)
   - Disable in development (match other configs)
   - Set `sendDefaultPii: false` (opt-in, not opt-out)
   - Set `enableLogs: false` (reduce Sentry cost)
2. Remove duplicate Sentry initialization — either delete `instrumentation-client.ts` or merge into `sentry.client.config.ts`
3. Fix `ErrorBoundary.tsx`:
   - Import `Sentry` from `@sentry/nextjs`
   - Replace `console.error` with `Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } })`
   - Keep `console.warn` for filtered DOM errors
4. Add `NEXT_PUBLIC_SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_ENVIRONMENT` to `.env.local.example`

**Files to modify:**
- `apps/web/src/instrumentation-client.ts`
- `apps/web/src/components/ErrorBoundary.tsx`
- `apps/web/.env.local.example`

**Acceptance criteria:**
- No hardcoded DSN in any file
- `ErrorBoundary` errors appear in Sentry dashboard
- Dev sessions don't send events to Sentry
- 100% trace sampling eliminated

---

### Phase 1 (P1): Client-Side Logger + Correlation IDs

**Priority:** P1 — Enable structured client logging and request tracing
**Estimated effort:** 1-2 days
**Depends on:** Phase 0

**Tasks:**
1. Create `apps/web/src/lib/client-logger.ts`:
   - `error(message, context?)` — Sentry.captureException + console.error + queue for backend
   - `warn(message, context?)` — Sentry.captureMessage + console.warn
   - `info(message, context?)` — console.info (dev only, gated by `NEXT_PUBLIC_LOG_LEVEL`)
   - `debug(message, context?)` — console.debug (dev only)
   - `setCorrelationId(id)` / `getCorrelationId()` — module-scoped storage
   - `setTenantId(id)` — for tagging Sentry events
   - Batched error reporting: queue errors and flush every 5s or when 10 errors accumulate
   - Rate limiting: max 10 errors/minute/client (drop excess, log to console)
2. Create `apps/web/src/lib/correlation-id.ts`:
   - `getOrCreateCorrelationId()` — read from `sessionStorage`, generate if missing
   - `setCorrelationId(id)` — store in `sessionStorage` (from API response header)
   - `clearCorrelationId()` — on logout
   - Use `crypto.randomUUID()` or nanoid for generation (client-side, no tenant key needed)
   - Format: `corr-CL-{nanoid}` (CL = client, distinguishes from server-generated IDs)
3. Create `apps/web/src/lib/api-client.ts` (or modify existing fetch wrapper):
   - Inject `x-correlation-id` header on every outgoing request
   - Read `X-Correlation-Id` from response headers, update stored correlation ID
   - Works with both `fetch` and any existing API service layer
4. Create `apps/web/src/lib/error-reporter.ts`:
   - `reportError(error, context)` — sends to `POST /api/client-errors`
   - Fire-and-forget with `navigator.sendBeacon` for reliability during page unload
   - Includes: message, stack, correlationId, tenantId, userId, url, userAgent, timestamp
   - Deduplication: skip if same message+stack hash sent in last 60s

**Files to create:**
- `apps/web/src/lib/client-logger.ts`
- `apps/web/src/lib/correlation-id.ts`
- `apps/web/src/lib/error-reporter.ts`

**Files to modify:**
- `apps/web/src/lib/api-client.ts` (or equivalent fetch wrapper / service layer base)
- `apps/web/src/components/ErrorBoundary.tsx` (use client-logger instead of direct Sentry)
- `apps/web/src/components/ClientRootLayout.tsx` (initialize correlation ID + client logger on mount)

**Acceptance criteria:**
- Every API request includes `x-correlation-id` header
- API response `X-Correlation-Id` header is captured and stored
- `ErrorBoundary` errors include correlation ID in Sentry tags
- Client errors are batched and sent to backend (visible in network tab)

---

### Phase 2 (P2): Backend Client Error Endpoint

**Priority:** P2 — Persist client errors to `application_error_log`
**Estimated effort:** 0.5 days
**Depends on:** Phase 1

**Tasks:**
1. Create `apps/api/src/routes/client-errors.ts`:
   - `POST /api/client-errors` — accepts batched error reports from frontend
   - No authentication required (client errors may occur before login)
   - Rate limited: max 10 errors/minute/IP (use existing rate limiting middleware)
   - Writes to `application_error_log` with:
     - `level: 'error'`
     - `source: 'client'` (add to `service` column or extend schema)
     - `tenant_id` (optional, from request body if user is logged in)
     - `user_id` (optional)
     - `correlation_id` (from request body)
     - `request_path` (from request body — client URL)
     - `request_method: 'CLIENT'`
     - `context` JSON (url, userAgent, sessionId, breadcrumbs)
     - `stack_trace` and `error_name` from error object
   - Returns `{ accepted: number, dropped: number }` (for dedup feedback)
2. Mount in `apps/api/src/index.ts`:
   - `app.use('/api/client-errors', clientErrorRoutes)`
   - Mount BEFORE authentication middleware (client errors can happen pre-login)
   - Apply rate limiting

**Files to create:**
- `apps/api/src/routes/client-errors.ts`

**Files to modify:**
- `apps/api/src/index.ts` (mount route)

**Acceptance criteria:**
- `POST /api/client-errors` accepts error reports without authentication
- Errors appear in `application_error_log` with `service='client'`
- Errors are visible in `GET /api/admin/errors?service=client`
- Rate limiting prevents abuse

---

### Phase 3 (P3): Global Error Handlers + Integration

**Priority:** P3 — Catch all client errors, not just React boundary errors
**Estimated effort:** 0.5 days
**Depends on:** Phase 2

**Tasks:**
1. Add global error handlers in `ClientRootLayout.tsx` or a new `GlobalErrorHandler` component:
   - `window.addEventListener('error', handler)` — uncaught errors
   - `window.addEventListener('unhandledrejection', handler)` — unhandled promise rejections
   - Both call `clientLogger.error()` which triggers Sentry + backend persistence
2. Integrate `clientLogger` into `ErrorBoundary.tsx`:
   - Replace direct `Sentry.captureException` with `clientLogger.error`
   - Include React component stack in context
3. Integrate `clientLogger` into `global-error.tsx`:
   - Replace direct `Sentry.captureException` with `clientLogger.error`
   - Include Next.js error digest in context
4. Set tenant ID and user ID on `clientLogger` when available:
   - Hook into auth context (CustomAuthProvider or useAuth hook)
   - Call `clientLogger.setTenantId(tenantId)` and `clientLogger.setUserId(userId)` on login/logout

**Files to modify:**
- `apps/web/src/components/ClientRootLayout.tsx` (add GlobalErrorHandler)
- `apps/web/src/components/ErrorBoundary.tsx` (use clientLogger)
- `apps/web/src/app/global-error.tsx` (use clientLogger)
- Auth provider (set tenant/user ID on clientLogger)

**Acceptance criteria:**
- Uncaught errors and unhandled rejections appear in Sentry AND `application_error_log`
- Errors include correlation ID, tenant ID, and user ID when available
- No duplicate error reports (dedup by message + stack hash)

---

### Phase 4 (P4): Console Migration (Incremental)

**Priority:** P4 — Reduce ephemeral logging
**Estimated effort:** Ongoing (incremental, file-by-file)
**Depends on:** Phase 1

**Strategy:** Replace `console.*` with `clientLogger.*` in priority order:

1. **Error boundaries and global error handlers** (done in Phase 3)
2. **Service files** — API service layer error handling (replace `console.error` in catch blocks)
3. **Provider/Context files** — singleton providers, auth providers, cart providers
4. **Component files** — replace `console.error` in component error states
5. **Debug logging** — replace `console.log` debug output with `clientLogger.debug` (dev-only)

**Strategy for high-volume files:**
- `TenantInfoService.ts` (153 matches) — likely debug logging, replace with `clientLogger.debug`
- `FlexibleApiSingleton.ts` (91 matches) — cache hit/miss logging, replace with `clientLogger.debug`
- `cacheManager.ts` (74 matches) — cache operations, replace with `clientLogger.debug`

**When it's OK to keep `console.*`:**
- Test files (`.test.ts`, `.test.tsx`)
- Example/demo files (`examples/`, `demos/`)
- Development-only diagnostic scripts
- Next.js config files (`next.config.mjs`)

**Acceptance criteria:**
- New code uses `clientLogger.*` instead of `console.*`
- ESLint rule `no-console` added with `allow: ['warn']` for transitional period

---

### Phase 5 (P5): Documentation + Skill

**Priority:** P5 — Document the architecture for developers and agents
**Estimated effort:** 0.5 days
**Depends on:** Phase 3

**Tasks:**
1. Update `apps/web/.env.local.example` with all new env vars
2. Create `apps/web/src/lib/README-LOGGING.md` (or update existing docs):
   - Architecture overview (client-logger, correlation IDs, error persistence)
   - Usage guide (when to use each log level, how to add context)
   - Migration guide (console.* → clientLogger.*)
   - Admin API reference (how to query client errors)
3. Create `.devin/skills/frontend-logging.md` skill for agents:
   - Quick reference for using `clientLogger`
   - Correlation ID usage patterns
   - Error reporting patterns
   - Anti-patterns (no console.*, no sensitive data, no silent catches)
4. Update `docs/LOGGING_AUDIT.md` with cross-reference to frontend audit

**Acceptance criteria:**
- New developers can configure Sentry via env vars
- Agents have clear guidance on frontend logging patterns
- All env vars documented

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | — | Sentry DSN for client-side error tracking |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `NODE_ENV` | Sentry environment label |
| `NEXT_PUBLIC_LOG_LEVEL` | `info` | Minimum client log level (debug, info, warn, error) |
| `NEXT_PUBLIC_API_URL` | — | API base URL (already exists) |

---

## Migration Risk Assessment

| Risk | Mitigation |
|---|---|
| Duplicate Sentry events from double initialization | Remove `instrumentation-client.ts` or merge into `sentry.client.config.ts` |
| Sentry quota from 100% trace sampling | Set to 0.1 in all configs (Phase 0) |
| Client error endpoint abuse (unauthenticated) | Rate limit by IP (10/min), dedup by message+stack hash |
| PII sent to Sentry without consent | Set `sendDefaultPii: false`, add consent banner if needed |
| High volume of client errors flooding DB | Batch + rate limit on client, dedup on server, purge job already handles retention |
| Correlation ID mismatch between client and server | Server generates authoritative ID, client adopts it from response header |
| `sessionStorage` not available (SSR) | Guard with `typeof window !== 'undefined'`, generate on client mount |
| Breaking existing fetch calls | Correlation ID injection is additive (header only), no behavior change |

---

## File References

### Existing (to modify)
- `apps/web/sentry.client.config.ts` — client Sentry config (keep as primary)
- `apps/web/sentry.server.config.ts` — server Sentry config (no changes)
- `apps/web/sentry.edge.config.ts` — edge Sentry config (no changes)
- `apps/web/src/instrumentation-client.ts` — **fix or remove** (hardcoded DSN, duplicate init)
- `apps/web/src/instrumentation.ts` — Next.js instrumentation hook (no changes)
- `apps/web/src/components/ErrorBoundary.tsx` — **fix** (use Sentry/clientLogger)
- `apps/web/src/app/global-error.tsx` — **fix** (use clientLogger)
- `apps/web/src/components/ClientRootLayout.tsx` — **add** GlobalErrorHandler + correlation ID init
- `apps/web/.env.local.example` — **add** Sentry env vars

### New (to create)
- `apps/web/src/lib/client-logger.ts` — structured client-side logger
- `apps/web/src/lib/correlation-id.ts` — correlation ID generation and propagation
- `apps/web/src/lib/error-reporter.ts` — batched error reporting to backend
- `apps/api/src/routes/client-errors.ts` — backend endpoint for client error persistence
- `.devin/skills/frontend-logging.md` — agent skill for frontend logging patterns

---

## Relationship to Backend Logging Audit

This audit is the frontend complement to `docs/LOGGING_AUDIT.md` (backend). The two systems share:

- **`application_error_log` table** — both client and server errors persist to the same table
- **Correlation IDs** — client generates initial ID, server may override via response header
- **Sentry** — both client and server send to the same Sentry project
- **Admin API** — `GET /api/admin/errors` shows both client (`service='client'`) and server errors
- **Purge job** — the existing daily log purge job handles client errors too (same retention policy)

| Backend (done) | Frontend (this plan) |
|---|---|
| `logger.ts` with 4 transports | `client-logger.ts` with Sentry + console + backend reporting |
| `context.ts` correlation ID middleware | `correlation-id.ts` client-side generation + header injection |
| `requestLogger` middleware | Global error handlers + ErrorBoundary integration |
| `application_error_log` persistence | `POST /api/client-errors` endpoint |
| `uncaughtException`/`unhandledRejection` handlers | `window.onerror`/`unhandledrejection` listeners |
| Admin API (`/api/admin/errors`) | Shared — client errors visible in same API |
| Log purge job | Shared — same purge job handles client errors |
| `docs/LOGGING_AUDIT.md` | This document |
| `.devin/skills/structured-logging.md` | `.devin/skills/frontend-logging.md` (Phase 5) |
