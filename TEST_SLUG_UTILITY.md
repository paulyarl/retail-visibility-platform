# Slug Utility Testing Guide

## Purpose
Verify that the centralized slug utility works consistently across frontend and backend.

## Test Cases

### Basic Slugification
```typescript
import { slugify } from '@/utils/slug'; // frontend
// import { slugify } from '../utils/slug'; // backend

// Test cases
slugify("Electronics store")     // "electronics-store"
slugify("Health & Beauty")       // "health-beauty"  
slugify("Restaurant/Pizza")      // "restaurant-pizza"
slugify("  Multiple   Spaces  ") // "multiple-spaces"
slugify("Special@#$%Chars")      // "special-chars"
```

### URL Generation
```typescript
import { getCategoryUrl, getStoreTypeUrl } from '@/utils/slug';

// Category URLs
getCategoryUrl({ name: "Electronics store" })           // "/directory/categories/electronics-store"
getCategoryUrl({ name: "Health & Beauty", slug: "custom" }) // "/directory/categories/custom"

// Store type URLs  
getStoreTypeUrl("Electronics store")                    // "/directory/stores/electronics-store"
getStoreTypeUrl("Restaurant/Pizza")                     // "/directory/stores/restaurant-pizza"
```

### Slug Matching
```typescript
import { slugsMatch } from '@/utils/slug';

// Should match
slugsMatch("electronics-store", "Electronics store")    // true
slugsMatch("health-beauty", "Health & Beauty")          // true
slugsMatch("restaurant-pizza", "Restaurant/Pizza")      // true

// Should not match
slugsMatch("electronics-store", "clothing-store")      // false
```

## Integration Points

### Frontend Usage
- **Storefront page**: `getCategoryUrl(category)` for GBP badges
- **Directory components**: `getStoreTypeUrl(storeType)` for navigation
- **Category pages**: `slugsMatch()` for robust slug comparison

### Backend Usage  
- **Store type service**: `slugify()` for generating slugs from category names
- **Category services**: `slugify()` for consistent slug generation
- **API responses**: Ensure slugs are URL-friendly

## Benefits Achieved

✅ **Single Source of Truth**: One slugify function used everywhere
✅ **Consistency**: Same URL format across all pages  
✅ **Maintainability**: Fix once, works everywhere
✅ **Future-Proof**: New pages can reuse existing utilities
✅ **Robust Matching**: Handles different slug formats gracefully

## Migration Complete

The following files now use the centralized slug utility:

**Frontend:**
- `apps/web/src/app/tenant/[id]/page.tsx` - Storefront GBP badges
- `apps/web/src/components/directory/DirectoryStoreTypeBrowser.tsx` - Directory navigation
- `apps/web/src/app/directory/categories/[categorySlug]/CategoryViewClient.tsx` - Category matching

**Backend:**
- `apps/api/src/services/store-type-directory.service.ts` - Store type slug generation

**New Utility Files:**
- `apps/web/src/utils/slug.ts` - Frontend slug utilities
- `apps/api/src/utils/slug.ts` - Backend slug utilities

## Testing Checklist

- [ ] Storefront GBP badges generate correct URLs
- [ ] Directory store type links work correctly  
- [ ] Category pages load with proper slug matching
- [ ] API returns properly formatted slugs
- [ ] Special characters are handled correctly
- [ ] Multiple spaces are normalized
- [ ] Edge hyphens are removed

The centralized slug utility ensures consistent URL generation across the entire platform!
