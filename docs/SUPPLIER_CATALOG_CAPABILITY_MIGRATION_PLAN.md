# Supplier Catalog → Product Options Capability Migration Plan

## Problem

Supplier catalog import in the Item Creation Wizard is gated by `FF_SUPPLIER_CATALOG_IMPORT` — a Layer 3 database hybrid feature flag. This is a per-tenant feature gating concern (which tenants can use supplier catalog import based on their tier), not a platform-wide kill switch. The `product_options` capability type is the correct home for this gate.

The feature flag catalog (`feature-flag-catalog.md`) already documents this pattern: deprecated scan flags were superseded by the `barcode_scan_options` capability. Supplier catalog should follow the same migration path.

## Current State

### Feature Flag Control Points

1. **Backend route gate** — `apps/api/src/routes/tenant/suppliers.ts:46-51` uses `requireFlag({ flag: 'FF_SUPPLIER_CATALOG_IMPORT', scope: 'tenant', tenantParam: 'tenantId' })` as router-level middleware on all `/suppliers` routes
2. **Frontend wizard gate** — `apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx:368-369` uses `useFeatureFlag('FF_SUPPLIER_CATALOG_IMPORT')` to conditionally show `CatalogSearchStep` (Step 0)
3. **Frontend flag config** — `apps/web/src/lib/featureFlags/index.ts` has a `pilot` strategy entry
4. **DB seed** — `platform_feature_flags_list` row with `enabled=true`, `allow_tenant_override=true`
5. **Admin UI** — `AdminPlatformFlags.tsx` has display metadata

### Product Options Capability Architecture

- **Capability type key**: `product_options`
- **Merchant gate table**: `tenant_product_options_settings` (Prisma model `tenant_product_options_settings`)
- **Backend resolver**: `apps/api/src/services/resolvers/ProductOptionsResolver.ts`
- **Resolver types**: `EffectiveProductOptions` in `apps/api/src/services/resolvers/types.ts`
- **Settings route**: `apps/api/src/routes/product-options-settings.ts` (GET + PUT `/:tenantId/product-options`)
- **Frontend state type**: `ProductOptionsState` in `apps/web/src/services/CapabilityResolutionService.ts`
- **Frontend mapper**: `mapProductOptions()` in `apps/web/src/services/UnifiedCapabilityService.ts`
- **Frontend hook**: `useProductOptionsCapability()` in `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts`
- **Feature key naming**: `product_opt_*` prefix for individual features, `product_options_*` for group/meta keys

### Feature Key Naming Decision

New feature key: **`product_opt_supplier_catalog`**

This follows the existing `product_opt_*` naming convention for individual product option features (matches `product_opt_recently_viewed`, `product_opt_qr_codes`, etc.). It belongs to the **creation group** since supplier catalog import is part of the product creation workflow (Step 0 of the wizard).

## Migration Strategy: Dual-Gate → Capability-Only

The migration uses a phased approach to avoid breaking any tenant currently relying on the feature flag:

1. Add the capability gate alongside the existing feature flag (dual-gate)
2. Let the capability gate take precedence
3. Remove the feature flag gate

---

## Phase 1: Database — Add Feature Key, Tier Linkage, Merchant Gate Column

**Goal**: Insert the new `product_opt_supplier_catalog` feature into the capability system tables and add the merchant gate column.

### Tasks

1. **Migration SQL** — Create `database/migrations/0XX_supplier_catalog_capability.sql`:
   - Insert `features_list` row: key=`product_opt_supplier_catalog`, name=`Supplier Catalog Import`, description=`Search and import from supplier catalogs during product creation`, category=NULL, is_active=true
   - Insert `capability_features_list` row linking to `capability_type_list` where key=`product_options`
   - Insert `tier_features_list` rows for all tiers with `is_enabled=true` (matching current DB flag state where `enabled=true` + `allow_tenant_override=true` means all tenants can use it)
   - `ALTER TABLE tenant_product_options_settings ADD COLUMN IF NOT EXISTS product_opt_supplier_catalog Boolean DEFAULT true`
   - RLS policy for the new column (covered by existing table-level RLS)

2. **Prisma schema** — Add `product_opt_supplier_catalog Boolean? @default(true)` to `tenant_product_options_settings` model in `apps/api/prisma/schema.prisma`

3. **Run `prisma db pull && prisma generate`** to sync the Prisma client

### Verification
```sql
SELECT key, name, is_active FROM features_list WHERE key = 'product_opt_supplier_catalog';
SELECT ctl.key, fl.key FROM capability_features_list cfl JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id JOIN features_list fl ON fl.id = cfl.feature_id WHERE fl.key = 'product_opt_supplier_catalog';
SELECT column_name FROM information_schema.columns WHERE table_name = 'tenant_product_options_settings' AND column_name = 'product_opt_supplier_catalog';
```

---

## Phase 2: Backend Resolver — Wire Feature into ProductOptionsResolver

**Goal**: The resolver outputs a `shows_supplier_catalog` boolean that the frontend and routes can check.

### Tasks

1. **`apps/api/src/services/resolvers/types.ts`** — Add to `EffectiveProductOptions`:
   - `shows_supplier_catalog: boolean` (tier-allowed)
   - `effective_shows_supplier_catalog: boolean` (tier-allowed AND merchant-enabled)

2. **`apps/api/src/services/resolvers/ProductOptionsResolver.ts`**:
   - Add `showsSupplierCatalog` computation in the **creation group** section:
     ```ts
     const showsSupplierCatalog = isFlexible || creationGroupEnabled || !!features.product_opt_supplier_catalog;
     ```
   - Add merchant preference:
     ```ts
     product_opt_supplier_catalog: merchantPrefs?.product_opt_supplier_catalog !== false,
     ```
   - Add effective flag:
     ```ts
     effective_shows_supplier_catalog: showsSupplierCatalog && prefs.product_opt_supplier_catalog,
     ```
   - Add to return object: `shows_supplier_catalog`, `effective_shows_supplier_catalog`
   - Add `features.product_opt_supplier_catalog` to `hasAnyOptionsFeature()` helper
   - Remember `flexible ||` prefix (R23) — covered by `isFlexible` in the creation group pattern

3. **`apps/api/src/routes/product-options-settings.ts`**:
   - Add `product_opt_supplier_catalog: z.boolean().optional()` to Zod schema
   - Add to `DEFAULT_SETTINGS`: `product_opt_supplier_catalog: true`
   - Add to `CREATION_FEATURE_KEYS`: `product_opt_supplier_catalog: 'showsSupplierCatalog'`
   - Add to GET response settings
   - Add to PUT response settings
   - Add to hard-gate all-false response

4. **`apps/api/src/services/EffectiveCapabilityResolver.ts`** — No changes needed (already fetches `tenant_product_options_settings` and passes to resolver)

### Verification
```bash
curl -s "http://localhost:3001/api/tenants/<tenantId>/effective-capabilities" | jq '.data.effective.product_options.shows_supplier_catalog'
curl -s "http://localhost:3001/api/tenants/<tenantId>/effective-capabilities" | jq '.data.effective.product_options.effective_shows_supplier_catalog'
pnpm checkapi
```

---

## Phase 3: Frontend — Wire Capability into Wizard + State Types

**Goal**: The wizard checks the capability gate instead of the feature flag. The capability appears in settings UI, PlanSummaryPanel, and CapabilityShowcase.

### Tasks

1. **`apps/web/src/services/CapabilityResolutionService.ts`** — Add to `ProductOptionsState`:
   - `showsSupplierCatalog: boolean`
   - `effectiveShowsSupplierCatalog: boolean`

2. **`apps/web/src/services/UnifiedCapabilityService.ts`**:
   - Add `shows_supplier_catalog: boolean` and `effective_shows_supplier_catalog: boolean` to `BackendEffectiveProductOptions`
   - Add to `mapProductOptions()`: `showsSupplierCatalog: b.shows_supplier_catalog`, `effectiveShowsSupplierCatalog: b.effective_shows_supplier_catalog`

3. **`apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx`**:
   - Replace `useFeatureFlag('FF_SUPPLIER_CATALOG_IMPORT')` with `useProductOptionsCapability(tenantId)`
   - Change gate: `const catalogEnabled = !isEditing && (capabilityData?.effectiveShowsSupplierCatalog ?? false)`
   - Remove `useFeatureFlag` import if no longer used in this file

4. **`apps/web/src/components/inventory/wizards/steps/CatalogSearchStep.tsx`**:
   - Update header comment from "Only visible when FF_SUPPLIER_CATALOG_IMPORT is enabled" to "Only visible when product_options capability includes supplier_catalog"

5. **`apps/web/src/components/dashboard/CapabilityShowcase.tsx`** — Add supplier catalog to the product options row detail string

6. **`apps/web/src/components/settings/PlanSummaryPanel.tsx`** — Add supplier catalog to the product options summary block

7. **Merchant settings UI** — Add a toggle for "Supplier Catalog Import" on the product options settings page (if one exists, or add to the creation group section)

### Verification
```bash
pnpm checkweb
```

---

## Phase 4: Backend Route — Dual-Gate Period

**Goal**: Supplier routes check BOTH the feature flag AND the capability gate. The capability gate is the primary control; the feature flag becomes a secondary kill-switch.

### Tasks

1. **`apps/api/src/routes/tenant/suppliers.ts`**:
   - Keep the existing `requireFlag()` middleware as the outer gate (platform kill-switch)
   - Add a capability check inside each route handler (or as additional middleware):
     ```ts
     // After authenticateToken + checkTenantAccess + requireFlag
     // Check product_options.shows_supplier_catalog capability
     const { EffectiveCapabilityResolver } = await import('../services/EffectiveCapabilityResolver');
     const caps = await EffectiveCapabilityResolver.resolve(tenantId);
     if (!caps.product_options.shows_supplier_catalog) {
       return res.status(403).json({ error: 'capability_disabled', message: 'Supplier catalog import is not available on your current plan' });
     }
     ```
   - Alternatively, create a `requireSupplierCatalogCapability` middleware for cleaner code
   - The feature flag still gates first (platform-wide kill switch), then the capability gate checks tier/merchant eligibility

2. **Audit log metadata** — Update audit log `metadata.flag` field to also include `capability: 'product_opt_supplier_catalog'` for traceability

### Verification
- With feature flag ON + capability ON: routes work (200)
- With feature flag ON + capability OFF: routes blocked (403 capability_disabled)
- With feature flag OFF: routes blocked (400 platform_disabled) — unchanged behavior
```bash
pnpm checkapi
```

---

## Phase 5: Deprecate the Feature Flag

**Goal**: Remove the feature flag gate entirely. The capability system is the sole gate.

### Prerequisites
- Phase 4 has been in production for a verification period (recommended: 1-2 weeks)
- No tenants are relying on the feature flag's `allow_tenant_override` behavior in a way that the capability system doesn't cover
- All tiers have `product_opt_supplier_catalog` enabled in `tier_features_list` (matching the previous flag state)

### Tasks

1. **`apps/api/src/routes/tenant/suppliers.ts`**:
   - Remove `requireFlag({ flag: 'FF_SUPPLIER_CATALOG_IMPORT', ... })` from the router middleware
   - Keep the capability check from Phase 4 as the sole gate
   - Remove `requireFlag` import if no longer used

2. **`apps/web/src/components/inventory/wizards/ItemCreationWizard.tsx`**:
   - Remove any remaining `useFeatureFlag` reference (should already be gone from Phase 3, but verify)

3. **`apps/web/src/lib/featureFlags/index.ts`**:
   - Remove `FF_SUPPLIER_CATALOG_IMPORT` from the hardcoded `FEATURE_FLAGS` config

4. **`apps/web/src/components/admin/AdminPlatformFlags.tsx`**:
   - Remove `FF_SUPPLIER_CATALOG_IMPORT` from `FLAG_DESCRIPTIONS`

5. **`apps/api/src/scripts/seed-platform-flags.ts`**:
   - Remove `FF_SUPPLIER_CATALOG_IMPORT` from the seed script

6. **Database cleanup** (optional, can be deferred):
   - Delete the `platform_feature_flags_list` row for `FF_SUPPLIER_CATALOG_IMPORT`
   - Delete all `tenant_feature_flags_list` rows for this flag
   - Or simply set `enabled=false` and document it as deprecated

7. **`apps/devin/skills/feature-flag-catalog.md`**:
   - Move `FF_SUPPLIER_CATALOG_IMPORT` from Group D to a "Deprecated" section
   - Note: "Superseded by `product_opt_supplier_catalog` capability (product_options capability type)"

8. **Update `add-capability-feature.md`** skill doc if any new patterns emerged during this migration

### Verification
```bash
pnpm checkapi && pnpm checkweb
# Verify routes still work with capability enabled
curl -s "http://localhost:3001/api/tenants/<tenantId>/suppliers" -H "Authorization: Bearer <token>"
# Verify routes blocked when capability disabled
# (disable via tier_features_list or merchant gate, then test)
```

---

## Summary

| Phase | Goal | Risk | Reversible? |
|-------|------|------|-------------|
| 1 | DB: feature key + merchant column | Low — additive only | Yes (drop column) |
| 2 | Backend resolver outputs new field | Low — additive | Yes (revert resolver) |
| 3 | Frontend uses capability instead of flag | Medium — UI behavior change | Yes (revert to useFeatureFlag) |
| 4 | Dual-gate: flag + capability | Low — flag still primary | Yes (remove capability check) |
| 5 | Remove feature flag | Medium — no fallback if capability misconfigured | Yes (re-add flag) |

**Key principle**: The feature flag (`FF_SUPPLIER_CATALOG_IMPORT`) remains functional through Phase 4. It's only removed in Phase 5 after the capability gate is proven to work correctly in production.
