# API Route Architecture — Sprint Plan

## Status: Draft
## Date: July 2026
## Source: `docs/API_ROUTE_ARCHITECTURE_AUDIT.md`

---

## Sprint Overview

The API route layer in `apps/api/src/index.ts` has become an unregulated registry: 249 `app.use()` calls, 98 inline handlers, and 312 route files with overlapping mount points and catch-all collisions. This plan turns the audit report into a sequenced, prioritized execution roadmap. The highest priority is **stop the bleeding** (shadowed routes, hidden endpoints, duplicate mounts), then consolidate, then refactor toward `backend-dev-guidelines` and `architecture-patterns`.

| Sprint | Theme | Duration | Primary Goal |
|--------|-------|----------|--------------|
| **Sprint 1** | Stabilize the mount surface | 1 week | Extract a single `routeRegistry.ts`, move inline `index.ts` handlers, and remove duplicate mounts. |
| **Sprint 2** | Fix collision surfaces | 1 week | Resolve `/api/directory`, `/api/tenants`, and `/api/admin` catch-all shadowing with explicit ordering. |
| **Sprint 3** | Domain consolidation | 1 week | Collapse overlapping routers into domain orchestrators (`directory.routes.ts`, `tenant.routes.ts`, etc.). |
| **Sprint 4** | Controllers, services & error handling | 2 weeks | Move business logic out of routes, adopt `BaseController`, global error handling, and Sentry. |
| **Sprint 5** | Validation & agent knowledge | 1 week | Generate route map / OpenAPI, add route-coverage tests, and create the `api-route-architecture-audit` agent skill. |

**Total estimated duration:** 6 weeks

---

## Benefits & Performance Gains

### Business & Operational Benefits

- **Eliminates route shadowing and hidden endpoints.** The `/api/directory`, `/api/tenants`, and `/api/admin` collision surfaces are the leading cause of "route works locally but returns 404 in production" bugs. A single registry with explicit ordering removes that class of incidents.
- **Cuts onboarding time for new backend engineers.** Today a new developer must grep `index.ts` (8,441 lines) and `routes/mounts/*.ts` to find a handler. After the refactor, a domain router tree plus a generated route map makes the API surface discoverable in minutes.
- **Reduces regressions during feature work.** Domain orchestrators and the route-order verification test make it impossible to add a catch-all before a static sub-route without a failing CI check.
- **Improves security posture.** Centralized auth middleware in `routeRegistry.ts` makes it visible which routes are public, tenant-authenticated, or admin-protected. No more inconsistent auth leading to accidental exposure.
- **Simplifies audits and compliance.** A generated OpenAPI spec and route map make SOC2 / security reviews straightforward, and `auditLogger` covers all routes including `/api/webhooks` and `/api/public`.

### Performance Gains

| Area | Current Cost | After Refactor | Expected Gain |
|---|---|---|---|
| **Request matching overhead** | Multiple routers at the same prefix (e.g., 12+ on `/api/directory`) can cause Express to traverse a deep middleware stack before finding a match. | One domain router per prefix, static paths first, catch-alls last. | Lower per-request CPU and more predictable latency, especially for `/api/directory` and `/api/tenants` paths. |
| **Duplicate middleware** | Some routers are mounted twice at different prefixes, causing the same middleware (auth, validation, logging) to run more than once. | Single canonical mount per router. | Removes redundant middleware execution and header parsing. |
| **Audit / logging coverage** | `auditLogger` is installed in `core-routes.ts` after some public routes, so some requests are not logged or correlated. | Middleware bootstrap at the top of `index.ts` before any route. | Every request gets a correlation ID and structured log entry, reducing time-to-debug and improving observability. |
| **Frontend API calls** | Client-side auth/tenant resolution and repeated `useQuery` calls cause duplicate `GET /api/tenants/:id` calls and render thrash. | `ServerResolvedContextProvider` seeds the client cache from the server layout and `TenantApiSingleton` caches tenant requests. | Eliminates at least one redundant API call per protected page load and removes initial-render waterfalls. |
| **Caching / invalidation** | Route files call `prisma` directly and do not declare cache patterns, so downstream singletons cannot invalidate route-level data. | Services extend `TenantApiSingleton` / `BaseService` with `getServiceCachePatterns` and `invalidateServiceCaches`. | Fewer stale reads, less DB pressure, and predictable cache invalidation across route changes. |
| **Structured logging** | Route files use `console.error` and `console.log` that are not persisted or correlated, making incident triage slow. | `logger.error` with correlation IDs and Sentry integration. | Errors are searchable by `tenantId` and `correlationId`, cutting MTTR. |
| **CI / release velocity** | Route ordering is verified manually; bad merges cause production 404s. | Route-order verification and route-coverage smoke tests in CI. | Failures caught in PRs, reducing rollback frequency and hot-fix cycles. |

**Realistic performance impact:** The refactor is not primarily about raw request throughput — Express is already fast enough for current traffic. The biggest gains are **latency consistency** (no more deep catch-all traversal), **frontend cold-load time** (fewer redundant API calls), and **operational efficiency** (faster debugging, fewer incidents). Backend per-request overhead should drop modestly; the main win is a stable, predictable route surface.

---

## Sprint 1: Stabilize the Mount Surface

**Goal:** Make the current route order explicit, remove duplication, and get all inline handlers out of `index.ts` without changing behavior.

### 1.1 — Create `routeRegistry.ts`

- **File**: `apps/api/src/routes/routeRegistry.ts` (NEW)
- **Description:** A single declarative array of every router, its mount path, optional middleware, and an explicit `priority`/`order` value.
- **Shape:**
  ```ts
  export interface RouteEntry {
    path: string;
    router: Router;
    middleware?: RequestHandler[];
    order: number;
    domain: 'admin' | 'tenant' | 'directory' | 'public' | 'integration' | 'auth' | 'checkout' | 'other';
  }

  export const routeRegistry: RouteEntry[] = [
    { path: '/api/auth', router: authRoutes, order: 100, domain: 'auth' },
    { path: '/api/public', router: publicRoutes, order: 200, domain: 'public' },
    // ...
  ];
  ```
- **Acceptance:** `index.ts` imports `routeRegistry` and mounts with a single sorted loop.

### 1.2 — Replace `mountAllRoutes` + direct-mount soup in `index.ts`

- **File**: `apps/api/src/index.ts`
- **Description:** Remove the `mountAllRoutes` call and the 200+ direct `app.use` calls. Replace with:
  ```ts
  for (const entry of [...routeRegistry].sort((a, b) => a.order - b.order)) {
    app.use(entry.path, ...(entry.middleware ?? []), entry.router);
  }
  ```
- **Acceptance:** No `app.use` in `index.ts` except middleware, static files, and the registry loop.

### 1.3 — Move inline handlers out of `index.ts`

- **Files**: `apps/api/src/routes/inline-handlers/*.ts` (NEW) or existing `routes/` files.
- **Scope:** 98 inline `app.get/post/put/patch/delete` handlers currently in `index.ts`.
- **Key moves:**
  - `GET /api/public/tenant/:tenantId/business-hours/status` → `routes/public-tenant.ts` or `routes/public-api.ts`
  - `GET /api/tenants/:id`, `POST /api/tenants`, `PUT /api/tenants/:id`, `PATCH /api/tenants/:id` → `routes/tenants.ts` (remove duplicate)
  - `PATCH /api/v1/tenants/:tenant_id/items/:itemId/category` → `routes/items.ts` or `routes/tenant-items.ts`
  - `PUT /api/items/:itemId` → `routes/items.ts`
  - `GET /api/gbp/categories` and `/api/gbp/categories/popular` → `routes/gbp-categories.ts`
  - `GET /api/admin/taxonomy/status` and `POST /api/admin/taxonomy/sync` → `routes/admin-taxonomy.ts`
- **Acceptance:** All `app.get/post/put/patch/delete` calls removed from `index.ts`; `pnpm checkapi` passes.

### 1.4 — Remove duplicate mounts

- **File**: `apps/api/src/index.ts` and `apps/api/src/routes/mounts/*.ts`
- **Scope:** Remove or consolidate routers mounted twice or at multiple prefixes:
  - `paypalConnectRoutes` at `/api/admin/paypal-connect` and `/api/tenants`
  - `fulfillmentSettingsRoutes`, `commerceSettingsRoutes`, `taxRoutes`, `featuredOptionsSettingsRoutes`, `faqOptionsSettingsRoutes`, `crmOptionsSettingsRoutes`, `socialCommerceOptionsSettingsRoutes`, `chatbotOptionsSettingsRoutes`, `storefrontTypeSettingsRoutes`, `productTypeSettingsRoutes`, `storefrontPolicyRoutes`, `paymentGatewaySettingsRoutes` at both `/api/tenants` and `/api`
  - `organizationCommerceSettingsRoutes` at `/api/organizations` and `/api`
  - `socialProofRoutes`, `returnsRoutes` at `/api` and `/api/tenants`
  - `storeReviewsRoutes` at `/api/stores` and `/api`
  - `directoryPhotosRouter` at `/api/directory` (twice)
  - `billingRoutes` in `core-routes.ts` and `index.ts`
- **Acceptance:** Each router has one canonical mount path. If aliases are needed, create an explicit alias router that re-exports the same handlers under a documented secondary path.

### 1.5 — Clean up commented-out imports and mounts

- **File**: `apps/api/src/index.ts`
- **Description:** Delete all `// import ...` and `// app.use(...)` lines. History is preserved in git.
- **Acceptance:** `index.ts` has zero commented-out route imports or mounts.

### 1.6 — Verification

- `pnpm checkapi` — zero TS errors.
- `pnpm checkweb` — zero TS errors (if any shared types changed).
- Start the server and smoke-test:
  - `GET /api/health`
  - `GET /api/tenants/:id` (existing working tenant)
  - `GET /api/directory/stores`
  - `GET /api/directory/search`
  - `GET /api/admin/users` (admin auth)
- No new 404s for previously working routes.

---

## Sprint 2: Fix Collision Surfaces

**Goal:** Reorder and restructure the `/api/directory`, `/api/tenants`, and `/api/admin` mount surfaces so specific paths always win over catch-alls.

### 2.1 — `/api/directory` catch-all audit

- **File**: `apps/api/src/routes/directory.routes.ts` (NEW orchestrator)
- **Description:** Create a single `directory.routes.ts` that imports and mounts all directory sub-routers in strict order:
  1. Static sub-paths first: `/mv`, `/categories`, `/store-types`, `/featured-products`, `/random-featured`, `/featured-stats`, `/premium-featured-products`, `/featured-stores`, `/consolidated`, `/categories-optimized`, `/map`, `/photos`, `/stores`, `/search`, `/locations`
  2. Generic routes last: `/:identifier` / `/:slug`
- **Files involved:** `directory.ts`, `directory-v2.ts`, `directory-categories.ts`, `directory-mv.ts`, `directory-optimized.ts`, `directory-consolidated.ts`, `ENHANCED_DIRECTORY_ROUTES.ts`, `directory-random-featured.ts`, `directory-random-featured-global.ts`, `directory-featured-products.ts`, `directory-featured-stats.ts`, `directory-premium-featured-products.ts`, `directory-featured-stores.ts`, `directory-categories-optimized.ts`, `directory-categories-enhanced.ts`, `directory-map.ts`, `directory-photos.ts`
- **Acceptance:** Every directory sub-router either has no catch-all or calls `next()` when it cannot resolve a slug. `GET /api/directory/stores` and `GET /api/directory/search` do not get intercepted by `/:slug`.

### 2.2 — `/api/tenants` catch-all audit

- **File**: `apps/api/src/routes/tenant.routes.ts` (NEW orchestrator)
- **Description:** Create a single `tenant.routes.ts` that mounts all tenant sub-routers in order:
  1. `/` root list (no `/:id` catch-all at root)
  2. `/by-status/:status` or other static filters
  3. Sub-resource routers: `/:tenantId/users`, `/:tenantId/payment-gateway-settings`, `/:tenantId/stripe-connect/*`, `/:tenantId/business-hours`, `/:tenantId/fulfillment-settings`, `/:tenantId/commerce-settings`, `/:tenantId/tax`, `/:tenantId/product-options-settings`, `/:tenantId/featured-options-settings`, etc.
  4. `/:id` tenant detail router **last**.
- **Acceptance:** `GET /api/tenants/:tenantId/payment-gateway-settings` reaches `payment-gateway-settings.ts`, not `tenants.ts` `/:id`. `GET /api/tenants/:id` still works.

### 2.3 — `/api/admin` prefix audit

- **File**: `apps/api/src/routes/admin.routes.ts` (existing) and `apps/api/src/routes/mounts/admin-routes.ts`
- **Description:** Merge all admin routers into one `admin.routes.ts` and enforce this ordering:
  1. Platform management: `/platform-categories`, `/taxonomy`, `/users`, `/security`, `/tiers`, `/tier-system`, `/capabilities`, `/platform-flags`, `/tenant-flags`, `/effective-flags`, `/billing`, `/manual-billing`, `/platform-revenue`, `/platform-fee-invoices`, `/notification-logs`, `/inventory-transfers`, `/slug-registry`, `/catalog`, `/inventory`, `/google-product-taxonomy`, `/demo-tenants`, `/service-charges`, `/security-monitoring`
  2. Directory admin: `/directory/*`
  3. Generic admin tools last: `/:id` (if any)
- **Acceptance:** All admin routes respond correctly; no `admin-tools` catch-all intercepts `/admin/users` or `/admin/taxonomy`.

### 2.4 — Standardize auth middleware per route

- **File**: `apps/api/src/routes/mounts/admin-routes.ts`, `core-routes.ts`, and `routeRegistry.ts`
- **Description:** For each admin/tenant route entry in `routeRegistry`, decide whether auth is applied at `app.use` (mount-level) or inside the router. Document the rule:
  - Public routes: no auth at mount.
  - Tenant routes: `authenticateToken` + `checkTenantAccess` at mount or per route.
  - Admin routes: `authenticateToken` + `requireAdmin` at mount.
  - Webhooks: no auth (signature verification inside router).
- **Acceptance:** No route is mounted without auth that should be protected, and no route is double-protected.

### 2.5 — Verification

- Add a new temporary test script `scripts/verify-route-order.ts` that:
  - Boots Express without listening.
  - Iterates the route stack and asserts that `/api/directory/:slug` is registered after all `/api/directory/<static>` routes.
  - Asserts the same for `/api/tenants/:id`.
- Run manual curl tests for the top 50 most critical routes.

---

## Sprint 3: Domain Consolidation

**Goal:** Replace the six `mounts/*.ts` files and the loose `routes/*.ts` file naming with a single domain-based router tree.

### 3.1 — Create domain orchestrator routers

- **Files**: 
  - `apps/api/src/routes/auth.routes.ts`
  - `apps/api/src/routes/public.routes.ts`
  - `apps/api/src/routes/tenant.routes.ts` (from Sprint 2)
  - `apps/api/src/routes/directory.routes.ts` (from Sprint 2)
  - `apps/api/src/routes/admin.routes.ts` (from Sprint 2)
  - `apps/api/src/routes/checkout.routes.ts`
  - `apps/api/src/routes/catalog.routes.ts`
  - `apps/api/src/routes/organization.routes.ts`
  - `apps/api/src/routes/integration.routes.ts`
- **Description:** Each orchestrator imports the sub-routers for its domain and mounts them in order. `routeRegistry.ts` only references these orchestrators.
- **Acceptance:** `index.ts` mounts at most one router per domain prefix.

### 3.2 — Merge `routes/mounts/*.ts` into orchestrators

- **Files**: `apps/api/src/routes/mounts/auth-routes.ts`, `core-routes.ts`, `dashboard-routes.ts`, `admin-routes.ts`, `integration-routes.ts`, `directory-routes.ts`
- **Description:** Move their mount logic into the new domain orchestrators. Then delete `routes/mounts/` directory.
- **Acceptance:** No `routes/mounts/` directory; `pnpm checkapi` passes.

### 3.3 — Rename ambiguous route files

- **Files:**
  - `ENHANCED_DIRECTORY_ROUTES.ts` → `directory-enhanced.ts` (uppercase file names are inconsistent)
  - `directory-v2.ts` / `directory-mv.ts` / `directory-optimized.ts` / `directory-categories-optimized.ts` → merge into `directory.routes.ts` or rename to `directory-<subdomain>.ts`
  - `public-api.ts` → `public-catalog.routes.ts` or merge into `public.routes.ts`
- **Acceptance:** All route files follow `kebab-case.routes.ts` or `kebab-case.ts` naming convention.

### 3.4 — Move middleware bootstrap out of `index.ts`

- **File**: `apps/api/src/middleware/bootstrap.ts` (NEW)
- **Description:** Move security headers, CORS, body parsers, `auditLogger`, `morgan`, `requestLogger`, `setRequestContext`, `applyRateLimit`, `inputValidationMiddleware`, `validateInput`, `securityLogger`, `performanceMonitoring` into a single function that is called before route mounting.
- **Acceptance:** `index.ts` no longer contains middleware configuration. `auditLogger` and `morgan` cover all routes including `/api/client-errors`, `/api/webhooks`, and `/api/public`.

### 3.5 — Verification

- `pnpm checkapi` / `pnpm checkweb` — zero TS errors.
- All route smoke tests from Sprint 1 still pass.
- Directory search, tenant detail, admin taxonomy, and checkout flow all functional.

---

## Sprint 4: Controllers, Services & Error Handling

**Goal:** Move business logic out of route files and inline handlers, aligning with `backend-dev-guidelines`.

### 4.1 — Introduce `BaseController` pattern

- **File**: `apps/api/src/controllers/BaseController.ts` (NEW)
- **Description:** Implement a base controller with standardized success/error responses, Zod validation, and Sentry error capture.
- **Acceptance:** All new route handlers extend or use `BaseController`.

### 4.2 — Create controllers for high-risk routes

- **Files**: `apps/api/src/controllers/tenant/`, `apps/api/src/controllers/directory/`, `apps/api/src/controllers/admin/`, `apps/api/src/controllers/public/`, etc.
- **Priority routes (highest traffic / most logic):**
  - `GET /api/tenants/:id`
  - `PATCH /api/tenants/:id`
  - `GET /api/directory/stores`
  - `GET /api/directory/search`
  - `GET /api/directory/:slug`
  - `GET /api/public/*`
  - `GET /api/admin/users`
- **Acceptance:** No raw Prisma or SQL queries in route files; queries live in controllers/services.

### 4.3 — Move business logic into services

- **Files**: `apps/api/src/services/tenant/`, `apps/api/src/services/directory/`, `apps/api/src/services/admin/`
- **Description:** Move DB interactions, caching, and business rules from route files and inline handlers into services. Use `unifiedConfig` instead of `process.env`.
- **Acceptance:** `grep -n "process.env" apps/api/src/routes/*.ts` returns zero results.

### 4.4 — Global error handling and Sentry

- **Files**: `apps/api/src/middleware/errorHandler.ts` (NEW or expand existing)
- **Description:** Add a global Express error handler that:
  - Sends errors to Sentry
  - Returns `{ success: false, error: <code>, message: <msg> }` shape
  - Logs structured errors via logger (not `console.error`)
- **Acceptance:** Remove `console.error` from route files. Add `asyncErrorWrapper` or `express-async-handler` so route handlers can `throw` instead of `try/catch`.

### 4.5 — Standardize request validation

- **File**: `apps/api/src/middleware/validateRequest.ts` (NEW)
- **Description:** Factory middleware that takes a Zod schema and validates `req.body`, `req.query`, `req.params`. Apply it at route level.
- **Acceptance:** All route files use `validateRequest(schema)` instead of inline `schema.safeParse`.

### 4.6 — Verification

- `pnpm checkapi` / `pnpm checkweb` — zero TS errors.
- Unit tests for new controllers/services.
- Sentry receives errors from a simulated failing route.

---

## Sprint 5: Validation & Agent Knowledge

**Goal:** Make the route architecture observable and self-documenting, and capture the effort insights for future agents.

### 5.1 — Generate route map from registry

- **File**: `apps/api/src/scripts/generate-route-map.ts` (NEW)
- **Description:** Script reads `routeRegistry.ts` and emits a JSON object with every mounted path, HTTP method, and middleware. Run it at build time.
- **Acceptance:** `route-map.json` is generated in `apps/api/dist/` or `apps/api/src/generated/`.

### 5.2 — OpenAPI generation

- **File**: `apps/api/src/scripts/generate-openapi.ts` (NEW)
- **Description:** Extend the route-map script to produce `openapi.json` from route metadata and Zod schemas. Store in `apps/api/openapi.json`.
- **Acceptance:** `openapi.json` is valid and importable into Swagger UI / Postman.

### 5.3 — Route coverage tests

- **Files**: `apps/api/src/tests/route-coverage.test.ts` (NEW)
- **Description:** A smoke test that boots the app and asserts every registry entry has a valid router and responds to `HEAD` or `GET` without throwing.
- **Acceptance:** CI runs `pnpm test:routes` and fails if a route is unreachable or a new catch-all is mounted before a static route.

### 5.4 — CI check for catch-all ordering

- **File**: `.github/workflows/ci.yml`
- **Description:** Add a lint/script step that fails if `grep` finds a catch-all route in a file before static routes in the same `Router()`.
- **Acceptance:** PR cannot merge if it introduces a catch-all before a static sub-route in the same orchestrator.

### 5.5 — Create the `api-route-architecture-audit` agent skill

- **File**: `.devin/skills/api-route-architecture-audit.md` (NEW)
- **Description:** Capture the effort insights, audit patterns, common risks, and quick wins discovered during this refactor. This is the final deliverable of the sprint plan.
- **Content requirements:**
  - When to use this skill (symptoms of route architecture rot)
  - How to audit an Express route surface (mount order, catch-alls, duplicates)
  - Common pitfalls and shadowing patterns
  - Effort estimation guidance for route refactors
  - Quick wins and long-term redesign patterns
  - Reference to `docs/API_ROUTE_ARCHITECTURE_AUDIT.md`
- **Acceptance:** Skill is reviewed and saved to `.devin/skills/api-route-architecture-audit.md`.

### 5.6 — Verification

- `pnpm checkapi` / `pnpm checkweb` — zero TS errors.
- `route-map.json` and `openapi.json` are generated.
- CI route coverage passes.
- Skill document is merged and tested by a new agent run.

---

## Cross-Sprint Dependencies

- **Sprint 1** must finish before **Sprint 2** because catch-all fixes depend on the registry being the single source of mount order.
- **Sprint 2** must finish before **Sprint 3** because domain orchestrators assume the collision surfaces are already ordered.
- **Sprint 3** should finish before **Sprint 4** because moving business logic is easier when route ownership is clear.
- **Sprint 4** should finish before **Sprint 5** because OpenAPI generation depends on clean controllers and Zod schemas.
- **Sprint 5** (skill doc) is independent but should come last so it captures actual effort insights from the refactor.

---

## Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| Moving `index.ts` inline handlers breaks existing routes | Write `routeRegistry.ts` side-by-side and keep `index.ts` as a fallback until smoke tests pass. |
| `/:id` catch-all intercepts new sub-routes | Add `scripts/verify-route-order.ts` before each PR and catch-all ordering CI check. |
| Auth middleware inconsistency causes security holes | Document auth rules in `routeRegistry.ts` and add an auth middleware unit test. |
| Large refactor causes merge conflicts | Land Sprint 1 quickly; use small PRs per domain. |
| Controllers/services refactor is too large | Start with the top 10 routes and expand incrementally. |

---

## Success Metrics

- `index.ts` goes from ~8,441 lines to under 500 lines.
- `app.use()` calls in `index.ts` go from 249 to under 10.
- Inline route handlers in `index.ts` go from 98 to 0.
- Duplicate mounts in `index.ts` go from 20+ to 0.
- `/api/directory` and `/api/tenants` have exactly one orchestrator each.
- `pnpm checkapi` and `pnpm checkweb` pass on every PR.
- OpenAPI spec is generated and route coverage tests pass in CI.
- New agent skill is created and reviewed.

---

## Appendix — Files to Touch

- `apps/api/src/index.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/src/routes/mounts/*.ts`
- `apps/api/src/routes/*.ts`
- `apps/api/src/routes/routeRegistry.ts` (NEW)
- `apps/api/src/routes/directory.routes.ts` (NEW)
- `apps/api/src/routes/tenant.routes.ts` (NEW)
- `apps/api/src/routes/admin.routes.ts` (NEW/rewrite)
- `apps/api/src/routes/auth.routes.ts` (NEW)
- `apps/api/src/routes/public.routes.ts` (NEW)
- `apps/api/src/routes/checkout.routes.ts` (NEW)
- `apps/api/src/routes/catalog.routes.ts` (NEW)
- `apps/api/src/routes/organization.routes.ts` (NEW)
- `apps/api/src/routes/integration.routes.ts` (NEW)
- `apps/api/src/middleware/bootstrap.ts` (NEW)
- `apps/api/src/middleware/errorHandler.ts` (NEW/expand)
- `apps/api/src/middleware/validateRequest.ts` (NEW)
- `apps/api/src/controllers/BaseController.ts` (NEW)
- `apps/api/src/controllers/**/*.ts` (NEW)
- `apps/api/src/services/**/*.ts` (NEW/expand)
- `apps/api/src/scripts/generate-route-map.ts` (NEW)
- `apps/api/src/scripts/generate-openapi.ts` (NEW)
- `apps/api/src/tests/route-coverage.test.ts` (NEW)
- `.github/workflows/ci.yml`
- `.devin/skills/api-route-architecture-audit.md` (NEW)

---

## Related Skills

These skills should be read before or during the corresponding sprints. They influence route creation, endpoint design, context resolution, logging, and pre/post-flight verification.

| Skill | Role in this Plan | When to Read / Apply |
|---|---|---|
| `tenant-scoped-id-generation.md` | **Route element creation** — any new entities exposed by new route endpoints must use tenant-scoped IDs from `id-generator.ts` (e.g., `routeRegistry.ts` entries, new service IDs, generated IDs in controllers). | Read during Sprint 1 before moving inline handlers; apply whenever a new route creates a new entity. |
| `deploy-service-extending-base-singleton.md` | **Route endpoint influencer** — frontend and backend services that routes call must extend the correct domain singleton (`PublicApiSingleton`, `TenantApiSingleton`, `AdminApiSingleton`, `BaseService`, `UniversalSingleton`) with cache contracts and `makeDefaultRequest`. | Read during Sprint 4 (controllers/services) and apply to every new service created. |
| `server-resolved-context-delegator.md` | **Route context influencer** — the server layout should resolve auth/tenant once and pass it to the client, eliminating redundant `GET /api/tenants/:id` calls from protected pages. | Read during Sprint 3 when consolidating tenant and auth routes; apply to protected Next.js layouts and route handlers. |
| `start-of-phase-sprint-checklist.md` | **Route pre-flight checklist** — run before each sprint to choose skill documents, plan tenant-scoped IDs, determine singleton base classes, and plan navigation. | Read at the start of every sprint. |
| `end-of-phase-sprint-checklist.md` | **Route post-flight checklist** — run at the end of each sprint to enforce zero TS errors, no direct `fetch`, singleton compliance, ID correlation, and route mount verification. | Read at the end of every sprint. |
| `structured-logging.md` | **Route logging influencer** — replaces `console.error`/`console.log` in route handlers with `logger.*` calls that include correlation IDs and Sentry metadata. | Read during Sprint 4 (error handling) and apply to all route handlers and middleware. |
