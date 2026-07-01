# Feature Flag Remediation Sprint Plan

## Overview

11 recommendations from the feature flag audit (`feature-flag-catalog.md`) organized into 4 priority sprints.

**Sprint cadence:** 1-week sprints
**Total duration:** 4 weeks
**Principle:** Security first → quick wins → structural changes → long-term enhancements

---

## Sprint 1: Security & Quick Wins (Week 1)

**Goal:** Close the security gap, remove dead code, and document the flag surface.

### S1-1: Add Auth to Override Endpoints (H1) — 🔴 Critical

**Priority rationale:** Unauthenticated kill-switch endpoints are an active security vulnerability.

**Scope:**
- Add `requirePlatformAdmin` to `POST /api/admin/flags/override/platform/:flag` in `apps/api/src/routes/effective-flags.ts`
- Add `requirePlatformAdmin` to `POST /api/admin/flags/override/tenant/:tenantId/:flag` in same file
- Add `requirePlatformAdmin` to `DELETE /api/admin/platform-flags` in `apps/api/src/routes/platform-flags.ts`

**Files:**
- `apps/api/src/routes/effective-flags.ts`
- `apps/api/src/routes/platform-flags.ts`

**Verification:**
- `curl -X POST /api/admin/flags/override/platform/FF_MAP_CARD -d '{"value":true}'` returns 401 without auth token
- Same endpoint returns 200 with platform admin token

**Effort:** 30 min

---

### S1-2: Remove Deprecated Scan Flags (E1) — 🟡 Cleanup

**Priority rationale:** Dead code that misleads developers; 4 flags + commented-out checks.

**Scope:**
- Remove `SKU_SCANNING`, `SCAN_CAMERA`, `SCAN_USB`, `SCAN_DUPLICATE_CHECK` from `apps/api/src/config.ts`
- Remove `SKU_SCANNING`, `SCAN_CAMERA`, `SCAN_USB`, `SCAN_DUPLICATE_CHECK` from `apps/web/src/lib/flags.ts`
- Keep `SCAN_ENRICHMENT` in both files (still actively consumed in `routes/scan.ts:584`)
- Remove commented-out `Flags.SKU_SCANNING` check in `apps/api/src/routes/scan.ts:64-66`
- Remove `isFeatureEnabled` / `Flags.SKU_SCANNING` references in web components if any
- Search and remove any `NEXT_PUBLIC_FF_SKU_SCANNING`, `NEXT_PUBLIC_FF_SCAN_CAMERA`, `NEXT_PUBLIC_FF_SCAN_USB`, `NEXT_PUBLIC_FF_SCAN_DUPLICATE_CHECK` references in docs/env files

**Files:**
- `apps/api/src/config.ts`
- `apps/web/src/lib/flags.ts`
- `apps/api/src/routes/scan.ts`

**Verification:**
- `npx tsc --noEmit` passes on both api and web
- `grep -r "SKU_SCANNING\|SCAN_CAMERA\|SCAN_USB\|SCAN_DUPLICATE_CHECK" apps/` returns nothing (except `SCAN_ENRICHMENT`)

**Effort:** 1 hr

---

### S1-3: Delete Admin UI Phantom Flags (E2) — 🟡 Cleanup

**Priority rationale:** 20 fake flag descriptions clutter the admin UI and mislead operators.

**Scope:**
- Remove all 20 phantom entries from `FLAG_DESCRIPTIONS` in `apps/web/src/components/admin/AdminPlatformFlags.tsx`
- Keep only entries for flags that exist in the seed script or have code consumers: `FF_MAP_CARD`, `FF_SWIS_PREVIEW`, `FF_BUSINESS_PROFILE`, `FF_DARK_MODE`, `FF_GOOGLE_CONNECT_SUITE`, `FF_APP_SHELL_NAV`, `FF_TENANT_URLS`, `FF_ITEMS_V2_GRID`, `FF_CATEGORY_MANAGEMENT_PAGE`, `FF_CATEGORY_QUICK_ACTIONS`, `FF_GLOBAL_TENANT_META`, `FF_SUPPLIER_CATALOG_IMPORT`, `FF_TENANT_GBP_CATEGORY_SYNC`, `FF_CATEGORY_MIRRORING`
- Remove `FF_ENFORCE_CSRF`, `FF_PRODUCT_ENRICHMENT`, `FF_AI_SUGGESTIONS`, `FF_ANALYTICS_DASHBOARD`, `FF_BULK_OPERATIONS`, `FF_REAL_TIME_SYNC`, `FF_MULTI_TENANT_SUPPORT`, `FF_API_RATE_LIMITING`, `FF_ADVANCED_SEARCH`, `FF_MOBILE_OPTIMIZED`, `FF_PWA_SUPPORT`, `FF_SOCIAL_SHARING`, `FF_EMAIL_NOTIFICATIONS`, `FF_WEBHOOKS`, `FF_CUSTOM_BRANDING`, `FF_ADVANCED_REPORTING`, `FF_INTEGRATION_MARKETPLACE`, `FF_AI_COPILOT`, `FF_VOICE_COMMANDS`, `FF_BLOCKCHAIN_INTEGRATION`

**Files:**
- `apps/web/src/components/admin/AdminPlatformFlags.tsx`

**Verification:**
- `npx tsc --noEmit` passes on web
- Admin flags page renders without errors

**Effort:** 30 min

---

### S1-4: Document All Web Env Vars (H4) — 🟢 Quick win

**Scope:**
- Add all `NEXT_PUBLIC_FF_*` vars to `apps/web/.env.local.example` with defaults and comments:
  ```env
  # Feature Flags
  NEXT_PUBLIC_FF_TENANT_URLS=true
  NEXT_PUBLIC_FF_I18N_SCAFFOLD=false          # Enable i18next translations (en-US, es-ES, fr-FR)
  NEXT_PUBLIC_FF_SCAN_ENRICHMENT=true         # Image enrichment during barcode scan
  NEXT_PUBLIC_FF_SCAN_DUPLICATE_CHECK=true    # Duplicate check during scan (deprecated — use capability system)
  ```

**Files:**
- `apps/web/.env.local.example`

**Verification:** File review

**Effort:** 15 min

---

### S1-5: Add Missing Flags to Seed Script (H5) — 🟢 Quick win

**Scope:**
- Add `FF_TENANT_GBP_CATEGORY_SYNC` to `DEFAULT_FLAGS` in `apps/api/src/scripts/seed-platform-flags.ts`:
  ```ts
  {
    flag: 'FF_TENANT_GBP_CATEGORY_SYNC',
    enabled: false,
    rollout: 'Google Business Profile category sync for tenant directory listings',
    allow_tenant_override: true,
  },
  ```
- Add `FF_CATEGORY_MIRRORING` to `DEFAULT_FLAGS`:
  ```ts
  {
    flag: 'FF_CATEGORY_MIRRORING',
    enabled: false,
    rollout: 'Mirror categories between platform and Google Business Profile',
    allow_tenant_override: true,
  },
  ```

**Files:**
- `apps/api/src/scripts/seed-platform-flags.ts`

**Verification:** Run `npx ts-node src/scripts/seed-platform-flags.ts` — both flags appear in DB

**Effort:** 15 min

---

### S1-6: Remove Web localStorage Flag Override (E4) — 🟡 Cleanup

**Scope:**
- Remove localStorage load block (lines 123-134) from `apps/web/src/lib/featureFlags/index.ts`
- Remove localStorage save logic from `updateFeatureFlag()` function (lines 231-243)
- Remove `CustomEvent` dispatch
- Keep `updateFeatureFlag()` as an in-memory update only (for dev/testing)
- Add a comment: `// Flag state is server-authoritative. Use .env.local for dev overrides.`

**Files:**
- `apps/web/src/lib/featureFlags/index.ts`

**Verification:**
- `npx tsc --noEmit` passes on web
- `grep "localStorage" apps/web/src/lib/featureFlags/index.ts` returns nothing

**Effort:** 30 min

---

### Sprint 1 Exit Criteria
- [ ] Override endpoints return 401 without auth
- [ ] No references to deprecated scan flags (except `SCAN_ENRICHMENT`)
- [ ] Admin UI shows only real flags
- [ ] `.env.local.example` documents all `NEXT_PUBLIC_FF_*` vars
- [ ] Seed script includes all 13 DB flags
- [ ] No localStorage flag override in web client
- [ ] `npx tsc --noEmit` passes on both api and web

---

## Sprint 2: Consolidation (Week 2)

**Goal:** Eliminate dual resolution paths and centralize flag gating.

### S2-1: Deprecate `tenantFlags.ts` (H7) — 🟠 Structural

**Scope:**
- Find all consumers of `isTenantFlagOn()` from `apps/api/src/utils/tenantFlags.ts`
- Replace each call with `getEffectiveTenant(flag, tenantId)` from `apps/api/src/utils/effectiveFlags.ts`
- Add a 30s in-memory cache to `effectiveFlags.ts` (port the cache pattern from `tenantFlags.ts`)
- Delete `apps/api/src/utils/tenantFlags.ts`
- Remove the import in `apps/api/src/middleware/flags.ts`

**Files:**
- `apps/api/src/utils/effectiveFlags.ts` (add cache)
- `apps/api/src/utils/tenantFlags.ts` (delete)
- `apps/api/src/middleware/flags.ts` (remove import)
- Any other files importing `isTenantFlagOn`

**Verification:**
- `grep -r "isTenantFlagOn\|tenantFlags" apps/api/src/` returns nothing
- `npx tsc --noEmit` passes on api
- Existing flag checks return same results

**Effort:** 2 hrs

---

### S2-2: Centralize Route-Level Flag Gating (R2) — 🟠 Structural

**Scope:**
- Refactor `requireSupplierCatalogFeature` in `apps/api/src/routes/tenant/suppliers.ts` to use `requireFlag({ flag: 'FF_SUPPLIER_CATALOG_IMPORT', scope: 'tenant' })`
- Audit all routes for ad-hoc flag checks (`Flags.CATEGORY_MIRRORING` in `categories.mirror.ts`, `Flags.FEED_ALIGNMENT_ENFORCE` in `feed-jobs.ts`, `Flags.FEED_COVERAGE` in `feed-validation.ts`, `Flags.CURRENCY_RATE_STUB` in `rates.ts`)
- For DB-hybrid flags: replace ad-hoc checks with `requireFlag()` middleware
- For env-only `config.ts` flags: leave as-is (they don't have DB entries — will be addressed in S3-1)

**Files:**
- `apps/api/src/routes/tenant/suppliers.ts`
- `apps/api/src/middleware/flags.ts` (verify it works for the supplier use case)

**Verification:**
- Supplier routes still gate correctly when flag is off
- `npx tsc --noEmit` passes on api

**Effort:** 2 hrs

---

### S2-3: Clean Up Stale Registry (E3) — 🟢 Documentation

**Scope:**
- Update `docs/feature-flags/registry.yaml`:
  - Set `FF_SCHEMA_V34_READY` to `status: removed` (no code consumer)
  - Set `FF_DIRECTORY_ENTRY_LAYOUT*` flags to `status: removed` (handled by capability system)
  - Set `FF_TENANT_CATEGORY_OVERRIDE` to `status: removed`
  - Set `FF_SYNTHETIC_MONITORING` to `status: removed`
  - Set `FF_ASYNC_FEED_JOBS` to `status: removed`
  - Fix `FF_AUDIT_LOG` status to `inactive` (defaults to `false` in `config.ts`)
  - Fix `FF_FEED_ALIGNMENT_ENFORCE` status to `inactive` (defaults to `false` in `config.ts`)
  - Add missing flags: all 13 `config.ts` flags, `FF_TENANT_GBP_CATEGORY_SYNC`, `FF_CATEGORY_MIRRORING`
  - Update version header to reflect audit date

**Files:**
- `docs/feature-flags/registry.yaml`

**Verification:** File review — registry matches actual code state

**Effort:** 1 hr

---

### Sprint 2 Exit Criteria
- [ ] `tenantFlags.ts` deleted, all consumers migrated to `effectiveFlags.ts`
- [ ] Supplier routes use `requireFlag()` middleware
- [ ] `registry.yaml` matches actual code state
- [ ] `npx tsc --noEmit` passes on both api and web

---

## Sprint 3: Unification (Week 3)

**Goal:** Migrate env-only `config.ts` flags into the DB system and begin web client migration.

### S3-1: Migrate `config.ts` Flags to DB System (R1, Step 1-2) — 🔴 Structural

**Scope:**
- Add all 13 `config.ts` flags to `DEFAULT_FLAGS` in `seed-platform-flags.ts` with `allow_tenant_override: false`:
  ```ts
  { flag: 'FF_GLOBAL_TENANT_META', enabled: false, rollout: 'Region resolution from DB', allow_tenant_override: false },
  { flag: 'FF_AUDIT_LOG', enabled: false, rollout: 'Audit log writes + table creation', allow_tenant_override: false },
  { flag: 'FF_I18N_SCAFFOLD', enabled: false, rollout: 'i18next translation scaffold', allow_tenant_override: false },
  { flag: 'FF_CURRENCY_RATE_STUB', enabled: false, rollout: 'Currency rate stub job', allow_tenant_override: false },
  { flag: 'FF_FEED_ALIGNMENT_ENFORCE', enabled: false, rollout: 'Block feed on unmapped categories', allow_tenant_override: false },
  { flag: 'FF_FEED_COVERAGE', enabled: true, rollout: 'Feed coverage endpoint', allow_tenant_override: false },
  { flag: 'FF_CATEGORY_MIRRORING', enabled: false, rollout: 'Category mirror endpoint', allow_tenant_override: false },
  { flag: 'FF_TENANT_PLATFORM_CATEGORY', enabled: false, rollout: 'Platform category mapping', allow_tenant_override: false },
  { flag: 'FF_SCAN_ENRICHMENT', enabled: true, rollout: 'Image enrichment during scan', allow_tenant_override: false },
  ```
- Replace `Flags.GLOBAL_TENANT_META` reads in `context.ts` with `await getEffectivePlatform('FF_GLOBAL_TENANT_META')` (use cached version from S2-1)
- Replace `Flags.AUDIT_LOG` reads in `audit.ts` with `await getEffectivePlatform('FF_AUDIT_LOG')`
- Replace `Flags.CURRENCY_RATE_STUB` reads in `jobs/rates.ts` with `await getEffectivePlatform('FF_CURRENCY_RATE_STUB')`
- Replace `Flags.FEED_ALIGNMENT_ENFORCE` reads in `routes/feed-jobs.ts` with `await getEffectivePlatform('FF_FEED_ALIGNMENT_ENFORCE')`
- Replace `Flags.FEED_COVERAGE` reads in `routes/feed-validation.ts` with `await getEffectivePlatform('FF_FEED_COVERAGE')`
- Replace `Flags.CATEGORY_MIRRORING` reads in `routes/categories.mirror.ts` with `await getEffectivePlatform('FF_CATEGORY_MIRRORING')`
- Replace `Flags.TENANT_PLATFORM_CATEGORY` reads with `await getEffectivePlatform('FF_TENANT_PLATFORM_CATEGORY')`
- Replace `Flags.SCAN_ENRICHMENT` reads in `routes/scan.ts` with `await getEffectivePlatform('FF_SCAN_ENRICHMENT')`
- **Note:** Some of these are in hot paths (e.g., `context.ts` runs on every request). The cache from S2-1 is critical here.
- **Note:** `audit.ts` `ensureAuditTable()` is called at startup — make it async or check env var as fallback if DB isn't ready yet
- Keep `config.ts` as a fallback for startup/boot paths where DB may not be available yet:
  ```ts
  // config.ts — kept as boot-time fallback
  export const Flags = {
    AUDIT_LOG: String(process.env.FF_AUDIT_LOG || "false").toLowerCase() === "true",
    // ...
  }
  ```
  Consumers use `getEffectivePlatform()` at runtime, `Flags.X` only at boot before DB is ready.

**Files:**
- `apps/api/src/scripts/seed-platform-flags.ts`
- `apps/api/src/context.ts`
- `apps/api/src/audit.ts`
- `apps/api/src/jobs/rates.ts`
- `apps/api/src/routes/feed-jobs.ts`
- `apps/api/src/routes/feed-validation.ts`
- `apps/api/src/routes/categories.mirror.ts`
- `apps/api/src/routes/scan.ts`
- `apps/api/src/config.ts` (add comment about fallback-only status)

**Verification:**
- Run seed script — all 22 flags in DB
- `npx tsc --noEmit` passes on api
- Flag checks return same results as before
- `FF_AUDIT_LOG=true` env var still forces audit logging on

**Effort:** 4 hrs

---

### S3-2: Create Web Flag Fetch Hook (R1, Step 3 / R3) — 🟠 Structural

**Scope:**
- Create `apps/web/src/hooks/useEffectiveFlags.ts`:
  ```ts
  // Fetches effective flags from API and caches in React Query
  // Returns: { isFlagOn(flag): boolean, flags: Record<string, EffectiveFlag>, isLoading: boolean }
  ```
- Uses the existing `AdminPlatformFlagsService.getEffectiveFlags()` or `TenantFlagsService.getEffectiveFlags(tenantId)` endpoint
- Caches for 60s (React Query staleTime)
- Falls back to `false` for all flags during SSR / initial load
- Create `apps/web/src/hooks/useFeatureFlag.ts`:
  ```ts
  // Convenience hook: useFeatureFlag('FF_MAP_CARD') → boolean
  ```

**Files:**
- `apps/web/src/hooks/useEffectiveFlags.ts` (new)
- `apps/web/src/hooks/useFeatureFlag.ts` (new)

**Verification:**
- `npx tsc --noEmit` passes on web
- Hook returns correct values when API is available

**Effort:** 2 hrs

---

### Sprint 3 Exit Criteria
- [ ] All 22 flags seeded in DB
- [ ] `config.ts` flags read from `getEffectivePlatform()` at runtime (with boot fallback)
- [ ] Web hooks created for fetching effective flags from API
- [ ] `npx tsc --noEmit` passes on both api and web

---

## Sprint 4: Migration & Enhancements (Week 4)

**Goal:** Migrate web components to server-side flags, add audit trail and governance.

### S4-1: Migrate Web Components to API Flags (R1, Step 3 / R3) — 🟠 Structural

**Scope:**
- Replace `isFeatureEnabled('FF_BUSINESS_PROFILE', tenantId, region)` calls in `apps/web/src/app/(platform)/settings/tenant/page.tsx` with `useFeatureFlag('FF_BUSINESS_PROFILE')`
- Replace `isFeatureEnabled('FF_TENANT_URLS', ...)` calls in:
  - `apps/web/src/app/(platform)/page.tsx`
  - `apps/web/src/lib/tenant-navigation.ts`
- Replace `isFeatureEnabled('FF_CATEGORY_MANAGEMENT_PAGE', ...)` in `apps/web/src/components/onboarding/OnboardingWizard.tsx`
- Replace `isFeatureEnabled('FF_TENANT_GBP_CATEGORY_SYNC', ...)` in tenant settings page
- Replace `isFeatureEnabled('FF_MAP_CARD', ...)` in tenant settings page
- Replace `isFeatureEnabled('FF_SWIS_PREVIEW', ...)` in tenant settings page
- Replace `isFeatureEnabled('FF_GOOGLE_CONNECT_SUITE', ...)` in tenant settings page
- Remove hardcoded `FEATURE_FLAGS` config and `isFeatureEnabled()` function from `apps/web/src/lib/featureFlags/index.ts`
- Keep the `FeatureFlag` type union (still useful for type safety)
- Remove `useFeatureFlag()` from `featureFlags/index.ts` (replaced by new hook)
- Remove `updateFeatureFlag()`, `enablePilot()`, `enablePercentage()`, `enableForAll()`, `disableForAll()`, `getAllFeatureFlags()`, `gradualRollout()`, `rollbackFeature()`, `trackFeatureFlagCheck()` — all client-side flag management functions

**Files:**
- `apps/web/src/app/(platform)/settings/tenant/page.tsx`
- `apps/web/src/app/(platform)/page.tsx`
- `apps/web/src/lib/tenant-navigation.ts`
- `apps/web/src/components/onboarding/OnboardingWizard.tsx`
- `apps/web/src/lib/featureFlags/index.ts` (gut the file, keep only the type)

**Verification:**
- `npx tsc --noEmit` passes on web
- Tenant settings page shows/hides sections based on API flag state
- `grep "isFeatureEnabled" apps/web/src/` returns nothing

**Effort:** 4 hrs

---

### S4-2: Add Flag Audit Trail (H3) — 🟢 Enhancement

**Scope:**
- In `apps/api/src/routes/platform-flags.ts` — add audit log calls after each mutation:
  ```ts
  import { logAudit } from '../audit';
  // After PUT /platform-flags/:flag
  await logAudit({ actor: req.user.id, action: 'update', payload: { flag, oldEnabled, newEnabled } });
  // After DELETE
  await logAudit({ actor: req.user.id, action: 'delete', payload: { flag } });
  ```
- In `apps/api/src/routes/tenant-flags.ts` — add audit log after PUT
- In `apps/api/src/routes/effective-flags.ts` — add audit log after override set
- All audit calls gated on `await getEffectivePlatform('FF_AUDIT_LOG')` (which replaces `Flags.AUDIT_LOG` from S3-1)

**Files:**
- `apps/api/src/routes/platform-flags.ts`
- `apps/api/src/routes/tenant-flags.ts`
- `apps/api/src/routes/effective-flags.ts`

**Verification:**
- Enable `FF_AUDIT_LOG`, change a flag, verify audit_log table has entry
- `npx tsc --noEmit` passes on api

**Effort:** 1.5 hrs

---

### S4-3: Add Flag Expiry Auto-Cleanup Job (H2) — 🟢 Enhancement

**Scope:**
- Add migration to add `expires_at` column to `platform_feature_flags_list`:
  ```sql
  ALTER TABLE platform_feature_flags_list ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
  ```
- Update Prisma schema
- Create `apps/api/src/jobs/flag-cleanup.ts`:
  - Runs daily (wire into `index.ts` startup)
  - Queries flags where `expires_at < NOW() - INTERVAL '30 days'`
  - Sets `enabled = false` for expired flags
  - Logs cleanup action to audit log
- Update seed script to set `expires_at` based on registry governance (6 months from created date)

**Files:**
- `database/migrations/072_flag_expiry_column.sql` (new)
- `apps/api/prisma/schema.prisma`
- `apps/api/src/jobs/flag-cleanup.ts` (new)
- `apps/api/src/index.ts` (wire job)
- `apps/api/src/scripts/seed-platform-flags.ts` (add expires_at)

**Verification:**
- Insert a flag with `expires_at` in the past, run job, verify flag is disabled
- `npx tsc --noEmit` passes on api

**Effort:** 2 hrs

---

### S4-4: Surface Flag Divergence in Admin UI (H6) — 🟢 Enhancement

**Scope:**
- Add a new API endpoint `GET /api/admin/flags/web-config` that returns the web client's hardcoded flag strategies (read from a static config file or environment)
- Add a "Web Config" column to `AdminPlatformFlags.tsx` that shows the web strategy alongside the DB state
- Show a ⚠️ warning icon when web strategy and DB state disagree
- **Note:** After S4-1, the web client no longer has hardcoded strategies, so this becomes a transitional tool. If S4-1 is complete, this task can be skipped or repurposed to show env var state vs DB state.

**Files:**
- `apps/api/src/routes/effective-flags.ts` (new endpoint)
- `apps/web/src/components/admin/AdminPlatformFlags.tsx`

**Verification:**
- Admin UI shows divergence warnings for mismatched flags

**Effort:** 2 hrs (skip if S4-1 fully eliminates web hardcoded config)

---

### Sprint 4 Exit Criteria
- [ ] All web components use `useFeatureFlag()` hook instead of `isFeatureEnabled()`
- [ ] `featureFlags/index.ts` gutted to just the type union
- [ ] Flag mutations produce audit log entries
- [ ] Flag cleanup job runs daily
- [ ] `npx tsc --noEmit` passes on both api and web

---

## Dependency Graph

```
S1-1 (H1: Auth)              ─── no deps, do first
S1-2 (E1: Scan flags)        ─── no deps
S1-3 (E2: Phantom flags)     ─── no deps
S1-4 (H4: Env docs)          ─── no deps
S1-5 (H5: Seed script)       ─── no deps
S1-6 (E4: localStorage)      ─── no deps

S2-1 (H7: tenantFlags.ts)    ─── depends on S1-2 (scan flags removed first)
S2-2 (R2: Centralize gating) ─── depends on S2-1 (effectiveFlags has cache)
S2-3 (E3: Registry)          ─── no deps

S3-1 (R1: config.ts → DB)    ─── depends on S2-1 (cache in effectiveFlags)
S3-2 (R3: Web fetch hook)    ─── no deps (can start in parallel with S3-1)

S4-1 (R1: Migrate web)       ─── depends on S3-2 (hook exists)
S4-2 (H3: Audit trail)       ─── depends on S3-1 (audit flag in DB)
S4-3 (H2: Cleanup job)       ─── depends on S3-1 (flags in DB)
S4-4 (H6: Divergence UI)     ─── depends on S4-1 (may be skippable)
```

## Effort Summary

| Sprint | Tasks | Total Effort | Risk |
|--------|-------|-------------|------|
| Sprint 1 | 6 | ~3 hrs | Low — deletions and security fix |
| Sprint 2 | 3 | ~5 hrs | Medium — structural changes to resolution path |
| Sprint 3 | 2 | ~6 hrs | High — migrating hot-path flag reads to async |
| Sprint 4 | 4 | ~9.5 hrs | Medium — web migration + new features |
| **Total** | **15** | **~23.5 hrs** | |

## Risk Register

| Risk | Mitigation |
|------|-----------|
| S3-1: Async flag checks in hot paths (context.ts) add latency | 30s cache in effectiveFlags.ts keeps it to 1 DB query per 30s per flag |
| S3-1: `audit.ts` `ensureAuditTable()` runs at boot before DB ready | Keep `Flags.AUDIT_LOG` env var as boot-time fallback |
| S4-1: Web components flash hidden content during SSR (flags load async) | Default to `false` during SSR, show after hydration — same behavior as current `isFeatureEnabled` which defaults to `off` |
| S2-1: Removing `tenantFlags.ts` breaks unknown consumers | Full grep before deletion; keep file as re-export shim for one sprint |
| S3-1: Seed script run on production changes flag states | Seed uses `upsert` — only updates flags that already exist; new flags get `enabled: false` by default |

## Parallelization Opportunities

- **S1-1 through S1-6** are all independent — can be done in parallel by multiple developers
- **S2-3** (registry cleanup) can be done in parallel with S2-1 and S2-2
- **S3-2** (web hook) can be done in parallel with S3-1 (api migration)
- **S4-2, S4-3, S4-4** can be done in parallel after S4-1 is complete
