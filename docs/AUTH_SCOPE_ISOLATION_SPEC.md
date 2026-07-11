# Auth Scope Isolation — Functional Spec

**Injects into:** Sprint 2.4 (Standardize auth middleware per route) of `API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md`
**Status:** Phase A complete — tenant-capabilities URL split, registry authLevel annotations, frontend URL updates, and CI verification wired. Phase B/C pending.
**Date:** July 2026
**Triggering incident:** Public product page 401 `authentication_required` — `tenantUserRoutes` with `router.use(authenticateToken)` blocked unauthenticated requests from reaching `tenantCapabilitiesRoutes` mounted after it in `tenant.routes.ts`.

---

## Completed Work (Phase A)

- Created `apps/api/src/routes/public-tenant-capabilities.ts` with public routes:
  - `GET /api/public/tenants/resolve/:identifier`
  - `GET /api/public/tenants/:tenantId/capabilities`
  - `GET /api/public/tenants/:tenantId/effective-capabilities` (summary only; `?detail=full` ignored)
- Trimmed `apps/api/src/routes/tenant-capabilities.ts` to authenticated-only routes with per-route `authenticateToken` + `checkTenantAccess`.
- Added `AuthLevel` type and `authLevel` field to `RouteEntry` in `apps/api/src/routes/routeRegistry.ts`, annotated all 203 entries, and mounted `/api/public/tenants`.
- Updated frontend URLs:
  - `UnifiedCapabilityService.ts` → `/api/public/tenants/${tenantId}/effective-capabilities`
  - `PublicApiSingleton.ts` → `/api/public/tenants/resolve/${identifier}`
- Created `scripts/verify-auth-scope.ts` (Check A + Check B) and wired it into `.github/workflows/ci.yml`.
- `pnpm checkapi`, `pnpm checkweb`, and `npx ts-node scripts/verify-auth-scope.ts` all pass.

**Still pending:** deprecated aliases with `Deprecation` + `Sunset` headers (FR-8 step 4), audit of remaining `/api/tenants/` public routes (FR-8 step 6), Phase B/C router-level auth migrations.

---

## Problem Statement

Two structural defects cause public/private auth scope clashes:

### Defect 1: URL namespace collision (root cause)

Public and private routes share the same URL namespace (`/api/tenants/:tenantId/...`). This is an open invitation for scope confusion — a public route and a private route differ only by middleware, not by URL. There is no structural boundary between "anyone can call this" and "only authenticated tenant users can call this."

The codebase already has a `/api/public/tenant/:tenantId/...` pattern for older public endpoints (fulfillment-settings, faq-options, payment-gateways, profile, logo, reviews). But the unified `effective-capabilities` endpoint — which replaced those deprecated endpoints — was placed at `/api/tenants/:tenantId/effective-capabilities`, under the **private** mount point. This was the structural mistake that caused the incident.

### Defect 2: Router-level auth bleed (amplifier)

Express `router.use(middleware)` applies that middleware to **every request** that enters the router — including requests that don't match any route in that router and fall through to `next()`. When multiple routers are mounted inside an orchestrator via `router.use('/', subRouter)`, a router-level `authenticateToken` in one sub-router acts as an implicit auth gate for **all subsequent sub-routers**, even those with public routes.

This creates an **auth bleed** problem: the auth scope of one router leaks into siblings based solely on mount order.

### Incident Example

```
URL: GET /api/tenants/tid-xxx/effective-capabilities (no Auth0 session)

tenant.routes.ts (orchestrator)
  ├─ tenantUserRoutes         → router.use(authenticateToken)  ← auth gate
  ├─ tenantCapabilitiesRoutes → GET /:tenantId/effective-capabilities (public, no auth)
```

Result: `authenticateToken` from `tenantUserRoutes` runs first → 401 → never reaches `tenantCapabilitiesRoutes`.

**Two failures compounded:**
1. A public endpoint was placed at a private URL (`/api/tenants/...` instead of `/api/public/tenants/...`).
2. A router with router-level auth was mounted before the public router, bleeding auth into it.

Either defect alone could cause the incident. Both must be fixed.

### Current Workaround

Reordered mounts so public routers come before auth-gated routers. This is **fragile** — any future router with `router.use(authenticateToken)` placed before a public router reintroduces the bug. There is no compile-time or CI signal to catch it.

### Scope of Problem

**30+ router files** use `router.use(authenticateToken)` at the router level. **6+ public routes** are currently mounted under `/api/tenants/` (the private namespace) instead of `/api/public/tenants/`. Both classes of defect need systematic resolution.

---

## Defense Layers

This spec defines **two defense layers**, in priority order:

| Layer | Mechanism | What it prevents |
|-------|-----------|------------------|
| **L1: URL namespace isolation** | Public routes live under `/api/public/...`, private routes live under `/api/tenants/...`, `/api/admin/...`, etc. | Scope confusion — impossible to accidentally mount a public route in a private namespace or vice versa. |
| **L2: Per-route auth** | No `router.use(authenticateToken)` in orchestrator-mounted sub-routers. Auth is applied per-route. | Auth bleed — even if L1 is violated, middleware from one router cannot block requests to another. |

**L1 is the primary defense.** URL structure is visible, auditable, and enforceable with simple grep. L2 is the secondary defense — it catches the case where someone correctly places a route in the right namespace but incorrectly uses router-level auth.

---

## Functional Requirements

### FR-1: URL namespace isolation (L1 — primary)

**Rule:** Public and private routes MUST NOT share a URL namespace. The URL prefix determines the auth scope:

| URL prefix | Auth scope | Who can call |
|------------|-----------|--------------|
| `/api/public/...` | Public | Anyone — no auth required |
| `/api/tenants/:tenantId/...` | Tenant-private | Authenticated users with tenant access |
| `/api/admin/...` | Admin | Platform admins only |
| `/api/organizations/:orgId/...` | Org-private | Authenticated users with org access |
| `/api/webhooks/...` | Webhook | Signature verification (no auth token) |

**A route mounted under `/api/tenants/` MUST require authentication.** A route that does not require auth MUST be mounted under `/api/public/`.

**Rationale:** URL structure is the strongest boundary because it is:
- **Visible** — anyone reading the URL knows the auth scope.
- **Enforceable** — a simple grep or CI check can verify no public routes exist under `/api/tenants/`.
- **Structural** — Express mount points create physical separation. A router mounted at `/api/public/tenants` cannot be affected by middleware in a router mounted at `/api/tenants`.

### FR-2: Route classification and URL migration

**Rule:** Each route in `tenant-capabilities.ts` must be classified as public-only, private-only, or dual-scope, and placed at the correct URL prefix accordingly.

**Route classification:**

| Route | Scope | Rationale | Current URL | Target URL(s) |
|-------|-------|-----------|-------------|---------------|
| `effective-capabilities` | **Dual-scope** | Public pages need summary; dashboard/settings need `?detail=full` with raw gates | `/api/tenants/:tenantId/effective-capabilities` | `/api/public/tenants/:tenantId/effective-capabilities` (summary, no auth) + `/api/tenants/:tenantId/effective-capabilities` (full, auth required) |
| `capabilities` | **Dual-scope** | Comment says "Accessible with tenant auth or public"; returns tier capability groups | `/api/tenants/:tenantId/capabilities` | `/api/public/tenants/:tenantId/capabilities` (no auth) + `/api/tenants/:tenantId/capabilities` (auth, for dashboard) |
| `resolve/:identifier` | **Public-only** | Slug-to-ID resolution for `PublicApiSingleton.resolveIdentifier()` | `/api/tenants/resolve/:identifier` | `/api/public/tenants/resolve/:identifier` |
| `system-status` | **Private-only** | Dashboard widget; tenant-scoped business state queries | `/api/tenants/:tenantId/system-status` | No change — stays private |
| `next-steps` | **Private-only** | Dashboard widget; tenant-scoped onboarding task list | `/api/tenants/:tenantId/next-steps` | No change — stays private |
| `quick-links` | **Private-only** | Dashboard widget; tenant-scoped quick links | `/api/tenants/:tenantId/quick-links` | No change — stays private |
| `growth-tips` | **Private-only** | Dashboard widget; tenant-scoped growth tips | `/api/tenants/:tenantId/growth-tips` | No change — stays private |
| `capabilities/tiers-by-capability` | **Private-only** | Already has `authenticateToken` | `/api/tenants/capabilities/tiers-by-capability` | No change — stays private |

**Dual-scope pattern:** Routes that serve both public and private consumers get **two endpoints**:

```
GET /api/public/tenants/:tenantId/effective-capabilities
  → No auth. Returns summary only. detail param is ignored (always summary).

GET /api/tenants/:tenantId/effective-capabilities
  → Auth required. detail=full returns raw gates (tier hard-gates + merchant soft-gates).
  → detail=summary (default) returns same shape as public endpoint.
```

The public endpoint is a **safe subset** of the private endpoint. The private endpoint may expose additional detail (`?detail=full`) that includes sensitive configuration (raw tier gates, merchant soft gates). The public endpoint MUST NOT expose `detail=full`.

**Router split:** `tenant-capabilities.ts` should be split:

- `public-tenant-capabilities.ts` — public routes (`effective-capabilities` summary, `capabilities`, `resolve`). Mounted at `/api/public/tenants` in `routeRegistry.ts`.
- `tenant-capabilities.ts` (remaining) — private routes (`effective-capabilities` with `?detail=full` + auth, `system-status`, `next-steps`, `quick-links`, `growth-tips`, `capabilities/tiers-by-capability`). Stays mounted in `tenant.routes.ts` orchestrator.

**Backward compatibility:** During migration, keep the old combined route as a deprecated alias with `Deprecation: true` + `Sunset` headers (same pattern already used by fulfillment-settings, faq-options, etc.). Remove aliases after frontend migration is confirmed.

### FR-2a: Frontend service migration

**Rule:** Frontend services that call routes being migrated MUST update their endpoint URLs. Services that call private-only routes (system-status, next-steps, quick-links, growth-tips) do NOT change — they stay on `/api/tenants/` with `TenantApiSingleton`.

**Migration table:**

| Frontend file | Current endpoint | Target endpoint | Base class | Change needed |
|---------------|-----------------|-----------------|------------|---------------|
| `services/UnifiedCapabilityService.ts` | `/api/tenants/${tenantId}/effective-capabilities` | `/api/public/tenants/${tenantId}/effective-capabilities` | `PublicApiSingleton` (already correct) | Update endpoint URL only |
| `providers/base/PublicApiSingleton.ts` | `/api/tenants/resolve/${identifier}` | `/api/public/tenants/resolve/${identifier}` | `PublicApiSingleton` (already correct) | Update endpoint URL in `resolveIdentifier()` |
| `services/SystemStatusSingletonService.ts` | `/api/tenants/${tenantId}/system-status` | No change | `TenantApiSingleton` | None — private route, stays as-is |
| `services/NextStepsSingletonService.ts` | `/api/tenants/${tenantId}/next-steps` | No change | `TenantApiSingleton` | None — private route, stays as-is |
| `services/QuickLinksSingletonService.ts` | `/api/tenants/${tenantId}/quick-links` | No change | `TenantApiSingleton` | None — private route, stays as-is |
| `services/GrowthTipSingletonService.ts` | `/api/tenants/${tenantId}/growth-tips` | No change | `TenantApiSingleton` | None — private route, stays as-is |

**Note:** If a future public page needs `system-status`, `next-steps`, etc., a new public endpoint should be created under `/api/public/tenants/` at that time — do not retroactively make private routes public. The dual-scope pattern (FR-2) applies only when a route genuinely serves both contexts today.

### FR-3: No router-level auth in orchestrator-mounted sub-routers (L2 — secondary)

**Rule:** Sub-routers mounted inside a domain orchestrator (`tenant.routes.ts`, `admin.routes.ts`, `directory.routes.ts`, etc.) MUST NOT use `router.use(authenticateToken)` or any auth middleware at the router level.

**Rationale:** Even with URL isolation (FR-1), a private orchestrator like `tenant.routes.ts` may mount multiple sub-routers. Router-level auth in one sub-router bleeds into all subsequent siblings. Per-route auth is explicit, self-contained, and order-independent.

**Exception:** A sub-router that is the **only** router in its orchestrator may use router-level auth (no siblings to bleed into). This is discouraged but not blocked.

### FR-4: Auth middleware applied per-route (L2 — secondary)

**Rule:** Every route handler that requires authentication MUST apply `authenticateToken` (and `checkTenantAccess`, `requireTenantAdmin`, `requireAdmin`, etc.) as per-route middleware:

```ts
// ✅ Correct — per-route auth
router.get('/:tenantId/users', authenticateToken, checkTenantAccess, async (req, res) => { ... });
router.post('/:tenantId/users', authenticateToken, requireTenantAdmin, async (req, res) => { ... });

// ❌ Forbidden — router-level auth bleed
router.use(authenticateToken);
router.get('/:tenantId/users', checkTenantAccess, async (req, res) => { ... });
```

**Rationale:** Per-route auth is visible at the route definition, cannot bleed to siblings, and makes the auth requirement explicit in the route registry.

### FR-5: Auth classification in route registry

**Rule:** Each entry in `routeRegistry.ts` MUST declare an `authLevel` field:

```ts
export type AuthLevel = 'public' | 'tenant' | 'admin' | 'webhook';

export interface RouteEntry {
  path: string;
  router: any;
  middleware?: any[];
  domain: string;
  authLevel: AuthLevel;  // NEW
  comment?: string;
  preMiddleware?: boolean;
  isCatchAll?: boolean;
}
```

**Values:**
- `public` — no auth required (storefront, product pages, directory listings). URL prefix: `/api/public/...`
- `tenant` — `authenticateToken` + `checkTenantAccess` (tenant-scoped CRUD). URL prefix: `/api/tenants/...`
- `admin` — `authenticateToken` + `requireAdmin` (platform admin). URL prefix: `/api/admin/...`
- `webhook` — no auth, signature verification inside router. URL prefix: `/api/webhooks/...`

**Rationale:** Makes auth scope visible at the registry level. Enables automated checks (FR-7) and route map generation. The `authLevel` MUST be consistent with the URL prefix — a `public` entry at `/api/tenants/...` is a CI failure.

### FR-6: Orchestrator auth grouping

**Rule:** Domain orchestrators MUST group sub-routers by auth level, with public routers mounted first. This is a **defense-in-depth** layer — FR-1 and FR-3/FR-4 make order irrelevant, but grouping provides a readable structure and an extra safety net.

```ts
// tenant.routes.ts — recommended structure

// ── Public sub-routers (no auth) ──
// After FR-2 migration, these should be moved to a public orchestrator
// and mounted at /api/public/tenants. Until then, mount first.
router.use('/', tenantCapabilitiesRoutes);
router.use('/', directoryTenantRoutes);
router.use('/', abandonedCartRoutes);

// ── Tenant-authenticated sub-routers (per-route auth) ──
router.use('/', paymentGatewaysRoutes);
router.use('/', fulfillmentSettingsRoutes);
// ...

// ── Main CRUD router — LAST ──
router.use('/', tenantsRoutes);
```

**Rationale:** Even with per-route auth (FR-4), grouping by auth level makes the orchestrator readable and ensures that if someone accidentally adds `router.use(authenticateToken)` to a sub-router, the blast radius is limited to other authenticated routers — not public ones.

### FR-7: CI enforcement

**Rule:** Two CI checks MUST fail the build:

**Check A — URL/authLevel consistency:** No route entry in `routeRegistry.ts` with `authLevel: 'public'` may have a path starting with `/api/tenants/`, `/api/admin/`, or `/api/organizations/`. No entry with `authLevel: 'tenant'` or `'admin'` may have a path starting with `/api/public/`.

**Check B — No router-level auth in orchestrator sub-routers:** No router file mounted inside a domain orchestrator may contain `router.use(authenticateToken)` or `router.use(requireAdmin)` at the router level.

**Detection approach:** Implemented in `scripts/verify-auth-scope.ts`.

- **Check A** parses `routeRegistry.ts`, extracts `path` + `authLevel`, and fails if a `public` entry starts with `/api/tenants/`, `/api/admin/`, or `/api/organizations/`, or if a `tenant`/`admin` entry starts with `/api/public/`.
- **Check B** reads each orchestrator's relative imports and scans only those sub-router files for bare `router.use(authenticateToken)`, `router.use(requireAuth)`, `router.use(requireAdmin)`, or `router.use(requirePlatformAdmin)`. Mount-level auth such as `router.use('/path', authenticateToken, subRouter)` is intentionally allowed.

**Exception list:** Standalone routers mounted directly in `routeRegistry.ts` (not inside an orchestrator) are exempt from Check B — they have no siblings to bleed into.

### FR-8: Migration plan

**Phase A — URL migration (Sprint 2):**

- [x] 1. Split `tenant-capabilities.ts` into `public-tenant-capabilities.ts` (public routes) and remaining `tenant-capabilities.ts` (private routes).
- [x] 2. `public-tenant-capabilities.ts` contains: `effective-capabilities` (summary only), `capabilities`, `resolve/:identifier`. Mounted at `/api/public/tenants` in `routeRegistry.ts`.
- [x] 3. Private `tenant-capabilities.ts` keeps: `effective-capabilities` (with `?detail=full` + `authenticateToken`), `system-status`, `next-steps`, `quick-links`, `growth-tips`, `capabilities/tiers-by-capability`. Stays in `tenant.routes.ts` orchestrator.
- [ ] 4. Keep old combined routes as deprecated aliases with `Deprecation` + `Sunset` headers. *(Pending — aliases not yet added.)*
- [x] 5. Update frontend services per FR-2a migration table:
   - `UnifiedCapabilityService.ts` → `/api/public/tenants/${tenantId}/effective-capabilities`
   - `PublicApiSingleton.resolveIdentifier()` → `/api/public/tenants/resolve/${identifier}`
   - `SystemStatusSingletonService.ts`, `NextStepsSingletonService.ts`, `QuickLinksSingletonService.ts`, `GrowthTipSingletonService.ts` → no change
- [ ] 6. Audit all other routes under `/api/tenants/` for public routes that should be under `/api/public/tenants/`. *(Pending follow-up audit.)*

**Phase B — Router-level auth migration (Sprint 2):**

| File | Current | Target |
|------|---------|--------|
| `tenant-users.ts` | `router.use(authenticateToken)` | Per-route `authenticateToken` on all 8 routes |
| `organization-capabilities.ts` | `router.use(authenticateToken)` | Per-route `authenticateToken` on all routes |
| `admin/bot-embed-licenses.ts` | `router.use(authenticateToken)` | Per-route `authenticateToken` on all routes |

**Phase C — Standalone router cleanup (Sprint 3, follow-up):**

| File | Current | Notes |
|------|---------|-------|
| `users.ts` | `router.use(authenticateToken)` | Standalone mount — no bleed risk, but follow pattern |
| `security.ts` | `router.use(authenticateToken)` + `router.use(requireAdmin)` | Standalone mount |
| `subscription-billing.ts` | `router.use(authenticateToken)` | Standalone mount |
| `payments.ts` | `router.use(authenticateToken)` | Standalone mount |
| `faq.ts` | `router.use(authenticateToken)` | Standalone mount |
| `mfa.ts` | `router.use(authenticateToken)` | Standalone mount |
| `gdpr.ts` | `router.use(authenticateToken)` | Standalone mount |
| `tier-config.ts` | `router.use(authenticateToken)` | Standalone mount |
| `bsaas-purchases.ts` | `router.use(authenticateToken)` | Standalone mount |
| `auth0-mfa.ts` | `router.use(authenticateToken)` | Standalone mount |
| All `*-singleton.ts` routers | `router.use(authenticateToken)` | Standalone mounts — 12+ files |

**Acceptance:** All public routes live under `/api/public/...`. All orchestrator-mounted routers use per-route auth. Standalone routers migrated for consistency in Sprint 3.

---

## Non-Functional Requirements

### NFR-1: Zero behavior change

The migration MUST NOT change the auth behavior of any route. Every route that was protected before must still be protected. Every route that was public before must still be public. URL changes must have deprecated aliases during transition.

### NFR-2: No double-auth

Routes that already have `checkTenantAccess` or `requireTenantAdmin` as per-route middleware do NOT need an additional `authenticateToken` — those middleware functions already check `req.user` and return 401 if not authenticated. Adding `authenticateToken` before them is redundant but harmless. The migration should add `authenticateToken` only to routes that lack any auth middleware.

### NFR-3: Order independence

After migration, the mount order of sub-routers inside an orchestrator MUST NOT affect auth behavior. Reordering sub-routers should be safe. This is the core invariant that prevents future regressions.

### NFR-4: URL prefix determines auth scope

The URL prefix (`/api/public/` vs `/api/tenants/` vs `/api/admin/`) MUST be the authoritative indicator of auth scope. A developer reading a URL should know immediately whether it requires auth, without reading the route file. CI checks enforce that `authLevel` in the registry matches the URL prefix.

---

## Verification

### V-1: URL/authLevel consistency test

Add a test to `scripts/verify-auth-scope.ts`:

1. Parse `routeRegistry.ts`.
2. For each entry, assert `authLevel` is consistent with URL prefix (FR-7 Check A).
3. Fail on any mismatch.

### V-2: Auth scope test

1. Boot Express without listening.
2. For each `authLevel: 'public'` route, send a mock unauthenticated request.
3. Assert the request is NOT rejected by auth middleware (i.e., reaches the route handler or returns a non-401 response).
4. For each `authLevel: 'tenant'` route, send a mock unauthenticated request.
5. Assert the request IS rejected with 401.

### V-3: CI check

`scripts/verify-auth-scope.ts` is the single source of truth. It parses `routeRegistry.ts` for URL/`authLevel` consistency (Check A) and scans sub-routers imported by `tenant.routes.ts`, `admin.routes.ts`, and `directory.routes.ts` for forbidden router-level auth middleware (Check B). Standalone routers mounted directly in `routeRegistry.ts` are exempt from Check B.

```yaml
# In .github/workflows/ci.yml
- name: Verify auth scope isolation
  run: npx ts-node scripts/verify-auth-scope.ts
```

### V-4: Smoke test

After migration, verify:
- `GET /api/public/tenants/:tenantId/effective-capabilities` returns 200 without auth headers (summary only).
- `GET /api/public/tenants/:tenantId/effective-capabilities?detail=full` returns 200 but ignores `detail=full` (returns summary, not raw gates).
- `GET /api/tenants/:tenantId/effective-capabilities` returns 401 without auth headers (private endpoint now requires auth).
- `GET /api/tenants/:tenantId/effective-capabilities` with auth returns 200; `?detail=full` returns raw gates.
- `GET /api/public/tenants/:tenantId/capabilities` returns 200 without auth headers.
- `GET /api/tenants/:tenantId/system-status` returns 401 without auth headers (private, no change).
- `GET /api/tenants/:tenantId/next-steps` returns 401 without auth headers (private, no change).
- `GET /api/tenants/:tenantId/users` returns 401 without auth headers (private, no change).
- Deprecated alias `GET /api/tenants/:tenantId/effective-capabilities` (without auth) returns 200 with `Deprecation: true` header during transition period.

---

## Relationship to Existing Sprint Plan

This spec enhances **Sprint 2.4** ("Standardize auth middleware per route") with:

1. **URL namespace isolation (FR-1, FR-2)** — the root cause fix. Public routes belong under `/api/public/...`, not `/api/tenants/...`. The current Sprint 2.4 only addresses middleware, not URL structure.
2. **Two-layer defense model** — L1 (URL isolation) as primary, L2 (per-route auth) as secondary. The current Sprint 2.4 treats auth middleware as the only mechanism.
3. **FR-5** — `authLevel` field in the route registry, with CI enforcement of URL/authLevel consistency.
4. **FR-7** — Two CI checks (URL consistency + no router-level auth), vs. the current Sprint 2.4 which has no enforcement mechanism.
5. **FR-8** — Concrete migration plan with URL moves, router splits, and deprecated aliases.
6. **NFR-4** — URL prefix as the authoritative auth scope indicator.

### Suggested edit to Sprint 2.4

Replace the current Sprint 2.4 section with a reference to this spec:

> **2.4 — Auth scope isolation**
> - **Spec:** `docs/AUTH_SCOPE_ISOLATION_SPEC.md`
> - **Summary:** Two-layer defense — (L1) move public routes to `/api/public/tenants/...` namespace, (L2) eliminate `router.use(authenticateToken)` from orchestrator-mounted sub-routers. Add `authLevel` to route registry entries with CI enforcement of URL/authLevel consistency.
> - **Acceptance:** All public routes live under `/api/public/...`. All orchestrator-mounted routers use per-route auth. CI checks pass. Public routes return 200 without auth. Protected routes return 401 without auth. Mount order does not affect auth behavior. URL prefix is the authoritative auth scope indicator.

---

## Skill Updates Required

The following agent skills must be updated to enforce and align with the rules in this spec:

### 1. `capability-deployment-flow.md`

**Phase 5 (Route)** — Add URL namespace selection rule:
- Public capability routes (readable by storefront/product pages) MUST be mounted at `/api/public/tenants/:tenantId/*`.
- Private capability routes (dashboard/settings only) MUST stay at `/api/tenants/:tenantId/*` with per-route `authenticateToken`.
- Dual-scope routes (e.g., `effective-capabilities`) get two endpoints: public summary at `/api/public/tenants/...` + private full detail at `/api/tenants/...` with auth.

**Phase 6 (Map)** — Add URL alignment rule:
- Frontend service endpoint URL MUST match the backend route's URL namespace.
- `PublicApiSingleton` services MUST call `/api/public/...` endpoints.
- `TenantApiSingleton` services MUST call `/api/tenants/...` endpoints.

**Quick Checklist** — Add:
- [ ] Route URL namespace matches auth scope (public → `/api/public/...`, private → `/api/tenants/...`)
- [ ] Frontend service base class matches route auth scope (`PublicApiSingleton` → public URL, `TenantApiSingleton` → private URL)
- [ ] No `router.use(authenticateToken)` at router level in orchestrator-mounted sub-routers

### 2. `deploy-service-extending-base-singleton.md`

**Section 3.1** — Already documents the `/api/public/tenants/:tenantId/*` pattern. Add:
- Reference to `docs/AUTH_SCOPE_ISOLATION_SPEC.md` as the authoritative spec.
- Dual-scope pattern: when a route serves both public and private consumers, the `PublicApiSingleton` service calls `/api/public/tenants/...` (summary) and the `TenantApiSingleton` service calls `/api/tenants/...` (full detail with auth).
- URL prefix determines auth scope — a `PublicApiSingleton` service MUST NOT call `/api/tenants/...` endpoints.

**Quick reference table (Section 4)** — Add row:
- Dual-scope (public summary + private full): `PublicApiSingleton` for public reads + `TenantApiSingleton` for authenticated reads. Two services, two endpoints, same underlying data at different detail levels.

### 3. `add-capability-feature.md`

**Verification (Unified Endpoint) section** — Update curl examples:
- Public no-auth curl: change `/api/tenants/<tenantId>/effective-capabilities` → `/api/public/tenants/<tenantId>/effective-capabilities`
- Full-detail curl: add note that `?detail=full` requires auth headers (private endpoint)

**Common Pitfalls** — Add:
- **Do not mount public capability routes under `/api/tenants/`** — public routes must be at `/api/public/tenants/:tenantId/*`. A public route at `/api/tenants/...` will be blocked by router-level auth middleware from sibling routers. See `AUTH_SCOPE_ISOLATION_SPEC.md` FR-1.

### 4. `troubleshooting-public-page-api-leaks.md`

**Pattern 4** — Already documents the blanket auth middleware issue. Add:
- Reference to `AUTH_SCOPE_ISOLATION_SPEC.md` as the comprehensive fix.
- Note that the problem has two layers: URL namespace collision (root cause) + router-level auth bleed (amplifier). Pattern 4 addresses the amplifier; URL namespace isolation addresses the root cause.
- Update "Prevention Rules" to include: "The URL prefix (`/api/public/` vs `/api/tenants/`) is the authoritative indicator of auth scope. A public route at `/api/tenants/...` is a spec violation regardless of middleware configuration."

### 5. `api-route-architecture-audit.md`

**Phase 1 (Inventory)** — Add auth scope inventory step:
- Grep for public routes under `/api/tenants/` (spec violation): `grep -rn "router\.get.*tenants" apps/api/src/routes/ | grep -v authenticateToken`
- Grep for `router.use(authenticateToken)` in orchestrator-mounted sub-routers.

**Phase 2 (Score Risks)** — Add risk type:
- **Auth scope collision**: Public route mounted under private URL prefix (`/api/tenants/...`). Automatically Critical.

**Verification Checklist** — Add:
- [ ] No public routes under `/api/tenants/` (all public routes at `/api/public/...`)
- [ ] No `router.use(authenticateToken)` in orchestrator-mounted sub-routers
- [ ] `authLevel` in route registry matches URL prefix

**References** — Add:
- `docs/AUTH_SCOPE_ISOLATION_SPEC.md` — Auth scope isolation functional spec

### 6. `start-of-phase-sprint-checklist.md`

**Section 5 (Backend Architecture Planning)** — Add auth scope URL namespace to route planning:
- Public routes → `/api/public/tenants/:tenantId/*`. Private routes → `/api/tenants/:tenantId/*` with per-route auth. Dual-scope → two endpoints. No `router.use(authenticateToken)` in orchestrator-mounted sub-routers.

**Mirror table (Section 10)** — Add auth scope row:
- Start-of-phase: Plan URL namespace (`/api/public/` vs `/api/tenants/`) and per-route auth.
- End-of-phase: Verify URL prefix matches auth scope, no router-level auth in orchestrator sub-routers.

### 7. `end-of-phase-sprint-checklist.md`

**Section 5 (Backend Conventions)** — Add auth scope URL namespace compliance check:
- Public routes mounted at `/api/public/...` (no public routes under `/api/tenants/...`).
- Private routes use per-route `authenticateToken` (no `router.use(authenticateToken)` in orchestrator-mounted sub-routers).
- Dual-scope routes have two endpoints (public summary + private full detail).
- Frontend service URL matches base class (`PublicApiSingleton` → `/api/public/...`, `TenantApiSingleton` → `/api/tenants/...`).
- Includes grep commands for verification.

**Quick Reference table** — Add row:
- Auth scope / public vs private routes → `docs/AUTH_SCOPE_ISOLATION_SPEC.md` + `troubleshooting-public-page-api-leaks.md`
