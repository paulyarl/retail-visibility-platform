# API Route Architecture Audit: Gap Analysis & Optimization Plan

## 1. Executive Summary

`apps/api/src/index.ts` has become an 8,441-line route monolith with **249 `app.use()` calls** and **98 inline `app.get/post/put/patch/delete` handlers**. The `apps/api/src/routes/` directory contains **312 route files**. Routes are mounted in two overlapping ways:

1. **Direct inline mounts** in `index.ts` (lines 295–8,440+).
2. **Modular mount groups** via `routes/index.ts` → `mountAllRoutes()` → `routes/mounts/*.ts`.

Both mechanisms run in the same process, so every path collision is resolved by **first-match-wins** Express behavior. The codebase already contains many comments such as "MUST be mounted BEFORE generic routes" and "MUST come before generic tenant routes" that prove the team is fighting Express ordering rather than designing it. This audit documents the gaps and recommends a route-first architecture that eliminates shadowing, blocking, and hidden endpoints.

---

## 2. Scope & Methodology

**Scope:**
- `apps/api/src/index.ts` — main Express entry point and route mounting surface.
- `apps/api/src/routes/index.ts` — orchestrator (`mountAllRoutes`, `mountMinimalRoutes`).
- `apps/api/src/routes/mounts/*.ts` — six modular mount groups.
- `apps/api/src/routes/**/*.ts` — 312 route files.
- Reference: `.agents/skills/backend-dev-guidelines/SKILL.md` and `.agents/skills/architecture-patterns/SKILL.md`.

**Methodology:**
- Grep inventory of `app.use(...)`, `app.get(...)`, `app.post(...)`, etc.
- Manual tracing of top collision paths: `/api/directory`, `/api/tenants`, `/api/admin`, `/api`, `/public`.
- Catch-all route identification (`/:id`, `/:slug`, `/:identifier`, `/:tenantId`).
- Review of inline route handlers and duplicate mount patterns.

---

## 3. Findings

### 3.1 The Main Entry Point Is a Route Registry

`apps/api/src/index.ts` is not only a server bootstrap file; it is the route registry. Key metrics:

| Metric | Count |
|--------|-------|
| Lines in `index.ts` | ~8,441 |
| `app.use()` calls | 249 |
| Inline `app.*` handlers | 98 |
| Route files in `routes/` | 312 |
| Modular mount groups | 6 (`auth-routes`, `core-routes`, `dashboard-routes`, `admin-routes`, `integration-routes`, `directory-routes`) |

### 3.2 Two Overlapping Mount Strategies

`index.ts` both **directly mounts** routes and **calls `mountAllRoutes()`**:

```ts
// Direct mounts, interleaved with middleware and business logic
app.use('/api/public', publicApiRoutes);              // index.ts:464
app.use('/api/directory', directoryConsolidatedRoutes); // index.ts:4291
// ...
mountAllRoutes(app);                                   // index.ts:6769
// ... more direct mounts after the modular call
app.use('/api/tenants', tenantsRoutes);                // index.ts:7565
app.use('/api/tenants', paymentGatewaysRoutes);        // index.ts:7569
```

This means the "canonical" mount order is not encapsulated in one file. It is split between `index.ts`, `routes/index.ts`, and six mount files. Finding the actual handler for a given URL requires tracing across multiple files and understanding Express's first-match semantics.

### 3.3 Heavy Use of Catch-All Routes

A grep for `router.get('/:<param>')` surfaced many catch-all patterns. The most dangerous for shadowing are those mounted at shared prefixes:

| File | Catch-All Pattern | Mounted At |
|------|-------------------|------------|
| `directory.ts` | `router.get('/:slug')` | `/api/directory` |
| `directory-v2.ts` | `router.get('/:identifier')` | `/api/directory` |
| `directory-simple.ts` | `router.get('/:slug')` | `/api/directory` |
| `shops.ts` | `router.get('/:identifier')` | `/api/shops` |
| `inventory/resolve.ts` | `router.get('/:identifier')` | `/api`? |
| `tenants.ts` | `router.get('/:id')` | `/api/tenants` |
| `organizations.ts` | `router.get('/:id')` | `/api/organizations` and `/organizations` |
| `users.ts` | `router.get('/:id')` | `/api/users-singleton` |
| `categories-singleton.ts` | `router.get('/:id')` | `/api/categories-singleton` |
| `taxonomy.ts` | `router.get('/:id')` | `/api/taxonomy` |

When a catch-all is mounted at a shared prefix before a more specific sub-path, it captures traffic that should reach another router.

### 3.4 `/api/directory` Is the Highest-Risk Collision Surface

At least 12 routers are mounted at `/api/directory` or below it:

- `directoryConsolidatedRoutes` — `/api/directory` (index.ts:4291)
- `directoryRandomFeaturedRoutes` — `/api/directory` (index.ts:4296)
- `directoryRandomFeaturedGlobalRoutes` — `/api/directory` (index.ts:4302)
- `directoryFeaturedStoresRoutes` — `/api/directory/featured-stores` (index.ts:4342)
- `directoryPhotosRouter` — `/api/directory` (index.ts:4346, 7967)
- `directoryCategoriesOptimizedRoutes` — `/api/directory/categories-optimized` (index.ts:6871)
- `directoryCategoriesEnhancedRoutes` — `/api/directory` (index.ts:6876)
- `directoryMapRoutes` — `/api/directory` (index.ts:6886)
- `directoryRoutes` — `/api/directory` (index.ts:6891)
- `directoryMvRoutes` — `/api/directory/mv` (mounts/directory-routes.ts:27)
- `directoryCategoriesRoutes` — `/api/directory` (mounts/directory-routes.ts:31)
- `directoryStoreTypesRoutes` — `/api/directory/store-types` (mounts/directory-routes.ts:36)
- `directoryFeaturedProductsRoutes` — `/api/directory/featured-products` (mounts/directory-routes.ts:40)
- `directoryRandomFeaturedRoutes` — `/api/directory/random-featured` (mounts/directory-routes.ts:44)
- `directoryPremiumFeaturedRoutes` — `/api/directory/premium-featured-products` (mounts/directory-routes.ts:46)
- `directoryRoutes` — `/api/directory` (mounts/directory-routes.ts:52)
- `enhancedDirectoryRoutes` — `/api/directory` (mounts/directory-routes.ts:53)

Observations:
- `directory-v2.ts` has a catch-all `/:identifier` that explicitly hard-codes `next()` only for `categories` and a reserved path list (`tenant`, `stores`, `search`, `locations`, `categories-optimized`). Any other segment is treated as a slug. This is a fragile workaround.
- `directory.ts` has a `/:slug` catch-all that does **not** call `next()`. If it is mounted before `directory-v2.ts` or other specific routers, it will 404 instead of letting the next router handle the request.
- `directory-consolidated.ts` has `/consolidated/:slug`. It is mounted at `/api/directory`, so `consolidated` is a static first segment.
- `directory-categories.ts` has `/categories` and `/:categoryId` (a catch-all). If `/:categoryId` is hit before a `directory-v2` or `directory` route, it may shadow other one-segment paths.

### 3.5 `/api/tenants` Has Multiple Catch-All Risk Points

`tenants.ts` is mounted at `/api/tenants` (index.ts:7565). It carries `router.get('/:id')` and `router.put('/:id/subdomain')`, but the inline `index.ts` handlers also register `GET /api/tenants/:id`, `PUT /api/tenants/:id`, `PATCH /api/tenants/:id`, `DELETE /api/tenants/:id`, `GET /api/tenants/by-status/:status`, etc. The inline `GET /api/tenants/:id` is registered **before** `tenants.ts` and the file comment in `tenants.ts` confirms it:

```ts
// NOTE: GET /api/tenants/:id is handled by index.ts (inline handler registered
// before this router mount, so it takes precedence).
```

This is a concrete example of a hidden endpoint: the router file exists, but the real handler is in `index.ts`.

After `tenants.ts` is mounted, many other routers are mounted at `/api/tenants`, including `paymentGatewaysRoutes`, `tenantStripeConnectRoutes`, `fulfillmentSettingsRoutes`, `commerceSettingsRoutes`, `taxRoutes`, `productOptionsSettingsRoutes`, `featuredOptionsSettingsRoutes`, etc. Many of these define `/:tenantId/<sub-resource>` paths. If `tenants.ts` were ever to register a `/:id/*` or `/:tenantId/*` wildcard, it would immediately shadow all of them. Even today, ordering errors can cause `GET /api/tenants/:id` to match when the caller intended `GET /api/tenants/:tenantId/payment-gateway-settings`.

### 3.6 `/api` Is a Shared Dumping Ground

`app.use('/api', ...)` is used for 20+ routers. Because Express strips the prefix and forwards the remainder to the router, any router with a catch-all at `/` or `/:param` mounted at `/api` will match **any** `/api/*` request that reaches it. Examples from `index.ts` after `mountAllRoutes`:

```ts
app.use('/api', tenantFeaturedRoutes);          // line 7177
app.use('/api', featuredProductsRoutes);        // line 7182
app.use('/api', scanRoutes);                    // line 6850
app.use('/api', productFeaturingRoutes);        // line 7497
app.use('/api', platformSettingsRoutes);        // line 7256
app.use('/api', rateLimitWarningsRoutes);       // line 7260
app.use('/api', billingRoutes);                 // line 7701
app.use('/api', tenantOrdersRoutes);            // line 7705
app.use('/api', activeFeaturedRoutes);          // line 7613
app.use('/api', featuredPlacementRoutes);       // line 7619
app.use('/api', badgeRegistryRoutes);           // line 7603
app.use('/api', badgeAnalyticsRoutes);          // line 7607
app.use('/api', googleBusinessOAuthRoutes);     // line 8106
app.use('/api', metaOAuthRoutes);               // line 8115
app.use('/api', metaWebhookRoutes);             // line 8119
app.use('/api', tiktokOAuthRoutes);             // line 8123
app.use('/api', tiktokWebhookRoutes);           // line 8127
app.use('/api', socialProofRoutes);             // line 8131
app.use('/api', shippingRateRoutes);            // line 8136
app.use('/api', returnsRoutes);                 // line 8140
app.use('/api', socialPixelRoutes);             // line 8145
app.use('/api', storeReviewsRoutes);            // line 8151
```

If any of these routers define `/:id` or `/:slug` without a static first segment, the order of these `app.use` calls determines whether a request hits the intended router. This is the root cause of "hidden endpoints" described by the user.

### 3.7 Inline Route Handlers in `index.ts`

98 inline handlers are not in `routes/` files. They mix business logic, database queries, and Zod validation directly in the server bootstrap file. Examples:

- `GET /api/public/tenant/:tenantId/business-hours/status` (index.ts:468)
- `GET /api/tenants/:id` (index.ts:753)
- `POST /api/tenants` (index.ts:969)
- `PUT /api/tenants/:id` (index.ts:1144)
- `PATCH /api/tenants/:id` (index.ts:1167)
- `PATCH /api/v1/tenants/:tenant_id/items/:itemId/category` (index.ts:6899)
- `PUT /api/items/:itemId` (index.ts:6922)
- `GET /api/gbp/categories` and `/api/gbp/categories/popular` (index.ts:7116, 7076)
- `GET /api/admin/taxonomy/status` and `POST /api/admin/taxonomy/sync` (index.ts:6780, 6807)

Inline handlers violate the backend-dev-guidelines principle that **routes should only route**, and they make the index file impossible to reason about. They also silently take precedence over router files because they are registered inline before the router file is mounted.

### 3.8 Duplicate & Redundant Mounts

Several routers appear to be mounted more than once or at multiple prefixes:

- `paypalConnectRoutes` is mounted at both `/api/admin/paypal-connect` and `/api/tenants` (index.ts:7381, 7382).
- `fulfillmentSettingsRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7578, 7579).
- `commerceSettingsRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7583, 7584).
- `taxRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7588, 7589).
- `featuredOptionsSettingsRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7597, 7598).
- `faqOptionsSettingsRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7623, 7624).
- `crmOptionsSettingsRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7628, 7629).
- `socialCommerceOptionsSettingsRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7633, 7634).
- `chatbotOptionsSettingsRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7638, 7639).
- `storefrontTypeSettingsRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7663, 7664).
- `productTypeSettingsRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7668, 7669).
- `storefrontPolicyRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7673, 7674).
- `paymentGatewaySettingsRoutes` is mounted at `/api/tenants` and `/api` (index.ts:7691, 7692).
- `organizationCommerceSettingsRoutes` is mounted at `/api/organizations` and `/api` (index.ts:7696, 7697).
- `socialProofRoutes` is mounted at `/api` and `/api/tenants` (index.ts:8131, 8132).
- `returnsRoutes` is mounted at `/api` and `/api/tenants` (index.ts:8140, 8141).
- `storeReviewsRoutes` is mounted at `/api/stores` and `/api` (index.ts:8150, 8151).
- `directoryPhotosRouter` is mounted twice at `/api/directory` (index.ts:4346, 7967).
- `photosRouter` is mounted at `/api/items` (index.ts:7963) and `directoryPhotosRouter` at `/api/directory` (index.ts:7967).
- `googleBusinessOAuthRoutes` is mounted at `/api` and `/auth` (index.ts:8106, 8107).
- `billingRoutes` is mounted in `core-routes.ts` at `/api` and again in `index.ts` at `/api` (line 7701).
- `clientErrorRoutes` is mounted at `/api/client-errors` (index.ts:350) and `webhooksRoutes` at `/api/webhooks` (index.ts:356), which are direct mounts outside the mount system.

These duplicates may be intentional aliases, but they add no value and create ambiguity. They are also a maintenance risk: if one mount is removed and the other is not, the route will silently disappear or behave differently.

### 3.9 Auth Middleware Applied Inconsistently

Some routers are mounted with `authenticateToken` or `requireAdmin` at the `app.use()` level, while others handle auth per-route. For example:

```ts
// index.ts
app.use('/api/admin/performance', performanceApi);
app.use('/api/admin/enrichment', authenticateToken, requireAdmin, adminEnrichmentRoutes);
app.use('/api/admin/tier-system', authenticateToken, requireAdmin, tierSystemRoutes);
app.use('/api/admin/capabilities', authenticateToken, requireAdmin, capabilityRoutes);
app.use('/api/admin/tiers', authenticateToken, tierManagementRoutes);
app.use('/api/admin/users', authenticateToken, requireAdmin, adminUsersRoutes);
```

Meanwhile, `admin-routes.ts` applies `authenticateToken` to every `app.use('/api/admin/*', ...)` and `core-routes.ts` applies `authenticateToken` only to some routers. Some admin routers (`admin-security`, `sentry`, etc.) have internal auth, others rely on the mount-level middleware. This inconsistency makes it easy to miss an auth check when a route is moved or duplicated.

### 3.10 Middleware Ordering Issues

- `auditLogger` is applied globally in `core-routes.ts` (`app.use(auditLogger)`), but it is called after some direct mounts in `index.ts` (e.g., `/api/client-errors`, `/api/webhooks`, `/api/public`). Those routes may not be audited.
- `morgan` logging is configured after security middleware, CSRF, and static file serving (index.ts:382). It will miss some early requests.
- `express.json({ limit: '50mb' })` is configured at index.ts:365, but some routes (`/api/client-errors`, `/api/webhooks/stripe-connect`) require custom body parsers before it. The order is correct in this specific case, but the fact that body parser configuration is scattered in `index.ts` is a code smell.

### 3.11 No Single Source of Truth for Routes

There is no generated route map, no OpenAPI schema, and no test that verifies every route is reachable and has the expected middleware. New developers must grep `index.ts` and `routes/mounts/*.ts` to understand the API surface.

---

## 4. Gap Analysis

| Guideline / Best Practice | Current State | Gap |
|---------------------------|---------------|-----|
| Routes only route; no business logic in `index.ts` | 98 inline handlers with business logic, DB calls, and Zod validation | Severe violation |
| Layered architecture: `Routes → Controllers → Services → Repositories → DB` | Inline handlers bypass controllers and services; route files often contain business logic and raw SQL | Partial violation |
| BaseController / consistent response/error handling | Inline handlers use ad-hoc `try/catch`, `console.error`, and inconsistent response shapes | Inconsistent |
| Centralized configuration (`unifiedConfig`) | `process.env` is used in `tenants.ts` and inline handlers | Violation |
| All errors to Sentry; no `console.error` | Inline handlers and route files use `console.error` and `console.log` liberally | Violation |
| Explicit error boundaries | No global error middleware is visible in the route mounting section; each handler handles errors inline | Gap |
| No untested business logic | Route files contain business logic without obvious unit tests | Gap |
| Clean/Hexagonal architecture domain boundaries | Route files are organized by feature, but mount points are mixed across `index.ts` and mount files | Partial |
| Predictable route naming and prefixes | Inconsistent: `/api/tenants`, `/api/tenant`, `/organizations`, `/api/organizations`, `/public/tenant`, `/api/public/tenant`, etc. | Inconsistent |
| One router per mount path | `/api/directory` and `/api/tenants` are mounted by many routers with overlapping catch-alls | Violation |

---

## 5. Risk Register

| ID | Risk | Severity | Evidence |
|----|------|----------|----------|
| R1 | `/api/directory` catch-alls shadow specific sub-routes | **Critical** | 12+ routers at `/api/directory`; `directory.ts` `/:slug` does not call `next()`; `directory-v2.ts` has hard-coded `next()` whitelist |
| R2 | `/api/tenants` catch-alls shadow sub-resource routes | **Critical** | `tenants.ts` at `/api/tenants` with `/:id`; many sub-routers (`paymentGatewaySettings`, `stripeConnect`, etc.) mounted after it |
| R3 | Inline handlers in `index.ts` silently override router files | **Critical** | `GET /api/tenants/:id` is inline in `index.ts` and the `tenants.ts` router has a comment noting it is ignored |
| R4 | Duplicate mounts cause silent behavior changes | **High** | `paypalConnectRoutes`, `billingRoutes`, `directoryPhotosRouter`, `storefrontTypeSettingsRoutes`, etc. mounted twice or at multiple prefixes |
| R5 | Auth middleware inconsistency | **High** | Some admin routes mount `authenticateToken`/`requireAdmin` at `app.use`, others rely on internal route-level auth |
| R6 | Missing global error / Sentry boundary | **High** | `console.error` in many files; `index.ts` uses `try/catch` around `mountAllRoutes` but does not send to Sentry |
| R7 | No generated route map / OpenAPI | **Medium** | No automation to verify 312 route files |
| R8 | Middleware order gaps (audit, morgan) | **Medium** | `auditLogger` misses routes mounted before it; `morgan` configured after many routes |
| R9 | Body parser misconfiguration risk | **Medium** | `express.json` and `express.raw` configured inline in `index.ts` |

---

## 6. Optimization Recommendations

### 6.1 Immediate Fixes (No Structural Refactor)

1. **Stop registering inline handlers in `index.ts`.** Move all 98 inline handlers into `routes/` files with explicit mount points. Use the existing `routes/` directory.
2. **Pick a single `GET /api/tenants/:id` owner.** Either `index.ts` or `routes/tenants.ts`. Remove the duplicate. Add an integration test.
3. **Remove duplicate `app.use` mounts.** If a router is truly an alias, create a dedicated alias router rather than double-mounting.
4. **Audit `/api/directory` mount order.** Mount specific sub-paths (`/mv`, `/categories`, `/store-types`, `/featured-products`, `/random-featured`, `/featured-stats`, `/premium-featured-products`, `/featured-stores`, `/map`, `/consolidated`, `/categories-optimized`, `/photos`) **before** any router with `/:identifier` or `/:slug`. Ensure every catch-all calls `next()` when it cannot resolve the request.
5. **Audit `/api/tenants` mount order.** Mount all `/:tenantId/<sub-resource>` routers before `tenants.ts` `/:id` catch-all, or restructure `tenants.ts` so it does not have a catch-all at the root.
6. **Standardize auth middleware.** For each admin/tenant route, decide whether auth is at the `app.use()` or router level. Document the rule and add a lint check.
7. **Move `auditLogger` and `morgan` to the top of middleware setup** so they cover all routes, including `/api/client-errors`, `/api/webhooks`, and `/api/public`.

### 6.2 Short-Term Architecture Improvements

1. **Create a single `routeRegistry.ts` module.**
   - Define every router, its mount path, its middleware stack, and a `priority` or `order` number.
   - Replace the `app.use()` soup in `index.ts` with a single loop:
   ```ts
   for (const route of routeRegistry) {
     app.use(route.path, ...route.middleware, route.router);
   }
   ```
   This makes the order explicit and sortable.
2. **Group routes by domain prefix.** Use a single mount point per domain:
   - `/api/tenants/:tenantId/*` → `tenant-routes.ts` (orchestrates all tenant sub-routers internally)
   - `/api/directory/*` → `directory-routes.ts` (orchestrates all directory sub-routers internally)
   - `/api/admin/*` → `admin-routes.ts` (already exists but should be the only admin mount)
   - `/api/public/*` → `public-routes.ts` for all unauthenticated reads
   - `/api/checkout/*` → already grouped; follow this pattern elsewhere
3. **Avoid `app.use('/api', ...)` for any router with a catch-all.** If a router must have a catch-all, mount it at a specific prefix (e.g., `/api/shops` not `/api`).
4. **Introduce `mergeParams: true` consistently** for tenant sub-routers and remove `/:tenantId` duplication.
5. **Remove commented-out imports.** Dozens of `// import ...` and `// app.use(...)` lines in `index.ts` create confusion. Remove them; history is in git.

### 6.3 Medium-Term Refactor Toward Guidelines

1. **Adopt `BaseController` pattern.** Every route handler should delegate to a controller. No business logic in `index.ts` or route files.
2. **Adopt dependency injection / service layer.** Route handlers should not call `prisma` directly or use `getDirectPool()` outside services.
3. **Use `unifiedConfig` everywhere.** Remove `process.env` direct usage from `tenants.ts` and route files.
4. **Centralize error handling.** Use a global Express error handler and `asyncErrorWrapper`. Stop using `console.error` in route files; send errors to Sentry.
5. **Add route-level request validation.** Use Zod at route entry (already in some places) but make it mandatory via a factory.

### 6.4 Long-Term Target Architecture

1. **Domain-Driven route modules.** Each domain (`tenant`, `directory`, `catalog`, `checkout`, `admin`, `public`, `customer`) has:
   - `routes/<domain>/<domain>.routes.ts` — orchestrating router
   - `routes/<domain>/<domain>.controller.ts` — controllers
   - `routes/<domain>/<domain>.service.ts` — services
   - `routes/<domain>/<domain>.schema.ts` — Zod schemas
2. **Single mount point per domain in `index.ts`:**
   ```ts
   app.use('/api/auth', authRoutes);
   app.use('/api/public', publicRoutes);
   app.use('/api/tenants', tenantRoutes);
   app.use('/api/directory', directoryRoutes);
   app.use('/api/admin', adminRoutes);
   app.use('/api/checkout', checkoutRoutes);
   app.use('/api/customers', customerRoutes);
   ```
3. **Internal sub-router registry per domain.** For example, `directory.routes.ts` mounts its sub-routers in a strict order and catch-alls are last.
4. **Automated route map and OpenAPI generation.** A build script parses `routes/` and emits `openapi.json` and a route-coverage test.

---

## 7. Proposed Route Mount Order (Target)

Inside `apps/api/src/index.ts`:

```ts
// 1. Middleware (no routes)
app.use(securityHeaders, additionalSecurityHeaders, securityLogger, validateInput, ...);
app.use(cors(...));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(applyRateLimit, inputValidationMiddleware, performanceMonitoring, requestLogger, setRequestContext, ...);

// 2. Static / health / public
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/api/webhooks', rawBody, webhooksRoutes);
app.use('/api/public', publicRoutes);

// 3. Auth (no auth required)
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

// 4. Domain routers
app.use('/api/admin', adminRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/directory', directoryRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/integrations', integrationRoutes);
// ... etc

// 5. Global 404/500 handlers
app.use(notFoundHandler);
app.use(globalErrorHandler);
```

Inside `directory.routes.ts`:

```ts
// Specific sub-paths first
router.use('/mv', directoryMvRoutes);
router.use('/categories', directoryCategoriesRoutes);
router.use('/store-types', directoryStoreTypesRoutes);
router.use('/featured-products', directoryFeaturedProductsRoutes);
router.use('/random-featured', directoryRandomFeaturedRoutes);
router.use('/featured-stats', directoryFeaturedStatsRoutes);
router.use('/premium-featured-products', directoryPremiumFeaturedRoutes);
router.use('/featured-stores', directoryFeaturedStoresRoutes);
router.use('/consolidated', directoryConsolidatedRoutes);
router.use('/categories-optimized', directoryCategoriesOptimizedRoutes);
router.use('/map', directoryMapRoutes);
router.use('/photos', directoryPhotosRoutes);

// Generic listing routes
router.use('/stores', directoryStoresRoutes);
router.use('/search', directorySearchRoutes);
router.use('/locations', directoryLocationsRoutes);
router.use('/:slug', directoryBySlugRoutes); // LAST, calls next() if no listing
```

This structure removes the need for inline manual ordering and makes shadowing visible at a glance.

---

## 8. Implementation Roadmap

### Phase 1 — Stabilize (1 week)
- [ ] Move all inline `index.ts` handlers to `routes/` files.
- [ ] Remove duplicate `app.use` mounts.
- [ ] Fix `/api/directory` and `/api/tenants` catch-all ordering.
- [ ] Standardize auth middleware for admin routes.
- [ ] Add a one-time `routeInventory` script that dumps every mount to JSON for verification.

### Phase 2 — Consolidate (2 weeks)
- [ ] Create `routeRegistry.ts` and replace `app.use` soup with explicit registry.
- [ ] Merge modular mount files into a single `mountRoutes()` function driven by the registry.
- [ ] Group tenant sub-routers under a single `tenant.routes.ts` orchestrator.
- [ ] Group directory sub-routers under a single `directory.routes.ts` orchestrator.
- [ ] Move middleware setup to a dedicated `middleware/` bootstrap.

### Phase 3 — Refactor (3–4 weeks)
- [ ] Introduce `BaseController` and controllers for all route handlers.
- [ ] Move business logic from route files into services.
- [ ] Replace `process.env` with `unifiedConfig`.
- [ ] Add `asyncErrorWrapper` and global error handler.
- [ ] Add Sentry integration to all route handlers.

### Phase 4 — Verify (2 weeks)
- [ ] Generate route map / OpenAPI from the registry.
- [ ] Add route-coverage tests (ensure every mount has a smoke test).
- [ ] Add CI check that fails if a new catch-all is mounted before a static route.

---

## 9. Quick Wins

1. **Delete commented-out `app.use` lines in `index.ts` (lines 6838–6848, 7173, etc.).**
2. **Remove the duplicate `mountAllRoutes()` + direct mounts pattern.** Call `mountAllRoutes` once and move all other mounts into the appropriate mount file.
3. **Replace `console.log('✅ ...')` route mounting logs with a structured logger or remove them.** They add noise and are not the right observability signal.
4. **Add `express.Router({ strict: true })` or `mergeParams: true` consistently** to prevent accidental segment matching.

---

## 10. Conclusion

The API route layer is functional but fragile. The root cause is not Express itself; it is that `index.ts` has become a global route registry with two competing mounting strategies, inline business logic, and overlapping catch-all routers. The recommended path is to:

1. **Centralize the route registry** in a single, explicit, ordered data structure.
2. **Move all inline handlers** into `routes/` files.
3. **Group domains** under single mount points and orchestrate sub-routers internally.
4. **Move toward controllers and services** to align with `backend-dev-guidelines` and `architecture-patterns`.

This will eliminate the hidden, shadowed, and blocked endpoints that prompted the audit and make the backend predictable, observable, and maintainable.

---

## Appendix A — Key Collision Paths

| Path Prefix | Routers Mounted | Risk |
|-------------|-----------------|------|
| `/api/directory` | `directory-consolidated`, `directory-random-featured`, `directory-random-featured-global`, `directory-categories`, `directory-store-types`, `directory-featured-products`, `directory-random-featured`, `directory-featured-stats`, `directory-premium-featured-products`, `directory-photos`, `directory-categories-enhanced`, `directory-map`, `directory-optimized`, `directory-categories-optimized`, `directory` (catch-all), `directory-v2` (catch-all) | Catch-alls likely shadow specific paths |
| `/api/tenants` | `payment-gateways`, `tenant-capabilities`, `tenants` (catch-all `:id`), `tenant-users`, `tenant-stripe-connect`, `fulfillment-settings`, `commerce-settings`, `tax`, `product-options-settings`, `featured-options-settings`, `quickstart-options-settings`, `storefront-options-settings`, `directory-entry-options-settings`, `storefront-type-settings`, `product-type-settings`, `storefront-policies`, `faq-options-settings`, `crm-options-settings`, `social-commerce-options-settings`, `chatbot-options-settings`, `barcode-scan-settings`, `integration-options-settings`, `payment-gateway-settings`, `organization-commerce-settings`, `shipments`, `abandoned-carts`, `trial-setup`, `tenant-notifications`, `digital-download-pages`, `tenant-categories` | Order-dependent; `tenants.ts` catch-all can intercept tenant IDs that collide with route names |
| `/api/admin` | `admin-*` routers, `platform-settings`, `tenant-flags`, `platform-flags`, `effective-flags`, `admin-tools`, `admin-users`, `taxonomy-admin`, `capability-routes`, `tier-system`, `tier-management`, `manual-billing`, `platform-revenue`, `platform-fee-invoices`, `paypal-connect`, `notification-logs`, `inventory-transfers`, `slug-registry`, `catalog`, `inventory`, `google-product-taxonomy`, `demo-tenants`, `service-charges`, `security-monitoring`, `security` | Many `admin-` routers + generic `admin-tools`/`admin-users` cause prefix collisions; auth middleware varies |
| `/api` | `tenant-featured`, `featured-products`, `scan`, `product-featuring`, `platform-settings`, `rate-limit-warnings`, `billing`, `tenant-orders`, `active-featured`, `featured-placements`, `badge-registry`, `badge-analytics`, `google-business-oauth`, `meta-oauth`, `meta-webhooks`, `tiktok-oauth`, `tiktok-webhooks`, `social-proof`, `shipping-rates`, `returns`, `social-pixels`, `store-reviews` | Any router with a catch-all at `/api` level will shadow all later mounts |
| `/api/orders` | `buyer-orders` and `orders` (authenticated) mounted at same prefix | `buyer-orders` must come before `orders` or be split by prefix |
| `/api/checkout` | `checkout`, `checkout-payments`, `paypal`, `square`, `stripe` | Good example of domain grouping; keep this pattern |

---

## Appendix B — Files Consulted

- `apps/api/src/index.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/src/routes/mounts/admin-routes.ts`
- `apps/api/src/routes/mounts/core-routes.ts`
- `apps/api/src/routes/mounts/auth-routes.ts`
- `apps/api/src/routes/mounts/dashboard-routes.ts`
- `apps/api/src/routes/mounts/directory-routes.ts`
- `apps/api/src/routes/mounts/integration-routes.ts`
- `apps/api/src/routes/directory.ts`
- `apps/api/src/routes/directory-v2.ts`
- `apps/api/src/routes/directory-consolidated.ts`
- `apps/api/src/routes/directory-categories.ts`
- `apps/api/src/routes/directory-mv.ts`
- `apps/api/src/routes/directory-optimized.ts`
- `apps/api/src/routes/ENHANCED_DIRECTORY_ROUTES.ts`
- `apps/api/src/routes/tenants.ts`
- `apps/api/src/routes/payment-gateway-settings.ts`
- `apps/api/src/routes/public-api.ts`
- `.agents/skills/backend-dev-guidelines/SKILL.md`
- `.agents/skills/architecture-patterns/SKILL.md`
