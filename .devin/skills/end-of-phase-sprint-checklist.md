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

## 2. Skill Document Hygiene

- [ ] **Does this session's implementation require updates to existing skills?** Review the skills in `.devin/skills/` that are related to the work done. If the session introduced a new pattern, changed a convention, or added a new step to an existing workflow, update the relevant skill document.
  - **Common candidates**: `capability-deployment-flow.md`, `capability-data-flow-rules.md`, `database-navigation-system.md`, `deploy-service-extending-base-singleton.md`, `tenant-scoped-id-generation.md`
  - **How to decide**: If a future agent doing similar work would benefit from knowing what changed, update the skill.

- [ ] **Does this session's insight require a new skill document?** If the session discovered a recurring pattern, a common pitfall, or a multi-step workflow that doesn't fit any existing skill, create a new `.md` file in `.devin/skills/`.
  - **Naming**: kebab-case, descriptive (e.g., `bot-widget-troubleshooting.md`, `lazy-bot-conversation-creation.md`).
  - **Format**: YAML frontmatter with `description:`, then markdown sections.
  - **Threshold**: Create a new skill only if the insight is reusable across future sessions. One-off fixes don't need a skill.

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

- [ ] **Background jobs wired into startup.** Any new scheduled job (e.g., `*-sync.ts`, `*-renewal.ts`) must be imported and started in `apps/api/src/index.ts` server startup.

- [ ] **Zod validation on route inputs.** New API routes should validate request bodies/params with Zod schemas. Low priority for internal routes, but required for public-facing endpoints.

- [ ] **RBAC gates on protected routes.** New routes should have appropriate `requirePermission`, `requireRole`, or `requireGroup` middleware. Public routes should be explicitly marked as public.

---

## 6. Database & Migration

- [ ] **Migration is idempotent.** Use `INSERT ... SELECT ... WHERE NOT EXISTS`, `DO$$ BEGIN ... EXCEPTION WHEN OTHERS THEN END $$;` for DDL, and `CREATE TABLE IF NOT EXISTS`.
- [ ] **RLS policies included.** Every new tenant-scoped table must have Row Level Security policies. Use `DO$$ ... EXCEPTION WHEN OTHERS THEN END $$;` for idempotency.
- [ ] **`updated_at` trigger included.** Every new table with an `updated_at` column must have a trigger function that auto-updates it on row modification.
- [ ] **Indexes on foreign keys and query columns.** Add indexes for `tenant_id`, any column used in `WHERE` clauses, and composite indexes for common query patterns.
- [ ] **Prisma schema updated.** After migration, run `npx prisma db pull` or manually update `apps/api/prisma/schema.prisma` to include new models. Verify relations and indexes match the migration.
- [ ] **Seed data included if needed.** If the migration introduces reference data (e.g., system badges, feature keys), include `INSERT` statements in the migration or a separate seed file.

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
- [ ] **Cross-capability constraints.** If the new feature interacts with other capabilities (e.g., requires another feature to be enabled first), add a constraint to `capability_constraints_list` and `CapabilityConstraintRegistry.ts`.
- [ ] **Constraint metadata updated.** If a new capability domain was added, update `CONSTRAINT_METADATA` in `apps/api/src/routes/admin/capability-constraints.ts` with the new capability's key, label, fields, operators, and values (derived from the `EffectiveXxx` interface in `types.ts`). Without this, the capability won't appear in the constraint form dropdowns.
- [ ] **Resolver updated.** New features must flow through the resolver → orchestrator → API route → frontend service → hook → dashboard pipeline. See `capability-deployment-flow.md` for the 8-phase checklist.
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

- [ ] **Memory updated.** If the session completed a significant milestone (phase, sprint, feature), create or update a memory entry summarizing what was built, key files, and next steps. Use `create_memory` with appropriate tags.

- [ ] **Commit message documents the work.** Include a summary of what was built, files changed, and any design decisions in the commit message. Reference the design doc if one exists.

---

## Quick Reference — Which Skills to Review

| Session touched... | Review this skill |
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
