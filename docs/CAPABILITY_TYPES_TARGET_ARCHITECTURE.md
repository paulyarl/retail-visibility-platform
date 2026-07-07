# Capability Types Target Architecture — Phase 1 Design

**Status**: Approved — Option A (Split Products into `product_types` + `product_options`)  
**Date**: 2026-06-26  
**Prerequisite**: `docs/CAPABILITY_TYPES_OPTIMIZATION_ANALYSIS.md`

---

## 1. Architectural Decision

**Option A: Split Products** — Create a new `product_types` capability for product kind gating (physical, digital, hybrid, service) and refactor `product_options` to be display/behavior/creation features only. This mirrors the existing Storefront split between `storefront_types` and `storefront_options`.

### Rationale

- Storefront already has clean separation: `storefront_types` (business type) + `storefront_options` (display features)
- Products currently mixes types, creation features, layouts, and page sections in one capability
- Splitting enables independent tier packaging: a plan could allow "digital products only" without gating product page features
- Group-gated resolver pattern (from Storefront options) can be applied to product options for consistent UI rendering
- Future expansion becomes painless — adding a new product page section is a new feature key in an existing group, not a new flat flag

---

## 2. Canonical Naming Convention

### 2.1 Feature Key Pattern

```
<capability_key>_enabled           # master ON gate
<capability_key>_disabled          # master OFF gate
<capability_key>_flexible          # unlock all features in this capability

<capability_key>_<group>_enabled   # group ON gate (options only)
<capability_key>_<group>_disabled  # group OFF gate (options only)

<capability_key>_<group>_<feature>             # individual feature
<capability_key>_<group>_<subgroup>_<feature>   # nested feature (rare)
```

### 2.2 Capability Key Naming

| Capability key | Prefix for features | Type |
|---|---|---|
| `storefront_types` | `storefront_` | Types |
| `storefront_options` | `storefront_options_` | Options |
| `product_types` | `product_types_` | Types |
| `product_options` | `product_options_` | Options |

### 2.3 Enablement Precedence (Canonical)

All resolvers MUST use this precedence:

1. If `*_disabled` is true → capability is OFF
2. Else if `*_enabled` is true → capability is ON
3. Else if any feature/group gate is enabled → capability is ON
4. Else → capability is OFF

`*_flexible` overrides individual group/feature gates and adds all allowed items to `allowed*` arrays.

---

## 3. Feature Key Registry — Complete

### 3.1 `product_types` (NEW)

| Feature Key | Name | Description | Sort |
|---|---|---|---|
| `product_types_enabled` | Product Types Enabled | Master gate — enables product types capability | 1 |
| `product_types_disabled` | Product Types Disabled | Master disable gate | 2 |
| `product_types_flexible` | Product Types Flexible | Flexible tier — unlocks all product types | 3 |
| `product_types_physical` | Physical Products | Sell physical/tangible products | 10 |
| `product_types_digital` | Digital Products | Sell digital/downloadable products | 11 |
| `product_types_hybrid` | Hybrid Products | Sell products with both physical + digital components | 12 |
| `product_types_service` | Service Products | Sell service-type products | 13 |

### 3.2 `product_options` (REFACTORED)

| Feature Key | Name | Description | Group | Sort |
|---|---|---|---|---|
| `product_options_enabled` | Product Options Enabled | Master gate — enables product options capability | master | 1 |
| `product_options_disabled` | Product Options Disabled | Master disable gate | master | 2 |
| `product_options_flexible` | Product Options Flexible | Flexible tier — unlocks all product options | master | 3 |
| `product_options_creation_enabled` | Creation Group Enabled | Enables all creation feature types | creation | 10 |
| `product_options_creation_disabled` | Creation Group Disabled | Disables all creation feature types | creation | 11 |
| `product_options_creation_variants` | Product Variants | Support for product variants (size, color, etc.) | creation | 12 |
| `product_options_creation_gallery` | Product Gallery | Multiple images per product | creation | 13 |
| `product_options_creation_video` | Product Video | Video support on product pages | creation | 14 |
| `product_options_layout_enabled` | Layout Group Enabled | Enables all layout types | layout | 20 |
| `product_options_layout_disabled` | Layout Group Disabled | Disables all layout types | layout | 21 |
| `product_options_layout_classic` | Classic Product Page | Classic product page layout | layout | 22 |
| `product_options_layout_editorial` | Editorial Product Page | Modern editorial product page layout | layout | 23 |
| `product_options_layout_immersive` | Immersive Product Page | Immersive commerce product page layout | layout | 24 |
| `product_options_sections_enabled` | Sections Group Enabled | Enables all product page sections | sections | 30 |
| `product_options_sections_disabled` | Sections Group Disabled | Disables all product page sections | sections | 31 |
| `product_options_sections_recently_viewed` | Recently Viewed | Track and display recently viewed products | sections | 32 |
| `product_options_sections_qr_codes` | QR Codes | QR codes for individual products | sections | 33 |
| `product_options_sections_qr_logo` | QR Logo | QR code with embedded logo | sections | 34 |
| `product_options_sections_recommended` | Recommended Products | Recommended products section on product page | sections | 35 |
| `product_options_sections_map_display` | Map Display | Map display on product page | sections | 36 |
| `product_options_sections_location_display` | Location Display | Location information on product page | sections | 37 |
| `product_options_sections_hours_display` | Hours Display | Business hours on product page | sections | 38 |
| `product_options_sections_enhanced_seo` | Enhanced SEO | Advanced SEO controls and metadata | sections | 39 |
| `product_options_sections_reviews` | Reviews | Product reviews section | sections | 40 |
| `product_options_sections_fulfillment` | Fulfillment | Fulfillment options display | sections | 41 |
| `product_options_sections_categories` | Categories | Category badges on product page | sections | 42 |
| `product_options_sections_location_availability` | Location Availability | Multi-location stock availability | sections | 43 |

### 3.3 `storefront_options` (RENAMED)

All `storefront_opt_*` keys will be renamed to `storefront_options_*`. See §5.3 for the complete mapping.

---

## 4. Database Table Design

### 4.1 `tenant_product_types_settings` (NEW)

Mirrors `tenant_storefront_type_settings`:

```sql
CREATE TABLE tenant_product_types_settings (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id                   TEXT NOT NULL UNIQUE,
  product_types_enabled       BOOLEAN DEFAULT true,
  selected_product_type       VARCHAR(20) DEFAULT 'physical',
  created_at                  TIMESTAMP(6) DEFAULT NOW(),
  updated_at                  TIMESTAMP(6) DEFAULT NOW(),
  CONSTRAINT fk_product_types_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_types_tenant ON tenant_product_types_settings(tenant_id);
```

**Prisma model**:
```prisma
model tenant_product_types_settings {
  id                     String    @id @default(dbgenerated("(gen_random_uuid())::text"))
  tenant_id              String    @unique
  product_types_enabled  Boolean?  @default(true)
  selected_product_type  String?   @default("physical") @db.VarChar(20)
  created_at             DateTime? @default(now()) @db.Timestamp(6)
  updated_at             DateTime? @default(now()) @db.Timestamp(6)
  tenants                tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade, onUpdate: NoAction, map: "fk_product_types_tenant")

  @@index([tenant_id], map: "idx_product_types_tenant")
}
```

### 4.2 `tenant_product_options_settings` (REFACTORED)

Remove type preference columns. Add master + group columns. Add `page_type` composite key (mirrors storefront options):

```sql
-- New columns to add:
ALTER TABLE tenant_product_options_settings
  ADD COLUMN IF NOT EXISTS product_options_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_options_disabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS page_type VARCHAR(20) DEFAULT 'product';

-- Change unique constraint to composite key (like storefront options):
ALTER TABLE tenant_product_options_settings
  DROP CONSTRAINT IF EXISTS tenant_product_options_settings_tenant_id_key,
  ADD CONSTRAINT uq_product_options_tenant_page UNIQUE (tenant_id, page_type);

-- Columns to REMOVE after data migration (Phase 2):
-- product_physical_enabled, product_digital_enabled, product_hybrid_enabled, product_service_enabled
-- (These move to tenant_product_types_settings)

-- Columns to RENAME (Phase 2, after backward-compat period):
-- product_variant_enabled → product_options_creation_variants
-- product_gallery_enabled → product_options_creation_gallery
-- product_video_enabled → product_options_creation_video
-- product_layout → product_options_layout
-- product_opt_recently_viewed → product_options_sections_recently_viewed
-- product_opt_qr_codes → product_options_sections_qr_codes
-- product_opt_qr_logo → product_options_sections_qr_logo
-- product_opt_recommended → product_options_sections_recommended
-- product_opt_map_display → product_options_sections_map_display
-- product_opt_location_display → product_options_sections_location_display
-- product_opt_hours_display → product_options_sections_hours_display
-- product_opt_enhanced_seo → product_options_sections_enhanced_seo
-- product_opt_reviews → product_options_sections_reviews
-- product_opt_fulfillment → product_options_sections_fulfillment
-- product_opt_categories → product_options_sections_categories
-- product_opt_location_availability → product_options_sections_location_availability
```

**Prisma model (target after Phase 2 migration)**:
```prisma
model tenant_product_options_settings {
  id                                        String    @id @default(dbgenerated("(gen_random_uuid())::text"))
  tenant_id                                 String
  page_type                                 String?   @default("product") @db.VarChar(20)
  product_options_enabled                   Boolean?  @default(true)
  product_options_disabled                  Boolean?  @default(false)
  // Creation group
  product_options_creation_variants         Boolean?  @default(true)
  product_options_creation_gallery          Boolean?  @default(true)
  product_options_creation_video            Boolean?  @default(false)
  // Layout
  product_options_layout                    String?   @default("classic") @db.VarChar(20)
  // Sections group
  product_options_sections_recently_viewed  Boolean?  @default(true)
  product_options_sections_qr_codes         Boolean?  @default(true)
  product_options_sections_qr_logo          Boolean?  @default(true)
  product_options_sections_recommended      Boolean?  @default(true)
  product_options_sections_map_display      Boolean?  @default(true)
  product_options_sections_location_display Boolean?  @default(true)
  product_options_sections_hours_display    Boolean?  @default(true)
  product_options_sections_enhanced_seo     Boolean?  @default(true)
  product_options_sections_reviews          Boolean?  @default(true)
  product_options_sections_fulfillment      Boolean?  @default(true)
  product_options_sections_categories       Boolean?  @default(true)
  product_options_sections_location_availability Boolean? @default(true)
  created_at                                DateTime? @default(now()) @db.Timestamp(6)
  updated_at                                DateTime? @default(now()) @db.Timestamp(6)
  tenants                                   tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade, onUpdate: NoAction, map: "fk_product_options_tenant")

  @@unique([tenant_id, page_type], map: "uq_product_options_tenant_page")
  @@index([tenant_id], map: "idx_product_options_tenant")
  @@index([tenant_id, page_type], map: "idx_product_options_tenant_page")
}
```

### 4.3 `tenant_storefront_options_settings` (RENAMED COLUMNS)

Column renames happen in Phase 2 alongside the product split. The `storefront_opt_enabled` column becomes `storefront_options_enabled`. All merchant preference columns keep their current names (they are already short and group-prefixed in the resolver). Only the feature keys in `features_list` / `tier_features_list` change from `storefront_opt_*` to `storefront_options_*`.

### 4.4 Migration Strategy

**Phase 2 migration approach** (additive, non-breaking):

1. **Add new capability type**: `INSERT INTO capability_type_list (key, name) VALUES ('product_types', 'Product Types')`
2. **Add new feature keys**: Insert all `product_types_*` and `product_options_*` keys into `features_list`
3. **Link features**: Insert into `capability_features_list` linking new keys to their capability types
4. **Seed tier features**: Copy tier assignments from old keys to new keys (same tier matrix)
5. **Create `tenant_product_types_settings` table**
6. **Migrate data**: For each row in `tenant_product_options_settings`, create a corresponding `tenant_product_types_settings` row with the type preference columns
7. **Add new columns** to `tenant_product_options_settings` (additive only — old columns remain)
8. **Keep old columns and feature keys** as backward-compatibility aliases

**Rollback plan**:
- Migration is additive — new tables and columns can be dropped without data loss
- Old feature keys and columns remain intact throughout transition
- Data migration script copies (not moves) type prefs to new table
- Phase 8 cleanup removes old keys/columns only after all code is migrated

---

## 5. Backward Compatibility Aliases

### 5.1 Product Types — Legacy Key Mapping

| Legacy Key | New Key | Alias Duration |
|---|---|---|
| `product_enabled` | `product_types_enabled` | Phase 2–8 |
| `product_disabled` | `product_types_disabled` | Phase 2–8 |
| `product_flexible` | `product_types_flexible` | Phase 2–8 |
| `product_physical` | `product_types_physical` | Phase 2–8 |
| `product_digital` | `product_types_digital` | Phase 2–8 |
| `product_hybrid` | `product_types_hybrid` | Phase 2–8 |
| `product_service` | `product_types_service` | Phase 2–8 |

### 5.2 Product Options — Legacy Key Mapping

| Legacy Key | New Key | Alias Duration |
|---|---|---|
| `product_variant` | `product_options_creation_variants` | Phase 2–8 |
| `product_gallery` | `product_options_creation_gallery` | Phase 2–8 |
| `product_video` | `product_options_creation_video` | Phase 2–8 |
| `product_layout_enabled` | `product_options_layout_enabled` | Phase 2–8 |
| `product_layout_classic` | `product_options_layout_classic` | Phase 2–8 |
| `product_layout_editorial` | `product_options_layout_editorial` | Phase 2–8 |
| `product_layout_immersive` | `product_options_layout_immersive` | Phase 2–8 |
| `product_opt_recently_viewed` | `product_options_sections_recently_viewed` | Phase 2–8 |
| `product_opt_qr_codes` | `product_options_sections_qr_codes` | Phase 2–8 |
| `product_opt_qr_logo` | `product_options_sections_qr_logo` | Phase 2–8 |
| `product_opt_recommended` | `product_options_sections_recommended` | Phase 2–8 |
| `product_opt_map_display` | `product_options_sections_map_display` | Phase 2–8 |
| `product_opt_location_display` | `product_options_sections_location_display` | Phase 2–8 |
| `product_opt_hours_display` | `product_options_sections_hours_display` | Phase 2–8 |
| `product_opt_enhanced_seo` | `product_options_sections_enhanced_seo` | Phase 2–8 |
| `product_opt_reviews` | `product_options_sections_reviews` | Phase 2–8 |
| `product_opt_fulfillment` | `product_options_sections_fulfillment` | Phase 2–8 |
| `product_opt_categories` | `product_options_sections_categories` | Phase 2–8 |
| `product_opt_location_availability` | `product_options_sections_location_availability` | Phase 2–8 |

### 5.3 Storefront Options — Legacy Key Mapping

| Legacy Key | New Key | Alias Duration |
|---|---|---|
| `storefront_opt_enabled` | `storefront_options_enabled` | Phase 2–8 |
| `storefront_opt_disabled` | `storefront_options_disabled` | Phase 2–8 |
| `storefront_opt_flexible` | `storefront_options_flexible` | Phase 2–8 |
| `storefront_opt_hours_enabled` | `storefront_options_hours_enabled` | Phase 2–8 |
| `storefront_opt_hours_disabled` | `storefront_options_hours_disabled` | Phase 2–8 |
| `storefront_opt_hours_animated` | `storefront_options_hours_animated` | Phase 2–8 |
| `storefront_opt_hours_status` | `storefront_options_hours_status` | Phase 2–8 |
| `storefront_opt_category_enabled` | `storefront_options_category_enabled` | Phase 2–8 |
| `storefront_opt_category_disabled` | `storefront_options_category_disabled` | Phase 2–8 |
| `storefront_opt_category_store` | `storefront_options_category_store` | Phase 2–8 |
| `storefront_opt_category_product` | `storefront_options_category_product` | Phase 2–8 |
| `storefront_opt_recommend_enabled` | `storefront_options_recommend_enabled` | Phase 2–8 |
| `storefront_opt_recommend_disabled` | `storefront_options_recommend_disabled` | Phase 2–8 |
| `storefront_opt_recommend_store` | `storefront_options_recommend_store` | Phase 2–8 |
| `storefront_opt_recommend_products` | `storefront_options_recommend_products` | Phase 2–8 |
| `storefront_opt_recently_viewed` | `storefront_options_behavior_recently_viewed` | Phase 2–8 |
| `storefront_opt_info_enabled` | `storefront_options_info_enabled` | Phase 2–8 |
| `storefront_opt_info_disabled` | `storefront_options_info_disabled` | Phase 2–8 |
| `storefront_opt_storefront_social_media` | `storefront_options_info_social_media` | Phase 2–8 |
| `storefront_opt_storefront_contact` | `storefront_options_info_contact` | Phase 2–8 |
| `storefront_opt_interactive_maps` | `storefront_options_info_interactive_maps` | Phase 2–8 |
| `storefront_opt_qr_enabled` | `storefront_options_qr_enabled` | Phase 2–8 |
| `storefront_opt_qr_disabled` | `storefront_options_qr_disabled` | Phase 2–8 |
| `storefront_opt_qr_codes_512` | `storefront_options_qr_codes_512` | Phase 2–8 |
| `storefront_opt_qr_codes_1024` | `storefront_options_qr_codes_1024` | Phase 2–8 |
| `storefront_opt_qr_codes_2048` | `storefront_options_qr_codes_2048` | Phase 2–8 |
| `storefront_opt_qr_product` | `storefront_options_qr_product` | Phase 2–8 |
| `storefront_opt_qr_store` | `storefront_options_qr_store` | Phase 2–8 |
| `storefront_opt_qr_logo` | `storefront_options_qr_logo` | Phase 2–8 |
| `storefront_opt_qr_directory` | `storefront_options_qr_directory` | Phase 2–8 |
| `storefront_opt_gallery_enabled` | `storefront_options_gallery_enabled` | Phase 2–8 |
| `storefront_opt_gallery_disabled` | `storefront_options_gallery_disabled` | Phase 2–8 |
| `storefront_opt_image_gallery_5` | `storefront_options_gallery_5` | Phase 2–8 |
| `storefront_opt_image_gallery_10` | `storefront_options_gallery_10` | Phase 2–8 |
| `storefront_opt_image_gallery_15` | `storefront_options_gallery_15` | Phase 2–8 |
| `storefront_opt_advanced_enabled` | `storefront_options_advanced_enabled` | Phase 2–8 |
| `storefront_opt_advanced_disabled` | `storefront_options_advanced_disabled` | Phase 2–8 |
| `storefront_opt_enhanced_seo` | `storefront_options_advanced_enhanced_seo` | Phase 2–8 |
| `storefront_opt_storefront_actions` | `storefront_options_advanced_actions` | Phase 2–8 |
| `storefront_opt_layout_enabled` | `storefront_options_layout_enabled` | Phase 2–8 |
| `storefront_opt_layout_disabled` | `storefront_options_layout_disabled` | Phase 2–8 |
| `storefront_opt_layout_classic` | `storefront_options_layout_classic` | Phase 2–8 |
| `storefront_opt_layout_editorial` | `storefront_options_layout_editorial` | Phase 2–8 |
| `storefront_opt_layout_immersive` | `storefront_options_layout_immersive` | Phase 2–8 |
| `storefront_opt_hours_display` | `storefront_options_hours_display` | Phase 2–8 |
| `storefront_opt_map_display` | `storefront_options_map_display` | Phase 2–8 |
| `storefront_opt_location_display` | `storefront_options_location_display` | Phase 2–8 |

### 5.4 Alias Implementation Strategy

During the transition period (Phase 2–8):

1. **Database**: Both old and new feature keys exist in `features_list` and `tier_features_list`. Both are linked to their respective capability types. Tier assignments are duplicated.
2. **Backend services**: `ProductOptionsService` and `ProductTypeService` query by `capability_type_id` (not by prefix). During transition, the service reads from the new capability type but falls back to old keys if new capability type has no features.
3. **Backend resolvers**: Resolvers check new keys first, then fall back to old keys:
   ```ts
   const enabled = !!features.product_types_enabled || !!features.product_enabled;
   const flexible = !!features.product_types_flexible || !!features.product_flexible;
   ```
4. **Frontend**: `UnifiedCapabilityService` maps from the new backend output shape. `CapabilityResolutionService` fallback resolvers also check both old and new keys.
5. **Phase 8 cleanup**: Remove old keys from `features_list` and `tier_features_list`. Remove fallback logic from resolvers. Remove old columns from settings tables.

---

## 6. Backend Architecture

### 6.1 New Files

| File | Purpose |
|---|---|
| `apps/api/src/services/resolvers/ProductTypeResolver.ts` | Pure resolver: `resolveProductType(features, merchantPrefs) → EffectiveProductType` |
| `apps/api/src/services/ProductTypeService.ts` | Singleton service: fetches tier features for `product_types`, calls resolver |
| `apps/api/src/routes/product-type-settings.ts` | GET/PUT API route for product type settings |

### 6.2 Modified Files

| File | Changes |
|---|---|
| `apps/api/src/services/resolvers/ProductOptionsResolver.ts` | Remove type resolution. Add group gates (creation, layout, sections). Use new feature key names with fallback to old. |
| `apps/api/src/services/resolvers/StorefrontOptionsResolver.ts` | Rename all `storefront_opt_*` references to `storefront_options_*` with fallback. |
| `apps/api/src/services/resolvers/types.ts` | Add `EffectiveProductType`, `ProductTypeMerchantSettings`. Refactor `EffectiveProductOptions` to group-based. Add `ProductTypeMerchantSettings` to `MerchantSettingsBundle`. |
| `apps/api/src/services/ProductOptionsService.ts` | Remove type resolution. Query `product_options` capability type only. Add group-gate logic. |
| `apps/api/src/services/StorefrontOptionsService.ts` | Update feature key references. |
| `apps/api/src/routes/product-options-settings.ts` | Remove type gating. Add group-gated validation. Use new feature keys. |
| `apps/api/src/routes/storefront-options-settings.ts` | Update feature key references. |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Add `product_types` to the resolver dispatch. Pass `merchantBundle.productTypes` to `ProductTypeResolver`. |
| `apps/api/src/routes/tenant-capabilities.ts` | Add `product_types` to `buildExpiredCapabilitiesResponse`. |

### 6.3 Resolver Output Contracts

#### `EffectiveProductType` (NEW)

```ts
export type ProductTypeValue = 'physical' | 'digital' | 'hybrid' | 'service' | 'flexible' | 'none';

export interface EffectiveProductType {
  enabled: boolean;
  type: ProductTypeValue;
  effective_type: ProductTypeValue;
  is_flexible: boolean;
  allowed_types: ProductTypeValue[];
  has_merchant_selection: boolean;
  merchant_preferences: {
    product_types_enabled: boolean;
    selected_product_type: ProductTypeValue;
  };
}
```

Mirrors `EffectiveStorefront` exactly.

#### `EffectiveProductOptions` (REFACTORED)

```ts
export type ProductOptCreationType = 'creation_variants' | 'creation_gallery' | 'creation_video';
export type ProductOptLayoutType = 'classic' | 'editorial' | 'immersive';
export type ProductOptSectionType =
  | 'sections_recently_viewed' | 'sections_qr_codes' | 'sections_qr_logo'
  | 'sections_recommended' | 'sections_map_display' | 'sections_location_display'
  | 'sections_hours_display' | 'sections_enhanced_seo' | 'sections_reviews'
  | 'sections_fulfillment' | 'sections_categories' | 'sections_location_availability';

export interface EffectiveProductOptions {
  enabled: boolean;
  is_flexible: boolean;
  // Creation group
  creation_enabled: boolean;
  allowed_creation_types: ProductOptCreationType[];
  effective_creation_types: ProductOptCreationType[];
  can_use_creation_variants: boolean;
  can_use_creation_gallery: boolean;
  can_use_creation_video: boolean;
  // Layout group
  layout_enabled: boolean;
  allowed_layouts: ProductOptLayoutType[];
  effective_layout: ProductOptLayoutType;
  can_use_layout_classic: boolean;
  can_use_layout_editorial: boolean;
  can_use_layout_immersive: boolean;
  // Sections group
  sections_enabled: boolean;
  allowed_section_types: ProductOptSectionType[];
  effective_section_types: ProductOptSectionType[];
  can_use_sections_recently_viewed: boolean;
  can_use_sections_qr_codes: boolean;
  can_use_sections_qr_logo: boolean;
  can_use_sections_recommended: boolean;
  can_use_sections_map_display: boolean;
  can_use_sections_location_display: boolean;
  can_use_sections_hours_display: boolean;
  can_use_sections_enhanced_seo: boolean;
  can_use_sections_reviews: boolean;
  can_use_sections_fulfillment: boolean;
  can_use_sections_categories: boolean;
  can_use_sections_location_availability: boolean;
  merchant_preferences: Record<string, any>;
}
```

Mirrors `EffectiveStorefrontOptions` group-based structure.

### 6.4 Merchant Settings Types

```ts
export interface ProductTypeMerchantSettings {
  product_types_enabled?: boolean | null;
  selected_product_type?: string | null;
}

export interface ProductOptionsMerchantSettings {
  product_options_enabled?: boolean | null;
  // Creation
  creation_variants?: boolean | null;
  creation_gallery?: boolean | null;
  creation_video?: boolean | null;
  // Layout
  product_layout?: string | null;
  // Sections
  sections_recently_viewed?: boolean | null;
  sections_qr_codes?: boolean | null;
  sections_qr_logo?: boolean | null;
  sections_recommended?: boolean | null;
  sections_map_display?: boolean | null;
  sections_location_display?: boolean | null;
  sections_hours_display?: boolean | null;
  sections_enhanced_seo?: boolean | null;
  sections_reviews?: boolean | null;
  sections_fulfillment?: boolean | null;
  sections_categories?: boolean | null;
  sections_location_availability?: boolean | null;
}
```

### 6.5 `MerchantSettingsBundle` Update

Add `productTypes` to the bundle:

```ts
export interface MerchantSettingsBundle {
  // ... existing fields ...
  productTypes: ProductTypeMerchantSettings | null;  // NEW
  productOptions: ProductOptionsMerchantSettings | null;  // REFACTORED (was productOptions)
  // ... rest ...
}
```

### 6.6 `EffectiveCapabilities` Update

Add `product_types` to the effective manifest:

```ts
export interface EffectiveCapabilities {
  // ...
  effective: {
    // ... existing ...
    product_types: EffectiveProductType;  // NEW
    product_options: EffectiveProductOptions;  // REFACTORED
    // ... rest ...
  };
  // ...
}
```

---

## 7. Frontend Architecture

### 7.1 New Files

| File | Purpose |
|---|---|
| `apps/web/src/app/t/[tenantId]/settings/product-types/ProductTypesSettingsClient.tsx` | Settings page for product types |

### 7.2 Modified Files

| File | Changes |
|---|---|
| `apps/web/src/services/CapabilityResolutionService.ts` | Add `ProductTypeState`, `resolveProductTypeState`. Refactor `ProductOptionsState` to group-based. Update `resolveProductOptionsState`. |
| `apps/web/src/services/UnifiedCapabilityService.ts` | Add `BackendEffectiveProductType`, `mapProductType`. Refactor `mapProductOptions`. Add `getProductTypeState`. |
| `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | Add `useProductTypesCapability` hook. |
| `apps/web/src/app/t/[tenantId]/settings/product-options/ProductOptionsSettingsClient.tsx` | Remove type toggles. Use group-based rendering. |
| `apps/web/src/app/t/[tenantId]/settings/storefront-options/StorefrontOptionsSettingsClient.tsx` | Update feature key references. |
| `apps/web/src/components/settings/PlanSummaryPanel.tsx` | Add `product_types` capability display. |
| `apps/web/src/components/dashboard/CapabilityShowcase.tsx` | Add `product_types` row. |

### 7.3 Frontend State Shapes

#### `ProductTypeState` (NEW)

```ts
export interface ProductTypeState {
  enabled: boolean;
  type: ProductTypeValue;
  effectiveType: ProductTypeValue;
  isFlexible: boolean;
  allowedTypes: ProductTypeValue[];
  hasMerchantSelection: boolean;
  merchantPreferences: {
    productTypesEnabled: boolean;
    selectedProductType: ProductTypeValue;
  } | null;
}
```

#### `ProductOptionsState` (REFACTORED)

```ts
export interface ProductOptionsState {
  enabled: boolean;
  isFlexible: boolean;
  // Creation group
  creationEnabled: boolean;
  allowedCreationTypes: string[];
  effectiveCreationTypes: string[];
  canUseCreationVariants: boolean;
  canUseCreationGallery: boolean;
  canUseCreationVideo: boolean;
  // Layout group
  layoutEnabled: boolean;
  allowedLayouts: string[];
  effectiveLayout: string;
  canUseLayoutClassic: boolean;
  canUseLayoutEditorial: boolean;
  canUseLayoutImmersive: boolean;
  // Sections group
  sectionsEnabled: boolean;
  allowedSectionTypes: string[];
  effectiveSectionTypes: string[];
  canUseSectionsRecentlyViewed: boolean;
  canUseSectionsQrCodes: boolean;
  canUseSectionsQrLogo: boolean;
  canUseSectionsRecommended: boolean;
  canUseSectionsMapDisplay: boolean;
  canUseSectionsLocationDisplay: boolean;
  canUseSectionsHoursDisplay: boolean;
  canUseSectionsEnhancedSeo: boolean;
  canUseSectionsReviews: boolean;
  canUseSectionsFulfillment: boolean;
  canUseSectionsCategories: boolean;
  canUseSectionsLocationAvailability: boolean;
  merchantPreferences: Record<string, any> | null;
}
```

---

## 8. Tier Feature Matrix

### 8.1 Product Types — Tier Assignments

Mirrors the current product type tier gating (extracted from existing `product_options` tier features):

| Tier | physical | digital | hybrid | service | flexible |
|---|---|---|---|---|---|
| starter | ✓ | ✓ | — | — | — |
| discovery | ✓ | ✓ | — | — | — |
| storefront | ✓ | ✓ | — | — | — |
| commitment | ✓ | ✓ | ✓ | — | — |
| ecommerce | ✓ | ✓ | ✓ | ✓ | — |
| omnichannel | ✓ | ✓ | ✓ | ✓ | — |
| professional | ✓ | ✓ | ✓ | ✓ | ✓ |
| enterprise | ✓ | ✓ | ✓ | ✓ | ✓ |
| google_only | — | — | — | — | — |
| organization | ✓ | ✓ | ✓ | ✓ | ✓ |
| chain_starter | ✓ | ✓ | — | — | — |
| chain_professional | ✓ | ✓ | ✓ | ✓ | ✓ |
| chain_enterprise | ✓ | ✓ | ✓ | ✓ | ✓ |
| trial_* | mirrors base | | | | |
| expired_trial | — | — | — | — | — |

### 8.2 Product Options — Tier Assignments

| Tier | creation group | layout group | sections group | flexible |
|---|---|---|---|---|
| starter | variants, gallery | classic | all sections | — |
| discovery | variants, gallery | classic | all sections | — |
| storefront | variants, gallery | classic | all sections | — |
| commitment | variants, gallery, video | classic, editorial | all sections | — |
| ecommerce | variants, gallery, video | classic, editorial, immersive | all sections | — |
| omnichannel | variants, gallery, video | classic, editorial, immersive | all sections | — |
| professional | all | all | all | ✓ |
| enterprise | all | all | all | ✓ |
| google_only | — | — | — | — |
| organization | all | all | all | ✓ |
| chain_starter | variants, gallery | classic | all sections | — |
| chain_professional | all | all | all | ✓ |
| chain_enterprise | all | all | all | ✓ |
| trial_* | mirrors base | | | |
| expired_trial | — | — | — | — |

---

## 9. API Route Design

### 9.1 `product-type-settings.ts` (NEW)

```
GET  /api/settings/:tenantId/product-types     → { success, settings, tierState }
PUT  /api/settings/:tenantId/product-types     → validates + persists + invalidates cache
```

**Settings shape**:
```json
{
  "product_types_enabled": true,
  "selected_product_type": "physical"
}
```

**Tier state**: `EffectiveProductType`

### 9.2 `product-options-settings.ts` (REFACTORED)

```
GET  /api/settings/:tenantId/product-options   → { success, settings, tierState }
PUT  /api/settings/:tenantId/product-options   → validates + persists + invalidates cache
```

**Settings shape** (group-based):
```json
{
  "product_options_enabled": true,
  "creation_variants": true,
  "creation_gallery": true,
  "creation_video": false,
  "product_layout": "classic",
  "sections_recently_viewed": true,
  "sections_qr_codes": true,
  "sections_qr_logo": true,
  "sections_recommended": true,
  "sections_map_display": true,
  "sections_location_display": true,
  "sections_hours_display": true,
  "sections_enhanced_seo": true,
  "sections_reviews": true,
  "sections_fulfillment": true,
  "sections_categories": true,
  "sections_location_availability": true
}
```

**Tier state**: `EffectiveProductOptions`

### 9.3 Route Registration

Add to `apps/api/src/index.ts`:
```ts
app.use('/api/settings', productTypeSettingsRouter);
```

Existing `product-options-settings` route remains registered (updated in place).

---

## 10. Side-by-Side Architecture Comparison

### After Phase 1–8 Completion

| Layer | Storefront Types | Storefront Options | Product Types | Product Options |
|---|---|---|---|---|
| Capability key | `storefront_types` | `storefront_options` | `product_types` | `product_options` |
| Feature prefix | `storefront_` | `storefront_options_` | `product_types_` | `product_options_` |
| Resolver | `StorefrontTypeResolver` | `StorefrontOptionsResolver` | `ProductTypeResolver` | `ProductOptionsResolver` |
| Service | `StorefrontTypeService` | `StorefrontOptionsService` | `ProductTypeService` | `ProductOptionsService` |
| API route | `/storefront-type` | `/storefront-options` | `/product-types` | `/product-options` |
| Settings table | `tenant_storefront_type_settings` | `tenant_storefront_options_settings` | `tenant_product_types_settings` | `tenant_product_options_settings` |
| Frontend state | `StorefrontState` | `StorefrontOptionsState` | `ProductTypeState` | `ProductOptionsState` |
| Settings page | `storefront-type` | `storefront-options` | `product-types` | `product-options` |
| Group gates | N/A (types) | hours, category, recommend, info, qr, gallery, advanced, layout | N/A (types) | creation, layout, sections |
| Master toggle | `storefront_type_enabled` | `storefront_options_enabled` | `product_types_enabled` | `product_options_enabled` |
| Flexible flag | `storefront_flexible` | `storefront_options_flexible` | `product_types_flexible` | `product_options_flexible` |
| Merchant selection | `selected_storefront_type` | `storefront_layout` | `selected_product_type` | `product_layout` |

Both families now follow identical patterns. Adding a new product page section is as simple as:
1. Add `product_options_sections_<new_section>` to `features_list`
2. Link to `product_options` capability type
3. Seed tier assignments
4. Add to `ProductOptSectionType` union
5. Resolver automatically picks it up via group gate pattern

---

## 11. Phase 2 Readiness Checklist

Before starting Phase 2 (Database Migration), verify:

- [ ] This document is reviewed and approved
- [ ] Tier feature matrix (§8) matches current production tier assignments
- [ ] No new product features are planned that would conflict with the group structure
- [ ] Skill documents are updated with canonical rules (§12)
- [ ] Rollback strategy is understood

---

## 12. Skill Document Updates

The following skill documents require updates to reflect the canonical rules established in this document:

1. **`capability-data-flow-rules.md`** — Add rules R14 (one capability = one concern), R15 (feature key naming convention), R16 (group gates required for options capabilities), R17 (enablement precedence canonical order)
2. **`capability-deployment-flow.md`** — Add note about types/options split pattern, update table mapping to include `product_types` / `tenant_product_types_settings`

These updates are part of the Phase 1 deliverable and will be applied to the skill files.
