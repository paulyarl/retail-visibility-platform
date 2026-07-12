---
description: Start-of-phase or sprint pre-flight checklist to run before beginning implementation — ensures skill awareness, pattern selection, ID planning, navigation strategy, and convention alignment before writing any code
---

# Start-of-Phase / Sprint Pre-Flight Checklist

Run this checklist at the start of every phase, sprint, or significant work session before writing any code. It mirrors the end-of-phase checklist (`end-of-phase-sprint-checklist.md`) but focuses on **planning and awareness** rather than verification. The goal is to front-load decisions so the implementation session doesn't surface surprises.

---

## 0. Hard Rule — TypeScript Checks at Phase End (Non-Negotiable)

**Every phase or sprint MUST end with zero new TypeScript errors on both apps. No exceptions. This is the final gate before marking work complete.**

```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

- **Zero new errors.** Pre-existing errors should not increase.
- **Run both checks** — API and web are independent TypeScript projects.
- **Do not skip, do not defer.** A phase with TS errors is not complete.
- **Plan for this.** Allocate time at the end of every session to run checks and fix errors before committing.

---

## 1. Singleton Service Strategy

**Skill**: `deploy-service-extending-base-singleton.md`

- [ ] **Identify which domain base the new service(s) will extend.** Before creating any frontend service, determine the audience and pick the base:
  | Audience | Web base | API base |
  |---|---|---|
  | Public-facing storefront data | `PublicApiSingleton` | `BaseService` or `UniversalSingleton` |
  | User-specific authenticated pages | `AuthenticatedApiSingleton` | `BaseService` |
  | Tenant admin dashboard | `TenantApiSingleton` | `BaseService` / `UniversalSingleton` |
  | Multi-tenant org operations | `OrganizationApiSingleton` | `BaseService` |
  | Admin platform panel | `AdminApiSingleton` | `BaseService` |
  | Background / cron / system jobs | `ApiSystemSingleton` | `UniversalSingleton` |
  | Third-party API wrapper | `ExternalApiSingleton` | N/A |
  | Capability-gated feature | `TenantApiSingleton` + client-side tier check | `PermissionEnhancedBaseService` |

- [ ] **Plan the cache contract.** If extending `TenantApiSingleton` or `OrganizationApiSingleton`, know upfront what cache patterns you'll need (`getServiceCachePatterns()`) and what mutations will require invalidation (`invalidateServiceCaches()`).

- [ ] **Confirm no direct `fetch` will be used.** All frontend API calls must go through `makeDefaultRequest` on a singleton service. If you're tempted to use `fetch`, create a service method instead.

- [ ] **Decide: singleton vs stateless.** Backend services only need `UniversalSingleton` if caching/metrics are required. Stateless CRUD → `BaseService`. Capability gates → compose `PermissionEnhancedBaseService`.

---

## 2. Skill Document Awareness

- [ ] **Read the relevant skills before starting.** Review the skills that apply to this phase's work. Use the quick reference table below to identify which ones to read.

| Phase will touch... | Read this skill first |
|---|---|
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
| Feature flags | `feature-flag-catalog.md` |
| Badge system | `meaningful-badge-architecture.md` + `badge-architecture-insights.md` |

- [ ] **Flag skills that will need updates after this phase.** This is a mandatory planning task, not optional. As you read each skill, note:
  - Which specific section(s) will need updates (e.g., "Phase 5 route section — add URL namespace rule")
  - What new insight from this phase's work should be captured (e.g., "discovered that X pattern causes Y bug")
  - Whether a new skill is needed for a recurring pattern or workflow that doesn't fit any existing skill
  - **This list will be consumed at phase end** — the end-of-phase checklist requires the agent to proactively update/create skills without being asked by the user.

- [ ] **Determine if a new skill document will be needed.** If the phase introduces a reusable multi-step workflow or a recurring pattern that doesn't fit any existing skill, plan to create one at the end. Note the proposed filename, scope, and which insights from this phase it should capture.

---

## 3. Tenant-Scoped ID Planning

**Skill**: `tenant-scoped-id-generation.md`

- [ ] **List all new entities the phase will create.** For each, determine:
  - Will it be tenant-scoped or global?
  - What prefix will the ID generator use? (Check the catalog in `tenant-scoped-id-generation.md` §4 for collisions.)
  - Will the DB column be `VarChar(255)` (not `@db.Uuid`)?

- [ ] **Add ID generators to `id-generator.ts` before creating services.** Don't wait until the service layer — add the generator function first so it's ready when the service needs it. Follow the `{prefix}-{tenantKey}-{nanoid}` format.

- [ ] **Identify any existing `randomUUID()` / `gen_random_uuid()` / `Date.now()` patterns that will be touched.** If the phase modifies existing entities, check whether they're still using raw UUIDs and plan to migrate them to tenant-scoped IDs as part of the work.

- [ ] **Plan multi-key IDs if entities span domains.** If an entity connects tenant + customer, or tenant + organization, plan a dual-key format (e.g., `ctr-{tk}-{ck}-{nanoid}`).

---

## 4. Navigation & Page Planning

**Skill**: `database-navigation-system.md`

- [ ] **List all new pages/routes the phase will create.** For each:
  - What is the route path? (e.g., `/t/[tenantId]/my-feature`)
  - Which sidebar target? (`tenant`, `admin`, or `all`)
  - What icon will it use? (Check available icons in `database-navigation-system.md` — must be registered in all 3 places: `useNavLinks.tsx`, `page.tsx`, `NavItemRow.tsx`)
  - Will it be a root link or a child of an existing parent? If child, identify the parent link ID.

- [ ] **Plan the SQL INSERT for `navigation_links`.** Draft the INSERT statement(s) now so they're ready to run. Use dynamic subqueries for parent IDs — never hardcode parent IDs that may differ between staging and production.

- [ ] **Plan file-based fallback updates.** Even though the DB is the active system, update `buildTenantNav()` / `buildAdminNavItems()` / `buildNavItems()` for resilience and reference.

- [ ] **Identify ALL settings cards needed.** New pages often need to be discoverable from settings landing pages, not just the sidebar. Check both:
  - **Tenant settings** (`apps/web/src/components/settings/TenantSettings.tsx`): If the new page is tenant-facing (under `/t/[tenantId]/settings/...`), identify which group/section to add the card to (e.g., "Stores", "Featured Products", "Organization Management", "Storefront"). Note the card title, description, icon, color, and href.
  - **Admin settings** (`apps/web/src/app/(platform)/settings/admin/page.tsx`): If the new page is admin-facing (under `/settings/admin/...`), identify which section/group to add the card or link to. Note the label, icon, and href.
  - **Don't forget sub-pages**: Even if the parent page already has a settings card, a new sub-page (e.g., `/settings/promotion/analytics`) may need its own card or a link from the parent page's UI.
  - **Store-related pages**: If the new page is a purchasable store or store-adjacent feature, also add it to:
    - **Dashboard** `StoreAccessCard.tsx` — add a store entry with icon, badge, and href
    - **App Store** `AppStoreClient.tsx` — add a new tab in the unified store page at `/t/{tenantId}/settings/store`
    - See `.devin/skills/self-serve-stores-guide.md` for the full store list and patterns

- [ ] **Check for dynamic template conflicts.** If the new page is a child of a `tenant-locations` or `organization-locations` template parent, it CANNOT be a database link — those children are generated client-side by `DynamicNavTemplates.tsx`.

---

## 5. Backend Architecture Planning

- [ ] **List all new route files.** For each, determine:
  - Mount path in `index.ts`
  - Auth level (public, authenticated, tenant, admin)
  - RBAC gates (`requirePermission`, `requireRole`, `requireGroup`)
  - Zod validation schemas needed for inputs
  - **Route order risk:** Will it be mounted under a prefix that already has a catch-all (`/:id`, `/:slug`, `/:tenantId`)? If yes, review `api-route-architecture-audit.md` first.
  - **Auth scope URL namespace** (from `docs/AUTH_SCOPE_ISOLATION_SPEC.md` FR-1, FR-2): Public routes → `/api/public/tenants/:tenantId/*`. Private routes → `/api/tenants/:tenantId/*` with per-route `authenticateToken`. Dual-scope routes → two endpoints (public summary + private full). Never use `router.use(authenticateToken)` in orchestrator-mounted sub-routers.

- [ ] **List all new background jobs.** For each:
  - Schedule (interval/cron)
  - Which tenants it operates on (all active, specific subset)
  - Wiring point in `index.ts` startup
  - Error handling strategy (fire-and-forget vs retry)

- [ ] **Plan logger usage.** All logger calls will use `logger.method(message, undefined, { ...meta })`. Note any webhook handlers that need `(req as any).rawBody`.

- [ ] **Identify existing services that will be modified.** List each and note what changes are needed. Check for cache invalidation implications.

---

## 6. Database & Migration Planning

- [ ] **Draft the migration file name.** Follow the numbering convention (check `database/migrations/` for the latest number). Format: `NNN_descriptive_name.sql`.

- [ ] **List all new tables.** For each:
  - Columns and types (use `VarChar(255)` for ID columns, not `UUID`)
  - RLS policies needed
  - `updated_at` trigger function
  - Indexes (foreign keys, query columns, composite)
  - Unique constraints
  - Seed data if reference table

- [ ] **Plan idempotency.** All DDL wrapped in `DO$$ BEGIN ... EXCEPTION WHEN OTHERS THEN END $$;`. All INSERTs use `INSERT ... SELECT ... WHERE NOT EXISTS`.

- [ ] **Plan Prisma schema updates.** After migration, will you run `npx prisma db pull` or manually edit `schema.prisma`? Note the models, relations, and indexes to add.

- [ ] **Identify any materialized views that need rebuilding.** If the migration changes tables that feed into MVs (e.g., `mv_storefront_discovery`), plan the `REFRESH MATERIALIZED VIEW` step.

---

## 7. Frontend Architecture Planning

- [ ] **List all new components.** For each:
  - Server component or client component?
  - Which existing components can be reused? (Check `skill-frontend-ux-guardrails` for component patterns)
  - Loading/empty/error/disabled states needed

- [ ] **Plan React Query cache keys.** Ensure unique keys that don't collide with existing queries. Include tenant ID for tenant-scoped queries.

- [ ] **Identify SSR safety needs.** Any `localStorage` / `window` access must be guarded with `typeof window !== 'undefined'`.

- [ ] **Check server-resolved context impact.** If the phase changes auth or tenant state flow, verify `ServerResolvedContextProvider` remains the single source of truth. See `fix-tenant-dashboard-load-loop.md`.

- [ ] **Plan the singleton service methods.** List each method the frontend service will need, with the API endpoint it maps to and the cache key pattern.

---

## 8. Capability System Planning

**Skills**: `capability-deployment-flow.md`, `capability-data-flow-rules.md`, `capability-constraint-relationships.md`

- [ ] **Identify if the phase introduces new capability features.** If yes, plan the 8-phase deployment:
  1. Define feature key in `canonical-features.ts` + `tier-hierarchies.ts`
  2. Seed DB (`features_list` + `capability_features_list` + `tier_features_list`)
  3. Store prefs table + Prisma schema
  4. Resolver (`XxxResolver.ts`) + types + `EffectiveCapabilityResolver.ts`
  5. Route (`xxx-options-settings.ts` with GET + PUT + tier filtering + cache invalidation)
  6. Map (`UnifiedCapabilityService.ts` + `CapabilityResolutionService.ts`)
  7. Display (`PlanSummaryPanel.tsx` + `CapabilityShowcase.tsx` + settings page)
  8. Verify (TS checks + `verify-capability-deployment.md`)

- [ ] **Check for cross-capability constraints.** Will the new feature depend on or conflict with another capability? If yes, plan a constraint entry in `capability_constraints_list` and `CapabilityConstraintRegistry.ts`.

- [ ] **Verify naming conventions.** Feature keys must be `snake_case` with domain prefix.
  - Type gates: `<capability_key>_enabled` or `<capability_key>_disabled`.
  - Group controls in options capabilities: `<capability_key>_<group>_on` or `<capability_key>_<group>_off` (R15 and R16 in `capability-data-flow-rules.md`).
  - Do not introduce new `<capability_key>_<group>_enabled` / `_disabled` group gates that would be ambiguous with the type gate.
  - If a new `_enabled` / `_disabled` feature key is required, confirm it is the capability type gate and does not collide with an existing group gate.
  - Reference `docs/ENABLED_DISABLED_NAMING_CONFLICT_MIGRATION_PLAN.md` until the migration is fully deployed.

- [ ] **Check for frontend fallback resolver impact in `CapabilityResolutionService.ts`.** If the phase changes any resolver logic in `apps/api/src/services/resolvers/XxxResolver.ts`, update the matching frontend fallback resolver in `apps/web/src/services/CapabilityResolutionService.ts` (R30 in `capability-data-flow-rules.md`). Verify parity for `_on`/`_off` group gate fallback, `enabled` derivation, and `effective_*` computation. Run `pnpm checkweb` **and** `pnpm checkapi` after changes.

- [ ] **Plan API route settings file updates (R32).** If the phase adds new merchant preference fields to a capability domain, plan updates to **four** places in the settings route file (`apps/api/src/routes/xxx-options-settings.ts`): (1) Zod validation schema, (2) `DEFAULT_SETTINGS` export, (3) all-false fallback when tier-disabled, (4) tier-filtered settings in the GET handler. See R32 in `capability-data-flow-rules.md`.

- [ ] **Plan `buildExpiredCapabilitiesResponse` updates (R13).** If the phase adds new fields to an existing capability domain's `EffectiveXxx` interface (not just new domains), plan to add those fields (disabled/empty/false) to that domain's entry in `buildExpiredCapabilitiesResponse` in `public-tenant-capabilities.ts`. Missing fields cause frontend mapper crashes for expired tenants.

- [ ] **Plan regression tests for group gate fallback.** Include cases for `_on` only, `_enabled` only, `_off` override, `_on` + `_off`, and `enabled` derived from a group gate without the master `_enabled` key.

---

## 9. Design Doc & Memory Planning

- [ ] **Is there a design doc for this phase?** If yes, read it fully before starting. If no, consider whether one is needed (multi-phase work should have a design doc in `docs/`).

- [ ] **Plan the memory entry.** At phase completion, a memory entry should summarize: what was built, key files, next steps. Note the tags you'll use (e.g., `phase-2`, `badges`, `complete`).

- [ ] **Check for existing memories about this phase.** Search for related work in previous session memories to avoid re-discovering context.

---

## 10. Pre-Flight Summary

Before writing any code, fill in this summary:

```
Phase/Sprint: _______________
Design doc: _______________

New services: _______________
New entities: _______________
New ID generators needed: _______________
New pages/routes: _______________
New sidebar links: _______________
New settings cards (tenant and/or admin): _______________
New migration: _______________
New background jobs: _______________
New capability features: _______________
Skills to read before starting: _______________
Skills to update after completion (mandatory — list specific sections): _______________
Insights to capture in skills (patterns, pitfalls, conventions learned): _______________
New skill to create (if any): _______________
```

---

## Relationship to End-of-Phase Checklist

This checklist is the **planning mirror** of `end-of-phase-sprint-checklist.md`. Where the end-of-phase checklist verifies compliance, this checklist ensures awareness:

| Concern | Start-of-phase | End-of-phase |
|---|---|---|
| Singletons | Pick the right base class | Verify no direct `fetch` was used |
| Skills | Read relevant skills; flag specific skills/sections for update; note insights to capture | Proactively update/create skills capturing phase insights — mandatory, no user prompt needed |
| IDs | Plan generators and prefixes | Verify no raw UUIDs in new code |
| Navigation | Plan SQL INSERTs and icon registration | Verify links appear in UI |
| Backend | Plan routes, jobs, logger usage | Verify mounting, wiring, signatures |
| Route architecture | Review `api-route-architecture-audit.md` if touching mount order or catch-alls | Run `lint:catchall`, `test:routes`, and `gen:routes` from `apps/api` |
| Auth scope | Plan URL namespace (`/api/public/` vs `/api/tenants/`) and per-route auth | Verify URL prefix matches auth scope, no router-level auth in orchestrator sub-routers |
| Database | Plan migration, RLS, triggers, indexes | Verify idempotency and Prisma sync |
| Frontend | Plan components, cache keys, SSR safety | Verify states, no orphaned imports |
| Capabilities | Plan 8-phase deployment | Verify feature keys and constraints |
| Verification | Note TS check commands | Run `tsc --noEmit` on both apps |
