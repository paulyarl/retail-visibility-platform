# /tenant/[id] Page - Complete Data Audit

## Overview
The `/tenant/[id]` page is a public storefront page that displays a tenant's business information, featured products, categories, hours, and contact information.

---

## Data Requirements & API Endpoints

### 1. **Tenant Basic Information**
**Required Data:**
- `id` - Tenant ID
- `name` - Business name
- `metadata.businessName` - Display name
- `metadata.logo_url` - Logo image
- `metadata.address` - Full address
- `metadata.phone` - Phone number
- `metadata.email` - Email
- `metadata.website` - Website URL
- `metadata.social_links` - Social media links
- `metadata.business_description` - Description
- `metadata.gbp_categories` - Google Business Profile categories
- `subscription_tier` - Subscription tier
- `location_status` - Location status
- `access.storefront` - Storefront access flag

**Current API Endpoint:**
✅ `/public/tenant/:tenantId` - Returns tenant basic info
- **Status:** WORKING (fixed in TenantInfoSingletonService)
- **Service:** `tenantInfoService.getTenantInfo(tenantId)`

---

### 2. **Business Profile**
**Required Data:**
- `business_name` - Business name
- `phone_number` - Phone
- `email` - Email
- `website` - Website
- `address_line1` - Address line 1
- `address_line2` - Address line 2
- `city` - City
- `state` - State
- `postal_code` - Postal code
- `logo_url` - Logo
- `business_description` - Description
- `social_links` - Social media
- `metadata` - Additional metadata

**Current API Endpoint:**
✅ `/public/tenant/:tenantId/profile` - Returns business profile
- **Status:** WORKING (fixed in TenantInfoSingletonService)
- **Service:** `tenantInfoService.getBusinessProfile(tenantId)`

---

### 3. **Business Hours**
**Required Data:**
- Hours for each day of week (monday-sunday)
- Special hours
- Current status (open/closed)
- Next status change time

**Current API Endpoints:**
✅ `/api/tenant/:tenantId/business-hours` - Returns business hours
- **Status:** WORKING
- **Service:** `tenantInfoService.getBusinessHours(tenantId)`

✅ `/public/tenant/:tenantId/business-hours/status` - Returns current status
- **Status:** WORKING
- **Used by:** HoursStatusSingleton

---

### 4. **Payment Gateways**
**Required Data:**
- Gateway type
- Active status
- Gateway name

**Current API Endpoint:**
✅ `/public/tenant/:tenantId/payment-gateways` - Returns active gateways
- **Status:** WORKING
- **Service:** `tenantInfoService.getPaymentGateways(tenantId)`

---

### 5. **Featured Products** ⚠️ ISSUE FOUND
**Required Data:**
- `totalCount` - Total featured products
- `buckets[]` - Array of featured buckets
  - `bucketType` - Type (staff_pick, seasonal, sale, new_arrival, store_selection)
  - `totalCount` - Count in bucket
  - `products[]` - Array of products
    - `id`, `name`, `sku`, `brand`, `description`
    - `priceCents`, `salePriceCents`
    - `stock`, `availability`
    - `imageUrl`
    - `categoryName`, `condition`
    - `hasVariants`
    - `featuredType`

**Current API Endpoint:**
❌ `/api/storefront/:tenantId/featured-products?limit=50` - Returns featured products
- **Status:** RETURNING EMPTY DATA (cached)
- **Service:** `featuredProductsSingleton.getAllFeaturedProducts(tenantId, 20)`
- **Issue:** Cache contains empty data `{ totalCount: 0, buckets: [] }`
- **Working on /shops/ page:** Same endpoint works on `/shops/` route

**Root Cause:**
The cache key `featured-products-tid-m8ijkrnk-20` contains stale empty data. The `/shops/` page successfully fetches fresh data, but `/tenant/` page is using the cached empty response.

**Solution:**
Need to either:
1. Clear the cache (emergency bust)
2. Ensure cache invalidation on data changes
3. Add cache TTL check before using cached data

---

### 6. **Product Categories**
**Required Data:**
- `categories[]` - Array of categories
  - `id` - Category ID
  - `name` - Category name
  - `slug` - URL slug
  - `count` - Product count
  - `googleCategoryId` - Google category mapping
  - `category_type` - Type (platform/store)
  - `is_primary` - Primary flag

**Current API Endpoint:**
✅ `/api/storefront/:tenantId/categories` - Returns categories with counts
- **Status:** WORKING
- **Service:** `storefrontService.getStorefrontCategories(tenantId)`
- **Returns:** `{ categories: [], uncategorizedCount: 0 }`

---

### 7. **Map Location**
**Required Data:**
- `latitude` - Latitude
- `longitude` - Longitude
- `address` - Full address

**Current Implementation:**
✅ `getTenantMapLocation(tenantId)` - Utility function
- **Status:** WORKING
- **Source:** `apps/web/src/lib/map-utils.ts`

---

### 8. **Platform Settings**
**Required Data:**
- `platformName` - Platform name
- `logoUrl` - Platform logo

**Current API Endpoint:**
✅ `/platform-settings` - Returns platform settings
- **Status:** WORKING
- **Service:** `platformSettingsService.getPlatformSettings()`

---

### 9. **Directory Listing**
**Required Data:**
- `slug` - Store slug
- `published` - Published status

**Current API Endpoints:**
✅ `/api/directory/tenant/:tenantId` - Returns directory listing
- **Status:** WORKING
- **Service:** `tenantDirectoryService.getTenantSlug(tenantId)`

✅ `/api/directory/:tenantId` - Returns directory data
- **Status:** WORKING
- **Service:** `storefrontService.getDirectoryListing(tenantId)`

---

### 10. **Total Product Count**
**Required Data:**
- Total number of products for tenant

**Current API Endpoint:**
✅ `/api/storefront/:tenantId/products` - Returns paginated products
- **Status:** WORKING
- **Service:** `storefrontService.getTotalProductCount(tenantId)`
- **Returns:** Total count from pagination metadata

---

## Component Breakdown

### StorefrontClientWrapper (Client Component)
**Props Required:**
1. ✅ `tenantId` - From URL params
2. ✅ `tenant` - From getTenantInfo
3. ✅ `platformSettings` - From getPlatformSettings
4. ✅ `mapLocation` - From getTenantMapLocation
5. ✅ `hasBranding` - Computed from logo/hours
6. ✅ `businessHours` - From getBusinessHours
7. ✅ `storeStatus` - Computed from businessHours
8. ✅ `categories` - From getStorefrontCategories
9. ✅ `productCategories` - Same as categories
10. ✅ `storeCategories` - Filtered categories
11. ✅ `uncategorizedCount` - From getStorefrontCategories
12. ✅ `paymentGateways` - From getPaymentGateways
13. ✅ `businessName` - From tenant metadata
14. ✅ `search` - From URL query params
15. ✅ `category` - From URL query params
16. ✅ `featured` - From URL query params
17. ✅ `view` - From URL query params
18. ✅ `isProductsOnly` - From URL query params
19. ✅ `apiBaseUrl` - From env
20. ✅ `directoryPublished` - From getDirectoryListing
21. ✅ `tenantSlug` - From getTenantSlug
22. ✅ `primaryGBPCategory` - From tenant metadata
23. ✅ `secondaryGBPCategories` - From tenant metadata
24. ✅ `tier` - From tenant.subscription_tier
25. ✅ `features` - From getLandingPageFeatures(tier)
26. ✅ `totalAllProducts` - From getTotalProductCount

**Client-Side Data Fetching:**
❌ `featuredData` - Fetched via `featuredProductsSingleton.getAllFeaturedProducts(tenantId, 20)`
  - **Issue:** Returns empty cached data
  - **Endpoint:** `/api/storefront/:tenantId/featured-products?limit=50`

---

## Issues Identified

### 🔴 Critical Issue: Empty Featured Products
**Problem:** Featured products cache contains empty data
**Impact:** Page loads but shows no featured product sections
**Location:** Line 93 in StorefrontClientWrapper.tsx
**Cache Key:** `featured-products-tid-m8ijkrnk-20`
**Cached Data:** `{ totalCount: 0, buckets: [], lastUpdated: "2026-02-01T16:15:28.265Z" }`

**Evidence from Logs:**
```
[CacheManager] IndexedDB cache HIT: featured-products-tid-m8ijkrnk-20
Featured data response: Object { totalCount: 0, buckets: [], lastUpdated: "2026-02-01T16:15:28.265Z" }
```

**Working Comparison:**
The `/shops/tid-m8ijkrnk` page successfully fetches featured products:
```
GET /api/storefront/tid-m8ijkrnk/featured-products?limit=50 200 116.810 ms - 135034
```

---

## Recommendations

### Immediate Fix
1. **Clear stale cache:**
   ```javascript
   window.emergencyBust("refresh featured products")
   ```

2. **Verify API endpoint returns data:**
   - Test: `GET /api/storefront/tid-m8ijkrnk/featured-products?limit=50`
   - Should return products with buckets

### Long-term Fixes
1. **Add cache validation:**
   - Check if cached data is empty before using
   - Force fresh fetch if `totalCount === 0 && buckets.length === 0`

2. **Implement cache invalidation:**
   - Clear featured products cache when products are updated
   - Add TTL check before using cached data

3. **Add fallback behavior:**
   - If featured products are empty, show regular products
   - Display message: "No featured products yet"

---

## API Endpoint Summary

| Endpoint | Status | Service | Purpose |
|----------|--------|---------|---------|
| `/public/tenant/:tenantId` | ✅ WORKING | TenantInfoSingletonService | Basic tenant info |
| `/public/tenant/:tenantId/profile` | ✅ WORKING | TenantInfoSingletonService | Business profile |
| `/api/tenant/:tenantId/business-hours` | ✅ WORKING | TenantInfoSingletonService | Business hours |
| `/public/tenant/:tenantId/business-hours/status` | ✅ WORKING | HoursStatusSingleton | Current open/closed status |
| `/public/tenant/:tenantId/payment-gateways` | ✅ WORKING | TenantInfoSingletonService | Payment gateways |
| `/api/storefront/:tenantId/featured-products` | ❌ EMPTY CACHE | FeaturedProductsSingleton | Featured products |
| `/api/storefront/:tenantId/categories` | ✅ WORKING | StorefrontSingletonService | Product categories |
| `/api/directory/tenant/:tenantId` | ✅ WORKING | TenantDirectorySingletonService | Directory slug |
| `/api/directory/:tenantId` | ✅ WORKING | StorefrontSingletonService | Directory listing |
| `/platform-settings` | ✅ WORKING | PlatformSettingsSingletonService | Platform branding |

---

## Next Steps

1. ✅ Fixed `/tenant/` route 404 (removed middleware redirect)
2. ✅ Fixed TenantInfoSingletonService data access (result vs result.data)
3. ⚠️ **CURRENT:** Clear featured products cache or fix empty data issue
4. ⏳ Verify all components render with correct data
5. ⏳ Test page functionality end-to-end
