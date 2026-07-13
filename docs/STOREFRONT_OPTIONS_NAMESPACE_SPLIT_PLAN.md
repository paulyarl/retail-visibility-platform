# Storefront Options Namespace Split Plan

## 1. Problem Statement

The `storefront_options` capability type has grown to **71 feature keys** spanning 6 distinct functional sub-domains. The resolver (`StorefrontOptionsResolver.ts`) **already handles each sub-domain as a separate logical block** — the only friction is that all feature keys share the `storefront_opt_*` prefix and are assigned to a single `storefront_options` capability type in the database.

This creates:
- **Admin UI congestion** — one capability type panel showing 71 toggle rows
- **Tier assignment complexity** — admins scroll through unrelated features
- **BSaaS catalog clutter** — à la carte purchases mixed across domains in one capability type
- **Surface misalignment** — every surface that reads `storefront_options` must parse all 71 keys

**The good news**: the resolver logic is already split. The migration is primarily a database feature key renaming + capability type assignment exercise, with surfaces updated to consume the new domain structure.

## 2. Naming Convention

Following the precedent of `storefront_types` (capability type `storefront_types`, feature keys `storefront`, `storefront_enabled`, `storefront_online`, `storefront_flexible` — no `_opt_` prefix):

| Scope | Prefix | Capability Type Key | Example |
|-------|--------|---------------------|---------|
| **Core** (stays) | `storefront_opt_` | `storefront_options` | `storefront_opt_enabled`, `storefront_opt_flexible` |
| **QR Code** | `storefront_qr_` | `storefront_qr` | `storefront_qr_enabled`, `storefront_qr_styled` |
| **Layouts** | `storefront_layout_` | `storefront_layouts` | `storefront_layout_classic`, `storefront_layout_editorial` |
| **Gallery** | `storefront_gallery_` | `storefront_gallery` | `storefront_gallery_enabled`, `storefront_gallery_magazine` |
| **Maps** | `storefront_maps_` | `storefront_maps` | `storefront_maps_interactive`, `storefront_maps_display` |
| **Hours** | `storefront_hours_` | `storefront_hours` | `storefront_hours_display`, `storefront_hours_animated` |

**Rule**: `storefront_opt_*` is strictly for the core storefront options that don't belong to a spun-off sub-domain. All sub-domains use their own `storefront_<domain>_*` prefix within the storefront sphere — same pattern as `storefront_type_*`.

## 3. Domain Key Pattern (applies to every new main domain)

Each new main domain follows the **same 4-tier key pattern** as existing capability types (`commerce`, `storefront_types`, `product_types`, etc.):

| Tier | Suffix | Purpose | Example |
|------|--------|---------|---------|
| **Flexible** | `_flexible` | Unlocks all features in the domain | `storefront_qr_flexible` |
| **Gate** | `_enabled` / `_disabled` | Master on/off for the domain | `storefront_qr_enabled`, `storefront_qr_disabled` |
| **Group** | `_on` / `_off` | Sub-group within the domain | `storefront_qr_styled_on`, `storefront_qr_styled_off` |
| **Individual** | (specific name) | Single feature toggle | `storefront_qr_dot_rounded`, `storefront_qr_custom_colors` |

Every new domain gets **all 4 tiers** where applicable. Not all domains have sub-groups, but all get `_flexible`, `_enabled`/`_disabled`, and individual keys.

## 4. Current Feature Inventory & New Key Mapping (71 features)

### 4.1 Core (stays as `storefront_opt_*`) — 21 features

| # | Current Key | Name | Notes |
|---|-------------|------|-------|
| 1 | `storefront_opt_enabled` | Storefront Options Enabled | Master gate |
| 2 | `storefront_opt_disabled` | Storefront Options Disabled | Master disable gate |
| 3 | `storefront_opt_flexible` | Storefront Options Flexible | Flexible tier — unlocks all |
| 4 | `storefront_opt_advanced_enabled` | Advanced Group Enabled | Group gate |
| 5 | `storefront_opt_advanced_on` | Advanced Group On | Group on gate |
| 6 | `storefront_opt_enhanced_seo` | Enhanced SEO | Advanced feature |
| 7 | `storefront_opt_storefront_actions` | Storefront Actions | Advanced feature |
| 8 | `storefront_opt_category_enabled` | Category Group Enabled | Group gate |
| 9 | `storefront_opt_category_on` | Category Group On | Group on gate |
| 10 | `storefront_opt_category_product` | Product Categories | Category feature |
| 11 | `storefront_opt_category_store` | Store Categories | Category feature |
| 12 | `storefront_opt_recommend_enabled` | Recommend Group Enabled | Group gate |
| 13 | `storefront_opt_recommend_on` | Recommend Group On | Group on gate |
| 14 | `storefront_opt_recommend_products` | Product Recommendations | Recommend feature |
| 15 | `storefront_opt_recommend_store` | Store Recommendations | Recommend feature |
| 16 | `storefront_opt_recently_viewed` | Recently Viewed | Behavior feature |
| 17 | `storefront_opt_info` | Store Information | Consolidated: social media + contact |
| 18 | `storefront_opt_info_enabled` | Info Group Enabled | Group gate |
| 19 | `storefront_opt_info_on` | Info Group On | Group on gate |
| 20 | `storefront_opt_storefront_contact` | Contact Info | Info feature |
| 21 | `storefront_opt_storefront_social_media` | Social Media Links | Info feature |

> **Note**: After the split, `storefront_opt_info` no longer covers maps/location (those move to `storefront_maps_*`). The core resolver must be updated to reflect this.

### 4.2 QR Code (→ `storefront_qr_*`) — 34 features (31 existing + 3 new domain keys)

The QR domain has two sub-modes: **Classic QR** (basic generation) and **Styled QR** (custom dot/corner styles, colors, gradients).

| # | Current Key | New Key | Name | Tier |
|---|-------------|---------|------|------|
| 1 | — | `storefront_qr_flexible` | QR Code Flexible | Flexible |
| 2 | — | `storefront_qr_enabled` | QR Code Enabled | Gate |
| 3 | — | `storefront_qr_disabled` | QR Code Disabled | Gate |
| 4 | `storefront_opt_qr` | `storefront_qr` | QR Code Display | Individual |
| 5 | `storefront_opt_qr_on` | `storefront_qr_on` | QR Group On | Group |
| 6 | `storefront_opt_qr_resolution` | `storefront_qr_resolution` | QR Resolution | Individual |
| 7 | `storefront_opt_qr_codes_512` | `storefront_qr_resolution_512` | QR 512px Resolution | Individual |
| 8 | `storefront_opt_qr_codes_1024` | `storefront_qr_resolution_1024` | QR 1024px Resolution | Individual |
| 9 | `storefront_opt_qr_codes_2048` | `storefront_qr_resolution_2048` | QR 2048px Resolution | Individual |
| 10 | `storefront_opt_qr_content` | `storefront_qr_content` | QR Content Types | Individual |
| 11 | `storefront_opt_qr_product` | `storefront_qr_product` | Product QR | Individual |
| 12 | `storefront_opt_qr_store` | `storefront_qr_store` | Store QR | Individual |
| 13 | `storefront_opt_qr_logo` | `storefront_qr_logo` | Logo QR | Individual |
| 14 | `storefront_opt_qr_directory` | `storefront_qr_directory` | Directory QR | Individual |
| — | — | **Classic QR sub-group** | | |
| 15 | — | `storefront_qr_classic` | Classic QR Renderer | Individual (new — explicit classic mode) |
| 16 | — | `storefront_qr_classic_on` | Classic QR (On) | Group (new) |
| — | — | **Styled QR sub-group** | | |
| 17 | `storefront_opt_qr_styled` | `storefront_qr_styled` | QR Styled Renderer | Individual |
| 18 | `storefront_opt_qr_styled_on` | `storefront_qr_styled_on` | QR Styled (On) | Group |
| 19 | `storefront_opt_qr_styled_off` | `storefront_qr_styled_off` | QR Styled (Off) | Group |
| 20 | `storefront_opt_qr_styled_enabled` | `storefront_qr_styled_enabled` | QR Styled (Legacy Enabled) | Group |
| 21 | `storefront_opt_qr_styled_disabled` | `storefront_qr_styled_disabled` | QR Styled (Disabled) | Group |
| 22 | `storefront_opt_qr_dot_styles` | `storefront_qr_dot_styles` | QR Dot Styles (All) | Sub-group |
| 23 | `storefront_opt_qr_dot_styles_on` | `storefront_qr_dot_styles_on` | QR Dot Styles (On) | Sub-group |
| 24 | `storefront_opt_qr_dot_rounded` | `storefront_qr_dot_rounded` | QR Dot: Rounded | Individual |
| 25 | `storefront_opt_qr_dot_dots` | `storefront_qr_dot_dots` | QR Dot: Dots | Individual |
| 26 | `storefront_opt_qr_dot_classy` | `storefront_qr_dot_classy` | QR Dot: Classy | Individual |
| 27 | `storefront_opt_qr_dot_classy_rounded` | `storefront_qr_dot_classy_rounded` | QR Dot: Classy Rounded | Individual |
| 28 | `storefront_opt_qr_dot_extra_rounded` | `storefront_qr_dot_extra_rounded` | QR Dot: Extra Rounded | Individual |
| 29 | `storefront_opt_qr_corner_styles` | `storefront_qr_corner_styles` | QR Corner Styles (All) | Sub-group |
| 30 | `storefront_opt_qr_corner_styles_on` | `storefront_qr_corner_styles_on` | QR Corner Styles (On) | Sub-group |
| 31 | `storefront_opt_qr_corner_dot` | `storefront_qr_corner_dot` | QR Corner: Dot | Individual |
| 32 | `storefront_opt_qr_corner_extra_rounded` | `storefront_qr_corner_extra_rounded` | QR Corner: Extra Rounded | Individual |
| 33 | `storefront_opt_qr_corner_rounded` | `storefront_qr_corner_rounded` | QR Corner: Rounded | Individual |
| 34 | `storefront_opt_qr_custom_colors` | `storefront_qr_custom_colors` | QR Custom Colors | Individual |
| 35 | `storefront_opt_qr_gradients` | `storefront_qr_gradients` | QR Gradients | Individual |

> **New keys** (not in current 71): `storefront_qr_flexible`, `storefront_qr_enabled`, `storefront_qr_disabled` (domain-level gates), `storefront_qr_classic`, `storefront_qr_classic_on` (explicit classic QR sub-group to parallel styled QR).

### 4.3 Storefront Gallery (→ `storefront_gallery_*`) — 11 features (7 existing + 4 new domain keys)

The Gallery domain has two display modes: **Carousel Gallery** (default, one image at a time) and **Magazine Gallery** (mosaic, all images at once).

| # | Current Key | New Key | Name | Tier |
|---|-------------|---------|------|------|
| 1 | — | `storefront_gallery_flexible` | Gallery Flexible | Flexible |
| 2 | — | `storefront_gallery_enabled` | Gallery Enabled | Gate |
| 3 | — | `storefront_gallery_disabled` | Gallery Disabled | Gate |
| 4 | `storefront_opt_gallery` | `storefront_gallery` | Gallery Display | Individual |
| 5 | `storefront_opt_gallery_on` | `storefront_gallery_on` | Gallery Group On | Group |
| 6 | `storefront_opt_image_gallery_5` | `storefront_gallery_limit_5` | 5 Image Gallery | Individual |
| 7 | `storefront_opt_image_gallery_10` | `storefront_gallery_limit_10` | 10 Image Gallery | Individual |
| 8 | `storefront_opt_image_gallery_15` | `storefront_gallery_limit_15` | 15 Image Gallery | Individual |
| — | — | **Carousel sub-group** | | |
| 9 | — | `storefront_gallery_carousel` | Carousel Gallery | Individual (new — explicit carousel mode) |
| 10 | — | `storefront_gallery_carousel_on` | Carousel Gallery (On) | Group (new) |
| — | — | **Magazine sub-group** | | |
| 11 | `storefront_opt_gallery_magazine` | `storefront_gallery_magazine` | Magazine Gallery | Individual |
| 12 | — | `storefront_gallery_magazine_on` | Magazine Gallery (On) | Group (new) |

> **New keys**: `storefront_gallery_flexible`, `storefront_gallery_enabled`, `storefront_gallery_disabled` (domain gates), `storefront_gallery_carousel`, `storefront_gallery_carousel_on`, `storefront_gallery_magazine_on` (explicit carousel/magazine sub-groups).

### 4.4 Storefront Hours (→ `storefront_hours_*`) — 8 features (5 existing + 3 new domain keys)

| # | Current Key | New Key | Name | Tier |
|---|-------------|---------|------|------|
| 1 | — | `storefront_hours_flexible` | Hours Flexible | Flexible |
| 2 | — | `storefront_hours_enabled` | Hours Enabled | Gate |
| 3 | — | `storefront_hours_disabled` | Hours Disabled | Gate |
| 4 | `storefront_opt_hours_display` | `storefront_hours_display` | Hours Display | Individual |
| 5 | `storefront_opt_hours_on` | `storefront_hours_on` | Hours Group On | Group |
| 6 | `storefront_opt_hours_animated` | `storefront_hours_animated` | Animated Hours | Individual |
| 7 | `storefront_opt_hours_status` | `storefront_hours_status` | Hours Status | Individual |

### 4.5 Storefront Layouts (→ `storefront_layout_*`) — 7 features (4 existing + 3 new domain keys)

| # | Current Key | New Key | Name | Tier |
|---|-------------|---------|------|------|
| 1 | — | `storefront_layout_flexible` | Layout Flexible | Flexible |
| 2 | — | `storefront_layout_enabled` | Layout Enabled | Gate |
| 3 | — | `storefront_layout_disabled` | Layout Disabled | Gate |
| 4 | `storefront_opt_layout` | `storefront_layout` | Storefront Layout | Individual |
| 5 | `storefront_opt_layout_classic` | `storefront_layout_classic` | Classic Layout | Individual |
| 6 | `storefront_opt_layout_editorial` | `storefront_layout_editorial` | Editorial Layout | Individual |
| 7 | `storefront_opt_layout_immersive` | `storefront_layout_immersive` | Immersive Layout | Individual |

### 4.6 Storefront Maps (→ `storefront_maps_*`) — 6 features (3 existing + 3 new domain keys)

| # | Current Key | New Key | Name | Tier |
|---|-------------|---------|------|------|
| 1 | — | `storefront_maps_flexible` | Maps Flexible | Flexible |
| 2 | — | `storefront_maps_enabled` | Maps Enabled | Gate |
| 3 | — | `storefront_maps_disabled` | Maps Disabled | Gate |
| 4 | `storefront_opt_interactive_maps` | `storefront_maps_interactive` | Interactive Maps | Individual |
| 5 | `storefront_opt_map_display` | `storefront_maps_display` | Map Display | Individual |
| 6 | `storefront_opt_location_display` | `storefront_maps_location` | Location Display | Individual |

### 4.7 Summary

| Domain | Existing Features | New Domain Keys | Total | Capability Type | Prefix |
|--------|-------------------|-----------------|-------|-----------------|--------|
| Core | 21 | 0 | 21 | `storefront_options` (existing) | `storefront_opt_` |
| QR Code | 31 | 5 | 36 | `storefront_qr` (new) | `storefront_qr_` |
| Gallery | 7 | 5 | 12 | `storefront_gallery` (new) | `storefront_gallery_` |
| Hours | 5 | 3 | 8 | `storefront_hours` (new) | `storefront_hours_` |
| Layouts | 4 | 3 | 7 | `storefront_layouts` (new) | `storefront_layout_` |
| Maps | 3 | 3 | 6 | `storefront_maps` (new) | `storefront_maps_` |
| **Total** | **71** | **19** | **90** | **6 capability types** | |

## 5. Migration Strategy

**Approach**: ADDITIVE and NON-BREAKING — identical to the `057_product_types_capability_split.sql` precedent.

### 5.1 Principles

1. **Old feature keys remain intact** in `features_list` and `tier_features_list` — no deletions
2. **New feature keys are added alongside old ones** — resolvers check new keys first, then fall back to old
3. **New capability types are created** and linked to the new feature keys
4. **Tier assignments are copied** from old keys to new keys
5. **Old `storefront_opt_*` keys are unlinked** from `storefront_options` capability type (removed from `capability_features_list`) but remain in `features_list` for backward compatibility
6. **Resolver logic is extracted** from `StorefrontOptionsResolver.ts` into 5 new resolver files — the logic already exists, it's a move + key rename
7. **All surfaces are aligned** to consume the new domain structure (see §8)

### 5.2 Phase Order

Ordered by **highest congestion first** (QR = 31 features) for maximum Admin UI relief:

1. **Phase 1**: QR Code (`storefront_qr`) — 36 features → biggest impact
2. **Phase 2**: Gallery (`storefront_gallery`) — 12 features
3. **Phase 3**: Hours (`storefront_hours`) — 8 features
4. **Phase 4**: Layouts (`storefront_layouts`) — 7 features
5. **Phase 5**: Maps (`storefront_maps`) — 6 features
6. **Phase 6**: Core cleanup + surface alignment finalization

Each phase is independently deployable. The system remains functional after each phase because resolvers fall back to old keys.

## 6. Database Migration Plan (per phase)

Each phase follows the same 7-step migration template (modeled after `057_product_types_capability_split.sql`):

### Step 1: Insert new feature keys into `features_list`

Insert all new `storefront_<domain>_*` keys — including the new `_flexible`, `_enabled`, `_disabled` domain gates and any new sub-group keys (e.g., `storefront_qr_classic`, `storefront_gallery_carousel`) — with `category = 'storefront_<domain>'`, appropriate `sort_order`, and `ON CONFLICT (key) DO UPDATE`.

### Step 2: Create new capability type in `capability_type_list`

```sql
INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'storefront_qr',
  'Storefront QR Code',
  'QR code generation, styling, and content types for storefront.',
  'storefront_qr',
  true,
  <next_sort_order>,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET ...;
```

### Step 3: Link new feature keys to new capability type

Use the `DO $$ ... END $$` block pattern from `057` to insert into `capability_features_list` with `sort_order` and `ON CONFLICT DO UPDATE`.

### Step 4: Copy tier assignments from old keys to new keys

For each new feature key, find all tiers that have the corresponding old `storefront_opt_*` key enabled in `tier_features_list`, and insert the new key for those same tiers. Also assign the new `_flexible`, `_enabled`, `_disabled` domain gates based on the old `storefront_opt_flexible` / `storefront_opt_enabled` / `storefront_opt_disabled` assignments.

```sql
-- Domain gates: copy from storefront_opt master gates
INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
SELECT gen_random_uuid()::text, tfl.tier_id, v_cap_type_id, 'storefront_qr_enabled', 'QR Code Enabled', true, false, '{"capability_type": "storefront_qr"}'
FROM tier_features_list tfl
WHERE tfl.feature_key = 'storefront_opt_qr_enabled' AND tfl.is_enabled = true
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- Individual keys: copy from old storefront_opt_qr_* keys
INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
SELECT gen_random_uuid()::text, tfl.tier_id, v_cap_type_id, 'storefront_qr_styled', 'QR Styled Renderer', true, false, '{"capability_type": "storefront_qr"}'
FROM tier_features_list tfl
WHERE tfl.feature_key = 'storefront_opt_qr_styled' AND tfl.is_enabled = true
ON CONFLICT (tier_id, feature_key) DO NOTHING;
```

### Step 5: Unlink old keys from `storefront_options` capability type

Remove the old migrated feature keys from `capability_features_list` for the `storefront_options` capability type. This cleans up the Admin UI. The old keys remain in `features_list` and `tier_features_list` for backward compatibility.

```sql
DELETE FROM capability_features_list
WHERE capability_type_id = (SELECT id FROM capability_type_list WHERE key = 'storefront_options')
  AND feature_id IN (SELECT id FROM features_list WHERE key LIKE 'storefront_opt_qr%');
```

### Step 6: Update BSaaS catalog entries

For any `bsaas_catalog` entries that reference old `storefront_opt_*` keys being migrated, add duplicate entries with the new key names. Old entries remain for existing subscriptions. New purchases use new keys.

### Step 7: Verification queries

Include commented-out verification SELECTs at the end of each migration.

## 7. Backend Resolver Changes

### 7.1 Key Insight: Logic Already Exists

The current `StorefrontOptionsResolver.ts` (278 lines) already contains separate logical blocks for each sub-domain:
- **Hours** (lines 33-42): checks `_hours_animated`, `_hours_status`, `_hours_on`, `_hours_enabled`
- **Category** (lines 44-53): checks `_category_store`, `_category_product`, `_category_on`, `_category_enabled`
- **Recommend** (lines 55-64): checks `_recommend_store`, `_recommend_products`, `_recommend_on`, `_recommend_enabled`
- **Info** (lines 66-76): checks `_info`, `_info_on`, `_info_enabled`, individual info keys
- **QR** (lines 78-103): checks `_qr_on`, `_qr`, `_qr_enabled`, `_qr_resolution`, `_qr_content`, individual QR keys
- **QR Styled** (lines 105-134): checks `_qr_styled`, `_qr_styled_on`, `_qr_styled_enabled`, `_qr_styled_disabled`, dot/corner styles, custom colors, gradients
- **Gallery** (lines 136-149): checks `_gallery_on`, `_gallery`, `_gallery_enabled`, individual gallery keys, magazine
- **Advanced** (lines 151-160): checks `_enhanced_seo`, `_storefront_actions`, `_advanced_on`, `_advanced_enabled`
- **Layout** (lines 162-172): checks `_layout_on`, `_layout`, `_layout_enabled`, individual layout keys

**The migration is primarily extracting these blocks into separate resolver files + updating key names.** The resolution logic itself stays the same — only the feature key prefixes change.

### 7.2 New Resolver Files

Create 5 new resolver files, one per sub-domain. Each is an extraction of the existing logic from `StorefrontOptionsResolver.ts`:

| File | Function | Extracted From (line range) | Input | Output |
|------|----------|----------------------------|-------|--------|
| `StorefrontQrResolver.ts` | `resolveStorefrontQr` | lines 78-134 | `features`, `fallbackFeatures`, `merchantPrefs` | `EffectiveStorefrontQr` |
| `StorefrontGalleryResolver.ts` | `resolveStorefrontGallery` | lines 136-149 | `features`, `fallbackFeatures`, `merchantPrefs` | `EffectiveStorefrontGallery` |
| `StorefrontHoursResolver.ts` | `resolveStorefrontHours` | lines 33-42 | `features`, `fallbackFeatures`, `merchantPrefs` | `EffectiveStorefrontHours` |
| `StorefrontLayoutResolver.ts` | `resolveStorefrontLayout` | lines 162-172 | `features`, `fallbackFeatures`, `merchantPrefs` | `EffectiveStorefrontLayout` |
| `StorefrontMapsResolver.ts` | `resolveStorefrontMaps` | lines 66-76 (maps portion) | `features`, `fallbackFeatures`, `merchantPrefs` | `EffectiveStorefrontMaps` |

Each resolver:
1. Checks new `storefront_<domain>_*` keys in its own capability features
2. Falls back to old `storefront_opt_<domain>_*` keys in `storefront_options` features
3. Applies the 4-tier pattern: `_flexible` → `_enabled`/`_disabled` → `_on`/`_off` → individual keys
4. Applies merchant preferences as soft gates

### 7.3 New Types (in `types.ts`)

Add new interfaces for each sub-domain following the 4-tier pattern:

```typescript
// ── QR Code ──
export interface StorefrontQrMerchantSettings {
  qr_enabled?: boolean | null;
  qr_styled_enabled?: boolean | null;
  qr_classic_enabled?: boolean | null;
  qr_dot_style?: string | null;
  qr_corner_style?: string | null;
  qr_custom_colors?: boolean | null;
  qr_gradients?: boolean | null;
  qr_resolution?: string | null;
  qr_content_types?: string[] | null;
}

export interface EffectiveStorefrontQr {
  enabled: boolean;
  is_flexible: boolean;
  qr_enabled: boolean;
  allowed_qr_resolutions: StorefrontOptQRResolutionType[];
  allowed_qr_content_types: StorefrontOptQRContentType[];
  // Classic QR sub-group
  qr_classic_enabled: boolean;
  // Styled QR sub-group
  qr_styled_enabled: boolean;
  allowed_qr_dot_styles: StorefrontOptQRDotStyleType[];
  allowed_qr_corner_styles: StorefrontOptQRCornerStyleType[];
  qr_custom_colors: boolean;
  qr_gradients: boolean;
  can_use_qr_codes: boolean;
  merchant_preferences: Record<string, any>;
}

// ── Gallery ──
export interface StorefrontGalleryMerchantSettings {
  gallery_enabled?: boolean | null;
  gallery_display_mode?: 'carousel' | 'magazine' | null;
  gallery_image_limit?: number | null;
}

export interface EffectiveStorefrontGallery {
  enabled: boolean;
  is_flexible: boolean;
  gallery_enabled: boolean;
  allowed_gallery_types: StorefrontOptGalleryType[];
  // Carousel sub-group
  gallery_carousel_enabled: boolean;
  // Magazine sub-group
  gallery_magazine_enabled: boolean;
  can_use_magazine_gallery: boolean;
  merchant_preferences: Record<string, any>;
}

// ── Hours ──
export interface StorefrontHoursMerchantSettings {
  hours_enabled?: boolean | null;
  hours_display?: boolean | null;
  hours_animated?: boolean | null;
  hours_status?: boolean | null;
}

export interface EffectiveStorefrontHours {
  enabled: boolean;
  is_flexible: boolean;
  hours_enabled: boolean;
  allowed_hours_types: StorefrontOptHoursType[];
  can_show_hours_display: boolean;
  can_use_animated_hours: boolean;
  can_show_hours_status: boolean;
  merchant_preferences: Record<string, any>;
}

// ── Layouts ──
export interface StorefrontLayoutMerchantSettings {
  layout_enabled?: boolean | null;
  selected_layout?: string | null;
}

export interface EffectiveStorefrontLayout {
  enabled: boolean;
  is_flexible: boolean;
  layout_enabled: boolean;
  allowed_layouts: StorefrontOptLayoutType[];
  effective_layout: StorefrontOptLayoutType;
  can_use_layout_classic: boolean;
  can_use_layout_editorial: boolean;
  can_use_layout_immersive: boolean;
  merchant_preferences: Record<string, any>;
}

// ── Maps ──
export interface StorefrontMapsMerchantSettings {
  maps_enabled?: boolean | null;
  interactive_maps?: boolean | null;
  map_display?: boolean | null;
  location_display?: boolean | null;
}

export interface EffectiveStorefrontMaps {
  enabled: boolean;
  is_flexible: boolean;
  maps_enabled: boolean;
  can_show_map_display: boolean;
  can_show_location_display: boolean;
  can_use_interactive_maps: boolean;
  merchant_preferences: Record<string, any>;
}
```

### 7.4 Update `EffectiveCapabilities` Interface

Add the new sub-domain effective types to the top-level `EffectiveCapabilities`:

```typescript
export interface EffectiveCapabilities {
  effective: {
    // ... existing capability types ...
    storefront_options: EffectiveStorefrontOptions;    // core (slimmed down)
    storefront_qr: EffectiveStorefrontQr;              // new
    storefront_gallery: EffectiveStorefrontGallery;    // new
    storefront_hours: EffectiveStorefrontHours;        // new
    storefront_layouts: EffectiveStorefrontLayout;     // new
    storefront_maps: EffectiveStorefrontMaps;          // new
    // ... rest ...
  };
}
```

### 7.5 Update `EffectiveStorefrontOptions` (Core — slimmed down)

Remove QR, Gallery, Hours, Layout, and Maps fields. Retain only core fields (category, recommend, recently viewed, info, advanced).

### 7.6 Update `MerchantSettingsBundle`

Add new sub-domain merchant settings:

```typescript
export interface MerchantSettingsBundle {
  // ... existing ...
  storefrontQr: StorefrontQrMerchantSettings | null;
  storefrontGallery: StorefrontGalleryMerchantSettings | null;
  storefrontHours: StorefrontHoursMerchantSettings | null;
  storefrontLayout: StorefrontLayoutMerchantSettings | null;
  storefrontMaps: StorefrontMapsMerchantSettings | null;
}
```

### 7.7 Update `EffectiveCapabilityResolver.ts`

Add dispatch calls for the 5 new resolvers. Each receives its own capability features + old `storefront_options` features as fallback:

```typescript
const effective = await Promise.all([
  // ... existing resolvers ...
  resolveStorefrontOptions(
    rawCaps.capabilities.storefront_options?.features || {},
    merchantBundle.storefrontOptions
  ),
  resolveStorefrontQr(
    rawCaps.capabilities.storefront_qr?.features || {},
    merchantBundle.storefrontQr,
    rawCaps.capabilities.storefront_options?.features || {}  // fallback
  ),
  resolveStorefrontGallery(
    rawCaps.capabilities.storefront_gallery?.features || {},
    merchantBundle.storefrontGallery,
    rawCaps.capabilities.storefront_options?.features || {}  // fallback
  ),
  resolveStorefrontHours(
    rawCaps.capabilities.storefront_hours?.features || {},
    merchantBundle.storefrontHours,
    rawCaps.capabilities.storefront_options?.features || {}  // fallback
  ),
  resolveStorefrontLayout(
    rawCaps.capabilities.storefront_layouts?.features || {},
    merchantBundle.storefrontLayout,
    rawCaps.capabilities.storefront_options?.features || {}  // fallback
  ),
  resolveStorefrontMaps(
    rawCaps.capabilities.storefront_maps?.features || {},
    merchantBundle.storefrontMaps,
    rawCaps.capabilities.storefront_options?.features || {}  // fallback
  ),
  // ... rest ...
]);
```

### 7.8 Update `StorefrontOptionsService.ts`

- Continues to resolve `storefront_options` (core) via `resolveStorefrontOptions`
- New sub-domain resolvers are called from `EffectiveCapabilityResolver.ts` directly
- `getDisabledState` fallback must return disabled states for all 6 domains

### 7.9 Update `fetchMerchantSettings` in `EffectiveCapabilityResolver.ts`

Add fetches for the 5 new merchant settings tables alongside the existing `storefrontOptions` fetch.

## 8. Surface Alignment

Every surface that currently reads `storefront_options` or `storefront_opt_*` must be aligned to consume the new domain structure. This is the most extensive part of the migration.

### 8.1 Storefront Page

**File**: `apps/web/src/app/t/[tenantId]/settings/storefront-options/StorefrontOptionsSettingsClient.tsx`

Currently renders all 71 features in one page with grouped sections (hours, QR, gallery, layout, maps, category, recommend, info, advanced). After alignment:
- **QR section** → reads from `storefront_qr` state, navigates to `/settings/storefront-qr`
- **Gallery section** → reads from `storefront_gallery` state, navigates to `/settings/storefront-gallery`
- **Hours section** → reads from `storefront_hours` state, navigates to `/settings/storefront-hours`
- **Layout section** → reads from `storefront_layouts` state, navigates to `/settings/storefront-layouts`
- **Maps section** → reads from `storefront_maps` state, navigates to `/settings/storefront-maps`
- **Core sections** (category, recommend, recently viewed, info, advanced) → stay on `storefront-options` page

Each new domain gets its own settings page with domain-specific UI (e.g., QR style picker, gallery display mode toggle, layout preview, maps configuration, hours editor).

### 8.2 Products Page

**Files**: Product page components that read `storefront_options` for layout, gallery, QR, hours, maps display on product pages.

After alignment:
- Product page layout → reads from `storefront_layouts` state
- Product page gallery → reads from `storefront_gallery` state (carousel vs magazine mode)
- Product page QR → reads from `storefront_qr` state (styled vs classic)
- Product page hours → reads from `storefront_hours` state
- Product page maps/location → reads from `storefront_maps` state
- Product page categories, recommendations, recently viewed → reads from `storefront_options` (core)

### 8.3 Directory Entry Page

**Files**: `apps/web/src/components/directory/redesign/types.ts`, directory entry page components

The directory entry currently mirrors `storefront_options` for layout, gallery, QR, hours, maps. After alignment:
- Directory entry layout → reads from `storefront_layouts` state (shared with storefront)
- Directory entry gallery → reads from `storefront_gallery` state (carousel vs magazine)
- Directory entry QR → reads from `storefront_qr` state
- Directory entry hours → reads from `storefront_hours` state
- Directory entry maps → reads from `storefront_maps` state
- `DirectoryEntryLayoutMeta` type updated to reference new domain states

### 8.4 BSaaS Store + Grants + Bundles

**Files**: `apps/web/src/services/AdminBsaasBundleService.ts`, `apps/web/src/admin/components/BundlesTab.tsx`, `apps/web/src/admin/components/BsaasFeaturesTab.tsx`, `apps/web/src/services/BsaasPurchaseService.ts`

After alignment:
- **BSaaS Store** (feature store page): new domain feature keys appear as purchasable items under their respective domain categories
- **Grants**: `PrivateFeatureGrantDialog.tsx` and `ComplimentaryAccessForm.tsx` list features grouped by new capability types
- **Bundles**: `BundleEditModal.tsx` and `BundlesTab.tsx` show features grouped by new capability types — bundle editor can select features from `storefront_qr`, `storefront_gallery`, etc. as separate sections

### 8.5 BSaaS Catalog + Grants + Bundles

**Files**: `apps/web/src/services/AdminBsaasCatalogService.ts`, `apps/web/src/admin/components/BsaasCatalogManagement.tsx`, `apps/web/src/app/(platform)/settings/admin/bsaas-catalog/page.tsx`

After alignment:
- **BSaaS Catalog**: new domain feature keys appear in catalog management UI grouped by capability type
- **Catalog entries**: old `storefront_opt_*` entries remain active for existing subscriptions; new `storefront_<domain>_*` entries added for new purchases
- **Feature grouping**: catalog UI shows 6 separate sections instead of one monolithic `storefront_options` section

### 8.6 Tenant Tier Page — Comparison + Tier Features

**Files**: `apps/web/src/lib/tiers/capability-display.ts`, `apps/web/src/components/tiers/TierComparisonTable.tsx`, `apps/web/src/components/subscription/CapabilityComparisonMatrix.tsx`, `apps/web/src/app/t/[tenantId]/settings/tier-features/TierFeaturesClient.tsx`

After alignment:
- **`CAPABILITY_META`** array in `capability-display.ts`: add 5 new entries for `storefront_qr`, `storefront_gallery`, `storefront_hours`, `storefront_layouts`, `storefront_maps` with their `_flexible` keys
- **`summarizeResolvedCapabilities()`**: add summary lines for each new domain
- **`buildEffectiveFeatures()`**: add raw feature maps for new domains
- **Tier Comparison Table**: shows 6 separate capability sections instead of one `storefront_options` row
- **Tier Features page**: lists features grouped by 6 capability types
- **`getCapabilityTypeForFeature()`** in `CapabilityResolutionService.ts`: updated to map new `storefront_<domain>_*` keys to their new capability types

### 8.7 Capability Admin + Tier Coverage + Constraints

**Files**: `apps/web/src/admin/components/CapabilityManagement.tsx`, `apps/web/src/app/(platform)/settings/admin/capabilities/page.tsx`

After alignment:
- **Capability Management** (`CapabilityManagement.tsx`): the Features tab, Capability Types tab, and Tier Capabilities tab all automatically pick up new capability types from `capability_type_list` — no code changes needed, just database migration
- **Tier Coverage**: tier coverage views show 6 separate capability sections
- **Constraints**: cross-capability constraints can now reference `storefront_qr`, `storefront_gallery`, etc. as separate source/target capabilities — the constraint system already supports arbitrary capability type keys

### 8.8 PlanSummaryPanel — New Domain Cards

**File**: `apps/web/src/components/settings/PlanSummaryPanel.tsx`

Currently renders one card for `storefront_options` showing all features. After alignment, render **6 separate cards**:

| Card | Key | Label | Icon | Settings Path |
|------|-----|-------|------|---------------|
| Storefront Options (Core) | `storefront_options` | Storefront Options | 🎨 | `/settings/storefront-options` |
| Storefront QR Code | `storefront_qr` | QR Code | 📱 | `/settings/storefront-qr` |
| Storefront Gallery | `storefront_gallery` | Image Gallery | 🖼️ | `/settings/storefront-gallery` |
| Storefront Hours | `storefront_hours` | Business Hours | 🕐 | `/settings/storefront-hours` |
| Storefront Layouts | `storefront_layouts` | Layouts | 📐 | `/settings/storefront-layouts` |
| Storefront Maps | `storefront_maps` | Maps & Location | 🗺️ | `/settings/storefront-maps` |

**Implementation**:
- Add new entries to `CAPABILITY_DISPLAY` map in `PlanSummaryPanel.tsx`
- Add summary builders for each new domain (similar to existing `so` block at line 588)
- Each card shows: enabled status, flexible badge, key features list, merchant gate status, settings link

### 8.9 `useCapabilityAccess` Hook

**File**: `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts`

Currently computes merchant gate status for `storefront_options` as a single entry. After alignment:
- Add merchant gate status entries for each new domain
- Update `storefront_options` to only reflect core features
- New domains check their own merchant settings tables

### 8.10 `storefrontOptions.ts` Utils

**File**: `apps/web/src/utils/storefrontOptions.ts`

Currently defines `STOREFRONT_OPT_GROUPS` and `getStorefrontOptMeta` for all 71 features. After alignment:
- Core groups stay (category, recommend, recently_viewed, info, advanced)
- QR, gallery, hours, layout, maps groups move to new util files: `storefrontQr.ts`, `storefrontGallery.ts`, etc.

## 9. Merchant Settings Table Strategy

Create 5 new tables mirroring the `tenant_product_types_settings` precedent:

```sql
CREATE TABLE tenant_storefront_qr_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,
  qr_enabled BOOLEAN DEFAULT true,
  qr_classic_enabled BOOLEAN DEFAULT true,
  qr_styled_enabled BOOLEAN DEFAULT false,
  qr_dot_style VARCHAR(30),
  qr_corner_style VARCHAR(30),
  qr_custom_colors BOOLEAN DEFAULT false,
  qr_gradients BOOLEAN DEFAULT false,
  qr_resolution VARCHAR(10) DEFAULT '512',
  qr_content_types TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_storefront_qr_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE tenant_storefront_gallery_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,
  gallery_enabled BOOLEAN DEFAULT true,
  gallery_display_mode VARCHAR(20) DEFAULT 'carousel',
  gallery_image_limit INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_storefront_gallery_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE tenant_storefront_hours_settings ( ... );
CREATE TABLE tenant_storefront_layout_settings ( ... );
CREATE TABLE tenant_storefront_maps_settings ( ... );
```

Each with RLS, updated_at triggers, and indexes — same pattern as `tenant_product_types_settings`.

## 10. Test Plan

### 10.1 Unit Tests

For each new resolver, create test files following the `CapabilityResolversOnOff.test.ts` pattern:

- `StorefrontQrResolver.test.ts` — test `_flexible`, `_enabled`/`_disabled`, `_on`/`_off`, classic vs styled sub-groups, dot styles, corner styles, custom colors, gradients, resolution tiers, content types
- `StorefrontGalleryResolver.test.ts` — test `_flexible`, `_enabled`/`_disabled`, `_on`/`_off`, carousel vs magazine sub-groups, image limits (5/10/15)
- `StorefrontHoursResolver.test.ts` — test `_flexible`, `_enabled`/`_disabled`, `_on`/`_off`, hours display, animated, status
- `StorefrontLayoutResolver.test.ts` — test `_flexible`, `_enabled`/`_disabled`, classic/editorial/immersive, merchant pref selection
- `StorefrontMapsResolver.test.ts` — test `_flexible`, `_enabled`/`_disabled`, interactive maps, map display, location display

Each test must verify:
1. New keys work correctly
2. Fallback to old `storefront_opt_*` keys works when new capability type is absent
3. `_flexible` unlocks all features in the domain
4. `_enabled`/`_disabled` gates work at the domain level
5. `_on`/`_off` groups work for sub-groups
6. Merchant preferences act as soft gates
7. Classic QR vs Styled QR sub-group interaction
8. Carousel Gallery vs Magazine Gallery sub-group interaction

### 10.2 Integration Tests

- Verify `EffectiveCapabilityResolver` returns all 6 domain states
- Verify subscription status (frozen/canceled) disables all 6 domains
- Verify cross-capability constraints work with new domain keys

### 10.3 Migration Verification

Run the commented-out verification queries at the end of each migration to confirm:
- New feature keys exist in `features_list`
- New capability types exist in `capability_type_list`
- New features are linked via `capability_features_list`
- Tier assignments are copied
- Old keys are unlinked from `storefront_options` but still exist in `features_list`

## 11. Rollback Plan

Since the migration is additive and non-breaking:

1. **Database rollback**: Re-link old keys to `storefront_options` capability type. New capability types and keys can remain (harmless).
2. **Backend rollback**: Revert resolver changes. Old `storefront_opt_*` keys still exist in `tier_features_list` and will be picked up by the original `StorefrontOptionsResolver`.
3. **Frontend rollback**: Revert state interface changes. Old `storefront_options` state still contains all fields.

## 12. Implementation Checklist

### Phase 1: QR Code (`storefront_qr`) — 36 features
- [ ] Migration: `104_storefront_qr_capability_split.sql`
  - [ ] Insert 36 `storefront_qr_*` feature keys into `features_list` (31 renamed + 5 new domain keys)
  - [ ] Create `storefront_qr` capability type
  - [ ] Link features to capability type
  - [ ] Copy tier assignments from `storefront_opt_qr_*` keys + domain gates from `storefront_opt_*` master gates
  - [ ] Unlink old QR keys from `storefront_options`
  - [ ] Create `tenant_storefront_qr_settings` table
  - [ ] Migrate existing QR merchant prefs to new table
  - [ ] Add BSaaS catalog entries for new keys
- [ ] Backend: Extract QR logic from `StorefrontOptionsResolver.ts` → `StorefrontQrResolver.ts`
- [ ] Backend: Add `EffectiveStorefrontQr` + `StorefrontQrMerchantSettings` types
- [ ] Backend: Update `EffectiveCapabilityResolver.ts` dispatch
- [ ] Backend: Update `MerchantSettingsBundle` + `fetchMerchantSettings`
- [ ] Backend: Update `StorefrontOptionsService.ts`
- [ ] Frontend: Add `StorefrontQrState` to `CapabilityResolutionService.ts`
- [ ] Frontend: Update `getCapabilityTypeForFeature()` mapping
- [ ] Frontend: Create `/settings/storefront-qr` page
- [ ] Frontend: Update `PlanSummaryPanel.tsx` — add QR card
- [ ] Frontend: Update `capability-display.ts` — add `storefront_qr` to `CAPABILITY_META`
- [ ] Frontend: Update `useCapabilityAccess.ts` — add QR merchant gate
- [ ] Frontend: Update QR rendering components (`TenantQRCode.tsx`, etc.)
- [ ] Frontend: Update BSaaS catalog/bundle/grant UIs for QR domain
- [ ] Tests: `StorefrontQrResolver.test.ts`

### Phase 2: Gallery (`storefront_gallery`) — 12 features
- [ ] Migration: `105_storefront_gallery_capability_split.sql`
- [ ] Backend: Extract gallery logic → `StorefrontGalleryResolver.ts`
- [ ] Frontend: `StorefrontGalleryState` + `/settings/storefront-gallery` page
- [ ] Frontend: Update `PlanSummaryPanel.tsx` — add Gallery card
- [ ] Frontend: Update `capability-display.ts` — add `storefront_gallery`
- [ ] Frontend: Update gallery/carousel components
- [ ] Frontend: Update BSaaS surfaces
- [ ] Tests: `StorefrontGalleryResolver.test.ts`

### Phase 3: Hours (`storefront_hours`) — 8 features
- [ ] Migration: `106_storefront_hours_capability_split.sql`
- [ ] Backend: Extract hours logic → `StorefrontHoursResolver.ts`
- [ ] Frontend: `StorefrontHoursState` + `/settings/storefront-hours` page
- [ ] Frontend: Update `PlanSummaryPanel.tsx` — add Hours card
- [ ] Frontend: Update `capability-display.ts` — add `storefront_hours`
- [ ] Frontend: Update hours display components
- [ ] Frontend: Update BSaaS surfaces
- [ ] Tests: `StorefrontHoursResolver.test.ts`

### Phase 4: Layouts (`storefront_layouts`) — 7 features
- [ ] Migration: `107_storefront_layouts_capability_split.sql`
- [ ] Backend: Extract layout logic → `StorefrontLayoutResolver.ts`
- [ ] Frontend: `StorefrontLayoutState` + `/settings/storefront-layouts` page
- [ ] Frontend: Update `PlanSummaryPanel.tsx` — add Layouts card
- [ ] Frontend: Update `capability-display.ts` — add `storefront_layouts`
- [ ] Frontend: Update layout selector components
- [ ] Frontend: Update BSaaS surfaces
- [ ] Tests: `StorefrontLayoutResolver.test.ts`

### Phase 5: Maps (`storefront_maps`) — 6 features
- [ ] Migration: `108_storefront_maps_capability_split.sql`
- [ ] Backend: Extract maps logic → `StorefrontMapsResolver.ts`
- [ ] Frontend: `StorefrontMapsState` + `/settings/storefront-maps` page
- [ ] Frontend: Update `PlanSummaryPanel.tsx` — add Maps card
- [ ] Frontend: Update `capability-display.ts` — add `storefront_maps`
- [ ] Frontend: Update map/location components
- [ ] Frontend: Update BSaaS surfaces
- [ ] Tests: `StorefrontMapsResolver.test.ts`

### Phase 6: Core Cleanup + Final Alignment
- [ ] Remove migrated fields from `EffectiveStorefrontOptions` interface
- [ ] Remove migrated logic from `StorefrontOptionsResolver.ts` (keep only core: category, recommend, recently viewed, info, advanced)
- [ ] Remove migrated fields from `StorefrontOptionsMerchantSettings`
- [ ] Update `StorefrontOptInfoType` to exclude maps types
- [ ] Update `toStorefrontOptionFlags` to delegate to sub-domain states
- [ ] Update `StorefrontOptionsService.ts` to only handle core
- [ ] Update `storefrontOptions.ts` utils — move domain groups to separate files
- [ ] Update `StorefrontOptionsSettingsClient.tsx` — remove migrated sections, add links to domain pages
- [ ] Update directory entry types/components
- [ ] Update product page components
- [ ] Full regression test pass

## 13. Key Files Affected

### Backend — Resolvers
- `apps/api/src/services/resolvers/types.ts` — new interfaces, updated `EffectiveStorefrontOptions`, `MerchantSettingsBundle`, `EffectiveCapabilities`
- `apps/api/src/services/resolvers/StorefrontOptionsResolver.ts` — slimmed to core only
- `apps/api/src/services/resolvers/StorefrontQrResolver.ts` — **new** (extracted from StorefrontOptionsResolver lines 78-134)
- `apps/api/src/services/resolvers/StorefrontGalleryResolver.ts` — **new** (extracted from lines 136-149)
- `apps/api/src/services/resolvers/StorefrontHoursResolver.ts` — **new** (extracted from lines 33-42)
- `apps/api/src/services/resolvers/StorefrontLayoutResolver.ts` — **new** (extracted from lines 162-172)
- `apps/api/src/services/resolvers/StorefrontMapsResolver.ts` — **new** (extracted from lines 66-76 maps portion)
- `apps/api/src/services/resolvers/CapabilityResolversOnOff.test.ts` — update existing tests, add new test files

### Backend — Services
- `apps/api/src/services/EffectiveCapabilityResolver.ts` — add 5 new dispatch calls + merchant settings fetches
- `apps/api/src/services/StorefrontOptionsService.ts` — slimmed to core only
- `apps/api/prisma/schema.prisma` — 5 new merchant settings models

### Frontend — Capability Services
- `apps/web/src/services/CapabilityResolutionService.ts` — new state interfaces, updated `AllCapabilitiesState`, `getCapabilityTypeForFeature()`
- `apps/web/src/services/UnifiedCapabilityService.ts` — updated for new domains
- `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` — merchant gate status for 6 domains

### Frontend — Plan Summary & Tier Comparison
- `apps/web/src/components/settings/PlanSummaryPanel.tsx` — 6 domain cards instead of 1
- `apps/web/src/lib/tiers/capability-display.ts` — `CAPABILITY_META`, `summarizeResolvedCapabilities()`, `buildEffectiveFeatures()` updated
- `apps/web/src/components/tiers/TierComparisonTable.tsx` — 6 capability sections
- `apps/web/src/components/subscription/CapabilityComparisonMatrix.tsx` — 6 capability sections
- `apps/web/src/app/t/[tenantId]/settings/tier-features/TierFeaturesClient.tsx` — features grouped by 6 types

### Frontend — Settings Pages
- `apps/web/src/app/t/[tenantId]/settings/storefront-options/StorefrontOptionsSettingsClient.tsx` — core only + links to domain pages
- `apps/web/src/app/t/[tenantId]/settings/storefront-qr/` — **new** QR settings page
- `apps/web/src/app/t/[tenantId]/settings/storefront-gallery/` — **new** Gallery settings page
- `apps/web/src/app/t/[tenantId]/settings/storefront-hours/` — **new** Hours settings page
- `apps/web/src/app/t/[tenantId]/settings/storefront-layouts/` — **new** Layouts settings page
- `apps/web/src/app/t/[tenantId]/settings/storefront-maps/` — **new** Maps settings page

### Frontend — Storefront/Product/Directory Surfaces
- `apps/web/src/app/tenant/[id]/StorefrontClientWrapper.tsx` — reads from 6 domain states
- `apps/web/src/app/tenant/[id]/layouts/hooks/useStorefrontState.ts` — reads from 6 domain states
- `apps/web/src/components/public/TenantQRCode.tsx` — reads from `storefront_qr` state
- `apps/web/src/components/directory/redesign/types.ts` — updated `DirectoryLayoutMeta`
- `apps/web/src/app/directory/[slug]/page.tsx` — reads from 6 domain states
- `apps/web/src/lib/storefront-sections.ts` — updated for 6 domains
- `apps/web/src/utils/storefrontOptions.ts` — core groups only; domain groups move to new util files

### Frontend — Admin/BSaaS Surfaces
- `apps/web/src/admin/components/CapabilityManagement.tsx` — auto-picks up new capability types
- `apps/web/src/admin/components/BsaasCatalogManagement.tsx` — features grouped by 6 types
- `apps/web/src/admin/components/BundlesTab.tsx` — features grouped by 6 types
- `apps/web/src/admin/components/BundleEditModal.tsx` — features grouped by 6 types
- `apps/web/src/admin/components/BsaasFeaturesTab.tsx` — features grouped by 6 types
- `apps/web/src/admin/components/PrivateFeatureGrantDialog.tsx` — features grouped by 6 types
- `apps/web/src/admin/components/ComplimentaryAccessForm.tsx` — features grouped by 6 types
- `apps/web/src/services/AdminBsaasCatalogService.ts` — handles new domain keys
- `apps/web/src/services/AdminBsaasBundleService.ts` — handles new domain keys
- `apps/web/src/services/BsaasPurchaseService.ts` — handles new domain keys

### Frontend — Landing/Marketing
- `apps/web/src/components/landing-page/TierBasedLandingPage.tsx` — shows 6 domain cards
- `apps/web/src/components/dashboard/CapabilityShowcase.tsx` — shows 6 domains
- `apps/web/src/components/dashboard/ConstraintAlertBanner.tsx` — handles new domain constraints
- `apps/web/src/components/settings/UnifiedSettings.tsx` — navigation for 6 domain settings pages

### Database
- `database/migrations/104_storefront_qr_capability_split.sql` — **new**
- `database/migrations/105_storefront_gallery_capability_split.sql` — **new**
- `database/migrations/106_storefront_hours_capability_split.sql` — **new**
- `database/migrations/107_storefront_layouts_capability_split.sql` — **new**
- `database/migrations/108_storefront_maps_capability_split.sql` — **new**

## 14. Precedent References

- **`057_product_types_capability_split.sql`** — primary precedent for capability type split (additive, non-breaking, tier assignment copy, separate settings table)
- **`052_storefront_type_feature_seeds.sql`** — precedent for `storefront_types` as a separate capability type with `storefront_*` feature keys (no `_opt_` prefix)
- **`070_storefront_options_optimization.sql`** — precedent for consolidating and re-linking features within `storefront_options`
- **`102_storefront_opt_qr_styled_features.sql`** — precedent for adding QR style features to `storefront_options` (the features being moved)
- **`103_storefront_opt_gallery_magazine.sql`** — precedent for adding gallery magazine feature + BSaaS catalog entry

## 15. Implementation Notes — Pre-Split Enhancements

Several enhancements have been implemented ahead of the full namespace split to address immediate UX and architectural needs.

### 15.1 PlanSummaryPanel Enhancements

**Problem**: The `PlanSummaryPanel` on the dashboard was growing too large as capability types expanded, consuming excessive dashboard real estate.

**Solution implemented**:
- **Moved full panel to dedicated page**: `/t/{tenantId}/settings/plan-summary` — renders the complete `PlanSummaryPanel` with all capability details, feature statuses, and constraint warnings.
- **Created slim dashboard widget**: `PlanSummaryWidget.tsx` — a compact variant showing only clickable capability type names with color-coded status indicators.
- **Updated `TenantDashboardV2.tsx`**: Replaced the full `PlanSummaryPanel` with `PlanSummaryWidget`, which links to the dedicated page.

**Color-coded status** (source of truth is the effective resolver, regardless of how effectiveness is achieved):

| Color | Meaning | Source |
|-------|---------|--------|
| **Green** | Tier enabled | Tier features list grants the capability |
| **Red** | Tier disabled | Capability not enabled by any source |
| **Orange** | Merchant block | Tier allows but merchant has disabled (merchant gate) |
| **Blue** | Purchased | Capability effective via BSaaS purchase (`purchasedFeatureKeys`) |
| **Purple** | Admin complimentary grant | Capability effective via admin override (`overrideFeatureKeys`) |

**Files**:
- `apps/web/src/components/dashboard/PlanSummaryWidget.tsx` — new slim widget
- `apps/web/src/app/t/[tenantId]/settings/plan-summary/page.tsx` — new dedicated page
- `apps/web/src/app/t/[tenantId]/settings/plan-summary/PlanSummaryPageClient.tsx` — page client
- `apps/web/src/components/dashboard/TenantDashboardV2.tsx` — updated to use slim widget
- `apps/web/src/services/CapabilityResolutionService.ts` — added `overrideFeatureKeys` to `AllCapabilitiesState`
- `apps/web/src/services/UnifiedCapabilityService.ts` — added `override_feature_keys` to backend interface + mapping

### 15.2 QR Code — Backward Compatibility & Styled QR Component

**Problem**: The existing `TenantQRCode.tsx` component handled both classic and styled QR inline, creating coupling and making it impossible to independently evolve the styled QR renderer.

**Solution implemented**:
- **Retained backward compatibility for classic QR**: The existing `TenantQRCode` component continues to handle classic QR code generation using the `qrcode` library. All existing classic feature keys (`storefront_opt_qr`, `storefront_opt_qr_on`, `storefront_opt_qr_codes_*`, `storefront_opt_qr_product`, `storefront_opt_qr_store`, `storefront_opt_qr_logo`, `storefront_opt_qr_directory`) remain unchanged.
- **Created shared styled QR component**: `StyledTenantQR.tsx` — a standalone component that handles styled QR rendering using the `qr-code-styling` library. It accepts `StorefrontOptionFlags` and renders styled QR codes with custom dot types, corner styles, colors, and gradients.
- **Effective resolver delegation**: `TenantQRCode` now checks `resolvedFlags?.showQRStyled` and delegates to `StyledTenantQR` when the effective resolver requires styled QR. Classic QR rendering remains in `TenantQRCode` for all other cases.
- **Public surface sync**: All public surfaces (product pages, storefront, directory listings) that use `TenantQRCode` automatically render the correct QR type based on the effective resolver — no changes needed to consumer components.

**Feature key structure** (pre-split, all under `storefront_options`):

| Sub-mode | Feature Keys | Group Keys |
|----------|-------------|------------|
| **Classic QR** | `storefront_opt_qr`, `storefront_opt_qr_codes_512/1024/2048`, `storefront_opt_qr_product/store/logo/directory` | `storefront_opt_qr_on`, `storefront_opt_qr_enabled` |
| **Styled QR** | `storefront_opt_qr_styled`, `storefront_opt_qr_dot_*`, `storefront_opt_qr_corner_*`, `storefront_opt_qr_custom_colors`, `storefront_opt_qr_gradients` | `storefront_opt_qr_styled_on/off/enabled/disabled`, `storefront_opt_qr_dot_styles_on`, `storefront_opt_qr_corner_styles_on` |

**Post-split** (Phase 1): Classic QR keys → `storefront_qr_classic_*`, Styled QR keys → `storefront_qr_styled_*` (see §4.2).

**Files**:
- `apps/web/src/components/public/StyledTenantQR.tsx` — new shared styled QR component
- `apps/web/src/components/public/TenantQRCode.tsx` — updated to delegate to `StyledTenantQR` when styled is active

### 15.3 Gallery — Magazine Gallery Domain Alignment

**Problem**: The magazine gallery feature (`storefront_opt_gallery_magazine`) was seeded under `storefront_options` but naturally belongs with the gallery sub-domain.

**Current state**: The magazine gallery feature key exists in `features_list` with `category = 'storefront_options'`, linked to the `storefront_options` capability type. The resolver (`StorefrontOptionsResolver.ts`, line 149) checks `features.storefront_opt_gallery_magazine` and exposes `galleryMagazineEnabled` and `canUseMagazineGallery` in the effective state.

**Post-split alignment** (Phase 2):
- `storefront_opt_gallery_magazine` → `storefront_gallery_magazine` (renamed)
- `gallery_display_mode` column in `tenant_storefront_options_settings` → moves to `tenant_storefront_gallery_settings`
- BSaaS catalog entry for `storefront_opt_gallery_magazine` → duplicated as `storefront_gallery_magazine`
- The magazine gallery feature naturally has a home with the `storefront_gallery_*` capability keys

**No pre-split changes needed**: The magazine gallery already works correctly under the current `storefront_options` namespace. The migration in Phase 2 will handle the rename and reassignment.
