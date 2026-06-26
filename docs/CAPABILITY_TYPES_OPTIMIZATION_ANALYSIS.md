# Capability Type Optimization Analysis: Products vs Storefront

## 1. Executive Summary

The platform capability system currently treats **Storefront** and **Products** differently at the architectural level. Storefront cleanly separates **storefront types** (what kind of business the merchant is) from **storefront options** (display and behavior features). Products, by contrast, mixes **product types** (physical, digital, hybrid, service), **product creation options** (variants, gallery, video), **product page layouts**, and **product page sections** inside a single `product_options` capability.

This document identifies the specific inconsistencies in feature naming, grouping, enablement, and separation of concerns, then proposes a canonical rule set and a phased plan to realign Products and Storefront capabilities so they mirror each other in structure and behavior.

**Status**: Analysis and planning only. No implementation actions are taken in this document.

---

## 2. Scope & Goals

### 2.1 Scope
- Capability types: `storefront_types`, `storefront_options`, `product_options`.
- Backend: resolvers, services, API routes, database schema / seed data, Prisma models.
- Frontend: TypeScript state interfaces, resolution logic, settings pages, UnifiedCapabilityService mapping.
- Reference: canonical capability data-flow and deployment rules in the skill documents.

### 2.2 Goals
1. **Separate types and options** consistently across both capability families.
2. **Standardize feature key naming** for enablement, disabling, flexibility, groups, and individual features.
3. **Align feature grouping** so both capabilities use the same group-gate pattern.
4. **Unify settings persistence** and API route behavior.
5. **Mirror frontend resolver and dashboard patterns** for both capability families.
6. Provide a **low-risk, phased rollout plan**.

---

## 3. Current State Architecture

### 3.1 Storefront (clean separation)

| Layer | Types | Options |
|-------|-------|---------|
| Capability type | `storefront_types` | `storefront_options` |
| Resolver | `StorefrontTypeResolver.ts` | `StorefrontOptionsResolver.ts` |
| Service | `StorefrontTypeService.ts` | `StorefrontOptionsService.ts` |
| API routes | `/api/settings/:tenantId/storefront-type` | `/api/settings/:tenantId/storefront-options` |
| Settings table | `tenant_storefront_type_settings` | `tenant_storefront_options_settings` |
| Frontend state | `StorefrontState` | `StorefrontOptionsState` |
| Settings page | `storefront-type` page | `storefront-options` page |

**Storefront types** (`storefront_` prefix): `online`, `retail`, `service`, `social`, `flexible`.  
**Storefront options** (`storefront_opt_` prefix): grouped into hours, category, recommend, info, qr, gallery, advanced, layout, plus user-behavior standalone features.

### 3.2 Products (mixed)

| Layer | Current |
|-------|---------|
| Capability type | `product_options` only |
| Resolver | `ProductOptionsResolver.ts` |
| Service | `ProductOptionsService.ts` |
| API route | `/api/settings/:tenantId/product-options` |
| Settings table | `tenant_product_options_settings` |
| Frontend state | `ProductOptionsState` |
| Settings page | `product-options` page |

**Everything lives under `product_options`**:
- **Types**: `product_physical`, `product_digital`, `product_hybrid`, `product_service`
- **Creation options**: `product_variant`, `product_gallery`, `product_video`
- **Layout**: `product_layout_classic`, `product_layout_editorial`, `product_layout_immersive`
- **Page sections**: `product_opt_recently_viewed`, `product_opt_qr_codes`, `product_opt_recommended`, etc.

There is no `product_types` capability type and no `ProductTypeResolver`/`ProductTypeService`.

---

## 4. Inconsistency Analysis

### 4.1 Separation of Types and Options

| Aspect | Storefront | Products | Issue |
|--------|------------|----------|-------|
| Types capability | `storefront_types` exists | None | Product types are not a first-class capability |
| Options capability | `storefront_options` | `product_options` | Product mixes types + options |
| Resolver split | Two resolvers | One resolver | Product cannot be reasoned about independently |
| Service split | Two services | One service | Product service has multiple responsibilities |

**Impact**: The dashboard and settings cannot separately tier-gate "what kinds of products can I sell" vs "what product-page features can I use".

### 4.2 Feature Key Naming

#### 4.2.1 Master enable / disable / flexible flags

| Concept | Storefront types | Storefront options | Products | Ideal |
|---------|------------------|--------------------|----------|-------|
| Master ON | `storefront_enabled` | `storefront_opt_enabled` | `product_enabled` | `<cap>_enabled` |
| Master OFF | `storefront_disabled` | `storefront_opt_disabled` | `product_disabled` | `<cap>_disabled` |
| Flexible | `storefront_flexible` | `storefront_opt_flexible` | `product_flexible` | `<cap>_flexible` |

**Issues**:
- Products uses `product_enabled` instead of `product_options_enabled` (or `product_types_enabled` after split).
- Storefront type and option prefixes differ only by `_opt_`, which is good, but products has no analogous prefix.

#### 4.2.2 Type-level features

| Storefront types | Products (current) | Ideal after split |
|------------------|------------------|-------------------|
| `storefront_online` | `product_physical` | `product_type_physical` |
| `storefront_retail` | `product_digital` | `product_type_digital` |
| `storefront_service` | `product_hybrid` | `product_type_hybrid` |
| `storefront_social` | `product_service` | `product_type_service` |

**Issue**: Product type keys omit the `_type_` segment, making them ambiguous with option keys.

#### 4.2.3 Layout features

| Storefront options | Products | Ideal |
|--------------------|----------|-------|
| `storefront_opt_layout_classic` | `product_layout_classic` | `product_options_layout_classic` (or `product_type_layout_...` if layout belongs to types) |

**Issue**: Product layout keys use `product_layout_*` while storefront uses `storefront_opt_layout_*`. The `_opt_` qualifier is missing.

#### 4.2.4 Section / page features

| Storefront options | Products | Ideal |
|--------------------|----------|-------|
| `storefront_opt_recently_viewed` | `product_opt_recently_viewed` | `product_options_recently_viewed` |
| `storefront_opt_enhanced_seo` | `product_opt_enhanced_seo` | `product_options_enhanced_seo` |

**Issue**: Both use `_opt_` for sections, but the surrounding convention differs. Storefront has `storefront_opt_` + group + feature, while Product has `product_opt_` + feature with no group.

### 4.3 Feature Grouping

Storefront options defines explicit **group gates**:
- `storefront_opt_hours_enabled` / `_disabled`
- `storefront_opt_category_enabled` / `_disabled`
- `storefront_opt_recommend_enabled` / `_disabled`
- `storefront_opt_info_enabled` / `_disabled`
- `storefront_opt_qr_enabled` / `_disabled`
- `storefront_opt_gallery_enabled` / `_disabled`
- `storefront_opt_advanced_enabled` / `_disabled`
- `storefront_opt_layout_enabled` / `_disabled`

Product options has **no group gates**. It is flat:
- Type flags: `product_physical`, `product_digital`, `product_hybrid`, `product_service`
- Creation feature flags: `product_variant`, `product_gallery`, `product_video`
- Layout flags: `product_layout_classic`, etc.
- Section flags: `product_opt_*`

**Impact**: The frontend cannot render product settings as cleanly grouped cards. The backend cannot express "the product page sections group is enabled" and future tier packaging becomes harder.

### 4.4 Enablement / Disabling Logic

Both use a boolean enable/disable pair, but the rule is applied inconsistently:

- Storefront type resolver: `isEnabled = masterDeactivate ? false : masterActivate ? true : hasAnyFeatureGate`
- Storefront options resolver: `mainOn = enabled && !disabled`
- Product options resolver: `enabled = enabled && !disabled`

**Issue**: The Storefront type resolver uses activation/deactivation semantics, while Storefront options and Product options use simple ON/OFF. The canonical rules should prefer one model.

### 4.5 Settings Persistence

| Aspect | Storefront options | Product options |
|--------|--------------------|-----------------|
| Table | `tenant_storefront_options_settings` | `tenant_product_options_settings` |
| Composite key | `tenant_id` + `page_type` | `tenant_id` only |
| Master pref column | `storefront_opt_enabled` | `product_physical_enabled`, `product_digital_enabled`, ... (type prefs) |

**Issue**:
- Product settings table stores **type preferences** (`product_physical_enabled`) as the primary columns, because there is no separate `product_types` capability. After splitting, the type prefs should move to a `tenant_product_types_settings` table.
- Storefront options supports `page_type` for future per-page variants; product options does not.

### 4.6 API Routes

Both routes follow the same pattern, but the Product route is more complex because it has to gate three unrelated concerns:
- `FEATURE_KEY_TO_TYPE` (product types)
- `FEATURE_KEY_TO_TIER_FLAG` (creation features: variant, gallery, video)
- `SECTION_FEATURE_KEYS` (page sections)

Storefront options route is simpler because it maps directly to the `allowedXTypes` arrays from the group-gated resolver.

**Issue**: Product options route is a catch-all; future additions will keep increasing its complexity.

### 4.7 Frontend State and Resolution

#### 4.7.1 `CapabilityResolutionService.ts`

- `StorefrontOptionsState` has group-based fields: `hoursEnabled`, `allowedHoursTypes`, `categoryEnabled`, `allowedCategoryTypes`, etc.
- `ProductOptionsState` has flat fields: `showsVariants`, `showsGallery`, `showsVideo`, `showsRecentlyViewed`, etc.

- `resolveStorefrontOptionsState` iterates groups and computes `allowedXTypes` arrays.
- `resolveProductOptionsState` computes individual booleans and `allowedTypes` for product types only.

#### 4.7.2 `UnifiedCapabilityService.ts`

- `BackendEffectiveStorefrontOptions` mirrors the group structure.
- `BackendEffectiveProductOptions` is flat, matching the current resolver.

**Issue**: The backend/frontend mapping is structurally different for the two capabilities, increasing maintenance cost.

### 4.8 Settings UI

- `StorefrontOptionsSettingsClient.tsx` uses `STOREFRONT_OPT_GROUPS` and `getStorefrontOptMeta` to render grouped cards.
- `ProductOptionsSettingsClient.tsx` manually renders cards for Product Types, Creation Features, Product Page Layout, and Product Page Sections.

**Issue**: Product UI cannot leverage the group metadata utility; any new section requires hand-written JSX.

---

## 5. Proposed Canonical Rules

Based on the skill documents (`capability-data-flow-rules.md` and `capability-deployment-flow.md`) and the existing Storefront pattern, the following rules should become the standard for all multi-concern capabilities.

### 5.1 One capability = one concern

- `*_types` capability controls what kinds of things the merchant can be/sell.
- `*_options` capability controls display, behavior, and feature options.

Apply this to Products by creating `product_types` and refactoring `product_options` to be display-only.

### 5.2 Feature key naming convention

```
<capability_key>_enabled          # master ON gate
<capability_key>_disabled         # master OFF gate
<capability_key>_flexible         # unlock all features in this capability

<capability_key>_<group>_enabled  # group ON gate
<capability_key>_<group>_disabled # group OFF gate

<capability_key>_<group>_<feature>            # individual feature
<capability_key>_<group>_<subgroup>_<feature>  # nested feature
```

Examples:

```
storefront_options_enabled
storefront_options_disabled
storefront_options_flexible
storefront_options_hours_enabled
storefront_options_hours_animated
storefront_options_qr_codes_1024

product_types_enabled
product_types_disabled
product_types_flexible
product_types_physical

product_options_enabled
product_options_disabled
product_options_flexible
product_options_creation_variants
product_options_creation_gallery
product_options_creation_video
product_options_layout_classic
product_options_sections_recently_viewed
product_options_sections_qr_codes
product_options_sections_recommended
```

### 5.3 Enablement precedence

Use the same precedence everywhere:

1. If `*_disabled` is true → capability is OFF.
2. Else if `*_enabled` is true → capability is ON.
3. Else if any feature/group is enabled → capability is ON.
4. Else → capability is OFF.

`*_flexible` overrides individual group/feature gates and adds all allowed items to `allowedXTypes` / `allowedLayouts` / etc.

### 5.4 Resolver output contract

Every resolver must return:

```ts
{
  enabled: boolean,
  isFlexible: boolean,
  allowedTypes: T[],
  effectiveTypes: T[],
  merchantPreferences: Record<string, any>,
  features: Record<string, boolean>,
}
```

For options resolvers, return group-level arrays:

```ts
{
  enabled: boolean,
  isFlexible: boolean,
  <group>Enabled: boolean,
  allowed<Group>Types: T[],
  effective<Group>Types: T[],
  ...
  merchantPreferences: Record<string, any>,
  features: Record<string, boolean>,
}
```

### 5.5 API route contract

- GET `/api/settings/:tenantId/<capability>` returns `{ settings, tierState }`.
- `settings` is tier-filtered (disallowed features forced off).
- `tierState` contains the raw allowed/effective state from the resolver.
- PUT `/api/settings/:tenantId/<capability>` validates each incoming toggle against `tierState` and rejects `tier_restricted` errors for `true` values on disallowed features.

### 5.6 Frontend mapping

- `CapabilityResolutionService` provides pure resolver functions.
- `UnifiedCapabilityService` maps snake_case backend response to camelCase frontend state.
- Settings pages use shared group-rendering utilities, not hand-written cards.

---

## 6. Target Architecture

### 6.1 Capability types

| Capability | Responsibility | Prefix | Notes |
|------------|---------------|--------|-------|
| `storefront_types` | Merchant business type | `storefront_` | Already exists; keep |
| `storefront_options` | Storefront display/behavior | `storefront_options_` | Rename internal keys from `storefront_opt_*` to `storefront_options_*` |
| `product_types` | Product kinds the merchant can sell | `product_types_` | **New** |
| `product_options` | Product page features and creation options | `product_options_` | **Refactored**; remove type flags |

### 6.2 Backend services

| Service | Purpose |
|---------|---------|
| `StorefrontTypeService` | Resolve `storefront_types` |
| `StorefrontOptionsService` | Resolve `storefront_options` |
| `ProductTypeService` | Resolve `product_types` |
| `ProductOptionsService` | Resolve `product_options` |

### 6.3 Backend resolvers

| Resolver | Purpose |
|----------|---------|
| `StorefrontTypeResolver` | Resolve `storefront_types` |
| `StorefrontOptionsResolver` | Resolve `storefront_options` |
| `ProductTypeResolver` | Resolve `product_types` |
| `ProductOptionsResolver` | Resolve `product_options` |

### 6.4 API routes

| Route | Capability |
|-------|------------|
| `GET/PUT /api/settings/:tenantId/storefront-type` | `storefront_types` |
| `GET/PUT /api/settings/:tenantId/storefront-options` | `storefront_options` |
| `GET/PUT /api/settings/:tenantId/product-types` | `product_types` |
| `GET/PUT /api/settings/:tenantId/product-options` | `product_options` |

### 6.5 Settings tables

| Table | Columns |
|-------|---------|
| `tenant_storefront_type_settings` | `storefront_type_enabled`, `selected_storefront_type`, timestamps |
| `tenant_storefront_options_settings` | existing columns (rename keys to `storefront_options_*`) |
| `tenant_product_types_settings` | `product_types_enabled`, `product_physical_enabled`, `product_digital_enabled`, `product_hybrid_enabled`, `product_service_enabled`, timestamps |
| `tenant_product_options_settings` | `product_options_enabled`, group columns, `product_layout`, timestamps |

### 6.6 Frontend state

| State | Shape |
|-------|-------|
| `StorefrontState` | `type`, `effectiveType`, `allowedTypes`, `effectiveTypes`, `merchantPreferences` |
| `StorefrontOptionsState` | group-based (already correct) |
| `ProductTypeState` | `type`? `allowedTypes`, `effectiveTypes`, `merchantPreferences` |
| `ProductOptionsState` | group-based, aligned with `StorefrontOptionsState` |

### 6.7 Feature key mapping (current → target)

#### Storefront options

| Current | Target |
|---------|--------|
| `storefront_opt_enabled` | `storefront_options_enabled` |
| `storefront_opt_disabled` | `storefront_options_disabled` |
| `storefront_opt_flexible` | `storefront_options_flexible` |
| `storefront_opt_hours_enabled` | `storefront_options_hours_enabled` |
| `storefront_opt_hours_animated` | `storefront_options_hours_animated` |
| `storefront_opt_hours_status` | `storefront_options_hours_status` |
| `storefront_opt_layout_classic` | `storefront_options_layout_classic` |
| `storefront_opt_recently_viewed` | `storefront_options_behavior_recently_viewed` |
| `storefront_opt_enhanced_seo` | `storefront_options_advanced_enhanced_seo` |
| ... | ... |

#### Product split

| Current | Target type capability | Target options capability |
|---------|------------------------|---------------------------|
| `product_enabled` | `product_types_enabled` | `product_options_enabled` |
| `product_disabled` | `product_types_disabled` | `product_options_disabled` |
| `product_flexible` | `product_types_flexible` | `product_options_flexible` |
| `product_physical` | `product_types_physical` | — |
| `product_digital` | `product_types_digital` | — |
| `product_hybrid` | `product_types_hybrid` | — |
| `product_service` | `product_types_service` | — |
| `product_variant` | — | `product_options_creation_variants` |
| `product_gallery` | — | `product_options_creation_gallery` |
| `product_video` | — | `product_options_creation_video` |
| `product_layout_classic` | — | `product_options_layout_classic` |
| `product_opt_recently_viewed` | — | `product_options_sections_recently_viewed` |
| `product_opt_qr_codes` | — | `product_options_sections_qr_codes` |
| `product_opt_recommended` | — | `product_options_sections_recommended` |
| `product_opt_map_display` | — | `product_options_sections_map_display` |
| `product_opt_location_display` | — | `product_options_sections_location_display` |
| `product_opt_hours_display` | — | `product_options_sections_hours_display` |
| `product_opt_enhanced_seo` | — | `product_options_sections_enhanced_seo` |
| `product_opt_reviews` | — | `product_options_sections_reviews` |
| `product_opt_fulfillment` | — | `product_options_sections_fulfillment` |
| `product_opt_categories` | — | `product_options_sections_categories` |
| `product_opt_location_availability` | — | `product_options_sections_location_availability` |

---

## 7. Phased Implementation Plan

### Phase 0 — Inventory & Alignment (read-only)

**Goal**: Complete the picture before changing code.

**Tasks**:
1. Run a SQL inventory of all `product_*` and `storefront_*` feature keys in `features_list`, `capability_features_list`, `tier_features_list`, and `capability_type_list`.
2. Generate a cross-reference report of every frontend consumer of `product_options` and `storefront_options` (hooks, settings pages, public pages, wizards).
3. Confirm that `UnifiedCapabilityService` / `EffectiveCapabilityResolver` is the primary consumer path; list legacy direct consumers.
4. Document the current default tier feature matrix for both capabilities.

**Deliverables**:
- `docs/CAPABILITY_FEATURE_INVENTORY.md`
- Dependency map for frontend consumers

**Risk**: Low (read-only).

### Phase 1 — Design & Rule Finalization

**Goal**: Lock the canonical rules and target architecture.

**Tasks**:
1. Decide whether to:
   - **Option A**: Split products into `product_types` + `product_options` (recommended, mirrors Storefront).
   - **Option B**: Keep single `product_options` but rename all keys to follow the canonical pattern.
2. Finalize the new feature key names.
3. Finalize DB table shapes and migration strategy.
4. Define backward-compatibility aliases for legacy feature keys (e.g., `product_physical` maps to `product_types_physical` during transition).
5. Update the capability skill documents (`capability-data-flow-rules.md`, `capability-deployment-flow.md`) with the canonical rules.

**Deliverable**: Approved target architecture document.

**Risk**: Medium; requires product/business sign-off on tier packaging.

### Phase 2 — Database Migration

**Goal**: Create new capability types and feature keys without breaking existing code.

**Tasks**:
1. Add `product_types` capability type to `capability_type_list`.
2. Add new feature keys to `features_list` and link them to `capability_features_list`.
3. Seed new keys into `tier_features_list` using the same tier matrix as current product options.
4. Add `tenant_product_types_settings` table.
5. Extend `tenant_product_options_settings` with `page_type` composite key and new columns if needed.
6. Add backward-compatibility views or application-level fallback so old keys continue to work.
7. Migrate existing `tenant_product_options_settings` rows:
   - Move `product_*_enabled` columns to `tenant_product_types_settings`.
   - Keep `product_options_*` columns in `tenant_product_options_settings`.

**Deliverables**:
- Prisma migration file
- Seed script update
- Data migration script

**Risk**: High; data migration must be reversible.

### Phase 3 — Backend Resolvers & Services

**Goal**: Build the new resolvers and refactor existing ones.

**Tasks**:
1. Create `ProductTypeResolver.ts` and `ProductTypeService.ts`.
2. Refactor `ProductOptionsResolver.ts` to remove type resolution and add group gates.
3. Update `StorefrontOptionsResolver.ts` to use the new canonical key names (`storefront_options_*`).
4. Update `EffectiveCapabilityResolver.ts` to include `product_types` and `product_options` separately.
5. Ensure both new resolvers accept `merchantPrefs` and return `allowed*` and `effective*` arrays.

**Deliverables**:
- New resolver/service files
- Updated resolver interfaces in `resolvers/types.ts`

**Risk**: Medium; must maintain backward compatibility.

### Phase 4 — API Routes

**Goal**: Add new routes and refactor existing ones.

**Tasks**:
1. Create `product-type-settings.ts` route.
2. Refactor `product-options-settings.ts` to:
   - Remove type gating logic.
   - Add group-gated validation.
   - Use new feature key names.
3. Update `storefront-options-settings.ts` to use new canonical keys.
4. Mount new routes in the Express app.
5. Keep legacy endpoints as aliases during transition.

**Deliverables**:
- Updated route files
- Route registration changes

**Risk**: Medium; frontend must be updated in tandem.

### Phase 5 — Frontend Resolution & State

**Goal**: Align frontend types and mapping.

**Tasks**:
1. Add `ProductTypeState` and `ProductType` types to `CapabilityResolutionService.ts`.
2. Refactor `ProductOptionsState` to group-based structure.
3. Add `resolveProductTypeState` and update `resolveProductOptionsState`.
4. Update `UnifiedCapabilityService.ts` mapping for `product_types` and `product_options`.
5. Rename `storefront_opt_*` references to `storefront_options_*` in resolution logic.
6. Add backward-compatibility mapping for old snake_case keys.

**Deliverables**:
- Updated TypeScript interfaces
- Updated resolver functions
- Updated mapping functions

**Risk**: Medium; many UI components depend on these shapes.

### Phase 6 — Frontend Settings UI

**Goal**: Update settings pages and shared utilities.

**Tasks**:
1. Create `product-types` settings page.
2. Refactor `product-options` settings page to use group-based rendering (similar to storefront options).
3. Update `storefront-options` settings page to use renamed keys.
4. Update `useCapabilityAccess` hook to expose `productTypes` and `productOptions` separately.
5. Update `PlanSummaryPanel` to display both new capabilities.

**Deliverables**:
- New and updated React components
- Updated hook exports

**Risk**: Medium; user-facing settings page must remain usable.

### Phase 7 — Public / Consumer Surfaces

**Goal**: Update every place that reads product options.

**Tasks**:
1. Update product creation wizard to use `product_types` for allowed types and `product_options` for creation features.
2. Update public product page to use `product_options` for sections and layout.
3. Update inventory services and item detail pages.
4. Update quickstart and onboarding flows that reference product types.

**Deliverables**:
- Updated consumer components
- Updated service calls

**Risk**: High; many surface areas.

### Phase 8 — Cleanup & Verification

**Goal**: Remove legacy aliases and verify correctness.

**Tasks**:
1. Remove legacy feature key aliases from `features_list` and `tier_features_list` (after transition period).
2. Remove legacy API route aliases.
3. Remove old `ProductOptionsState` flat fields if no longer used.
4. Run full TypeScript check (`checkapi`, `checkweb`).
5. Add unit tests for each resolver verifying:
   - Master disable overrides all.
   - Flexible unlocks all.
   - Group gates work.
   - Merchant preferences correctly produce effective sets.
6. Add integration tests for settings routes.
7. Update skill documentation to reflect the final state.

**Deliverables**:
- Cleaned code
- Test suite
- Updated documentation

**Risk**: Medium; cleanup can introduce regressions.

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Splitting product types/options changes tier packaging | High | Maintain backward-compatible aliases during transition; communicate tier changes before cleanup |
| Data migration of merchant preferences | High | Run migration in a transaction; keep old columns until Phase 8; provide rollback script |
| Many frontend surfaces depend on current shapes | High | Use backward-compatible mapping in `UnifiedCapabilityService`; update consumers incrementally |
| Storefront option rename affects existing tenants | Medium | Keep `storefront_opt_*` aliases; only remove after all code is migrated |
| Resolver complexity increases | Medium | Add unit tests for each group-gate branch; keep resolvers pure |
| Dashboard display of merchant-gated features | Low | Follow skill rule: tier-allowed = visible, merchant-disabled = marked as "merchant-gated" |
| Development time | Medium | Split into phases; deliver each phase independently |

---

## 9. Immediate Next Steps

1. **Confirm Option A vs Option B** with product/business stakeholders.
2. Run the Phase 0 inventory to capture any feature keys missed in this analysis.
3. Update `capability-data-flow-rules.md` and `capability-deployment-flow.md` with the canonical rules once approved.
4. Begin Phase 1 design document once the split direction is approved.

---

## 10. References

- `apps/api/src/services/StorefrontOptionsService.ts`
- `apps/api/src/services/StorefrontTypeService.ts`
- `apps/api/src/services/ProductOptionsService.ts`
- `apps/api/src/services/resolvers/ProductOptionsResolver.ts`
- `apps/api/src/services/resolvers/StorefrontOptionsResolver.ts`
- `apps/api/src/services/resolvers/StorefrontTypeResolver.ts`
- `apps/api/src/services/resolvers/types.ts`
- `apps/api/src/routes/storefront-options-settings.ts`
- `apps/api/src/routes/product-options-settings.ts`
- `apps/api/prisma/schema.prisma` (models `tenant_storefront_options_settings`, `tenant_product_options_settings`)
- `apps/api/prisma/migrations/create_storefront_options.sql`
- `apps/api/prisma/seed-storefront-layout-capabilities.ts`
- `apps/api/prisma/seed-product-layout-capabilities.ts`
- `apps/web/src/services/CapabilityResolutionService.ts`
- `apps/web/src/services/UnifiedCapabilityService.ts`
- `apps/web/src/app/t/[tenantId]/settings/storefront-options/StorefrontOptionsSettingsClient.tsx`
- `apps/web/src/app/t/[tenantId]/settings/product-options/ProductOptionsSettingsClient.tsx`
- `.devin/skills/capability-data-flow-rules.md`
- `.devin/skills/capability-deployment-flow.md`
