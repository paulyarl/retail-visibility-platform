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
| FF_SUPPLIER_CATALOG_IMPORT | true (DB) | `FF_FF_SUPPLIER_CATALOG_IMPORT` (Railway) | true | pilot | ✅ Active (enabled via DB) | Supplier routes (`routes/tenant/suppliers.ts`), ItemCreationWizard Step 0 |

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
FF_SUPPLIER_CATALOG_IMPORT=true
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

### 5. `FF_SUPPLIER_CATALOG_IMPORT` — Fully Wired
This is the most recently added flag (created 2026-06-29). It is the only flag that uses the `getEffectiveTenant()` resolution path in production code (`routes/tenant/suppliers.ts`). It is `enabled=false` in the DB seed with `allow_tenant_override=true`, so tenants can self-enable it.

### 6. Web localStorage Override
The web `featureFlags/index.ts` loads overrides from `localStorage.feature_flags`. This means a developer can override flag state in their browser without touching the server. This is a client-only override — it does not affect API-side gating.

### 7. `requireFlag()` Middleware Is Used by Supplier Routes
The `requireFlag()` Express middleware in `middleware/flags.ts` is used by `routes/tenant/suppliers.ts` (line 48) to gate all supplier endpoints with `FF_SUPPLIER_CATALOG_IMPORT` at tenant scope. This is the only route currently using `requireFlag()`, but it demonstrates the correct pattern for centralized flag gating.

**Troubleshooting `platform_disabled` errors:**
When `requireFlag()` returns a 400 with `{ error: 'platform_disabled' }`, it means:
- The flag is OFF at the platform level (`platform_feature_flags_list.enabled = false`)
- AND `allow_tenant_override = false` (or the flag row doesn't exist in the DB at all)
- The tenant is therefore blocked — no tenant-level override can rescue it

**Fix (SQL):**
```sql
INSERT INTO platform_feature_flags_list (id, flag, enabled, allow_tenant_override, created_at, updated_at)
VALUES (gen_random_uuid(), 'FF_SUPPLIER_CATALOG_IMPORT', true, true, now(), now())
ON CONFLICT (flag) DO UPDATE SET enabled = true, allow_tenant_override = true, updated_at = now();
```

**Fix (API):**
```
PUT /api/admin/platform-flags/FF_SUPPLIER_CATALOG_IMPORT
{ "enabled": true, "allowTenantOverride": true }
```

**Fix (Env var):** Set `FF_FF_SUPPLIER_CATALOG_IMPORT=true` on **Railway** (note: the code prepends `FF_` to the flag name, which already starts with `FF_`, resulting in a double prefix). Do NOT set this on Vercel — the API process is the only consumer of this env var.

The API `PUT` endpoint calls `invalidateEffectiveFlagCaches()` so changes take effect immediately. The SQL approach requires either an API restart or calling `invalidateEffectiveFlagCaches()` via the admin API to clear the 30s in-memory cache.

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

## Capability System (Separate from Feature Flags)

The platform also has a **capability system** (`EffectiveCapabilityResolver.ts`) that gates features by tier + merchant settings. This is distinct from feature flags:

- **Feature flags** = platform-wide on/off switches (kill switches, gradual rollouts)
- **Capabilities** = per-tenant feature gating by subscription tier + merchant preferences

Capability domains: `commerce`, `payment_gateway`, `storefront`, `fulfillment`, `barcode_scan`, `product_types`, `product_options`, `featured`, `integrations`, `quickstart`, `storefront_options`, `directory_entry`, `faq`, `crm`, `chatbot`, `org_options`, `social_commerce_options`.

The deprecated scan flags (`SKU_SCANNING`, etc.) were superseded by the `barcode_scan_options` capability. This pattern may repeat for other flags.

## Recommendations

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

**Problem:** The `requireFlag()` middleware in `middleware/flags.ts` is defined but unused. The supplier routes implement a custom `requireSupplierCatalogFeature` function instead. Flag gating is ad-hoc.

**Status:** Partially done. `routes/tenant/suppliers.ts` already uses `requireFlag({ flag: 'FF_SUPPLIER_CATALOG_IMPORT', scope: 'tenant', tenantParam: 'tenantId' })`. Other flag-gated routes should follow the same pattern.

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
