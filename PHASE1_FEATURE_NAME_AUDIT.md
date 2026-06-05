# Phase 1 Feature Name Audit Results

**Status:** 🔴 CRITICAL CONFLICTS FOUND  
**Date:** November 19, 2025  
**Priority:** Emergency fix required

## Critical Feature Name Conflicts Identified

### 🔥 CONFLICT #1: Barcode Scanning Feature
```typescript
// Backend (tier-access.ts line 40):
'barcode_scan'          // ✅ Source of truth

// Frontend (tier-features.ts line 31):
'product_scanning'      // ❌ DIFFERENT NAME!

// Result: Backend allows → Frontend blocks = Mixed results
```

### 🔥 CONFLICT #2: Quick Start Variants
```typescript
// Backend (tier-access.ts line 39):
'quick_start_wizard'    // ✅ Source of truth

// Frontend useTenantTier.ts (line 224):
'quick_start_wizard_full'  // ❌ Different variant!

// Frontend tier-features.ts (line 30):
'quick_start_wizard'    // ✅ Matches backend
```

## Complete Feature Comparison Matrix

| Feature Category | Backend (tier-access.ts) | Frontend (tier-features.ts) | Status | Action Required |
|------------------|--------------------------|------------------------------|--------|-----------------|
| **Professional Tier** | | | | |
| Quick Start | `quick_start_wizard` | `quick_start_wizard` | ✅ Match | None |
| Scanning | `barcode_scan` | `product_scanning` | ❌ Conflict | **Fix frontend** |
| GBP Integration | `gbp_integration` | `gbp_integration` | ✅ Match | None |
| Custom Branding | `custom_branding` | `custom_branding` | ✅ Match | None |
| Business Logo | `business_logo` | `business_logo` | ✅ Match | None |
| QR Codes | `qr_codes_1024` | `qr_codes_1024` | ✅ Match | None |
| Image Gallery | `image_gallery_5` | `image_gallery_5` | ✅ Match | None |
| **Organization Tier** | | | | |
| Product Propagation | `propagation_products` | `propagation_products` | ✅ Match | None |
| Category Propagation | `propagation_categories` | `propagation_categories` | ✅ Match | None |
| GBP Sync Propagation | `propagation_gbp_sync` | `propagation_gbp_sync` | ✅ Match | None |
| Hours Propagation | `propagation_hours` | `propagation_hours` | ✅ Match | None |
| Profile Propagation | `propagation_profile` | `propagation_profile` | ✅ Match | None |
| Flags Propagation | `propagation_flags` | `propagation_flags` | ✅ Match | None |
| Roles Propagation | `propagation_roles` | `propagation_roles` | ✅ Match | None |

## Additional Conflicts in useTenantTier.ts

### Feature Mapping Object (lines 208-244)
```typescript
// Current problematic mappings:
const featureTierMap: Record<string, { tier: string; badge: string; tooltip: string; color: string }> = {
  // Organization tier features
  'propagation': {  // ❌ Generic name, should be specific
    tier: 'organization', 
    badge: 'ORG', 
    tooltip: 'Requires Organization tier - Upgrade to propagate to all locations',
    color: 'bg-gradient-to-r from-blue-600 to-cyan-600'
  },
  
  // Professional tier features
  'barcode_scan': {  // ✅ Matches backend
    tier: 'professional',
    badge: 'PRO+',
    tooltip: 'Requires Professional tier or higher - Upgrade for barcode scanning',
    color: 'bg-gradient-to-r from-purple-600 to-pink-600'
  },
  'quick_start_wizard_full': {  // ❌ Different variant!
    tier: 'professional', 
    badge: 'PRO+', 
    tooltip: 'Requires Professional tier or higher - Upgrade for full Quick Start wizard',
    color: 'bg-gradient-to-r from-purple-600 to-pink-600'
  },
};
```

## Canonical Feature Names (Backend = Source of Truth)

Based on `apps/api/src/middleware/tier-access.ts`, these are the authoritative feature names:

### Professional Tier Features:
- ✅ `quick_start_wizard`
- ✅ `barcode_scan` (NOT `product_scanning`)
- ✅ `gbp_integration`
- ✅ `custom_branding`
- ✅ `business_logo`
- ✅ `qr_codes_1024`
- ✅ `image_gallery_5`
- ✅ `interactive_maps`
- ✅ `privacy_mode`
- ✅ `custom_marketing_copy`
- ✅ `priority_support`

### Organization Tier Features:
- ✅ `propagation_products`
- ✅ `propagation_categories`
- ✅ `propagation_gbp_sync`
- ✅ `propagation_hours`
- ✅ `propagation_profile`
- ✅ `propagation_flags`
- ✅ `propagation_roles`
- ✅ `propagation_brand`
- ✅ `organization_dashboard`
- ✅ `hero_location`
- ✅ `strategic_testing`
- ✅ `unlimited_locations`
- ✅ `shared_sku_pool`
- ✅ `centralized_control`

## Immediate Actions Required

### 1. Emergency Fix (Deploy Today)
```typescript
// Add to useTenantTier.ts - Feature name mapping
const EMERGENCY_FEATURE_MAPPING: Record<string, string> = {
  'product_scanning': 'barcode_scan',  // Map frontend name to backend
  'quick_start_wizard_full': 'quick_start_wizard',  // Normalize variants
  'propagation': 'propagation_products',  // Default propagation to products
};

const normalizeFeatureId = (featureId: string): string => {
  return EMERGENCY_FEATURE_MAPPING[featureId] || featureId;
};
```

### 2. Frontend Updates (This Week)
- [ ] Update `tier-features.ts` line 31: `'product_scanning'` → `'barcode_scan'`
- [ ] Update `useTenantTier.ts` line 224: `'quick_start_wizard_full'` → `'quick_start_wizard'`
- [ ] Update `useTenantTier.ts` line 210: `'propagation'` → `'propagation_products'`

### 3. Validation Required
- [ ] Search for all references to `'product_scanning'` and replace
- [ ] Search for all references to `'quick_start_wizard_full'` and replace
- [ ] Test barcode scanning access for Professional tier users
- [ ] Test Quick Start access for Professional tier users

## Files to Modify

### High Priority (This Week):
1. `apps/web/src/lib/tiers/tier-features.ts` - Line 31
2. `apps/web/src/hooks/dashboard/useTenantTier.ts` - Lines 210, 224
3. Any components using `'product_scanning'` feature checks

### Medium Priority (Next Week):
1. Update any documentation referencing old feature names
2. Add validation tests to prevent future conflicts
3. Create feature name linting rules

## Testing Checklist

### Critical Tests (Run Today):
- [ ] Platform admin can access barcode scanning
- [ ] Professional tier user can access barcode scanning
- [ ] Professional tier user can access Quick Start wizard
- [ ] Organization tier user can access propagation features

### Regression Tests (Run This Week):
- [ ] All existing feature access still works
- [ ] No new access denied errors in logs
- [ ] Feature badges display correctly
- [ ] Upgrade prompts show correct tier requirements

## Success Metrics

### Immediate (Today):
- [ ] 0 "access denied" errors for barcode scanning
- [ ] 0 "access denied" errors for Quick Start wizard
- [ ] Platform admin can access all features

### This Week:
- [ ] 100% feature name consistency between frontend/backend
- [ ] 0 feature name conflicts in codebase
- [ ] All tier checks use canonical feature names

---

**Next Steps:**
1. Deploy emergency feature mapping fix
2. Update frontend feature names to match backend
3. Add validation to prevent future conflicts
4. Move to Phase 1.2: Platform Admin Bypass Consolidation
