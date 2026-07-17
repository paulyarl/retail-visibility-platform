---
description: Canonical pattern for cleanly decoupling a capability domain from its parent domain — dedicated merchant gate table, dedicated types, resolver/route refactor, source domain cleanup, and grep-verification of zero residual coupling
---

# Capability Domain Decouple — Clean Separation Pattern

This skill defines the canonical pattern for decoupling a capability domain from its parent domain at the **merchant gate layer**. Use it when a capability type has already been split at the feature key level but still shares a merchant settings table, types, ID generator, or resolver logic with its parent domain.

## When to Use This Skill

- A capability type has its own feature keys but **shares a merchant settings table** with another domain (e.g., via a `page_type` discriminator)
- A capability type reuses another domain's **merchant settings TypeScript interface** instead of having its own
- A capability type reuses another domain's **ID generator** function
- A resolver reads merchant preferences from another domain's fields
- A route queries another domain's table with a discriminator filter
- You need to **retrofit a clean decouple** after a previous split left residual coupling
- **Feature-key-level split variant**: A capability has its own feature keys (`storefront_maps_*`) but its merchant prefs are still columns on the parent's settings table (e.g., `interactive_maps`, `map_display`, `location_display` in `tenant_storefront_options_settings`). No `page_type` discriminator — the fields are just mixed into the parent table. The decouple pattern is the same: create a dedicated table, move the fields, clean up the parent. The Storefront Maps decouple (Phase 5) is a reference for this variant.

## Reference Implementations

1. **Directory Entry Decouple Sprint** (`docs/DIRECTORY_ENTRY_DECOUPLE_SPRINT_PLAN.md`) — Decouples Directory Entry from Storefront Options at the merchant gate layer (page_type discriminator variant).

2. **Storefront Maps Decouple (Phase 5)** — Decouples Maps from Storefront Options at the feature-key level (no page_type discriminator). Maps fields (`interactive_maps`, `map_display`, `location_display`) were directly in `StorefrontOptionsMerchantSettings` and `tenant_storefront_options_settings`. New table: `tenant_storefront_maps_settings`, new resolver: `StorefrontMapsResolver.ts`, new route: `storefront-maps-settings.ts`. Frontend: new `StorefrontMapsSettingsClient.tsx` page, `useStorefrontMapsCapability` hook, `StorefrontMapsState` in `CapabilityResolutionService.ts` + `UnifiedCapabilityService.ts`.

## The 10 Clean Decouple Principles

These principles MUST be followed to achieve a clean separation. Violations of any principle create residual coupling that will require a future retrofit.

### 1. Dedicated Table

The decoupled domain gets its own `tenant_<domain>_settings` table with ONLY the columns it needs.

- **No `page_type` discriminator** — the table has a `UNIQUE` constraint on `tenant_id`, one row per tenant
- **No inherited parent domain columns** — only include fields the domain actually uses
- **Standard table infrastructure**: RLS policies, `updated_at` trigger, index on `tenant_id`, FK to `tenants(id)` with `ON DELETE CASCADE`
- **ID format**: `<prefix>-{tk}-{nanoid}` (e.g., `des-{tk}-{nanoid}` for directory entry settings)

### 2. Dedicated Type

Create a dedicated `<Domain>MerchantSettings` TypeScript interface in `types.ts`.

- **No reuse of parent domain's interface** — the new interface has only domain-relevant fields
- **Update `MerchantSettingsBundle`** — change the domain's entry from `ParentDomainMerchantSettings | null` to `<Domain>MerchantSettings | null`
- **Remove leaked fields from parent** — any fields that were bolted onto the parent interface for the child domain MUST be removed from the parent interface in the **same sprint**

### 3. Dedicated ID Generator

Create a `generate<Domain>SettingsId(tenantId)` function in `id-generator.ts`.

- **No reuse of parent domain's ID generator** — the new function uses its own prefix
- **Follow existing pattern**: `customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8)` for the nanoid portion

### 4. Remove Leaked Fields from Source Domain

Fields that belong to the decoupled domain but were placed in the parent domain's interface, route schema, or defaults MUST be removed in the **same sprint**.

- Remove from parent's `MerchantSettings` interface in `types.ts`
- Remove from parent's `DEFAULT_SETTINGS` in the parent's route file
- Remove from parent's Zod validation schema
- Verify parent's resolver does not reference these fields

> **Critical lesson from previous splits**: The QR/Gallery/Hours splits deferred this cleanup to a "final phase" that was never fully executed. `directory_entry_layout` and `external_link_enabled` remained in `StorefrontOptionsMerchantSettings` for months after the split. **Do not defer cleanup.**

### 5. Resolver Reads Only Its Own Merchant Prefs

The decoupled domain's resolver MUST accept its own `<Domain>MerchantSettings | null` type, not `Record<string, any>` or the parent domain's type.

- **Read from dedicated field names**: `merchantPrefs?.<domain>_opt_enabled`, NOT `merchantPrefs?.<parent>_opt_enabled`
- **No reads of parent domain fields**: Do not read `image_gallery_*`, `qr_*`, or other parent domain fields from merchant prefs
- **Section flags use tier features + own merchant prefs**: Gallery/QR/etc. availability is tier-gated only; merchant prefs for those sections come from their own dedicated resolvers, not this domain's merchant prefs
- **Fallback**: If new merchant prefs are null, fall back to old table row (backward compatibility during transition)

### 6. Route Queries Only Its Own Table

The decoupled domain's route MUST query `tenant_<domain>_settings`, never the parent domain's table.

- **GET handler**: `prisma.tenant_<domain>_settings.findUnique({ where: { tenant_id: tenantId } })` with fallback to old table
- **PUT handler**: `prisma.tenant_<domain>_settings.upsert()` — write to new table only
- **Zod schema**: Only include domain-relevant fields — no parent domain fields
- **DEFAULT settings**: Only include domain-relevant fields
- **ID generator**: Use `generate<Domain>SettingsId`, not the parent's generator

### 7. EffectiveCapabilityResolver Queries Only Its Own Table

`fetchMerchantSettings()` in `EffectiveCapabilityResolver.ts` MUST query the new dedicated table for the domain's merchant settings bundle entry.

- Change from `prisma.tenant_<parent>_settings.findUnique({ where: { tenant_id_page_type: { tenant_id, page_type: '<domain>' } } })` to `prisma.tenant_<domain>_settings.findUnique({ where: { tenant_id: tenantId } })`
- Update **both** primary and MV-based pipelines
- Cast result to `<Domain>MerchantSettings`

### 8. Grep-Verify Zero Residual Coupling

At the end of the sprint, run grep checks to confirm no residual coupling remains. See the **Grep-Verification Checklist** section below.

### 9. Additive Migration, Immediate Cutover

- **Data is copied** (not moved) from old table to new table — old rows preserved for rollback
- **Code is cut over immediately** — all reads/writes go to the new table (with fallback to old table for safety)
- **Old rows are NOT deleted** — they remain as orphaned data for rollback safety; can be cleaned up in a future migration

### 10. Single-Sprint Completion

Database, backend, frontend, source domain cleanup, and verification all happen in **one sprint cycle**. No multi-phase deferral. This is the key difference from the previous split approach.

## Migration Template

```sql
-- Migration: <number>_<domain>_merchant_gate_split.sql

-- Step 1: Create dedicated table
CREATE TABLE IF NOT EXISTS tenant_<domain>_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,
  <domain>_opt_enabled BOOLEAN DEFAULT true,
  -- ... domain-specific columns ...
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_<domain>_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Step 2: RLS
ALTER TABLE tenant_<domain>_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_<domain>_settings_isolation ON tenant_<domain>_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Step 3: Updated_at trigger
CREATE TRIGGER set_updated_at_tenant_<domain>_settings
  BEFORE UPDATE ON tenant_<domain>_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 4: Index
CREATE INDEX IF NOT EXISTS idx_tenant_<domain>_settings_tenant_id
  ON tenant_<domain>_settings(tenant_id);

-- Step 5: Migrate existing data from parent table
INSERT INTO tenant_<domain>_settings (tenant_id, <domain>_opt_enabled, ...)
SELECT tenant_id,
  storefront_opt_enabled,  -- map from parent field
  -- ... map other fields ...
  NOW(), NOW()
FROM tenant_<parent>_settings
WHERE page_type = '<domain>'
ON CONFLICT (tenant_id) DO NOTHING;

-- Step 6: Verification queries (commented out)
-- SELECT count(*) FROM tenant_<domain>_settings;
-- SELECT count(*) FROM tenant_<parent>_settings WHERE page_type = '<domain>';
```

## Type Separation Template

```typescript
// In types.ts

// NEW: Dedicated merchant settings for the decoupled domain
export interface <Domain>MerchantSettings {
  <domain>_opt_enabled?: boolean | null;
  // ... domain-specific fields only ...
}

// UPDATE: MerchantSettingsBundle — change from parent type to dedicated type
export interface MerchantSettingsBundle {
  // ... other domains ...
  <domain>: <Domain>MerchantSettings | null;  // was: ParentDomainMerchantSettings | null
}

// CLEAN: Remove leaked fields from parent's interface
export interface ParentDomainMerchantSettings {
  // ... parent-only fields ...
  // REMOVED: <domain>_layout — moved to <Domain>MerchantSettings
  // REMOVED: <domain>_external_link_enabled — moved to <Domain>MerchantSettings
}
```

## Resolver Refactor Template

```typescript
// In <Domain>Resolver.ts

// BEFORE: merchantPrefs typed as Record<string, any> or ParentDomainMerchantSettings
export function resolve<Domain>(
  features: Record<string, boolean>,
  merchantPrefs: Record<string, any> | null  // COUPLED
): Effective<Domain> { ... }

// AFTER: merchantPrefs typed as dedicated <Domain>MerchantSettings
export function resolve<Domain>(
  features: Record<string, boolean>,
  merchantPrefs: <Domain>MerchantSettings | null  // DECOUPLED
): Effective<Domain> {
  // Read from dedicated fields
  const prefs = {
    <domain>_opt_enabled: merchantPrefs?.<domain>_opt_enabled !== false,  // NOT parent's field
    // ...
  };

  // NO reads of parent domain fields from merchant prefs
  // Section flags use tier features + own merchant prefs only
  return { ... };
}
```

## Route Refactor Template

```typescript
// In <domain>-options-settings.ts

// BEFORE: queries parent table with discriminator
const settings = await prisma.tenant_<parent>_settings.findUnique({
  where: { tenant_id_page_type: { tenant_id, page_type: '<domain>' } }
});

// AFTER: queries dedicated table with fallback
let settings = await prisma.tenant_<domain>_settings.findUnique({
  where: { tenant_id: tenantId }
});

// Fallback to old table for backward compatibility
if (!settings) {
  const oldSettings = await prisma.tenant_<parent>_settings.findUnique({
    where: { tenant_id_page_type: { tenant_id, page_type: '<domain>' } }
  });
  if (oldSettings) {
    settings = mapOldToNew(oldSettings);
  }
}

// PUT: write to new table only
await prisma.tenant_<domain>_settings.upsert({
  where: { tenant_id: tenantId },
  create: { id: generate<Domain>SettingsId(tenantId), tenant_id: tenantId, ...parsed },
  update: { ...parsed },
});
```

## Grep-Verification Checklist

After completing all implementation, run these grep checks. Every check MUST return zero results (or results only in the new domain's files, not the parent's).

```bash
# 1. Decoupled resolver must not read parent domain fields
grep -rn "<parent>_opt_enabled" apps/api/src/services/resolvers/<Domain>Resolver.ts
# Expected: zero results

# 2. Decoupled resolver must not read parent domain section fields
grep -rn "<parent_section_field>" apps/api/src/services/resolvers/<Domain>Resolver.ts
# Expected: zero results

# 3. Parent's merchant settings type must not carry decoupled domain fields
grep -rn "<domain>_layout\|<domain>_external_link" apps/api/src/services/resolvers/types.ts
# Expected: only in <Domain>MerchantSettings, NOT in ParentDomainMerchantSettings

# 4. Parent's route must not reference decoupled domain
grep -rn "<domain>" apps/api/src/routes/<parent>-options-settings.ts
# Expected: zero results

# 5. No more page_type discriminator queries for decoupled domain
grep -rn "page_type.*<domain>" apps/api/src/
# Expected: zero results

# 6. Decoupled route must not use parent's ID generator
grep -rn "generate<Parent>SettingsId" apps/api/src/routes/<domain>-options-settings.ts
# Expected: zero results

# 7. Frontend decoupled components must not reference parent domain fields
grep -rn "<parent>_opt_enabled" apps/web/src/components/<domain>/
# Expected: zero results

# 8. Frontend decoupled components must not reference parent-only section fields
grep -rn "<parent_only_field>" apps/web/src/components/<domain>/
# Expected: zero results
```

## Common Pitfalls (from Previous Splits)

1. **Deferred cleanup** — Moving source domain cleanup to a "final phase" that never gets executed. **Fix**: Do cleanup in the same sprint as the decouple.

2. **Shared merchant settings type** — Reusing the parent's `MerchantSettings` interface for the child domain. **Fix**: Create a dedicated interface with only domain-relevant fields.

3. **Page_type discriminator retained** — Keeping the `page_type` column query pattern "just in case". **Fix**: Query the dedicated table directly; use fallback only for transition safety.

4. **Resolver reads parent fields** — Reading `storefront_opt_enabled` or `image_gallery_*` from merchant prefs because the shared table had those columns. **Fix**: The resolver should only read fields from its own `<Domain>MerchantSettings` type.

5. **Route returns parent fields** — Returning all columns from the shared table in the API response, including parent-only fields. **Fix**: Zod schema and response should only include domain-relevant fields.

6. **No grep verification** — Assuming the decouple is complete without verifying. **Fix**: Run the grep-verification checklist and confirm zero residual coupling.

## Frontend Decouple (Sprint 2)

The frontend decouple follows the backend sprint and ensures the UI layer consumes the new dedicated types and APIs. The key principle: **frontend components for the decoupled domain must not reference parent domain fields**.

### Frontend Type Separation

1. **`UnifiedCapabilityService.ts`** — Type `BackendEffective<Domain>.merchant_preferences` with a dedicated interface instead of `Record<string, any>`. In `map<Domain>()`, explicitly map fields from the backend interface to the frontend state interface, casting enum-like fields (e.g., layout keys) to the frontend union type.

2. **`TenantDirectoryManagementService.ts`** (or equivalent singleton) — Add a `<Domain>Settings` interface with only domain-relevant fields. Type the `get<Domain>Options` and `update<Domain>Options` methods with this interface instead of `any`.

3. **`CapabilityResolutionService.ts`** — The `<Domain>OptionsState.merchantPreferences` interface should use `<domain>_opt_enabled` (not `<parent>_opt_enabled`). No frontend fallback resolver function is needed if the domain doesn't have one — just ensure the state interface is clean.

### Frontend Component Cleanup

4. **Settings panel** (`<Domain>SettingsPanel.tsx`) — Remove all parent-domain-only toggle sections and their helper functions:
   - Remove `is<ParentSection>On` / `set<ParentSection>` helpers that read/write parent domain fields
   - Remove parent domain fields from the save payload in `handleSaveSections`
   - Remove parent domain toggle UI sections (checkboxes, labels, descriptions)
   - Add any new domain-specific toggles that have dedicated table columns but no UI yet (e.g., `location_display`, `interactive_maps`)

### Frontend Grep-Verification

```bash
# Frontend: Decoupled components must not reference parent domain fields
grep -rn "<parent>_opt_enabled" apps/web/src/components/<domain>/
# Expected: zero results

# Frontend: Decoupled components must not reference parent-only section fields
grep -rn "<parent_only_field>" apps/web/src/components/<domain>/
# Expected: zero results

# Frontend: TS check
pnpm checkweb
# Expected: zero TS errors
```

### Common Frontend Pitfalls

1. **`as any` casts in mapper functions** — Using `merchantPreferences: b.merchant_preferences as any` instead of explicit field mapping. **Fix**: Map each field explicitly with proper type casts for enum-like fields.

2. **Untyped service methods** — Using `Promise<any>` for get/update methods. **Fix**: Define a `<Domain>Settings` interface and type all service methods.

3. **Retaining parent domain toggles in UI** — Keeping Gallery/QR/etc. toggles in the decoupled domain's settings panel because "they were already there". **Fix**: Remove them — those sections belong to their own dedicated resolvers and settings panels.

4. **Missing new domain toggles** — The new dedicated table may have columns that had no UI toggle before (because they were lost in the shared table). **Fix**: Add toggles for any new domain-specific fields like `location_display`, `interactive_maps`.

## Related Skills

- `capability-deployment-flow.md` — End-to-end orchestration for adding new capabilities
- `capability-data-flow-rules.md` — Canonical data flow rules from resolver to dashboard
- `add-capability-feature.md` — Adding feature keys to an existing capability type
- `add-bsaas-feature.md` — Adding BSaaS catalog entries for features
