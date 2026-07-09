---
description: How to audit and restructure an Express route layer to eliminate shadowing, catch-all collisions, duplicate mounts, and inline handler rot
---

# API Route Architecture Audit & Restructuring

Use this skill when the backend has grown into an unplanned route registry, `index.ts` is full of `app.use()` and inline handlers, and there are reports of endpoints being shadowed, returning 404s unexpectedly, or behaving differently after small changes. This is an audit-and-reshape process, not a feature addition.

## Symptoms That Trigger This Skill

- `apps/api/src/index.ts` is 2,000+ lines and contains many `app.use('/api/...')` calls.
- The same route is mounted more than once (different prefixes or the same prefix).
- Endpoints return 404 for paths that exist in a route file.
- Adding a new route breaks an existing one, especially under `/api/directory`, `/api/tenants`, or `/api`.
- Route handlers contain raw SQL, Prisma calls, business logic, or `process.env` reads.
- `console.error` and `console.log` are used throughout route files.
- `/:id`, `/:slug`, `/:identifier`, `/:tenantId` catch-alls exist in routers mounted at shared prefixes.
- There is no generated route map, OpenAPI spec, or route-coverage test.

## Effort Insights (What This Costs)

| Refactor Stage | Typical Effort | Complexity | Why |
|---|---|---|---|
| **Inventory** | 2–4 hours | Low | Grepping `app.use` and `router.get` is fast; the work is interpreting mount order. |
| **Route registry extraction** | 2–3 days | Medium | Moving `app.use` into a single registry is mechanical, but the order must be preserved exactly. |
| **Inline handler relocation** | 3–5 days | High | 50–100 inline handlers may have hidden dependencies, local variables, and hard-coded DB calls. Each needs tests. |
| **Catch-all collision fixes** | 2–4 days | Medium | Reordering is easy; the risk is behavioral changes. Add a route-order verification test. |
| **Domain orchestrator consolidation** | 3–5 days | Medium | Moving `routes/mounts/*.ts` into domain routers and deleting old files. Mostly mechanical. |
| **Controller/service refactor** | 1–3 weeks | High | Moving business logic out of routes requires understanding each handler and writing tests. |
| **OpenAPI / route map / CI** | 2–3 days | Low | Once controllers/schemas exist, generation is straightforward. |
| **Total for a monolithic `index.ts` (8,000+ lines, 250+ mounts)** | 4–6 weeks | High | Serial dependency: stabilization → collision fixes → consolidation → controllers → observability. |

**Rule of thumb:** Every 50 `app.use()` calls in `index.ts` adds roughly 1 day of stabilization and 1 day of testing. Every 25 inline handlers adds 1–2 days of relocation. Catch-alls at shared prefixes multiply effort because each must be hand-verified.

## The 4-Phase Audit Process

### Phase 1: Inventory the Surface

1. **Count the scale.**

```bash
# Count mounts in the main entry point
grep -n "app\.use(" apps/api/src/index.ts | wc -l

# Count inline handlers in the main entry point
grep -nE "app\.(get|post|put|delete|patch|all)\(" apps/api/src/index.ts | wc -l

# Count route files
find apps/api/src/routes -type f -name '*.ts' | wc -l

# List all routers mounted and their order
grep -n "app\.use(" apps/api/src/index.ts > /tmp/index-mounts.txt
```

2. **Identify the collision prefixes.** Run:

```bash
grep -n "app\.use(" apps/api/src/index.ts | grep -E "\'/api/(directory|tenants|admin|)'" | sort -t'/' -k3
```

3. **Find catch-all routes.**

```bash
grep -rn "router\.(get|post|put|delete|patch)\(['\"]/:" apps/api/src/routes/ | head -50
```

4. **Map duplicate mounts.**

```bash
grep -n "app\.use(" apps/api/src/index.ts | awk -F"'" '/\.use\(.+\'/{print $2}' | sort | uniq -d
```

5. **Look for inline handlers in `index.ts`.** Any `app.get('/api/...', ...)` that is not in `routes/` is a hidden endpoint.

### Phase 2: Score the Risks

Rank each risk as **Critical**, **High**, **Medium**, or **Low**.

| Risk Type | Critical Criteria | Examples |
|---|---|---|
| **Catch-all shadowing** | A `/:id` or `/:slug` router is mounted at a prefix that also has specific sub-routes, and the catch-all is earlier in order. | `/api/tenants/:id` before `/api/tenants/:tenantId/payment-gateway-settings` |
| **Inline handler hiding** | `index.ts` has an inline handler for the same path a router file claims to own. | `GET /api/tenants/:id` in `index.ts` while `routes/tenants.ts` has the same route |
| **Duplicate mounts** | The same router is mounted at two prefixes or the same prefix twice. | `billingRoutes` in `core-routes.ts` and `index.ts` |
| **Prefix dumping** | A router is mounted at `/api` with a catch-all. | `app.use('/api', someRouterWithCatchAll)` |
| **Auth inconsistency** | Same route family protected by different middleware combinations. | Some admin routes use `requireAdmin` at mount, others internally |

**Risk scoring rule:** Any prefix with 3+ routers mounted at the same path is automatically a collision risk. Any catch-all in a router mounted at a prefix with sub-routers is automatically Critical.

### Phase 3: Design the Target Structure

The target architecture is one mount point per domain in `index.ts`, with internal orchestrators handling sub-route ordering.

```ts
// apps/api/src/index.ts
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/directory', directoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/checkout', checkoutRoutes);
```

Inside `directory.routes.ts`:

```ts
const router = Router();

// Static sub-paths first
router.use('/mv', directoryMvRoutes);
router.use('/categories', directoryCategoriesRoutes);
router.use('/store-types', directoryStoreTypesRoutes);
router.use('/featured-products', directoryFeaturedProductsRoutes);
router.use('/random-featured', directoryRandomFeaturedRoutes);
router.use('/featured-stores', directoryFeaturedStoresRoutes);
router.use('/consolidated', directoryConsolidatedRoutes);
router.use('/map', directoryMapRoutes);
router.use('/photos', directoryPhotosRoutes);
router.use('/stores', directoryStoresRoutes);
router.use('/search', directorySearchRoutes);
router.use('/locations', directoryLocationsRoutes);

// Generic catch-all LAST
router.use('/:slug', directoryBySlugRoutes);

export default router;
```

**Ordering rule:** Always mount static paths before dynamic parameters. Always mount `/:id` last. If a catch-all cannot resolve a value, it must call `next()` to allow downstream routers to handle the request.

### Phase 4: Execute in Priority Order

1. **Stabilize:** Create a single `routeRegistry.ts` and move all `app.use` calls into it. Do not change behavior yet.
2. **Relocate inline handlers:** Move every `app.get/post/put/patch/delete` from `index.ts` into `routes/` files. Keep the path/method identical.
3. **Remove duplicates:** Delete duplicate mounts. Use explicit alias routers if a secondary path is genuinely required.
4. **Fix collision surfaces:** Reorder `/api/directory`, `/api/tenants`, and `/api/admin` catch-alls.
5. **Consolidate domains:** Create domain orchestrators and delete `routes/mounts/`.
6. **Refactor controllers/services:** Move business logic out of route files. This is the highest-effort phase and should be incremental.
7. **Add observability:** Generate route map, OpenAPI, and route-coverage tests.

## Common Pitfalls & How to Avoid Them

### Pitfall 1: "I just moved the `app.use` and now a route returns 404."

**Cause:** Express matches routers in registration order. If you moved a catch-all earlier, it now captures the request.

**Fix:** Re-run the route-order verification script. Ensure static paths precede dynamic parameters.

### Pitfall 2: "The new controller works but the old handler still runs."

**Cause:** `index.ts` still has an inline handler for the same path.

**Fix:** Search `index.ts` for the route path (without leading slash) and remove the inline handler.

### Pitfall 3: "Auth works locally but not on staging."

**Cause:** Auth middleware is applied at `app.use` in one place and per-route in another. After refactoring, some routes may be double-protected or unprotected.

**Fix:** Define the auth rule in `routeRegistry.ts` (public, tenant, admin, webhook). Add a unit test that inspects the route stack and asserts each route has the expected middleware.

### Pitfall 4: "A route is mounted twice and both handlers run."

**Cause:** `app.use` is called twice for the same router, or the same router is mounted at `/api` and `/api/tenants` and its handlers match both prefixes.

**Fix:** Assign one canonical mount path. If the router is intended to be used at both prefixes, create a thin factory that returns a router with the correct base path.

### Pitfall 5: "Body is undefined in a webhook route."

**Cause:** Body parser middleware (`express.json`) is configured before the route and is consuming the raw body, or the route needs `express.raw` but is mounted after `express.json`.

**Fix:** Mount webhook routers with `express.raw({ type: 'application/*' })` before `express.json()`. Move middleware configuration to `middleware/bootstrap.ts`.

## Quick Wins (Do These First)

1. **Delete commented-out imports and mounts.** They create noise and make grep inventory unreliable.
2. **Create `routeRegistry.ts` and replace the `app.use` soup.** Even if you do nothing else, you now have an explicit, sorted list of all routes.
3. **Remove duplicate mounts.** Zero-risk and immediately reduces surface confusion.
4. **Move inline handlers to `routes/` files.** Keep them as thin wrappers initially; do not rewrite logic yet.
5. **Add a route-order verification script.** It catches shadowing regressions before they merge.

## Long-Term Patterns

- **One router per domain prefix in `index.ts`.** No exceptions.
- **Domain orchestrators handle sub-route ordering.** Each domain has a single `*.routes.ts` file that mounts sub-routers in the correct order.
- **Catch-alls call `next()` on miss.** A catch-all should never 404 if another router might handle the same path.
- **No business logic in routes.** Route files delegate to controllers; controllers delegate to services.
- **No `process.env` in routes.** Use `unifiedConfig`.
- **No `console.error` in routes.** Use the global error handler and Sentry.
- **Generated route map.** Every PR should update `route-map.json` and OpenAPI spec.
- **CI catch-all ordering check.** A script should fail the build if a catch-all is added before a static route in the same orchestrator.

## Tools & Commands

```bash
# Inventory mounts
 grep -n "app\.use(" apps/api/src/index.ts > /tmp/index-mounts.txt

# Inventory inline handlers
 grep -nE "app\.(get|post|put|delete|patch|all)\(" apps/api/src/index.ts > /tmp/index-handlers.txt

# Count route files
 find apps/api/src/routes -type f -name '*.ts' | wc -l

# Find catch-alls
 grep -rn "router\.(get|post|put|delete|patch)\(['\"]/:" apps/api/src/routes/

# Find duplicate mount paths
 grep -n "app\.use(" apps/api/src/index.ts | awk -F"'" '/\.use\(.+\'/{print $2}' | sort | uniq -d

# Find inline handlers that should be in route files
 grep -n "app\.\(get\|post\|put\|delete\|patch\)\(" apps/api/src/index.ts

# Find process.env in routes
 grep -rn "process\.env" apps/api/src/routes/

# Find console.error in routes
 grep -rn "console\.error" apps/api/src/routes/
```

## Performance Impact

Route architecture cleanup is not primarily a throughput optimization; it is a **latency-consistency, cold-load, and operational-efficiency** optimization. The realistic gains are:

| Area | Before | After |
|---|---|---|
| **Request matching** | 12+ routers mounted at `/api/directory`; Express traverses catch-alls before static paths. | One domain orchestrator, static paths first, catch-all last. Lower per-request CPU and more predictable latency. |
| **Duplicate middleware** | Same router mounted twice or at `/api` and `/api/tenants`. Auth/validation runs repeatedly. | Single canonical mount per router. Removes redundant middleware execution. |
| **Frontend cold-load** | Client re-resolves auth and tenant, causing duplicate `GET /api/tenants/:id` calls and render thrash. | Server-resolved context seeds the client cache; `TenantApiSingleton` caches tenant requests. |
| **Caching / invalidation** | Route files call Prisma directly with no cache contract. | Services extend domain singletons with `getServiceCachePatterns` and `invalidateServiceCaches`. |
| **Observability** | `console.error` and `console.log` are not correlated or persisted. | Structured logging with correlation IDs and Sentry reduces debugging time. |

**Expect modest backend per-request gains and significant frontend cold-load improvement.** The biggest win is eliminating the class of 404/redirect/render-thrash bugs caused by route ordering.

## Related Skills

These skills directly influence the quality and speed of the route refactor. Read them before the corresponding work.

| Skill | Influence | When to Apply |
|---|---|---|
| `tenant-scoped-id-generation.md` | Route element creation — new entities and route IDs should use `id-generator.ts` tenant-scoped prefixes. | Before creating new route files or controllers. |
| `deploy-service-extending-base-singleton.md` | Route endpoint influencer — services called by routes must extend the right domain singleton and implement cache contracts. | When moving business logic from routes into services. |
| `server-resolved-context-delegator.md` | Route context influencer — server layout should resolve auth/tenant once and pass it to the client, eliminating redundant API calls. | When consolidating auth and tenant routes. |
| `start-of-phase-sprint-checklist.md` | Route pre-flight checklist — pick skill documents, plan IDs, singleton bases, and conventions before coding. | At the start of each sprint. |
| `end-of-phase-sprint-checklist.md` | Route post-flight checklist — verify zero TS errors, no direct `fetch`, singleton compliance, ID correlation, and route mounts. | At the end of each sprint. |
| `structured-logging.md` | Route logging influencer — replace `console.*` in route handlers with structured `logger.*` calls. | When moving inline handlers and adding error handling. |

## Verification Checklist

- [ ] `index.ts` has no inline route handlers.
- [ ] `index.ts` has no duplicate `app.use` mounts.
- [ ] Every domain prefix is mounted exactly once in `index.ts`.
- [ ] Every domain orchestrator mounts static sub-paths before catch-alls.
- [ ] Every catch-all calls `next()` when it cannot resolve the request.
- [ ] `pnpm checkapi` and `pnpm checkweb` pass.
- [ ] Route-order verification script passes.
- [ ] Route-coverage smoke tests pass.
- [ ] OpenAPI spec is generated and valid.

## References

- `docs/API_ROUTE_ARCHITECTURE_AUDIT.md` — Full audit findings and risk register.
- `docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md` — Prioritized implementation plan.
- `.agents/skills/backend-dev-guidelines/SKILL.md` — Backend coding standards.
- `.agents/skills/architecture-patterns/SKILL.md` — Clean/Hexagonal/DDD patterns.

## When to Escalate

- If `index.ts` has more than 150 `app.use()` calls, the refactor should be split into multiple sprints.
- If a catch-all is used for more than 30% of routes in a domain, consider a path redesign instead of ordering fixes.
- If route behavior changes cannot be verified by existing smoke tests, add a temporary feature flag before merging.
