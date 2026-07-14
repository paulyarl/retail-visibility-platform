# Directory Entry Decouple Sprint Plan

> **Reference skill**: `.devin/skills/capability-domain-decouple.md` — the canonical pattern for decoupling a capability domain from its parent. This sprint serves as the **reference implementation** for that skill.

## 1. Problem Statement

Directory Entry and Storefront Options are two equal-level capability type domains. The capability type split was performed at the **feature key** level — `directory_entry_*` keys were moved to their own `directory_entry` capability type. However, the **merchant gate** layer was never decoupled.

### Coupling Evidence

Directory Entry has **no own merchant gate table**. It piggybacks on `tenant_storefront_options_settings` via a `page_type = 'directory_entry'` discriminator row. This creates the following couplings:

1. **Shared database table** — `tenant_storefront_options_settings` stores both storefront (page_type='storefront') and directory entry (page_type='directory_entry') merchant preferences. Directory entry inherits all storefront options columns (qr_codes_*, image_gallery_*, enhanced_seo, storefront_actions, etc.) — many irrelevant to directory entry.

2. **Shared merchant settings type** — `types.ts` line 53: `directoryEntry: StorefrontOptionsMerchantSettings | null` — Directory Entry reuses the `StorefrontOptionsMerchantSettings` interface instead of having its own. The interface has `directory_entry_layout` and `external_link_enabled` bolted on (lines 228-229).

3. **Shared ID generator** — `directory-entry-options-settings.ts` imports `generateStorefrontOptionsSettingsId` from id-generator.ts.

4. **Resolver reads storefront options merchant prefs** — `DirectoryEntryOptionsResolver.ts` reads `merchantPrefs?.storefront_opt_enabled`, `merchantPrefs.image_gallery_*`, `merchantPrefs.qr_*`, `merchantPrefs.hours_display`, `merchantPrefs.map_display`, `merchantPrefs.storefront_contact`, `merchantPrefs.storefront_social_media`, `merchantPrefs.enhanced_seo` — all storefront options columns.

5. **Route queries shared table** — `directory-entry-options-settings.ts` queries `prisma.tenant_storefront_options_settings` with `page_type: 'directory_entry'`, maps `settings.storefront_opt_enabled` to `directory_entry_opt_enabled`, returns storefront options columns.

6. **EffectiveCapabilityResolver double-queries same table** — `fetchMerchantSettings()` makes two separate queries to `tenant_storefront_options_settings` (one for page_type='storefront', one for page_type='directory_entry').

7. **Zod schema & defaults contain storefront options fields** — The directory entry options Zod schema and DEFAULT_DIRECTORY_ENTRY_SETTINGS include `qr_codes_512`, `image_gallery_5`, `enhanced_seo`, `storefront_actions`, `storefront_social_media`, `storefront_contact`, etc.

8. **Frontend service hits shared API** — `TenantDirectoryManagementService.ts` calls `/api/tenants/${tenantId}/directory-entry-options` which reads/writes the shared table.

### What Directory Entry Actually Needs

Directory entry merchant preferences should be:
- `directory_entry_opt_enabled` — master toggle (currently mapped from `storefront_opt_enabled`)
- `directory_entry_layout` — layout choice (classic/editorial/immersive/premium)
- `hours_display` — show/hide hours section
- `map_display` — show/hide map section
- `location_display` — show/hide location section
- `storefront_social_media` — show/hide social links section
- `storefront_contact` — show/hide contact section
- `interactive_maps` — interactive map display
- `enhanced_seo` — SEO meta tags
- `external_link_enabled` — external link toggle
- `gallery_display_mode` — carousel/magazine (shared with storefront gallery, but merchant pref is per-surface)

Fields like `qr_codes_512/1024/2048`, `qr_product/qr_store/qr_logo/qr_directory`, `image_gallery_5/10/15`, `default_qr_resolution`, `default_gallery_limit`, `hours_animated`, `hours_status`, `category_store`, `category_product`, `recommend_store`, `recommend_products`, `recently_viewed`, `storefront_actions`, `storefront_layout` are **storefront options concerns** that leaked into the directory entry row because of the shared table schema.

## 2. Lessons from Previous Splits

The QR, Gallery, and Hours capability splits (migrations 104-107) were executed from the `STOREFRONT_OPTIONS_NAMESPACE_SPLIT_PLAN.md`. The feature key layer was split cleanly — each domain got its own `storefront_<domain>_*` keys and capability type. However, **residual coupling remains in the codebase**:

### Residual Coupling Found in Previous Splits

1. **`StorefrontOptionsMerchantSettings` still carries directory entry fields** — `types.ts` lines 228-229: `directory_entry_layout` and `external_link_enabled` remain in the storefront options interface. These were never cleaned up.

2. **`StorefrontOptionsResolver.ts` still resolves maps/location fields** — lines 91-92, 100, 137-138, 146: `map_display`, `location_display`, `interactive_maps` are still in the storefront options resolver and merchant prefs, even though maps was planned as a separate domain (Phase 5 in the split plan, never executed).

3. **`storefront-options-settings.ts` still has `directory_entry_layout`** — line 54: `DEFAULT_SETTINGS` includes `directory_entry_layout: 'classic'` in the storefront options route. This is a directory entry field that was never removed.

4. **`StorefrontOptionsMerchantSettings` still carries maps fields** — `map_display`, `location_display`, `interactive_maps` remain in the interface even though the split plan designated them for a `storefront_maps` domain.

5. **`StorefrontGalleryMerchantSettings` overlaps with `StorefrontOptionsMerchantSettings`** — `gallery_display_mode` appears in `StorefrontGalleryMerchantSettings` (line 177) but the field also exists in `tenant_storefront_options_settings` and is read by the directory entry route.

### Root Cause of Residual Coupling

The split plan (§5.3) specified a **per-domain cleanup step** at the end of each phase: remove migrated fields from `EffectiveStorefrontOptions`, `StorefrontOptionsMerchantSettings`, `StorefrontOptionsResolver.ts`, and the storefront options route. This cleanup was **only partially executed**. The QR, Gallery, and Hours resolver logic was extracted, but the old fields were not removed from the shared types and routes.

### Clean Decouple Principles (This Sprint)

This sprint avoids the same mistake by enforcing **complete decouple in a single sprint** — no deferred cleanup. The following principles guide the implementation:

1. **Dedicated table** — Directory Entry gets its own `tenant_directory_entry_settings` table with ONLY the columns it needs. No `page_type` discriminator. No inherited storefront options columns.

2. **Dedicated type** — `DirectoryEntryMerchantSettings` interface with ONLY directory-entry-relevant fields. No reuse of `StorefrontOptionsMerchantSettings`.

3. **Dedicated ID generator** — `generateDirectoryEntrySettingsId` with `des-` prefix. No reuse of `generateStorefrontOptionsSettingsId`.

4. **Remove leaked fields from source domain** — `directory_entry_layout` and `external_link_enabled` are removed from `StorefrontOptionsMerchantSettings` AND from `storefront-options-settings.ts` defaults/schema in the **same sprint**, not deferred.

5. **Resolver reads only its own merchant prefs** — `DirectoryEntryOptionsResolver` reads `directory_entry_opt_enabled`, NOT `storefront_opt_enabled`. No reads of `image_gallery_*`, `qr_*`, or other storefront options fields from merchant prefs.

6. **Route queries only its own table** — `directory-entry-options-settings.ts` queries `tenant_directory_entry_settings`, never `tenant_storefront_options_settings`.

7. **EffectiveCapabilityResolver queries only its own table** — `fetchMerchantSettings()` queries `tenant_directory_entry_settings` for the `directoryEntry` bundle entry, not `tenant_storefront_options_settings` with `page_type='directory_entry'`.

8. **Grep-verify zero residual coupling** — At the end of the sprint, grep the codebase to confirm no directory entry references remain in storefront options files, and no storefront options field references remain in directory entry files.

9. **Additive migration, immediate cutover** — Data is copied (not moved) from old table to new table. But code is cut over immediately (with fallback). Old rows preserved for rollback safety, but all reads/writes go to the new table.

10. **Single-sprint completion** — Database, backend, frontend, cleanup, and verification all happen in one sprint cycle. No multi-phase deferral.

## 3. Architecture Decision

**Create a dedicated `tenant_directory_entry_settings` table** with only the columns directory entry actually needs. Follow the same additive migration pattern used for the QR, Gallery, and Hours capability splits (migrations 104, 105, 107), but with **immediate cleanup** of leaked fields from the source domain.

### New Table: `tenant_directory_entry_settings`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | TEXT PK | gen_random_uuid() | `des-{tk}-{nanoid}` ID format |
| `tenant_id` | TEXT UNIQUE | — | One row per tenant |
| `directory_entry_opt_enabled` | BOOLEAN | true | Master toggle |
| `directory_entry_layout` | VARCHAR(20) | 'classic' | Layout choice |
| `hours_display` | BOOLEAN | true | Show hours section |
| `map_display` | BOOLEAN | true | Show map section |
| `location_display` | BOOLEAN | true | Show location section |
| `storefront_social_media` | BOOLEAN | true | Show social links |
| `storefront_contact` | BOOLEAN | true | Show contact info |
| `interactive_maps` | BOOLEAN | true | Interactive map |
| `enhanced_seo` | BOOLEAN | false | SEO meta tags |
| `external_link_enabled` | BOOLEAN | false | External link |
| `gallery_display_mode` | VARCHAR(20) | 'carousel' | Gallery mode |
| `created_at` | TIMESTAMP | NOW() | |
| `updated_at` | TIMESTAMP | NOW() | |

### New Merchant Settings Type: `DirectoryEntryMerchantSettings`

```typescript
export interface DirectoryEntryMerchantSettings {
  directory_entry_opt_enabled?: boolean | null;
  directory_entry_layout?: string | null;
  hours_display?: boolean | null;
  map_display?: boolean | null;
  location_display?: boolean | null;
  storefront_social_media?: boolean | null;
  storefront_contact?: boolean | null;
  interactive_maps?: boolean | null;
  enhanced_seo?: boolean | null;
  external_link_enabled?: boolean | null;
  gallery_display_mode?: string | null;
}
```

### Resolver Changes

`DirectoryEntryOptionsResolver.ts` will:
- Accept `DirectoryEntryMerchantSettings | null` instead of `Record<string, any> | null`
- Read from dedicated fields: `merchantPrefs?.directory_entry_opt_enabled`, `merchantPrefs?.hours_display`, etc.
- **Fallback**: If new merchant prefs are null, fall back to reading from old `tenant_storefront_options_settings` row with `page_type='directory_entry'` (backward compatibility during transition)

### Backward Compatibility

- Old `tenant_storefront_options_settings` rows with `page_type='directory_entry'` remain intact
- Resolver checks new table first, falls back to old table
- Old route endpoint `/api/tenants/:tenantId/directory-entry-options` continues to work
- Data is **copied** (not moved) during migration — old rows preserved
- `StorefrontOptionsMerchantSettings` loses `directory_entry_layout` and `external_link_enabled` fields (they move to `DirectoryEntryMerchantSettings`)

## 4. Feature Key Inventory

Directory Entry already has its own capability type (`directory_entry`) and feature keys. No new feature keys needed. Existing keys:

| # | Key | Tier | Notes |
|---|-----|------|-------|
| 1 | `directory_entry_enabled` | Gate | Master enable |
| 2 | `directory_entry_disabled` | Gate | Master disable |
| 3 | `directory_entry_flexible` | Flexible | Unlocks all |
| 4 | `directory_entry_layout_on` | Group | Layout group |
| 5 | `directory_entry_layout_classic` | Individual | Layout: classic |
| 6 | `directory_entry_layout_editorial` | Individual | Layout: editorial |
| 7 | `directory_entry_layout_immersive` | Individual | Layout: immersive |
| 8 | `directory_entry_layout_premium` | Individual | Layout: premium |
| 9 | `directory_entry_hours_on` | Group | Hours group |
| 10 | `directory_entry_map_on` | Group | Map group |
| 11 | `directory_entry_contact_on` | Group | Contact group |
| 12 | `directory_entry_gallery_on` | Group | Gallery group |
| 13 | `directory_entry_qr_on` | Group | QR group |
| 14 | `directory_entry_social_on` | Group | Social group |
| 15 | `directory_entry_seo_on` | Group | SEO group |
| 16 | `directory_entry_external_link` | Individual | External link |

No new feature keys or capability type changes needed — the split is purely at the merchant settings layer.

## 5. Sprint Breakdown

### Sprint 1: Database Migration + Backend Resolver Decouple + Source Domain Cleanup

**Goal**: Create dedicated table, migrate data, update resolver and route to use new table with fallback.

#### Tasks

1. **Migration `108_directory_entry_merchant_gate_split.sql`**:
   - Step 1: Create `tenant_directory_entry_settings` table (RLS, triggers, indexes)
   - Step 2: Migrate existing directory entry merchant prefs from `tenant_storefront_options_settings` (WHERE page_type='directory_entry') into new table
   - Step 3: Add `navigation_links` entry if needed (already exists for directory settings)
   - Idempotent (IF NOT EXISTS, ON CONFLICT DO NOTHING)

2. **Prisma schema**:
   - Add `tenant_directory_entry_settings` model
   - Add back-relation on `tenants` model
   - Run `prisma db pull` + `prisma generate`

3. **ID generator** (`id-generator.ts`):
   - Add `generateDirectoryEntrySettingsId(tenantId)` → `des-{tk}-{nanoid}`

4. **Types** (`resolvers/types.ts`):
   - Add `DirectoryEntryMerchantSettings` interface
   - Change `MerchantSettingsBundle.directoryEntry` from `StorefrontOptionsMerchantSettings | null` to `DirectoryEntryMerchantSettings | null`
   - Remove `directory_entry_layout` and `external_link_enabled` from `StorefrontOptionsMerchantSettings` (they belong to directory entry now)

5. **Resolver** (`DirectoryEntryOptionsResolver.ts`):
   - Change `merchantPrefs` param type from `Record<string, any> | null` to `DirectoryEntryMerchantSettings | null`
   - Update all merchant pref reads to use dedicated field names:
     - `merchantPrefs?.storefront_opt_enabled` → `merchantPrefs?.directory_entry_opt_enabled`
     - `merchantPrefs?.directory_entry_layout` stays the same
     - `merchantPrefs?.hours_display` stays the same
     - `merchantPrefs?.map_display` stays the same
     - `merchantPrefs?.storefront_contact` stays the same
     - `merchantPrefs?.storefront_social_media` stays the same
     - `merchantPrefs?.enhanced_seo` stays the same
     - `merchantPrefs?.external_link_enabled` stays the same
   - Remove reads of `merchantPrefs.image_gallery_*` and `merchantPrefs.qr_*` — these are storefront options/gallery/qr concerns, not directory entry merchant prefs. The resolver should only check tier features for gallery/qr availability, not merchant prefs from the shared table.
   - Update `prefs` object to use `directory_entry_opt_enabled` instead of `storefront_opt_enabled`

6. **Route** (`directory-entry-options-settings.ts`):
   - Update GET handler to query `prisma.tenant_directory_entry_settings.findUnique({ where: { tenant_id: tenantId } })` with fallback to old `tenant_storefront_options_settings` (page_type='directory_entry')
   - Update PUT handler to upsert into `prisma.tenant_directory_entry_settings` instead of `tenant_storefront_options_settings`
   - Update Zod schema to only include directory-entry-relevant fields (remove qr_codes_*, image_gallery_*, default_qr_resolution, default_gallery_limit, hours_animated, hours_status, category_*, recommend_*, recently_viewed, storefront_actions, storefront_layout)
   - Update DEFAULT_DIRECTORY_ENTRY_SETTINGS to only include directory-entry-relevant fields
   - Use `generateDirectoryEntrySettingsId` instead of `generateStorefrontOptionsSettingsId`
   - Return only directory-entry-relevant fields in response

7. **EffectiveCapabilityResolver** (`EffectiveCapabilityResolver.ts`):
   - Update `fetchMerchantSettings()`: change `directoryEntry` query from `tenant_storefront_options_settings` (page_type='directory_entry') to `tenant_directory_entry_settings.findUnique({ where: { tenant_id: tenantId } })`
   - Update both primary and MV-based pipelines
   - Cast result to `DirectoryEntryMerchantSettings`

8. **public-tenant-capabilities.ts**:
   - No changes needed — `directory_entry` block in `buildExpiredCapabilitiesResponse` already uses correct shape

9. **capability-constraints.ts**:
   - No changes needed — `directory_entry` constraint metadata already exists

10. **Unit tests** (`DirectoryEntryOptionsResolver.test.ts`):
    - Test resolver with new `DirectoryEntryMerchantSettings` type
    - Test fallback behavior when merchant prefs are null
    - Test all section flags with dedicated merchant pref fields
    - Test layout gating with merchant layout choice

11. **Source domain cleanup** (same sprint, not deferred):
    - Remove `directory_entry_layout` from `StorefrontOptionsMerchantSettings` in `types.ts`
    - Remove `external_link_enabled` from `StorefrontOptionsMerchantSettings` in `types.ts`
    - Remove `directory_entry_layout` from `DEFAULT_SETTINGS` in `storefront-options-settings.ts`
    - Verify `StorefrontOptionsResolver.ts` does not reference `directory_entry_layout` or `external_link_enabled` (it currently does not resolve these, but verify)

12. **Grep-verify zero residual coupling** (backend):
    - `grep -r "storefront_opt_enabled" apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts` → **must return zero results**
    - `grep -r "image_gallery_" apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts` → **must return zero results**
    - `grep -r "qr_product\|qr_store\|qr_logo\|qr_directory" apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts` → **must return zero results**
    - `grep -r "directory_entry_layout\|external_link_enabled" apps/api/src/services/resolvers/types.ts` → must only appear in `DirectoryEntryMerchantSettings`, NOT in `StorefrontOptionsMerchantSettings`
    - `grep -r "directory_entry" apps/api/src/routes/storefront-options-settings.ts` → **must return zero results**
    - `grep -r "page_type.*directory_entry" apps/api/src/` → **must return zero results** (no more page_type discriminator queries)
    - `grep -r "generateStorefrontOptionsSettingsId" apps/api/src/routes/directory-entry-options-settings.ts` → **must return zero results**

**Verification**: `pnpm checkapi` zero TS errors. Unit tests pass. All grep checks pass.

---

### Sprint 2: Frontend Decouple

**Goal**: Update frontend types, services, and UI to use dedicated directory entry settings.

#### Tasks

1. **CapabilityResolutionService.ts**:
   - Update `DirectoryEntryOptionsState.merchantPreferences` to use `directory_entry_opt_enabled` instead of `storefront_opt_enabled`
   - No other changes needed — state interface already has correct shape

2. **UnifiedCapabilityService.ts**:
   - Update `BackendEffectiveDirectoryEntry` interface if needed (merchant_preferences shape)
   - `mapDirectoryEntry()` — update merchant_preferences mapping

3. **TenantDirectoryManagementService.ts**:
   - `getDirectoryEntryOptions()` — response type updated to match new API response (no more storefront options fields)
   - `updateDirectoryEntryOptions()` — request body updated to only send directory-entry-relevant fields

4. **DirectorySettingsPanel.tsx**:
   - Remove references to storefront-options-only fields in section toggles
   - Section toggles should only show: hours_display, map_display, location_display, storefront_social_media, storefront_contact, interactive_maps, enhanced_seo, external_link_enabled, gallery_display_mode
   - Remove: qr_codes_*, image_gallery_*, default_qr_resolution, default_gallery_limit, hours_animated, hours_status, category_*, recommend_*, recently_viewed, storefront_actions, storefront_layout

5. **TenantInfoService.ts** (if needed):
   - Add `getDirectoryEntrySettings()` + `updateDirectoryEntrySettings()` methods if a dedicated service method is needed (currently handled by TenantDirectoryManagementService)

6. **useCapabilityAccess.ts** (if needed):
   - Add `useDirectoryEntryCapability` hook if not already present (check existing hooks)

7. **PlanSummaryPanel.tsx**:
   - Update `directory_entry` merchant_preferences display if it references `storefront_opt_enabled`

8. **CapabilityShowcase.tsx**:
   - No changes expected — already has directory_entry row

9. **Settings cards & sidebar**:
   - Verify directory entry settings card/link exists in TenantSettings.tsx and DynamicTenantSidebar.tsx
   - Add if missing

10. **Grep-verify zero residual coupling** (frontend):
    - `grep -r "storefront_opt_enabled" apps/web/src/services/CapabilityResolutionService.ts` → in directory entry context, **must return zero results**
    - `grep -r "storefront_opt_enabled" apps/web/src/components/directory/DirectorySettingsPanel.tsx` → **must return zero results**
    - `grep -r "qr_codes_\|image_gallery_\|default_qr_resolution\|default_gallery_limit\|hours_animated\|hours_status\|category_store\|category_product\|recommend_store\|recommend_products\|recently_viewed\|storefront_actions\|storefront_layout" apps/web/src/components/directory/DirectorySettingsPanel.tsx` → **must return zero results**

**Verification**: `pnpm checkweb` zero TS errors. All grep checks pass.

---

### Sprint 3: E2E Tests + Skill Doc

**Goal**: Add E2E batch tests, verify end-to-end, create agent skill document for reuse.

> **Note**: Source domain cleanup (removing `directory_entry_layout` and `external_link_enabled` from `StorefrontOptionsMerchantSettings` and `storefront-options-settings.ts`) is done in **Sprint 1, Task 11** — not deferred to Sprint 3. This is the key lesson from previous splits where deferred cleanup left residual coupling.

#### Tasks

1. **E2E batch tests** (`sprint-e2e-batch.test.ts`):
   - Add DirectoryEntryOptionsResolver test section
   - Test: resolver with new merchant settings type
   - Test: fallback when merchant prefs null
   - Test: layout gating
   - Test: section flags (hours, map, contact, gallery, qr, social, seo, external_link)
   - Test: disabled flag overrides everything

2. **Old table cleanup** (optional, deferred):
   - Do NOT delete old `page_type='directory_entry'` rows from `tenant_storefront_options_settings` — keep for backward compatibility
   - Add a comment in the migration noting these rows are orphaned and can be cleaned up in a future migration

3. **Create agent skill document** `.devin/skills/capability-domain-decouple.md`:
   - Extract the clean decouple pattern from this sprint into a reusable skill
   - Include the 10 clean decouple principles
   - Include the grep-verification checklist template
   - Include the migration template (table creation, data copy, RLS, triggers)
   - Include the type separation template
   - Include the resolver refactor template
   - Include the route refactor template
   - Reference this sprint as the reference implementation

4. **End-of-phase checklist**:
   - TS checks (checkapi + checkweb)
   - Singleton compliance
   - RBAC gates on new route
   - Route mounting verified
   - Capability system (constraint metadata, buildExpiredCapabilitiesResponse)
   - Navigation links
   - Sidebar + settings card
   - Database migration (idempotency, RLS, triggers, indexes, Prisma sync)
   - E2E batch test

**Verification**: `pnpm checkapi` + `pnpm checkweb` zero TS errors. E2E batch tests pass. All grep checks pass.

## 6. File Inventory

### New Files
| File | Sprint | Purpose |
|------|--------|---------|
| `database/migrations/108_directory_entry_merchant_gate_split.sql` | 1 | Table creation + data migration |
| `apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.test.ts` | 1 | Unit tests |

### Modified Files — Backend (Sprint 1)
| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Add `tenant_directory_entry_settings` model + tenant back-relation |
| `apps/api/src/lib/id-generator.ts` | Add `generateDirectoryEntrySettingsId` |
| `apps/api/src/services/resolvers/types.ts` | Add `DirectoryEntryMerchantSettings`, update `MerchantSettingsBundle.directoryEntry`, clean `StorefrontOptionsMerchantSettings` |
| `apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts` | Use `DirectoryEntryMerchantSettings`, update pref reads, remove gallery/qr merchant pref reads |
| `apps/api/src/routes/directory-entry-options-settings.ts` | Query new table, update Zod schema, update defaults, use new ID generator |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Update `fetchMerchantSettings()` directoryEntry query (both pipelines) |

### Modified Files — Frontend (Sprint 2)
| File | Changes |
|------|---------|
| `apps/web/src/services/CapabilityResolutionService.ts` | Update merchantPreferences field name |
| `apps/web/src/services/UnifiedCapabilityService.ts` | Update mapDirectoryEntry merchant_preferences |
| `apps/web/src/services/TenantDirectoryManagementService.ts` | Update response/body types for new API shape |
| `apps/web/src/components/directory/DirectorySettingsPanel.tsx` | Remove storefront-options-only fields from section toggles |

### Modified Files — Source Domain Cleanup (Sprint 1, not deferred)
| File | Changes |
|------|---------|
| `apps/api/src/services/resolvers/types.ts` | Remove `directory_entry_layout` and `external_link_enabled` from `StorefrontOptionsMerchantSettings` |
| `apps/api/src/routes/storefront-options-settings.ts` | Remove `directory_entry_layout` from `DEFAULT_SETTINGS` |

### New Files — Sprint 3
| File | Purpose |
|------|---------|
| `.devin/skills/capability-domain-decouple.md` | Agent skill document for clean capability domain decoupling |

### Modified Files — Sprint 3
| File | Changes |
|------|---------|
| `apps/api/src/tests/sprint-e2e-batch.test.ts` | Add DirectoryEntryOptionsResolver test section |

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing directory entry settings lost during migration | Medium | Data is copied (not moved). Old rows preserved. Migration is additive. |
| Resolver fallback fails when new table is empty | Low | Resolver falls back to old `tenant_storefront_options_settings` row when new table returns null. |
| Frontend expects old field names in API response | Medium | Route returns same field names from new table. Frontend service types updated in Sprint 2. |
| StorefrontOptionsMerchantSettings cleanup breaks storefront options | Low | `directory_entry_layout` and `external_link_enabled` were only used by directory entry rows. Removing from the interface is safe — storefront rows never set these. |
| Prisma schema drift after db pull | Low | Run `prisma db pull` + `prisma generate` after migration. Verify model matches. |

## 8. Migration Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│  BEFORE (Current State)                                         │
│                                                                 │
│  tenant_storefront_options_settings                             │
│  ├── page_type='storefront'     → Storefront Options prefs      │
│  └── page_type='directory_entry' → Directory Entry prefs (LEAK) │
│      └── Contains: qr_codes_*, image_gallery_*, enhanced_seo,   │
│          storefront_actions, category_*, recommend_*, etc.      │
│          (storefront options fields not relevant to dir entry)  │
│                                                                 │
│  StorefrontOptionsMerchantSettings (type)                       │
│  └── directory_entry_layout, external_link_enabled (LEAK)       │
│                                                                 │
│  DirectoryEntryOptionsResolver                                  │
│  └── reads merchantPrefs.storefront_opt_enabled (LEAK)          │
│  └── reads merchantPrefs.image_gallery_*, merchantPrefs.qr_*    │
│      (storefront options fields, LEAK)                          │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │  MIGRATION 108      │
                    │  Copy dir entry     │
                    │  prefs to new table │
                    │  (additive, non-    │
                    │  breaking)          │
                    └─────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AFTER (Target State)                                           │
│                                                                 │
│  tenant_storefront_options_settings                             │
│  └── page_type='storefront'     → Storefront Options prefs      │
│      (directory_entry_layout, external_link_enabled removed     │
│       from type — they were never used by storefront rows)      │
│                                                                 │
│  tenant_directory_entry_settings (NEW)                          │
│  └── tenant_id (UNIQUE)         → Directory Entry prefs         │
│      └── Contains ONLY: directory_entry_opt_enabled,            │
│          directory_entry_layout, hours_display, map_display,    │
│          location_display, storefront_social_media,             │
│          storefront_contact, interactive_maps, enhanced_seo,    │
│          external_link_enabled, gallery_display_mode            │
│                                                                 │
│  DirectoryEntryMerchantSettings (NEW type)                      │
│  DirectoryEntryOptionsResolver                                  │
│  └── reads merchantPrefs.directory_entry_opt_enabled            │
│  └── no longer reads image_gallery_*, qr_* from merchant prefs  │
│                                                                 │
│  Old page_type='directory_entry' rows preserved for fallback    │
└─────────────────────────────────────────────────────────────────┘
```

## 9. Verification Checklist

### Sprint 1
- [ ] Migration 108 is idempotent (IF NOT EXISTS, ON CONFLICT DO NOTHING)
- [ ] RLS policies on new table
- [ ] updated_at trigger on new table
- [ ] Index on tenant_id
- [ ] Prisma schema matches DB (db pull + generate)
- [ ] `generateDirectoryEntrySettingsId` follows `{prefix}-{tk}-{nanoid}` pattern
- [ ] `DirectoryEntryMerchantSettings` interface has only directory-entry-relevant fields
- [ ] `StorefrontOptionsMerchantSettings` no longer has `directory_entry_layout` or `external_link_enabled`
- [ ] Resolver uses `DirectoryEntryMerchantSettings` type
- [ ] Resolver no longer reads `image_gallery_*` or `qr_*` from merchant prefs
- [ ] Route queries new table with fallback to old table
- [ ] Route Zod schema only includes directory-entry-relevant fields
- [ ] `fetchMerchantSettings()` queries new table for directoryEntry
- [ ] Both primary and MV-based pipelines updated
- [ ] `pnpm checkapi` — zero TS errors
- [ ] Unit tests pass

### Sprint 2
- [ ] `DirectoryEntryOptionsState.merchantPreferences` uses `directory_entry_opt_enabled`
- [ ] `mapDirectoryEntry()` maps merchant_preferences correctly
- [ ] `TenantDirectoryManagementService` types match new API shape
- [ ] `DirectorySettingsPanel` only shows directory-entry-relevant toggles
- [ ] `pnpm checkweb` — zero TS errors

### Sprint 3
- [ ] E2E batch tests pass
- [ ] Agent skill document created at `.devin/skills/capability-domain-decouple.md`
- [ ] Full end-of-phase checklist verified

## 10. Grep-Verification Commands

Run these after all sprints to confirm zero residual coupling:

```bash
# Backend: Directory Entry must not read storefront options fields
grep -rn "storefront_opt_enabled" apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts
# Expected: zero results

grep -rn "image_gallery_" apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts
# Expected: zero results

grep -rn "qr_product\|qr_store\|qr_logo\|qr_directory" apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts
# Expected: zero results

# Backend: Storefront Options must not carry directory entry fields
grep -rn "directory_entry_layout\|external_link_enabled" apps/api/src/services/resolvers/types.ts
# Expected: only in DirectoryEntryMerchantSettings, NOT in StorefrontOptionsMerchantSettings

grep -rn "directory_entry" apps/api/src/routes/storefront-options-settings.ts
# Expected: zero results

# Backend: No more page_type discriminator queries for directory entry
grep -rn "page_type.*directory_entry" apps/api/src/
# Expected: zero results

# Backend: Directory entry route must not use storefront options ID generator
grep -rn "generateStorefrontOptionsSettingsId" apps/api/src/routes/directory-entry-options-settings.ts
# Expected: zero results

# Frontend: Directory Entry components must not reference storefront options fields
grep -rn "storefront_opt_enabled" apps/web/src/components/directory/DirectorySettingsPanel.tsx
# Expected: zero results

grep -rn "qr_codes_\|image_gallery_\|default_qr_resolution\|default_gallery_limit\|hours_animated\|hours_status\|category_store\|category_product\|recommend_store\|recommend_products\|recently_viewed\|storefront_actions\|storefront_layout" apps/web/src/components/directory/DirectorySettingsPanel.tsx
# Expected: zero results
```
