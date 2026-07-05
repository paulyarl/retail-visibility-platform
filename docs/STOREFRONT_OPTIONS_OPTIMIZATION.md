# Storefront Options Feature Optimization (38→18)

## Overview

Consolidates the `storefront_options` capability from 38 tier-feature keys to 18, simplifying tier management while preserving all existing functionality through backward-compatible fallback.

## Optimization Strategy

### What Changes

| Technique | Old Count | New Count | Saved |
|---|---|---|---|
| Remove `disabled` master gate | 1 | 0 | 1 |
| Remove group gates for 2-item groups (hours, category, recommend, advanced) | 4 | 0 | 4 |
| Consolidate QR resolution (3 radio → 1 + merchant pref) | 3 | 1 | 2 |
| Consolidate QR content (4 toggles → 1 + merchant prefs) | 4 | 1 | 3 |
| Consolidate gallery (3 radio + group gate → 1 + merchant pref) | 4 | 1 | 3 |
| Consolidate layout (3 radio + group gate → 1 + merchant pref) | 4 | 1 | 3 |
| Consolidate info (3 toggles + group gate → 1 + merchant prefs) | 4 | 1 | 3 |
| Merge standalone map_display, location_display into info group | 2 | 0 | 2 |
| Keep hours_display as standalone tier feature | 1 | 1 | 0 |
| Keep individual toggle features for hours, category, recommend, advanced | 8 | 8 | 0 |
| Keep recently_viewed standalone | 1 | 1 | 0 |
| Keep master gates (enabled, flexible) | 2 | 2 | 0 |
| **Total** | **38** | **18** | **20** |

### The 18 New Feature Keys

| # | Feature Key | Type | Replaces |
|---|---|---|---|
| 1 | `storefront_opt_enabled` | Master ON | (unchanged) |
| 2 | `storefront_opt_flexible` | Unlock all | (unchanged) |
| 3 | `storefront_opt_hours_display` | Standalone | (unchanged) |
| 4 | `storefront_opt_hours_animated` | Individual | (unchanged, group gate removed) |
| 5 | `storefront_opt_hours_status` | Individual | (unchanged, group gate removed) |
| 6 | `storefront_opt_category_store` | Individual | (unchanged, group gate removed) |
| 7 | `storefront_opt_category_product` | Individual | (unchanged, group gate removed) |
| 8 | `storefront_opt_recommend_store` | Individual | (unchanged, group gate removed) |
| 9 | `storefront_opt_recommend_products` | Individual | (unchanged, group gate removed) |
| 10 | `storefront_opt_recently_viewed` | Standalone | (unchanged) |
| 11 | `storefront_opt_info` | Consolidated group | `info_enabled` + `storefront_social_media` + `storefront_contact` + `interactive_maps` + `map_display` + `location_display` |
| 12 | `storefront_opt_qr` | Group gate | (unchanged) |
| 13 | `storefront_opt_qr_resolution` | Consolidated radio | `qr_codes_512` + `qr_codes_1024` + `qr_codes_2048` |
| 14 | `storefront_opt_qr_content` | Consolidated toggles | `qr_product` + `qr_store` + `qr_logo` + `qr_directory` |
| 15 | `storefront_opt_gallery` | Consolidated radio | `gallery_enabled` + `image_gallery_5` + `image_gallery_10` + `image_gallery_15` |
| 16 | `storefront_opt_enhanced_seo` | Individual | (unchanged, group gate removed) |
| 17 | `storefront_opt_storefront_actions` | Individual | (unchanged, group gate removed) |
| 18 | `storefront_opt_layout` | Consolidated radio | `layout_enabled` + `layout_classic` + `layout_editorial` + `layout_immersive` |

### Merchant Preferences (Unchanged)

Merchant prefs remain the same — they control sub-features within consolidated groups:
- `storefront_layout`: 'classic' | 'editorial' | 'immersive' (for `storefront_opt_layout`)
- `default_gallery_limit`: 5 | 10 | 15 (for `storefront_opt_gallery`)
- `default_qr_resolution`: '512' | '1024' | '2048' (for `storefront_opt_qr_resolution`)
- `qr_product`, `qr_store`, `qr_logo`, `qr_directory`: boolean (for `storefront_opt_qr_content`)
- `storefront_social_media`, `storefront_contact`, `interactive_maps`: boolean (for `storefront_opt_info`)
- `map_display`, `location_display`: boolean (for `storefront_opt_info`)
- All other individual toggles remain the same

## Backward Compatibility

### Resolver Fallback Strategy

The resolver checks new feature keys first, then falls back to old keys:

```ts
// Example: Info group
if (flexible || !!features.storefront_opt_info) {
  // New key: all info types allowed
  allowedInfoTypes.push('storefront_social_media', 'storefront_contact', 'interactive_maps');
} else {
  // Fallback: check old keys
  if (features.storefront_opt_info_enabled) {
    allowedInfoTypes.push('storefront_social_media', 'storefront_contact', 'interactive_maps');
  } else {
    if (features.storefront_opt_storefront_social_media) allowedInfoTypes.push('storefront_social_media');
    if (features.storefront_opt_storefront_contact) allowedInfoTypes.push('storefront_contact');
    if (features.storefront_opt_interactive_maps) allowedInfoTypes.push('interactive_maps');
  }
}
```

### Migration Strategy (Additive)

1. Insert 18 new feature keys into `features_list`
2. Link them to `storefront_options` capability type via `capability_features_list`
3. Copy tier assignments from old keys to new keys (same tier matrix)
4. Old keys remain in database — no data loss
5. Phase 8 cleanup removes old keys after all code migrated

## Files Modified

| File | Changes |
|---|---|
| `database/migrations/070_storefront_options_optimization.sql` | New feature keys + tier assignment copy |
| `apps/api/src/services/resolvers/StorefrontOptionsResolver.ts` | New key resolution with fallback |
| `apps/api/src/services/StorefrontOptionsService.ts` | New key resolution with fallback |
| `apps/api/src/services/resolvers/types.ts` | `StorefrontOptionsMerchantSettings` extended (additive) |
| `apps/web/src/services/CapabilityResolutionService.ts` | Fallback resolver updated |
| `apps/web/src/utils/storefrontOptions.ts` | Group metadata updated |
| `apps/web/src/app/t/.../StorefrontOptionsSettingsClient.tsx` | Settings interface updated |

## Resolver Output (Unchanged)

The `EffectiveStorefrontOptions` output shape remains identical. No frontend breaking changes.
