# Slug Pattern Selection Integration Audit

**Status:** 🔍 IN PROGRESS  
**Date:** February 1, 2026

## Objective

Integrate `SlugPatternSelector` component into **ALL** tenant and profile creation/editing points where business name entry is required.

---

## Integration Points Identified

### ✅ COMPLETED

**1. Shop Creation Wizard**
- **File:** `apps/web/src/components/shops/ShopCreationWizard.tsx`
- **Status:** ✅ COMPLETE (lines 282-296)
- **Integration:** SlugPatternSelector replaces manual slug input
- **Triggers:** Business name + location fields
- **Notes:** Full pattern selection with real-time availability

---

### 🔄 PENDING INTEGRATION

**2. Onboarding Wizard - Store Identity Step** ⭐ HIGH PRIORITY
- **File:** `apps/web/src/components/onboarding/StoreIdentityStep.tsx`
- **Status:** ⏳ PENDING
- **Current:** Business name, address, city, state, country inputs (no slug field)
- **Action:** Add SlugPatternSelector after business name field
- **Triggers:** business_name, city, state, country_code fields
- **Priority:** HIGH (primary onboarding flow for new tenants)
- **Impact:** Every new tenant goes through this flow

**3. Edit Business Profile Modal** ⭐ HIGH PRIORITY
- **File:** `apps/web/src/components/settings/EditBusinessProfileModal.tsx`
- **Status:** ⏳ PENDING
- **Current:** Full business profile editing
- **Action:** Add SlugPatternSelector with current slug display + regenerate option
- **Triggers:** business_name, city, state, country changes
- **Priority:** HIGH (existing tenants updating profiles)
- **Impact:** Allows manual slug regeneration when business details change

**4. Tenant Creation (TenantsClient)** 🔧 MEDIUM PRIORITY
- **File:** `apps/web/src/components/tenants/TenantsClient.tsx`
- **Status:** ⏳ PENDING
- **Current:** Simple name input modal (line 161: `api.post("/api/tenants", { name })`)
- **Action:** Expand modal to include location fields + SlugPatternSelector
- **Triggers:** Tenant name + optional location
- **Priority:** MEDIUM (admin/platform feature, less frequent)
- **Impact:** Platform admins creating tenants manually

**5. Business Profile Card (Settings)** 🔧 MEDIUM PRIORITY
- **File:** `apps/web/src/components/settings/BusinessProfileCard.tsx`
- **Status:** ⏳ PENDING
- **Current:** Displays business profile, likely has edit functionality
- **Action:** Ensure edit flow includes SlugPatternSelector
- **Triggers:** Business name edits
- **Priority:** MEDIUM (alternative to EditBusinessProfileModal)
- **Impact:** Settings page profile updates

**6. Directory Settings Panel** 🔧 LOW PRIORITY
- **File:** `apps/web/src/components/directory/DirectorySettingsPanel.tsx`
- **Status:** ⏳ PENDING
- **Current:** Directory listing settings
- **Action:** Add slug regeneration option if business name shown
- **Triggers:** Directory listing updates
- **Priority:** LOW (directory-specific settings)
- **Impact:** Manual slug override for directory listings

---

## Integration Strategy

### Phase 1: High Priority (New Tenant Creation)
1. ✅ Shop Creation Wizard (DONE)
2. ⏳ Onboarding Wizard - Store Identity Step
3. ⏳ Edit Business Profile Modal

### Phase 2: Medium Priority (Admin Tools)
4. ⏳ Tenant Creation Modal
5. ⏳ Business Profile Card

### Phase 3: Low Priority (Advanced Features)
6. ⏳ Directory Settings Panel

---

## Implementation Pattern

### For Creation Flows (New Tenants)
```tsx
<SlugPatternSelector
  businessName={formData.business_name}
  location={{
    city: formData.city,
    state: formData.state,
    country: formData.country_code,
  }}
  tenantId={undefined}  // No tenantId for new tenants
  selectedSlug={formData.slug}
  onSlugSelect={(slug) => updateFormData('slug', slug)}
/>
```

### For Edit Flows (Existing Tenants)
```tsx
<SlugPatternSelector
  businessName={formData.business_name}
  location={{
    city: formData.city,
    state: formData.state,
    country: formData.country_code,
  }}
  tenantId={tenantId}  // Include tenantId for collision checking
  selectedSlug={formData.slug || currentSlug}
  onSlugSelect={(slug) => updateFormData('slug', slug)}
/>
```

### With Current Slug Display
```tsx
<div className="space-y-4">
  <div className="bg-gray-50 p-3 rounded-lg">
    <p className="text-sm text-gray-600">Current URL:</p>
    <code className="text-sm font-mono">/shops/{currentSlug}</code>
  </div>
  
  <SlugPatternSelector
    businessName={formData.business_name}
    location={{ city, state, country }}
    tenantId={tenantId}
    selectedSlug={newSlug || currentSlug}
    onSlugSelect={setNewSlug}
  />
  
  {newSlug && newSlug !== currentSlug && (
    <Alert variant="info">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        Changing your URL will affect existing links and SEO.
      </AlertDescription>
    </Alert>
  )}
</div>
```

---

## Backend Integration Points

### Auto-Regeneration (Already Implemented ✅)
- `POST /api/tenant/profile` - Auto-regenerates slug on business name change
- `PATCH /api/tenant/profile` - Auto-regenerates slug on business name change

### Manual Regeneration API
- `POST /api/slugs/tenant/:tenantId/regenerate` - Manual slug regeneration
- `POST /api/slugs/patterns` - Get all available patterns
- `POST /api/slugs/generate-with-pattern` - Generate specific pattern

---

## Testing Checklist

### For Each Integration Point
- [ ] Business name triggers pattern fetch
- [ ] Location changes update patterns
- [ ] Availability checking works correctly
- [ ] Auto-selection of first available pattern
- [ ] Pattern selection updates form state
- [ ] Validation includes slug field
- [ ] Submission includes selected slug
- [ ] Error handling for API failures
- [ ] Loading states display correctly
- [ ] Debouncing prevents excessive API calls

### Edge Cases
- [ ] Empty business name (should hide selector)
- [ ] Very short business name (< 2 chars)
- [ ] Special characters in business name
- [ ] Missing location data
- [ ] All patterns taken (autoId fallback)
- [ ] Network errors during pattern fetch
- [ ] Rapid business name changes (debouncing)

---

## Benefits Per Integration

### Onboarding Wizard
- ✅ New tenants get professional URLs from day 1
- ✅ No manual slug entry errors
- ✅ Guided pattern selection
- ✅ Reduced onboarding friction

### Edit Profile Modal
- ✅ Existing tenants can update slugs when rebranding
- ✅ Clear visibility of URL changes
- ✅ SEO-friendly slug updates
- ✅ Manual override capability

### Tenant Creation
- ✅ Platform admins create tenants with proper slugs
- ✅ Consistent slug generation across all creation methods
- ✅ No orphaned tenants without slugs

---

## Migration Notes

### Existing Forms Without Slug Fields
For forms that currently don't have slug fields (like StoreIdentityStep), we need to:
1. Add `slug` to form data interface
2. Add SlugPatternSelector component
3. Include slug in submission payload
4. Update backend to accept slug in creation endpoint

### Forms With Manual Slug Entry
For forms with existing manual slug inputs:
1. Replace `<Input>` with `<SlugPatternSelector>`
2. Remove manual validation logic
3. Update onChange handlers
4. Keep fallback to manual entry if API fails

---

## Next Steps

1. **Integrate into Onboarding Wizard** (Store Identity Step)
2. **Integrate into Edit Business Profile Modal**
3. **Expand Tenant Creation Modal** (add location + slug selection)
4. **Update Business Profile Card** (ensure edit flow has slug selection)
5. **Add to Directory Settings** (optional manual override)
6. **Comprehensive Testing** (all integration points)
7. **Documentation Update** (user guides for slug selection)

---

## Success Metrics

### Before Integration
- ❌ Manual slug entry in some flows
- ❌ No slug validation in onboarding
- ❌ Inconsistent slug generation
- ❌ No pattern selection guidance

### After Integration
- ✅ 100% of creation flows have slug selection
- ✅ Real-time availability checking everywhere
- ✅ Consistent pattern selection UX
- ✅ Zero manual slug entry errors
- ✅ Professional URLs for all new tenants
