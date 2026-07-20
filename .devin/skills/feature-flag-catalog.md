# Feature Flag Catalog & Audit

## Purpose

Complete audit of all feature flags in the retail-visibility-platform codebase: where they live, how they're activated, which are active vs inactive, and what environment variables must be set on remote servers.

## Flag System Architecture (3 Layers)

The platform has **three independent feature flag systems** that operate at different layers:

### Layer 1: API `config.ts` Flags (Env-Only, Hardcoded)

**File:** `apps/api/src/config.ts`

These flags are read exclusively from API-side environment variables at process start. They are **not** in the database, have no admin UI, and cannot be toggled at runtime.

```ts
export const Flags = {
  GLOBAL_TENANT_META:      process.env.FF_GLOBAL_TENANT_META      || "false",
  AUDIT_LOG:               process.env.FF_AUDIT_LOG               || "false",
  I18N_SCAFFOLD:           process.env.FF_I18N_SCAFFOLD           || "false",
  CURRENCY_RATE_STUB:      process.env.FF_CURRENCY_RATE_STUB      || "false",
  FEED_ALIGNMENT_ENFORCE:  process.env.FF_FEED_ALIGNMENT_ENFORCE  || "false",
  FEED_COVERAGE:           process.env.FF_FEED_COVERAGE           || "true",
  CATEGORY_MIRRORING:      process.env.FF_CATEGORY_MIRRORING      || "false",
  TENANT_PLATFORM_CATEGORY: process.env.FF_TENANT_PLATFORM_CATEGORY || "false",
  SKU_SCANNING:            process.env.FF_SKU_SCANNING            || "false",
  SCAN_CAMERA:             process.env.FF_SCAN_CAMERA             || "false",
  SCAN_USB:                process.env.FF_SCAN_USB                || "true",  // default ON
  SCAN_ENRICHMENT:         process.env.FF_SCAN_ENRICHMENT         || "true",  // default ON
  SCAN_DUPLICATE_CHECK:    process.env.FF_SCAN_DUPLICATE_CHECK    || "true",  // default ON
}
```

**Consumers:**
- `Flags.GLOBAL_TENANT_META` → `context.ts` (region resolution from DB)
- `Flags.AUDIT_LOG` → `audit.ts` (audit log writes + table creation)
- `Flags.I18N_SCAFFOLD` → API-side i18n (not used directly; web side uses NEXT_PUBLIC_ equivalent)
- `Flags.CURRENCY_RATE_STUB` → `jobs/rates.ts` (currency rate job endpoint)
- `Flags.FEED_ALIGNMENT_ENFORCE` → `routes/feed-jobs.ts` (block feed on unmapped categories)
- `Flags.FEED_COVERAGE` → `routes/feed-validation.ts` (coverage endpoint gate)
- `Flags.CATEGORY_MIRRORING` → `routes/categories.mirror.ts` (category mirror endpoint)
- `Flags.TENANT_PLATFORM_CATEGORY` → tenant category routes
- `Flags.SKU_SCANNING` → `routes/scan.ts` (COMMENTED OUT — superseded by barcode_scan_options capability)
- `Flags.SCAN_ENRICHMENT` → `routes/scan.ts` (image enrichment during scan)
- `Flags.SCAN_USB` / `Flags.SCAN_CAMERA` / `Flags.SCAN_DUPLICATE_CHECK` → scan routes (legacy, mostly superseded)

### Layer 2: Web `flags.ts` Flags (Env-Only, Build-Time)

**File:** `apps/web/src/lib/flags.ts`

Read from `NEXT_PUBLIC_FF_*` env vars at Next.js build time. Client-side only.

```ts
export const Flags = {
  SKU_SCANNING:         process.env.NEXT_PUBLIC_FF_SKU_SCANNING         === 'true',
  SCAN_CAMERA:          process.env.NEXT_PUBLIC_FF_SCAN_CAMERA          === 'true',
  SCAN_USB:             process.env.NEXT_PUBLIC_FF_SCAN_USB             !== 'false', // default ON
  SCAN_ENRICHMENT:      process.env.NEXT_PUBLIC_FF_SCAN_ENRICHMENT      === 'true',
  SCAN_DUPLICATE_CHECK: process.env.NEXT_PUBLIC_FF_SCAN_DUPLICATE_CHECK !== 'false', // default ON
}
```

**Note:** SKU_SCANNING, SCAN_CAMERA, SCAN_USB are **deprecated** — superseded by the `barcode_scan_options` capability type. Use `useBarcodeScanCapability()` instead.

### Layer 3: Database + Env Hybrid Flags (Full System)

This is the main feature flag system with database persistence, env var override, runtime kill-switch, and admin UI.

**Core files:**
- `apps/api/src/utils/effectiveFlags.ts` — resolution engine (env > runtime override > DB)
- `apps/api/src/middleware/flags.ts` — Express middleware (`requireFlag()`)
- `apps/api/src/utils/tenantFlags.ts` — simple tenant flag cache (30s TTL)
- `apps/api/src/routes/platform-flags.ts` — admin CRUD for `platform_feature_flags_list`
- `apps/api/src/routes/tenant-flags.ts` — tenant CRUD for `tenant_feature_flags_list`
- `apps/api/src/routes/effective-flags.ts` — effective flag resolution + runtime override endpoints
- `apps/api/src/scripts/seed-platform-flags.ts` — seed script to populate DB from defaults
- `apps/web/src/lib/featureFlags/index.ts` — client-side flag config (localStorage + hardcoded strategies)
- `apps/web/src/services/AdminPlatformFlagsService.ts` — admin frontend service
- `apps/web/src/services/TenantFlagsService.ts` — tenant flag frontend service
- `apps/web/src/components/admin/AdminPlatformFlags.tsx` — admin UI panel

**Resolution precedence (highest to lowest):**
1. **Env var** `FF_{FLAG_NAME}=true` on **Railway** (API server) → forces ON
2. **Runtime override** (in-memory `platformOverrides` map, set via admin API) → kill switch / force-on
3. **Database** `platform_feature_flags_list.enabled` → persistent default
4. If none match → OFF

**Tenant-level resolution:**
- If platform is ON and `allow_tenant_override=false` → tenant inherits ON
- If platform is OFF and `allow_tenant_override=false` → tenant blocked
- If `allow_tenant_override=true` → tenant DB record (`tenant_feature_flags_list`) or runtime override decides

**Web client-side** (`featureFlags/index.ts`):
- Hardcoded `FeatureFlagConfig` strategies (`off`, `pilot`, `percentage`, `on`)
- Overridden by `localStorage.feature_flags` if present
- `isFeatureEnabled(flag, tenantId, region)` checks strategy
- **Not connected to the API-side DB system** — client and server flag states can diverge

**Database tables:**
- `platform_feature_flags_list` (id, flag, enabled, description, rollout, allow_tenant_override, timestamps)
- `tenant_feature_flags_list` (id, tenant_id, flag, enabled, description, rollout, timestamps; unique on [tenant_id, flag])

**Seed script:** `npx ts-node src/scripts/seed-platform-flags.ts` — inserts 11 default flags into `platform_feature_flags_list`.

## Complete Flag Catalog

### Group A: API `config.ts` Env-Only Flags (13 flags)

These require environment variables on **Railway** (the API server). No DB, no admin UI. Do NOT set these on Vercel — the API process reads them from `process.env` at startup.

| Flag | Env Var | Default | Active? | Consumer | Notes |
|------|---------|---------|---------|----------|-------|
| GLOBAL_TENANT_META | `FF_GLOBAL_TENANT_META` | false | ❌ Inactive | `context.ts` | Region resolution from DB |
| AUDIT_LOG | `FF_AUDIT_LOG` | false | ❌ Inactive | `audit.ts` | Audit log writes + table creation |
| I18N_SCAFFOLD | `FF_I18N_SCAFFOLD` | false | ❌ Inactive | API-side i18n | Web side uses NEXT_PUBLIC_ equivalent |
| CURRENCY_RATE_STUB | `FF_CURRENCY_RATE_STUB` | false | ❌ Inactive | `jobs/rates.ts` | Currency rate stub job |
| FEED_ALIGNMENT_ENFORCE | `FF_FEED_ALIGNMENT_ENFORCE` | false | ❌ Inactive | `routes/feed-jobs.ts` | Block feed on unmapped categories |
| FEED_COVERAGE | `FF_FEED_COVERAGE` | true | ✅ Active | `routes/feed-validation.ts` | Coverage endpoint gate |
| CATEGORY_MIRRORING | `FF_CATEGORY_MIRRORING` | false | ❌ Inactive | `routes/categories.mirror.ts` | Category mirror endpoint |
| TENANT_PLATFORM_CATEGORY | `FF_TENANT_PLATFORM_CATEGORY` | false | ❌ Inactive | tenant category routes | Platform category mapping |
| SKU_SCANNING | `FF_SKU_SCANNING` | false | ❌ Inactive (commented out) | `routes/scan.ts` | **DEPRECATED** — superseded by barcode_scan_options capability |
| SCAN_CAMERA | `FF_SCAN_CAMERA` | false | ❌ Inactive | scan routes | **DEPRECATED** — superseded |
| SCAN_USB | `FF_SCAN_USB` | true | ✅ Active | scan routes | **DEPRECATED** — superseded |
| SCAN_ENRICHMENT | `FF_SCAN_ENRICHMENT` | true | ✅ Active | `routes/scan.ts` | Image enrichment during scan |
| SCAN_DUPLICATE_CHECK | `FF_SCAN_DUPLICATE_CHECK` | true | ✅ Active | scan routes | **DEPRECATED** — superseded |

### Group B: Web `flags.ts` Env-Only Flags (5 flags)

These require `NEXT_PUBLIC_FF_*` env vars on the **web server** (Vercel). Build-time only.

| Flag | Env Var | Default | Active? | Notes |
|------|---------|---------|---------|-------|
| SKU_SCANNING | `NEXT_PUBLIC_FF_SKU_SCANNING` | false | ❌ Inactive | **DEPRECATED** |
| SCAN_CAMERA | `NEXT_PUBLIC_FF_SCAN_CAMERA` | false | ❌ Inactive | **DEPRECATED** |
| SCAN_USB | `NEXT_PUBLIC_FF_SCAN_USB` | true | ✅ Active | **DEPRECATED** |
| SCAN_ENRICHMENT | `NEXT_PUBLIC_FF_SCAN_ENRICHMENT` | false | ❌ Inactive | **DEPRECATED** |
| SCAN_DUPLICATE_CHECK | `NEXT_PUBLIC_FF_SCAN_DUPLICATE_CHECK` | true | ✅ Active | **DEPRECATED** |

### Group C: Web `i18n.ts` Env-Only Flag (1 flag)

| Flag | Env Var | Default | Active? | Notes |
|------|---------|---------|---------|-------|
| I18N_SCAFFOLD | `NEXT_PUBLIC_FF_I18N_SCAFFOLD` | false | ❌ Inactive | i18next initialization; `useTranslation()` falls back to raw strings |

### Group D: Database + Env Hybrid Flags (seeded via `seed-platform-flags.ts`)

These exist in `platform_feature_flags_list` DB table. Can be toggled via admin UI at `/settings/admin` → Platform Flags. Env var `FF_{FLAG}=true` on **Railway** (API server) forces ON regardless of DB state. The web client (Vercel) does not need these env vars — it fetches effective flags from the API via `GET /api/admin/effective-flags`.

| Flag | DB Default | Env Var Override | allow_tenant_override | Web Strategy | Active? | Consumer |
|------|-----------|-----------------|----------------------|-------------|---------|----------|
| FF_MAP_CARD | false | `FF_MAP_CARD` | true | off | ❌ Inactive | Tenant settings: MapCardSettings component |
| FF_SWIS_PREVIEW | false | `FF_SWIS_PREVIEW` | true | off | ❌ Inactive | Tenant settings: SwisPreviewSettings component |
| FF_BUSINESS_PROFILE | true | `FF_BUSINESS_PROFILE` | false | on (100%) | ✅ Active | Tenant settings: BusinessProfileCard |
| FF_DARK_MODE | false | `FF_DARK_MODE` | true | off | ❌ Inactive | Future feature — no consumer yet |
| FF_GOOGLE_CONNECT_SUITE | false | `FF_GOOGLE_CONNECT_SUITE` | false | pilot | ❌ Inactive | Tenant settings: GoogleConnectCard |
| FF_APP_SHELL_NAV | false | `FF_APP_SHELL_NAV` | false | off | ❌ Inactive | App shell navigation |
| FF_TENANT_URLS | false | `FF_TENANT_URLS` | false | on (100%) | ⚠️ Divergent | Web says ON, DB says OFF. Env `NEXT_PUBLIC_FF_TENANT_URLS=true` set in web .env.example |
| FF_ITEMS_V2_GRID | false | `FF_ITEMS_V2_GRID` | true | off | ❌ Inactive | Items grid v2 (virtualized) |
| FF_CATEGORY_MANAGEMENT_PAGE | true | `FF_CATEGORY_MANAGEMENT_PAGE` | false | on (100%) | ✅ Active | OnboardingWizard, category management |
| FF_CATEGORY_QUICK_ACTIONS | false | `FF_CATEGORY_QUICK_ACTIONS` | true | off | ❌ Inactive | Quick actions footer |

### Group E: Web `featureFlags/index.ts` Only (not in seed script, not in DB)

These flags exist only in the web client's hardcoded `FEATURE_FLAGS` config. They have no DB row, no seed entry, and no API env var. They are controlled purely by the web client's localStorage or hardcoded strategy.

| Flag | Web Strategy | Active? | Consumer |
|------|-------------|---------|----------|
| FF_TENANT_GBP_CATEGORY_SYNC | pilot (1 tenant) | ⚠️ Pilot only | Tenant settings: GBPCategoryCard |
| FF_CATEGORY_MIRRORING | off | ❌ Inactive | Web only — API side has separate `Flags.CATEGORY_MIRRORING` env var |

### Group F: Registry-Only Flags (in `registry.yaml`, not in code)

These flags are documented in `docs/feature-flags/registry.yaml` but have **no code consumers**. They are aspirational/documentation-only.

| Flag | Registry Status | Notes |
|------|----------------|-------|
| FF_SCHEMA_V34_READY | active (100%) | No code reference — likely a historical migration flag |
| FF_DIRECTORY_ENTRY_LAYOUT | active (100%) | No code reference — directory layout switching may be handled by capability system instead |
| FF_DIRECTORY_ENTRY_LAYOUT_EDITORIAL | active | No code reference |
| FF_DIRECTORY_ENTRY_LAYOUT_IMMERSIVE | active | No code reference |
| FF_DIRECTORY_ENTRY_LAYOUT_PREMIUM | inactive (0%) | No code reference — hard-gated |
| FF_TENANT_CATEGORY_OVERRIDE | pilot (0%) | No code reference |
| FF_FEED_ALIGNMENT_ENFORCE | active | **Also in config.ts** — env var controls it, registry status is stale |
| FF_AUDIT_LOG | active | **Also in config.ts** — env var controls it, registry status is stale |
| FF_SYNTHETIC_MONITORING | active (100%) | No code reference |
| FF_ASYNC_FEED_JOBS | pilot (30%) | No code reference |

### Group G: Admin UI Display-Only Flags (not seeded, not in code)

The `AdminPlatformFlags.tsx` component has `FLAG_DESCRIPTIONS` for flags that have **no seed entry, no code consumer, and no env var**. These are UI placeholders for future features.

| Flag | Title | Notes |
|------|-------|-------|
| FF_ENFORCE_CSRF | CSRF Protection | No implementation |
| FF_PRODUCT_ENRICHMENT | Product Enrichment | No implementation |
| FF_AI_SUGGESTIONS | AI Suggestions | No implementation |
| FF_ANALYTICS_DASHBOARD | Analytics Dashboard | No implementation |
| FF_BULK_OPERATIONS | Bulk Operations | No implementation |
| FF_REAL_TIME_SYNC | Real-Time Sync | No implementation |
| FF_MULTI_TENANT_SUPPORT | Multi-Tenant Support | No implementation |
| FF_API_RATE_LIMITING | API Rate Limiting | No implementation |
| FF_ADVANCED_SEARCH | Advanced Search | No implementation |
| FF_MOBILE_OPTIMIZED | Mobile Optimized | No implementation |
| FF_PWA_SUPPORT | PWA Support | No implementation |
| FF_SOCIAL_SHARING | Social Sharing | No implementation |
| FF_EMAIL_NOTIFICATIONS | Email Notifications | No implementation |
| FF_WEBHOOKS | Webhooks | No implementation |
| FF_CUSTOM_BRANDING | Custom Branding | No implementation |
| FF_ADVANCED_REPORTING | Advanced Reporting | No implementation |
| FF_INTEGRATION_MARKETPLACE | Integration Marketplace | No implementation |
| FF_AI_COPILOT | AI Co-Pilot | No implementation |
| FF_VOICE_COMMANDS | Voice Commands | No implementation |
| FF_BLOCKCHAIN_INTEGRATION | Blockchain Integration | No implementation |

## Environment Variables Required on Remote Servers

### API Server (Railway)

Set these in the Railway project environment variables. The API process reads them from `process.env` at startup. Do NOT set these on Vercel — Vercel hosts the Next.js web client, which fetches flag state from the API.

#### To activate inactive API config flags:
```env
FF_GLOBAL_TENANT_META=true
FF_AUDIT_LOG=true
FF_I18N_SCAFFOLD=true
FF_CURRENCY_RATE_STUB=true
FF_FEED_ALIGNMENT_ENFORCE=true
FF_CATEGORY_MIRRORING=true
FF_TENANT_PLATFORM_CATEGORY=true
```

#### Already active by default (no action needed):
```env
# FF_FEED_COVERAGE=true (default)
# FF_SCAN_USB=true (default)
# FF_SCAN_ENRICHMENT=true (default)
# FF_SCAN_DUPLICATE_CHECK=true (default)
```

#### To force-ON database hybrid flags (overrides DB):
```env
FF_MAP_CARD=true
FF_SWIS_PREVIEW=true
FF_DARK_MODE=true
FF_GOOGLE_CONNECT_SUITE=true
FF_APP_SHELL_NAV=true
FF_TENANT_URLS=true
FF_ITEMS_V2_GRID=true
FF_CATEGORY_QUICK_ACTIONS=true
```

**Note:** `FF_BUSINESS_PROFILE` and `FF_CATEGORY_MANAGEMENT_PAGE` are already `enabled=true` in the DB seed. Setting env vars for them is redundant but harmless.

### Web Server (Vercel)

Set these in the Vercel project environment variables. These are `NEXT_PUBLIC_*` vars baked into the Next.js build at compile time. They are read client-side only.

```env
# Already in .env.local.example:
NEXT_PUBLIC_FF_TENANT_URLS=true

# To activate web-side scan flags (DEPRECATED — use capability system instead):
NEXT_PUBLIC_FF_SKU_SCANNING=true
NEXT_PUBLIC_FF_SCAN_CAMERA=true
NEXT_PUBLIC_FF_SCAN_ENRICHMENT=true

# To activate i18n:
NEXT_PUBLIC_FF_I18N_SCAFFOLD=true
```

## Key Insights

### 1. Three Systems, No Unification
The platform has three independent flag systems (API config.ts, web flags.ts, DB hybrid) that are **not connected to each other**. The web `featureFlags/index.ts` hardcoded strategies can diverge from the API DB state. Example: `FF_TENANT_URLS` is `on` in web config but `enabled=false` in the DB seed.

### 2. Deprecated Scan Flags
`SKU_SCANNING`, `SCAN_CAMERA`, `SCAN_USB`, `SCAN_ENRICHMENT`, `SCAN_DUPLICATE_CHECK` are all marked **DEPRECATED** in `flags.ts`. They have been superseded by the `barcode_scan_options` capability type. The API-side `Flags.SKU_SCANNING` check in `routes/scan.ts` is **commented out**. Only `SCAN_ENRICHMENT` is still actively consumed.

### 3. Registry vs Reality Gap
`docs/feature-flags/registry.yaml` contains 22 flags, but several have no code consumers (Group F). The registry marks `FF_AUDIT_LOG` and `FF_FEED_ALIGNMENT_ENFORCE` as `active`, but in code they default to `false` and require env vars to activate. The registry is stale.

### 4. Admin UI Phantom Flags
`AdminPlatformFlags.tsx` has display metadata for 20 flags that have no implementation anywhere in the codebase. These appear in the admin UI if someone creates them in the DB, but they do nothing.

### 5. `FF_SUPPLIER_CATALOG_IMPORT` — DEPRECATED
**Superseded by `product_opt_supplier_catalog` capability (product_options capability type).** Migrated 2026-07-03. The flag has been removed from `featureFlags/index.ts`, `AdminPlatformFlags.tsx`, `seed-platform-flags.ts`, and `routes/tenant/suppliers.ts`. Supplier routes now use `resolveEffectiveCapabilities()` capability gate exclusively. The DB row in `platform_feature_flags_list` can be safely deleted or left as-is (it is no longer read by any code).

### 6. Web localStorage Override
The web `featureFlags/index.ts` loads overrides from `localStorage.feature_flags`. This means a developer can override flag state in their browser without touching the server. This is a client-only override — it does not affect API-side gating.

### 7. `requireFlag()` Middleware — No Longer Used in Production
The `requireFlag()` Express middleware in `middleware/flags.ts` was previously used by `routes/tenant/suppliers.ts` to gate all supplier endpoints with `FF_SUPPLIER_CATALOG_IMPORT` at tenant scope. As of 2026-07-03, this is the only route that ever used `requireFlag()`, and it has been replaced by a capability gate. The middleware remains available for future use but has no current consumers.

**Other error codes from `requireFlag()`:**
- `tenant_not_enabled` — platform flag is ON but tenant has no DB record and no override (inherits platform state, but `allow_tenant_override=true` means tenant must opt in)
- `tenantId_required` — no tenant ID found in params/query/body/headers
- `flag_check_failed` — exception during resolution (DB error, etc.)

## Database Seed Script

To populate the `platform_feature_flags_list` table with default values:

```bash
cd apps/api
npx ts-node src/scripts/seed-platform-flags.ts
```

This seeds 11 flags. The script is idempotent (uses Prisma `upsert`).

## Admin API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/admin/platform-flags` | Platform user | List all platform flags |
| PUT | `/api/admin/platform-flags/:flag` | Platform admin | Update/create flag |
| POST | `/api/admin/platform-flags/:flag/override` | Platform admin | Force override |
| DELETE | `/api/admin/platform-flags` | Platform admin | Delete flag + tenant overrides |
| GET | `/api/admin/effective-flags` | Platform user | List effective platform flags |
| GET | `/api/admin/effective-flags/:tenantId` | Tenant access | List effective tenant flags |
| POST | `/api/admin/flags/override/platform/:flag` | None | Set platform runtime override |
| POST | `/api/admin/flags/override/tenant/:tenantId/:flag` | None | Set tenant runtime override |
| GET | `/api/admin/tenant-flags/:tenantId` | Tenant access | List tenant flags |
| PUT | `/api/admin/tenant-flags/:tenantId/:flag` | Tenant owner | Update tenant flag |

**Note:** The override endpoints (`POST /flags/override/...`) have **no auth middleware** — they are mounted under the admin router but lack `requirePlatformAdmin`. This is a security gap.

## Capability System (Migration Target)

The platform has a **capability system** (`EffectiveCapabilityResolver.ts`) that gates features by tier + merchant settings. Feature flags and capabilities served different purposes historically:

- **Feature flags** = platform-wide on/off switches (kill switches, gradual rollouts)
- **Capabilities** = per-tenant feature gating by subscription tier + merchant preferences

Capability domains: `commerce`, `payment_gateway`, `storefront`, `fulfillment`, `barcode_scan`, `product_types`, `product_options`, `featured`, `integrations`, `quickstart`, `storefront_options`, `directory_entry`, `faq`, `crm`, `chatbot`, `org_options`, `social_commerce_options`.

### Migration Path: Feature Flags → Capabilities

The feature flag system is **on a migration path to the capability architecture**. The deprecated scan flags (`SKU_SCANNING`, `SCAN_CAMERA`, `SCAN_USB`, `SCAN_DUPLICATE_CHECK`) were the first group superseded by the `barcode_scan_options` capability type. This pattern is now the template for migrating remaining feature flags.

**Why capabilities replace feature flags for tenant-gated features:**

- **Tier-aware gating**: Capabilities respect subscription tier boundaries — features unlock by plan, not by env var or DB toggle. Feature flags cannot express "available on Professional tier, not on Starter."
- **Merchant self-service**: Capabilities expose per-feature merchant toggles via settings pages. Merchants see what their plan includes and can opt-in to tier-allowed features. Feature flags require admin intervention or env var changes.
- **Cross-capability constraints**: The Constraint Layer (CCL) can express dependencies between capabilities (e.g., "service storefront requires service product type"). Feature flags have no dependency model.
- **Dashboard visibility**: `PlanSummaryWidget` (dashboard + options pages) and `CapabilityShowcase` automatically render capability state — tier-allowed, merchant-gated, enabled, or disabled. Feature flags have no dashboard representation.
- **Consistent data flow**: The 6-layer architecture (resolver → orchestrator → route → service → hook → dashboard) ensures backend and frontend never diverge. Feature flags have three independent systems that can disagree.
- **Well-documented**: Capability deployment follows `capability-deployment-flow.md` (8-phase pipeline) and `capability-data-flow-rules.md` (23 rules). Feature flags have no deployment skill.
- **DB-managed**: Feature keys, tier assignments, and merchant prefs are all DB rows managed via admin UI or SQL. No env var redeployment needed.

**What stays as feature flags (not migrating):**

Platform infrastructure flags that control API-side behavior unrelated to tenant gating remain as env-only flags. These are kill switches and infrastructure toggles, not merchant-facing features:
- `FF_AUDIT_LOG`, `FF_FEED_ALIGNMENT_ENFORCE`, `FF_FEED_COVERAGE`, `FF_GLOBAL_TENANT_META`, `FF_I18N_SCAFFOLD`, `FF_CURRENCY_RATE_STUB`, `FF_CATEGORY_MIRRORING`, `FF_TENANT_PLATFORM_CATEGORY`, `FF_SCAN_ENRICHMENT`

**Migration process per flag:**

1. Define feature key(s) in `canonical-features.ts` following R15 naming convention
2. Seed into `features_list` + `capability_features_list` + `tier_features_list`
3. Add merchant pref column to appropriate `tenant_*_options_settings` table
4. Build or extend resolver (follow `capability-deployment-flow.md` Phases 1-8)
5. Replace `requireFlag()` / `isFeatureEnabled()` / `Flags.XXX` calls with `resolveEffectiveCapabilities()` checks
6. Remove the feature flag from `config.ts`, `flags.ts`, seed script, and admin UI
7. Verify with `pnpm checkapi` and `pnpm checkweb`

See `capability-deployment-flow.md` for the full 8-phase deployment pipeline.

## Recommendations

### Feature Flag → Capability Migration Candidates

The following feature flags are the next eligible group for migration to the capability architecture, ranked by readiness and impact. Each includes the ideal capability type (existing or new) and migration notes.

#### Tier 1: Immediate Candidates (active, tenant-gated, clear mapping)

| Flag | Current State | Target Capability | Migration Notes |
|------|--------------|-------------------|-----------------|
| `FF_SUPPLIER_CATALOG_IMPORT` | **MIGRATED** (2026-07-03) | **Existing: `product_options`** | ✅ Migrated to `product_opt_supplier_catalog` capability. Removed from all code. See note 5 above. |
| `FF_GOOGLE_CONNECT_SUITE` | Inactive, `allow_tenant_override=false`, pilot strategy | **Existing: `integrations`** | Google Connect is an integration feature. Add `integrations_google_connect` feature key to the existing `integrations` capability domain. Merchant toggle in `tenant_integrations_settings`. Replaces `GoogleConnectCard` component flag check. |
| `FF_TENANT_GBP_CATEGORY_SYNC` | Pilot (1 tenant), web-only, no DB row | **Existing: `integrations`** | GBP category sync is an integration feature. Add `integrations_gbp_category_sync` feature key. Migrate from web-only `featureFlags/index.ts` pilot strategy to tier-gated capability. Replaces `GBPCategoryCard` component flag check. |

#### Tier 2: Near-Term Candidates (display/behavior features fitting existing capabilities)

| Flag | Current State | Target Capability | Migration Notes |
|------|--------------|-------------------|-----------------|
| `FF_MAP_CARD` | Inactive, `allow_tenant_override=true` | **Existing: `storefront_options`** (new group: `map`) | Display feature for tenant storefront. Add `storefront_options_map_enabled` group gate + `storefront_options_map_card` feature key. Replaces `MapCardSettings` component flag check. |
| `FF_DARK_MODE` | Inactive, `allow_tenant_override=true` | **Existing: `storefront_options`** (new group: `theme`) | UI theme feature. Add `storefront_options_theme_enabled` group gate + `storefront_options_theme_dark_mode` feature key. |
| `FF_TENANT_URLS` | Divergent (web ON, DB OFF) | **Existing: `storefront_options`** (new group: `urls`) | Custom tenant URLs. Add `storefront_options_urls_enabled` group gate + `storefront_options_urls_custom` feature key. Migration resolves the web/DB divergence automatically. |
| `FF_ITEMS_V2_GRID` | Inactive, `allow_tenant_override=true` | **Existing: `product_options`** (new group: `layout`) | Virtualized items grid. Add `product_options_layout_enabled` group gate + `product_options_layout_v2_grid` feature key. Replaces web `isFeatureEnabled()` check. |
| `FF_CATEGORY_QUICK_ACTIONS` | Inactive, `allow_tenant_override=true` | **Existing: `storefront_options`** (new group: `category`) | Quick actions footer for category management. Add `storefront_options_category_enabled` group gate + `storefront_options_category_quick_actions` feature key. |

#### Tier 3: Lower Priority (already ON for all tenants, migration is cleanup)

| Flag | Current State | Target Capability | Migration Notes |
|------|--------------|-------------------|-----------------|
| `FF_BUSINESS_PROFILE` | Active, `allow_tenant_override=false`, ON for all | **Existing: `storefront_options`** (new group: `info`) | Already always on — migration is cleanup to unify under capability architecture. Add `storefront_options_info_enabled` group gate + `storefront_options_info_business_profile` feature key. Replaces `BusinessProfileCard` component flag check. |
| `FF_CATEGORY_MANAGEMENT_PAGE` | Active, `allow_tenant_override=false`, ON for all | **Existing: `storefront_options`** (existing group: `category`) | Already always on. Add `storefront_options_category_management_page` feature key to the `category` group created for `FF_CATEGORY_QUICK_ACTIONS`. |
| `FF_SWIS_PREVIEW` | Inactive, `allow_tenant_override=true` | **New: `swis_options`** or **Existing: `storefront_options`** (new group: `swis`) | SWIS preview is a specialized feature. If it has multiple sub-features, create a dedicated `swis_options` capability type. If it's a single toggle, add as `storefront_options_swis_preview` under a `swis` group. |
| `FF_APP_SHELL_NAV` | Inactive, `allow_tenant_override=false` | **Existing: `storefront_options`** (new group: `layout`) | App shell navigation. Add `storefront_options_layout_enabled` group gate + `storefront_options_layout_app_shell_nav` feature key. |

#### Not Eligible for Migration (platform infrastructure)

These flags control API-side infrastructure behavior and have no tenant-gating semantics. They remain as env-only flags in `config.ts`:

- `FF_AUDIT_LOG` — audit log infrastructure, not tenant-facing
- `FF_FEED_ALIGNMENT_ENFORCE` — feed validation infrastructure
- `FF_FEED_COVERAGE` — feed validation infrastructure
- `FF_GLOBAL_TENANT_META` — platform region resolution
- `FF_I18N_SCAFFOLD` — i18n initialization
- `FF_CURRENCY_RATE_STUB` — currency rate job infrastructure
- `FF_CATEGORY_MIRRORING` — platform-level data operation
- `FF_TENANT_PLATFORM_CATEGORY` — platform-level data operation
- `FF_SCAN_ENRICHMENT` — scan pipeline infrastructure (last active scan flag)

### Restructuring

#### R1: Unify the Three Flag Systems

**Problem:** Three independent systems (API `config.ts`, web `flags.ts`, DB hybrid) can diverge. `FF_TENANT_URLS` is `on` in web config but `enabled=false` in the DB seed — the web shows the feature, the API blocks it.

**Recommendation:** Consolidate into the DB hybrid system as the single source of truth. The web client should fetch effective flags from the API (`GET /api/admin/effective-flags/:tenantId`) rather than relying on hardcoded strategies and localStorage. Migrate `config.ts` env-only flags into `platform_feature_flags_list` with `allow_tenant_override=false` so they can be managed via the admin UI without redeployment.

**Migration path:**
1. Add missing `config.ts` flags to the seed script (`FF_AUDIT_LOG`, `FF_FEED_COVERAGE`, `FF_GLOBAL_TENANT_META`, etc.)
2. Replace `config.ts` reads with `getEffectivePlatform()` calls (cached)
3. Replace web `featureFlags/index.ts` hardcoded config with an API fetch + client-side cache
4. Keep env vars as the emergency kill-switch / force-on override layer (already works via `effectiveFlags.ts`)

#### R2: Centralize Route-Level Flag Gating

**Problem:** The `requireFlag()` middleware in `middleware/flags.ts` is defined but no longer used by any route. Supplier routes previously used it but have been migrated to the capability system.

**Status:** `requireFlag()` has no current consumers. Future flag-gated routes should prefer the capability system (`resolveEffectiveCapabilities`) over `requireFlag()`. The middleware remains available for backward compatibility.

#### R3: Move Web `featureFlags/index.ts` Logic Server-Side

**Problem:** The web client has its own rollout strategy engine (`off`, `pilot`, `percentage`, `on`) with localStorage overrides. This duplicates the server-side resolution and can produce different results for the same flag.

**Recommendation:** Delete the client-side strategy engine. Replace `isFeatureEnabled()` calls in web components with a React hook that fetches from the API's effective flags endpoint. The pilot tenant lists and rollout percentages should live in the DB (or a config table), not in client code.

### Eliminations

#### E1: Remove Deprecated Scan Flags

**Problem:** `SKU_SCANNING`, `SCAN_CAMERA`, `SCAN_USB`, `SCAN_DUPLICATE_CHECK` are marked DEPRECATED in both `apps/api/src/config.ts` and `apps/web/src/lib/flags.ts`. The API-side `Flags.SKU_SCANNING` check is commented out. These have been superseded by the `barcode_scan_options` capability type.

**Recommendation:** Remove `SKU_SCANNING`, `SCAN_CAMERA`, `SCAN_USB`, `SCAN_DUPLICATE_CHECK` from both `config.ts` and `flags.ts`. Keep only `SCAN_ENRICHMENT` (still actively consumed in `routes/scan.ts`). Remove the corresponding `NEXT_PUBLIC_FF_*` env vars from documentation and deployment configs. Remove the commented-out `Flags.SKU_SCANNING` check in `routes/scan.ts`.

#### E2: Delete Admin UI Phantom Flags

**Problem:** `AdminPlatformFlags.tsx` has `FLAG_DESCRIPTIONS` for 20 flags that have no implementation anywhere (Group G). These clutter the admin UI and mislead operators into thinking they control real features.

**Recommendation:** Remove all 20 phantom flag descriptions from `FLAG_DESCRIPTIONS` in `AdminPlatformFlags.tsx`. If any of these features are planned, add them back when the feature is actually implemented.

#### E3: Clean Up Stale Registry Entries

**Problem:** `docs/feature-flags/registry.yaml` contains 9 flags with no code consumers (Group F). It also marks `FF_AUDIT_LOG` and `FF_FEED_ALIGNMENT_ENFORCE` as `active` when they default to `false` in code.

**Recommendation:** Update `registry.yaml` to reflect actual code state. Move flags with no implementation to `status: removed` or remove them entirely. Fix the status of `FF_AUDIT_LOG` and `FF_FEED_ALIGNMENT_ENFORCE` to match their actual default (`false`). Add the 13 `config.ts` env-only flags and the 2 web-only flags that are missing from the registry.

#### E4: Remove Web localStorage Flag Override

**Problem:** `featureFlags/index.ts` loads flag overrides from `localStorage.feature_flags`. This allows a developer to override flag state in their browser without server knowledge, creating a client-server divergence that's hard to debug.

**Recommendation:** Remove the localStorage load/save logic. Flag state should come from the server only. If local development flag toggling is needed, use a dev-only `.env.local` override instead.

### Enhancements

#### H1: Add Auth to Override Endpoints

**Problem:** `POST /api/admin/flags/override/platform/:flag` and `POST /api/admin/flags/override/tenant/:tenantId/:flag` in `routes/effective-flags.ts` have no auth middleware. Anyone with network access to the API can set runtime kill switches.

**Recommendation:** Add `requirePlatformAdmin` to both override endpoints. This is a security fix — runtime overrides are kill switches and must be protected.

#### H2: Add Flag Expiry Auto-Cleanup Job

**Problem:** The registry defines governance policies (`max_lifetime: 6_months`, `auto_cleanup_after_expiry: 30_days`) but no code enforces them. Expired flags accumulate in the DB indefinitely.

**Recommendation:** Create a scheduled job (`jobs/flag-cleanup.ts`) that runs daily, checks `platform_feature_flags_list` for flags past their expiry (add an `expires_at` column), and auto-disables them after the grace period. Log all auto-cleanup actions to the audit log.

#### H3: Add Flag Audit Trail

**Problem:** Flag changes (enable, disable, override, delete) are not logged. There's no way to trace who changed a flag and when.

**Recommendation:** Add audit log entries for all flag mutations in `platform-flags.ts`, `tenant-flags.ts`, and `effective-flags.ts` routes. Use the existing `audit.ts` infrastructure (gated on `FF_AUDIT_LOG`). Record: actor, flag, action, old value, new value, timestamp.

#### H4: Add `NEXT_PUBLIC_FF_*` Vars to Web `.env.local.example`

**Problem:** Only `NEXT_PUBLIC_FF_TENANT_URLS=true` is documented in `.env.local.example`. The other web-side flags (`SCAN_*`, `I18N_SCAFFOLD`) are undocumented.

**Recommendation:** Add all `NEXT_PUBLIC_FF_*` vars to `.env.local.example` with their defaults and descriptions, even if deprecated. This makes the web flag surface discoverable.

#### H5: Add Missing Flags to Seed Script

**Problem:** The seed script (`seed-platform-flags.ts`) only seeds 11 flags. The web client knows about 13 flags (Group D + E). `FF_TENANT_GBP_CATEGORY_SYNC` and `FF_CATEGORY_MIRRORING` are missing from the seed script, so they have no DB row and can't be managed via the admin UI.

**Recommendation:** Add `FF_TENANT_GBP_CATEGORY_SYNC` (enabled: false, allow_tenant_override: true) and `FF_CATEGORY_MIRRORING` (enabled: false, allow_tenant_override: true) to the seed script.

#### H6: Surface Flag Divergence in Admin UI

**Problem:** The admin UI shows DB state and effective state, but doesn't highlight when the web client's hardcoded strategy disagrees with the DB. Operators can't see the divergence.

**Recommendation:** Add a "Divergence" column to `AdminPlatformFlags.tsx` that fetches the web client's hardcoded strategy (via a static config endpoint) and compares it to the DB state. Show a warning icon when they disagree.

#### H7: Deprecate `tenantFlags.ts` in Favor of `effectiveFlags.ts`

**Problem:** `utils/tenantFlags.ts` provides `isTenantFlagOn()` — a simple DB lookup with 30s cache. `utils/effectiveFlags.ts` provides `getEffectiveTenant()` — a full resolution with env/override/DB precedence. Two functions, same purpose, different behavior.

**Recommendation:** Remove `isTenantFlagOn()` and replace all consumers with `getEffectiveTenant()`. This ensures all flag checks respect the same precedence rules. The 30s TTL cache in `tenantFlags.ts` is redundant since `effectiveFlags.ts` could add its own caching layer.
