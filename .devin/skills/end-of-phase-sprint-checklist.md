---
description: End-of-phase or sprint verification checklist to run before marking work complete — ensures singleton compliance, skill doc hygiene, ID correlation, navigation sync, and platform conventions
---

# End-of-Phase / Sprint Checklist

Run this checklist at the end of every phase, sprint, or significant work session before marking it complete. Each item references the skill document or convention it enforces. Items are grouped by concern.

---

## 0. Hard Rule — TypeScript Checks (Non-Negotiable)

**Every phase or sprint MUST end with zero new TypeScript errors on both apps. No exceptions.**

```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

- **Zero new errors.** Pre-existing errors should not increase. If they do, fix them before marking the phase complete.
- **Run both checks.** Passing one is not sufficient — the API and web are independent TypeScript projects.
- **Do not skip this step.** A phase with TS errors is not complete. Do not mark it as done, do not commit, do not move to the next phase.
- **If errors are pre-existing and unrelated**, note them in the commit message but verify the count hasn't increased.

---

## 1. Singleton Service Compliance

**Skill**: `deploy-service-extending-base-singleton.md`

- [ ] **No direct `fetch` calls.** Search the session's frontend files for `fetch(` — every API call must go through a singleton service's `makeDefaultRequest` (or typed helper). Direct `fetch` bypasses auth headers, caching, error parsing, and tenant isolation.
  - **How to check**: `grep -rn "fetch(" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"` and review any hits in files touched this session.
  - **Fix**: Create or extend a singleton service extending the correct domain base (`PublicApiSingleton`, `TenantApiSingleton`, `AdminApiSingleton`, etc.).

- [ ] **No direct `new` instantiation of singletons.** All singleton services must be consumed via `MyService.getInstance()`, never `new MyService()`.

- [ ] **Backend services extend the correct base.** If the service needs caching/metrics → `UniversalSingleton`. If it's stateless CRUD → `BaseService`. If it needs capability gates → compose `PermissionEnhancedBaseService`.

- [ ] **Cache invalidation implemented.** After any mutation (POST/PUT/PATCH/DELETE), the service must call `this.invalidateCache(key)` or implement `invalidateServiceCaches` for tenant-scoped services. Missing invalidation causes stale data.

---

## 2. Skill Document Hygiene (Mandatory — Do Not Skip)

**The agent MUST proactively review, update, and create skills at the end of every phase or sprint. This is not optional and does not require the user to ask.** The skills in `.devin/skills/` are the institutional memory of the platform — if insights from this phase are not captured, future agents will repeat the same mistakes and rediscover the same patterns.

- [ ] **Review all skills related to this phase's work and update them.** Go through each skill that was read at the start of the phase (see pre-flight checklist Section 2) and check:
  - Did the implementation follow the skill's documented pattern? If it deviated, update the skill to reflect the new pattern — or add a note explaining when to use the deviation.
  - Did the implementation surface a new pitfall, edge case, or debugging insight? Add it to the skill's "Common Pitfalls" or troubleshooting section.
  - Did the implementation change a convention (naming, routing, auth, caching, etc.)? Update all skills that reference the old convention.
  - **Common candidates**: `capability-deployment-flow.md`, `capability-data-flow-rules.md`, `database-navigation-system.md`, `deploy-service-extending-base-singleton.md`, `tenant-scoped-id-generation.md`, `start-of-phase-sprint-checklist.md`, `end-of-phase-sprint-checklist.md`
  - **Decision rule**: If a future agent doing similar work would benefit from knowing what was learned, update the skill. When in doubt, update.

- [ ] **Capture phase insights in skills.** Review the work done this phase and extract reusable insights:
  - **Patterns discovered**: New architectural patterns, refactoring approaches, or workflows that worked well.
  - **Pitfalls encountered**: Bugs, edge cases, or gotchas that cost debugging time. Add to the relevant skill's pitfall/troubleshooting section so future agents avoid them.
  - **Conventions established**: New naming rules, auth patterns, URL conventions, or coding standards that should be followed going forward.
  - **Cross-skill impacts**: If a change in one skill affects another (e.g., auth scope rules affect capability deployment, route architecture, and singleton selection), update all affected skills.

- [ ] **Create a new skill document if the phase introduced a reusable workflow.** If the session discovered a recurring pattern or multi-step workflow that doesn't fit any existing skill, create a new `.md` file in `.devin/skills/`.
  - **Naming**: kebab-case, descriptive (e.g., `bot-widget-troubleshooting.md`, `lazy-bot-conversation-creation.md`).
  - **Format**: YAML frontmatter with `description:`, then markdown sections.
  - **Threshold**: Create a new skill only if the insight is reusable across future sessions. One-off fixes don't need a skill — but if the same one-off has happened twice, it's a pattern and needs a skill.

- [ ] **Verify the pre-flight skill update plan was executed.** The pre-flight checklist (Section 2) asked the agent to flag specific skills and sections for update. Confirm each flagged item was addressed. If a planned update turned out to be unnecessary, note why.

---

## 3. Tenant-Scoped ID Correlation

**Skill**: `tenant-scoped-id-generation.md`

- [ ] **Do backend entities use correlation IDs for singleton keys?** Every new entity created this session must use a tenant-scoped ID generator from `apps/api/src/lib/id-generator.ts` — not `randomUUID()`, not `Date.now() + Math.random()`, not DB-level `gen_random_uuid()`.
  - **How to check**: `grep -rn "randomUUID\|gen_random_uuid\|Date.now().*Math.random" apps/api/src/ --include="*.ts"` and review hits in files touched this session.
  - **If a new entity type was introduced**: Add a generator function to `id-generator.ts` following the `{prefix}-{tenantKey}-{nanoid}` format. Check for prefix collisions with existing generators.
  - **If a DB column was added**: Ensure it's `VarChar(255)`, not `@db.Uuid`. Remove any `@default(dbgenerated("gen_random_uuid()"))` and pass the ID explicitly from the application layer.

---

## 4. Navigation & Sidebar Updates

**Skill**: `database-navigation-system.md`

- [ ] **Did the session create a new page?** If a new route/page was added (e.g., `/t/[tenantId]/my-feature`), the sidebar navigation must be updated so users can reach it.
  - **Active system is database-driven**: Adding links to file-based fallback arrays (`buildTenantNav`, `buildAdminNavItems`, `buildNavItems`) will NOT show them in the UI. Must insert into `navigation_links` table.
  - **SQL INSERT**: See `database-navigation-system.md` → "Option B: Via Database Query" for the INSERT template.
  - **Set `targets` correctly**: `tenant` for tenant pages, `admin` for admin pages, `all` for settings pages visible to all authenticated users.
  - **Register icons in all 3 places**: `useNavLinks.tsx` IconComponents map, `page.tsx` IconComponents + ICON_OPTIONS, `NavItemRow.tsx` IconComponents map.
  - **Update parent metadata**: If adding a child link, update the parent's `metadata.childrenKeys` and `metadata.hasChildren` using nested `jsonb_set`.
  - **Keep file-based fallbacks in sync**: Update the corresponding `buildTenantNav()` / `buildAdminNavItems()` / `buildNavItems()` array as well, for resilience and reference.

- [ ] **Did the session add settings cards?** New pages must be discoverable from settings landing pages, not just the sidebar. Verify both:
  - **Tenant settings** (`apps/web/src/components/settings/TenantSettings.tsx`): If a tenant-facing page was added (under `/t/[tenantId]/settings/...`), ensure a settings card was added to the appropriate group/section with title, description, icon, color, and href.
  - **Admin settings** (`apps/web/src/app/(platform)/settings/admin/page.tsx`): If an admin-facing page was added (under `/settings/admin/...`), ensure a card or link was added to the appropriate section with label, icon, and href.
  - **Admin page route placement**: Admin pages MUST live at `(platform)/settings/admin/<feature>/page.tsx`, NOT `t/[tenantId]/settings/admin/<feature>/page.tsx`. The admin dashboard links to `/settings/admin/<feature>` (no tenant prefix). A tenant-scoped admin page will 404. If a tenant-scoped admin page already exists, create a platform-level page with a client component using `AdminApiSingleton`-based services (no tenantId required).
  - **Admin service singleton**: Admin pages must use services extending `AdminApiSingleton`, not `TenantApiSingleton` (which requires tenantId). If only a tenant-scoped service exists, create a parallel `Admin<Feature>Service` extending `AdminApiSingleton` calling `/api/admin/<feature>/*` endpoints.
  - **Sub-pages**: If a new sub-page was added (e.g., `/settings/promotion/analytics`), ensure it has its own settings card or a link from the parent page's UI — don't rely solely on the sidebar for discoverability.
  - **Store-related pages**: If a new purchasable store or store-adjacent feature was added, verify it appears in:
    - **Dashboard** `StoreAccessCard.tsx` — store entry with icon, badge, and href
    - **App Store** `AppStoreClient.tsx` — tab in the unified store page at `/t/{tenantId}/settings/store`
    - See `.devin/skills/self-serve-stores-guide.md` for the full store list and patterns

---

## 5. Backend Conventions

- [ ] **Logger calls use the correct signature.** All logger calls must use `logger.method(message, undefined, { ...meta })` — the second argument is `RequestCtx` (pass `undefined` when not in a request context), metadata goes in the third argument.
  - **How to check**: `grep -rn "logger\.\(info\|warn\|error\|debug\)" apps/api/src/ --include="*.ts"` and review files touched this session for incorrect signatures.

- [ ] **`req.rawBody` access cast.** In webhook handlers, access raw body via `(req as any).rawBody` — the Express type definitions don't include this field.

- [ ] **Routes mounted in `index.ts`.** Any new route file must be imported and mounted in `apps/api/src/index.ts`. Verify the mount path matches the route prefix.

- [ ] **Route order and catch-all ordering.** If the session added or reordered routes, verify no static sub-route is mounted after a catch-all (`/:id`, `/:slug`, `/:tenantId`) in the same `Router()`. Run the catch-all lint and route coverage tests:
  ```bash
  cd apps/api
  npx tsx src/scripts/lint-catchall-order.ts
  npx vitest run src/tests/route-coverage.test.ts
  ```
  If the count of `app.use` in `index.ts` has grown significantly, also regenerate the route map and OpenAPI spec:
  ```bash
  npx tsx src/scripts/generate-route-map.ts
  npx tsx src/scripts/generate-openapi.ts
  ```
  Review `api-route-architecture-audit.md` for patterns and pitfalls.

- [ ] **Background jobs wired into startup.** Any new scheduled job (e.g., `*-sync.ts`, `*-renewal.ts`) must be imported and started in `apps/api/src/index.ts` server startup.

- [ ] **Zod validation on route inputs.** New API routes should validate request bodies/params with Zod schemas. Low priority for internal routes, but required for public-facing endpoints.

- [ ] **RBAC gates on protected routes.** New routes should have appropriate `requirePermission`, `requireRole`, or `requireGroup` middleware. Public routes should be explicitly marked as public.

- [ ] **Auth scope URL namespace compliance** (from `docs/AUTH_SCOPE_ISOLATION_SPEC.md` FR-1, FR-2):
  - **Public routes mounted at `/api/public/...`**: Any route accessible without authentication MUST be under `/api/public/tenants/:tenantId/*` (or `/api/public/...`). No public routes under `/api/tenants/...`.
  - **Private routes use per-route auth**: Routes under `/api/tenants/:tenantId/*` MUST have `authenticateToken` applied per-route, NOT via `router.use(authenticateToken)` at the router level in orchestrator-mounted sub-routers.
  - **Dual-scope routes have two endpoints**: If a route serves both public and private consumers, verify a public summary endpoint exists at `/api/public/tenants/...` (no auth, `detail=full` ignored) and a private full-detail endpoint at `/api/tenants/...` (auth required).
  - **Frontend service URL matches base class**: `PublicApiSingleton` services call `/api/public/...` endpoints. `TenantApiSingleton` services call `/api/tenants/...` endpoints. No cross-scope URL/base-class mismatch.
  - **How to check**: `grep -rn "router\.use(authenticateToken)" apps/api/src/routes/ | grep -v admin.routes.ts | grep -v test` — should return empty (or only standalone mounts). `grep -rn "/api/tenants/" apps/web/src/services/ --include="*.ts" | grep -i public` — should return empty (no PublicApiSingleton service calling private URLs).

---

## 6. Database & Migration

- [ ] **Migration is idempotent.** Use `INSERT ... SELECT ... WHERE NOT EXISTS`, `DO$$ BEGIN ... EXCEPTION WHEN OTHERS THEN END $$;` for DDL, and `CREATE TABLE IF NOT EXISTS`.
- [ ] **RLS policies included.** Every new tenant-scoped table must have Row Level Security policies. Use `DO$$ ... EXCEPTION WHEN OTHERS THEN END $$;` for idempotency.
- [ ] **`updated_at` trigger included.** Every new table with an `updated_at` column must have a trigger function that auto-updates it on row modification.
- [ ] **Indexes on foreign keys and query columns.** Add indexes for `tenant_id`, any column used in `WHERE` clauses, and composite indexes for common query patterns.
- [ ] **Prisma schema synced via introspection (not edits).** After migration is applied to the DB, run `npx prisma db pull && npx prisma generate` to update `schema.prisma` and TypeScript types. **Never edit `schema.prisma` directly** — see `manual-sql-migration-policy.md`. Verify no edits were made to `schema.prisma` during this session: `git diff apps/api/prisma/schema.prisma` should show no manual changes (only introspected changes from `prisma db pull`).
- [ ] **Seed data included if needed.** If the migration introduces reference data (e.g., system badges, feature keys), include `INSERT` statements in the migration or a separate seed file.
- [ ] **Runtime-seeded data has a SQL migration.** If the session relies on runtime seeding (e.g., `ensureSupplierExists()` in sync jobs, `upsert` on first request), verify a SQL migration also exists to seed the data immediately. Runtime-only seeding causes data to be missing on first deploy or after server restart (startup delays of 10-30 min). Check for `upsert` or `ensure*Exists` patterns in new jobs/services and create a matching `INSERT ... ON CONFLICT DO UPDATE` migration. Set paid-subscription entries as `active = false` so admins can toggle them on.

---

## 7. Frontend Conventions

- [ ] **SSR safety for `localStorage` / `window`.** Any new frontend code accessing `localStorage` or `window` must guard with `typeof window !== 'undefined'`. Singleton base classes handle this for auth headers, but service-specific reads need manual guards.
- [ ] **Server-resolved context consistency.** If the session changed auth or tenant state flow, verify `ServerResolvedContextProvider` is still the single source of truth. See `fix-tenant-dashboard-load-loop.md` and `fix-auth0-redirect-loop.md`.
- [ ] **React Query cache keys are unique.** New query hooks must use unique cache keys that don't collide with existing keys. Include tenant ID in tenant-scoped queries.
- [ ] **Loading/empty/error states.** New pages and components must handle all three states. See `skill-frontend-ux-guardrails` for UX quality gates.

---

## 8. Capability System

**Skills**: `capability-deployment-flow.md`, `capability-data-flow-rules.md`, `capability-constraint-relationships.md`

- [ ] **New feature keys registered and follow naming convention.** If the session added a capability feature, it must be in `canonical-features.ts` and `tier-hierarchies.ts`.
  - Type gates: `<capability_key>_enabled` or `<capability_key>_disabled`.
  - Group controls in options capabilities: `<capability_key>_<group>_on` or `<capability_key>_<group>_off`. Do not register new `<capability_key>_<group>_enabled` / `_disabled` group gates.
  - Individual features: `<capability_key>_<group>_<feature>`.
  - If the session touched capability feature keys, verify no new `_enabled` / `_disabled` group gates were introduced that are ambiguous with an existing type gate.
- [ ] **Feature keys seeded into `features_list` via SQL migration.** Every feature key referenced in a resolver (`!!features.<key>`) MUST have a corresponding row in `features_list` and a linkage in `capability_features_list`. This is the most commonly missed step — see R31 in `capability-data-flow-rules.md` and Step 0 in `add-capability-feature.md`.
  - **How to check**: `grep -rn "!!features\." apps/api/src/services/resolvers/ --include="*.ts"` to find all referenced keys, then verify each exists in the latest migration or `features_list` table.
  - **How to verify**: Navigate to `/settings/admin/capabilities` in the Admin UI — new feature keys must appear under their capability type. If they don't, the migration was not created or not run.
  - **Fix**: Create a migration in `database/migrations/` with `INSERT INTO features_list ... ON CONFLICT (key) DO UPDATE` and `INSERT INTO capability_features_list ... ON CONFLICT DO NOTHING`. See `102_storefront_opt_qr_styled_features.sql` for the pattern.
- [ ] **Cross-capability constraints.** If the new feature interacts with other capabilities (e.g., requires another feature to be enabled first), add a constraint to `capability_constraints_list` and `CapabilityConstraintRegistry.ts`.
- [ ] **Constraint metadata updated.** If a new capability domain was added, update `CONSTRAINT_METADATA` in `apps/api/src/routes/admin/capability-constraints.ts` with the new capability's key, label, fields, operators, and values (derived from the `EffectiveXxx` interface in `types.ts`). Without this, the capability won't appear in the constraint form dropdowns.
- [ ] **Resolver updated.** New features must flow through the resolver → orchestrator → API route → frontend service → hook → dashboard pipeline. See `capability-deployment-flow.md` for the 8-phase checklist.
- [ ] **PlanSummaryWidget and PlanSummaryPanel updated.** When a new capability domain is added or an existing domain's effective fields change, both display surfaces must be updated:
  - **`PlanSummaryWidget.tsx`** (slim widget — used on both dashboard AND all options/settings pages) — add the new capability type to the widget's capability list with color-coded status indicator (green/red/orange/blue/purple). This is the compact card shown on `TenantDashboardV2` and at the top of every options page.
  - **`PlanSummaryPanel.tsx`** (full panel — used ONLY on `/settings/plan-summary`) — add a summary builder block for the new domain (similar to existing `so` block). Each card shows: enabled status, flexible badge, key features list, merchant gate status, settings link.
  - The widget is a subset of the panel — both read from the same `AllCapabilitiesState` but the widget shows only clickable capability names with status colors, while the panel shows full detail cards. If only one was updated, the dashboard/options pages or the plan-summary page will be missing the new capability.
  - **Options pages should NOT import `PlanSummaryPanel`** — use `PlanSummaryWidget` instead to save real estate. The widget includes a "View full plan details" link to the plan-summary page.
- [ ] **API route settings file updated (R32).** When adding new merchant preference fields, the settings route file (`apps/api/src/routes/xxx-options-settings.ts`) MUST be updated in **four** places: (1) Zod validation schema, (2) `DEFAULT_SETTINGS` export, (3) all-false fallback when tier-disabled, (4) tier-filtered settings in the GET handler. See R32 in `capability-data-flow-rules.md`.
- [ ] **`buildExpiredCapabilitiesResponse` updated (R13).** When adding new fields to an existing capability domain's `EffectiveXxx` interface (not just new domains), add those fields (disabled/empty/false) to that domain's entry in `buildExpiredCapabilitiesResponse` in `public-tenant-capabilities.ts`. Missing fields cause frontend mapper crashes for expired tenants.
- [ ] **Subscription-status override.** If a new capability domain was added, verify it appears in the `isReadOnly` and/or `isLimited` override blocks in `EffectiveCapabilityResolver.ts` Step 6. See R23 in `capability-data-flow-rules.md`.
- [ ] **Frontend `deriveInternalStatus` parity.** If the backend `deriveInternalStatus` was updated, ensure the frontend version in `apps/web/src/lib/subscription-status.ts` mirrors the same logic. See R24 in `capability-data-flow-rules.md`.

---

## 9. Verification

- [ ] **TypeScript checks pass.** Run both:
  ```bash
  cd apps/api && npx tsc --noEmit
  cd apps/web && npx tsc --noEmit
  ```
  Zero new errors. Pre-existing errors should not increase.

- [ ] **No orphaned imports.** Check that removed code didn't leave unused imports. `tsc --noEmit` catches most, but review manually for barrel-exported modules.

- [ ] **E2E batch test passes.** If the sprint created or modified services, endpoints, or jobs, create or update a sprint batch test at `apps/api/src/tests/sprint-e2e-batch.test.ts` (or a sprint-specific test file). The batch test should cover all sprint-implemented services and endpoints with mocked dependencies (no DB/Stripe required). Run it before marking complete:
  ```bash
  cd apps/api
  doppler run --config local -- npx vitest run src/tests/sprint-e2e-batch.test.ts --reporter=verbose
  ```
  **Must run from `apps/api`**, not project root — root doesn't have `vitest`/`tsx` installed.
  - Use `vi.hoisted()` for mock functions that need to be available in `vi.mock` factories
  - Mock `prisma`, `logger`, `unifiedConfig`, and any external SDKs (stripe, etc.)
  - Cover success paths, error paths, edge cases, and integration points between services
  - Group tests by service/feature section for readability
  - Reference: `barcode-wholesale-integration.md` §13 for the established pattern

- [ ] **Memory updated.** If the session completed a significant milestone (phase, sprint, feature), create or update a memory entry summarizing what was built, key files, and next steps. Use `create_memory` with appropriate tags.

- [ ] **Commit message documents the work.** Include a summary of what was built, files changed, and any design decisions in the commit message. Reference the design doc if one exists.

---

## Quick Reference — Which Skills to Review

| Session touched... | Review this skill |
|---|---|
| Route architecture / mount order / shadowed endpoints | `api-route-architecture-audit.md` |
| Auth scope / public vs private routes | `docs/AUTH_SCOPE_ISOLATION_SPEC.md` + `troubleshooting-public-page-api-leaks.md` |
| Frontend API calls | `deploy-service-extending-base-singleton.md` |
| New entity / DB table | `tenant-scoped-id-generation.md` |
| New page / route | `database-navigation-system.md` |
| Capability feature | `capability-deployment-flow.md` + `capability-data-flow-rules.md` |
| Cross-capability deps | `capability-constraint-relationships.md` |
| Bot / chatbot | `lazy-bot-conversation-creation.md` + `bot-widget-troubleshooting.md` |
| Auth / redirect issues | `fix-auth0-redirect-loop.md` + `fix-tenant-dashboard-load-loop.md` |
| Dashboard performance | `dashboard-performance-audit.md` |
| Render loops | `debug-infinite-render-loops.md` |
| Cache invalidation | `cross-context-cache-invalidation.md` |
| Database schema changes | `manual-sql-migration-policy.md` |
