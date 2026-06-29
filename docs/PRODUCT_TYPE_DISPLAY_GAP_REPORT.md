# Product Type Display Architecture — Gap Report

**Date:** 2026-06-27  
**Status:** Analysis Complete — Awaiting Implementation  
**Scope:** Product display cards across all surfaces (storefront, featured, directory, product detail, recommendations, recently viewed, shopping cart, variant display)

---

## Executive Summary

The platform supports 4 product types — **physical**, **digital**, **service**, **hybrid** — but display architecture is split: the storefront page and product detail page are fully type-aware, while **every other surface** that displays product cards is **completely type-blind**. This includes 12+ distinct components using `SmartProductCard` across storefronts, directory, recommendations, recently viewed, featured buckets, and product detail sub-sections — plus the shopping cart and variant selector, which have their own type-related issues. Digital, service, and hybrid products render with physical-specific UI (stock counts, "Add to Cart", out-of-stock badges, quantity steppers) in all of these surfaces.

---

## Current Architecture

### Type-Specific Surfaces (Working Correctly)

#### 1. Storefront Page (`/tenant/[id]`)
`StorefrontClientWrapper.tsx` buckets products by `productType` into 4 arrays and renders each with a dedicated section + custom card:

| Type | Section Component | Card Component | CTA | Type-Specific UI |
|------|------------------|----------------|-----|-----------------|
| Physical | `ProductSection` | `SmartProductCard` | Add to Cart | Stock, variants, featured badges |
| Service | `ServiceSection` | `ServiceCard` | Book Now (BookingCTA) | Duration, service area, provider, pricing model |
| Digital | `DigitalSection` | `DigitalCard` | Get (download icon) | File type, file size, license type, download limit |
| Hybrid | `HybridSection` | `HybridCard` | View | Physical + digital component indicators |

- Each section supports 3 layout variants: `classic`, `editorial`, `immersive`
- Each section is capability-gated: `product_service_enabled`, `product_digital_enabled`, `product_hybrid_enabled`
- Bucketing logic at `StorefrontClientWrapper.tsx:233-258`

#### 2. Product Detail Page (`/products/[id]`)
`ProductTypeSection` switches on `resolvedType` to render type-specific info blocks:

| Type | Info Blocks |
|------|------------|
| Physical | StockStatusInfo, ShippingInfo, ConditionInfo |
| Digital | DigitalDownloadInfo, LicenseInfo, AccessDurationInfo |
| Hybrid | StockStatusInfo, ShippingInfo, ConditionInfo, DigitalDownloadInfo, LicenseInfo, AccessDurationInfo |
| Service | ServiceBookingCTA, ServiceDurationInfo, ServiceAreaInfo |

`ProductPurchasePanel` also branches:
- `product.productType === 'service'` → adjusts purchase UI
- `product.productType === 'hybrid'` → adjusts purchase UI
- Shows type badge with icon: Package (physical), Download (digital), Globe (hybrid), Calendar (service)

---

## Gaps Identified

### GAP-1: `SmartProductCard` is completely type-blind

**Severity:** High  
**Impact:** All 4 card variants (featured, grid, list, compact) render identically regardless of product type  
**File:** `apps/web/src/components/products/SmartProductCard.tsx`

The `productType` field exists in the `ProductData` interface and is passed by some callers, but the card never reads it. Consequences for non-physical products:

| Issue | Physical | Digital | Service | Hybrid |
|-------|----------|---------|---------|--------|
| Stock count display | Correct | Irrelevant (digital has no stock) | Irrelevant (services have no stock) | Misleading (only physical component has stock) |
| "Out of Stock" badge | Correct | Never applicable | Never applicable | Misleading |
| CTA button text | "Add to Cart" | Should be "Get" or "Download" | Should be "Book Now" | Should be "View Details" |
| Type-specific metadata | N/A | Missing: file type, file size, license, download limit | Missing: duration, service area, provider, pricing model | Missing: physical + digital component indicators |
| Type badge/indicator | N/A | Missing | Missing | Missing |
| Add-to-cart flow | Correct | Should be instant access / download link | Should be booking flow | Should be hybrid flow |

### GAP-2: `StorefrontFeaturedProducts` segments by featured badge, not product type

**Severity:** Medium  
**Impact:** Featured service/digital/hybrid products display with physical UI in featured sections  
**File:** `apps/web/src/components/storefront/StorefrontFeaturedProducts.tsx`

Featured sections are organized by badge type (store_selection, new_arrival, seasonal, sale, staff_pick). A service product featured as "new_arrival" renders with "Add to Cart" and stock indicators instead of "Book Now" and duration. The `productType` field IS passed to `SmartProductCard` (line 526), but `SmartProductCard` ignores it (GAP-1).

### GAP-3: 10 of 12 `SmartProductCard` callers don't pass `productType`

**Severity:** High  
**Impact:** Even if `SmartProductCard` becomes type-aware, most surfaces can't use it because the data isn't passed  
**Files:** 10 components (see full surface inventory below)

Only 2 callers pass `productType` today:
- `StorefrontFeaturedProducts.tsx` (line 526) — passes it but `SmartProductCard` ignores it
- `ProductSection.tsx` (within `StorefrontClientWrapper`) — passes full product object which includes `productType`

The following 10 callers **omit** `productType` from the product prop:

| # | File | Surface | Variant Used |
|---|------|---------|-------------|
| 1 | `RandomFeaturedProducts.tsx` | Directory random featured | `featured` |
| 2 | `ProductDisplay.tsx` | Storefront grid/gallery view | `grid` |
| 3 | `ProductRecommendations.tsx` | "You Might Also Like" on product detail | `compact` |
| 4 | `FeaturedTypeProducts.tsx` | "More from this store" featured buckets on product detail | `grid` |
| 5 | `FeaturedBucket.tsx` | Storefront featured bucket showcase | `featured` |
| 6 | `LastViewed.tsx` | "Recently Viewed" on directory & product pages | `featured` or `grid` |
| 7 | `DirectoryEntryClassicLayout.tsx` | Directory entry — featured products | `featured` |
| 8 | `DirectoryEntryEditorialLayout.tsx` | Directory entry — featured products | `featured` |
| 9 | `DirectoryEntryImmersiveLayout.tsx` | Directory entry — featured products | `featured` |
| 10 | `DirectoryEntryPremiumLayout.tsx` | Directory entry — featured products | `featured` |

Additional consumers to audit (may use `SmartProductCard` indirectly):
- `UniversalDirectoryGrid.tsx`
- `ShopsPageClient.tsx`
- `EnhancedStorefrontProductCard.tsx`
- `ProductCardLayouts.tsx`
- `StorefrontImmersiveLayout.tsx` (uses `SmartProductCard` for physical grid + custom sections for other types)

### GAP-5: No type badge on product cards

**Severity:** Low  
**Impact:** Users can't distinguish product types at a glance in card views  
**Files:** `SmartProductCard.tsx`, `RandomFeaturedProducts.tsx`

The product detail page shows a type badge with icon (Package/Download/Globe/Calendar). No equivalent exists on any card variant. The storefront's custom cards (`DigitalCard`, `ServiceCard`, `HybridCard`) have colored badges ("Digital" blue, "Hybrid" purple) but `SmartProductCard` has none.

### GAP-6: `AddToCartButton` has no type awareness

**Severity:** Medium  
**Impact:** Add-to-cart button renders for digital/service products where a different CTA is needed  
**File:** `apps/web/src/components/products/SmartProductCard.tsx` (lines 807-816, 1035-1044)

The purchase UI in `SmartProductCard` always renders `AddToCartButton` for non-variant products. For services, it should render a booking CTA. For digital, it should render a "Get" or "Download" button. The storefront's custom `ServiceCard` uses `BookingCTA` instead.

### GAP-7: Shopping cart display is type-blind

**Severity:** Medium  
**Impact:** Cart shows physical-specific UI (stock limits, quantity steppers) for all product types  
**File:** `apps/web/src/app/carts/page.tsx`

The multi-cart page at `/carts` renders cart items with:
- **Stock-based quantity limits** (lines 356-370): `item.stock` used to cap quantity — irrelevant for digital (unlimited copies) and service (booking quantity differs)
- **Quantity steppers** (lines 346-374): +/- buttons assume physical inventory model — digital products are typically 1-license-per-purchase; services may have booking slots
- **No type badge or indicator**: Cart items show only name, variant, price — no indication whether item is physical/digital/service/hybrid
- **No type-specific fulfillment info**: Digital items should show download link after purchase; services should show booking date/time; hybrids should show both shipping + download info
- **"Add More Items" link** (line 390): Links to storefront but doesn't differentiate by product type

The cart item interface (from `useMultiCart` hook) likely doesn't carry `productType` — this needs to be threaded through from the product data at add-to-cart time.

### GAP-8: Variant selector and display assume physical products

**Severity:** Low-Medium  
**Impact:** Variant UI shows stock-based availability and physical attributes for all product types  
**Files:** `ProductVariantSelector.tsx`, `VariantInfoCard.tsx`, `VariantBadge.tsx`

`ProductVariantSelector.tsx`:
- **Stock-based availability** (line 114): `isAvailable = matchingVariants.some(v => v.stock > 0)` — digital variants don't have stock; service variants have booking slot availability
- **"Out of Stock" labels** (line 347): Shown for unavailable variants — should say "Unavailable" or "Fully Booked" for services
- **No type awareness**: Renders identically for physical, digital, service, hybrid products
- Variants are primarily a physical-product concept, but digital (e.g., license tiers) and service (e.g., duration options) products could have variant-like selections

`VariantInfoCard.tsx`:
- Shows variant count, price range, available attributes — all physical-centric labels
- No type badge or type-specific attribute labeling

### GAP-9: Product recommendations lack type context

**Severity:** Low  
**Impact:** Recommendations don't consider product type affinity  
**File:** `apps/web/src/components/products/ProductRecommendations.tsx`

The `RecommendedProduct` interface (lines 10-28) doesn't include `productType`. The recommendations API (`recommendationsService.getProductPageRecommendations`) may or may not return it. Even if the API returns it, the component strips it when constructing the `SmartProductCard` product prop (lines 101-119). A service product might get physical product recommendations, and vice versa. Type-aware recommendations would improve relevance (e.g., service products recommend other services).

### GAP-10: API services don't select or map `product_type` from the MV

**Severity:** High  
**Impact:** Even if frontend callers are fixed, `productType` will be `undefined` because the API never returns it  
**Files:** 4 backend services

The materialized view `mv_storefront_discovery` **has** `product_type` and derived boolean flags (`is_digital_product`, `is_physical_product`, `is_service`) at `create_scope_aware_mvs.sql:597-609`. However, 4 of the 6 API services that feed `SmartProductCard` callers don't select or map it:

| Service | File | Selects `product_type`? | Maps to response? | Feeds which frontend surface? |
|---------|------|------------------------|-------------------|-------------------------------|
| DiscoveryService | `DiscoveryService.ts` | **Yes** (7 queries) | Yes | Storefront products, directory |
| Storefront API route | `routes/storefront.ts` | **Yes** | Yes (`productType: row.product_type`) | Storefront grid, `StorefrontClientWrapper` |
| Storefront Featured route | `routes/storefront-featured.ts` | **Yes** | Yes (`productType: product.product_type`) | `StorefrontFeaturedProducts`, `FeaturedBucket` |
| Public API route | `routes/public-api.ts` | **Yes** | Yes (`productType: item.product_type`) | `RandomFeaturedProducts`, directory entry |
| SingleProductService | `SingleProductService.ts` | **Yes** (Prisma select) | Yes (`productType: product.product_type`) | Product detail page |
| **FeaturedService** | `FeaturedService.ts` | **No** (uses `SELECT mv.*` so column is fetched, but `transformFeaturedProduct()` lines 252-326 **does not map it**) | **No** | `StorefrontFeaturedProducts` (fallback path) |
| **FeaturedProductsSingletonService** | `FeaturedProductsSingletonService.ts` | **No** (explicit column list at lines 297-313 omits it) | **No** | `FeaturedProductsSingletonService` consumers |
| **FeaturedProductsService** | `FeaturedProductsService.ts` | **No** (explicit column lists in `generateTrendingProducts` and `generateRecommendedProducts` omit it) | **No** | Trending/recommended featured products |
| **RecommendationService** | `recommendationService.ts` | **No** (selects 40+ columns from MV but omits `product_type`) | **No** | `ProductRecommendations.tsx` |

**Root cause:** The services that use explicit column lists (instead of `SELECT mv.*`) were written before `product_type` was added to the MV, and the column lists were never updated. `FeaturedService.ts` uses `SELECT mv.*` so the column is technically in the result set, but `transformFeaturedProduct()` silently drops it by not mapping it to the response object.

**This is a blocking dependency for Phase 1.** No amount of frontend fixing will help if the API doesn't return `product_type`.

---

## Data Flow Architecture

```
Database (inventory_items.product_type)
  ↓
MV (mv_storefront_discovery.product_type + is_digital_product + is_physical_product + is_service)  ✅
  ↓
API Service Layer  ← GAP-10: 4 of 6 services don't select/map product_type
  ↓
API Route Response  ← GAP-10: field missing from JSON response
  ↓
Frontend Caller Component  ← GAP-3: 10 of 13 callers don't pass productType to SmartProductCard
  ↓
SmartProductCard  ← GAP-1: ignores productType even when present
  ↓
Rendered Card  ← Physical-specific UI for all types
```

---

## Complete Surface Inventory

### Surfaces Using `SmartProductCard` (22 files, 12 direct callers)

| # | Surface | File | Card Variant | Passes `productType`? | Type-Aware? |
|---|---------|------|-------------|----------------------|-------------|
| 1 | Storefront physical section | `ProductSection.tsx` | grid, list | Yes (full product) | No (GAP-1) |
| 2 | Storefront featured products | `StorefrontFeaturedProducts.tsx` | featured | Yes (line 526) | No (GAP-1) |
| 3 | Storefront featured buckets | `FeaturedBucket.tsx` | featured | No (GAP-3) | No (GAP-1) |
| 4 | Storefront grid/gallery | `ProductDisplay.tsx` | grid | No (GAP-3) | No (GAP-1) |
| 5 | Storefront immersive layout | `StorefrontImmersiveLayout.tsx` | grid | No (GAP-3) | No (GAP-1) |
| 6 | Directory random featured | `RandomFeaturedProducts.tsx` | featured | No (GAP-3) | No (GAP-1) |
| 7 | Directory entry — classic | `DirectoryEntryClassicLayout.tsx` | featured | No (GAP-3) | No (GAP-1) |
| 8 | Directory entry — editorial | `DirectoryEntryEditorialLayout.tsx` | featured | No (GAP-3) | No (GAP-1) |
| 9 | Directory entry — immersive | `DirectoryEntryImmersiveLayout.tsx` | featured | No (GAP-3) | No (GAP-1) |
| 10 | Directory entry — premium | `DirectoryEntryPremiumLayout.tsx` | featured | No (GAP-3) | No (GAP-1) |
| 11 | Recently viewed | `LastViewed.tsx` | featured, grid | No (GAP-3) | No (GAP-1) |
| 12 | Product recommendations | `ProductRecommendations.tsx` | compact | No (GAP-3) | No (GAP-1) |
| 13 | Featured type products | `FeaturedTypeProducts.tsx` | grid | No (GAP-3) | No (GAP-1) |

### Surfaces Using Custom Cards (Type-Aware, Working Correctly)

| # | Surface | File | Card Used | Type-Aware? |
|---|---------|------|-----------|-------------|
| 1 | Storefront service section | `ServiceSection.tsx` | `ServiceCard` | Yes — BookingCTA, duration, area, provider |
| 2 | Storefront digital section | `DigitalSection.tsx` | `DigitalCard` | Yes — file type, size, license, download limit |
| 3 | Storefront hybrid section | `HybridSection.tsx` | `HybridCard` | Yes — physical + digital component indicators |
| 4 | Product detail — type info | `ProductTypeSection.tsx` | N/A (info blocks) | Yes — switch on resolvedType |
| 5 | Product detail — purchase | `ProductPurchasePanel.tsx` | N/A (panel) | Yes — type badge, type-specific purchase UI |

### Surfaces With Their Own Type-Related Gaps

| # | Surface | File | Gap | Issue |
|---|---------|------|-----|-------|
| 1 | Shopping cart | `carts/page.tsx` | GAP-7 | Stock limits, quantity steppers, no type badge for all types |
| 2 | Variant selector | `ProductVariantSelector.tsx` | GAP-8 | Stock-based availability, "Out of Stock" labels, no type awareness |
| 3 | Variant info card | `VariantInfoCard.tsx` | GAP-8 | Physical-centric labels, no type badge |
| 4 | Storefront recommendations | `StorefrontClient.tsx` | N/A | Uses `UnifiedStoreCard` (store recs, not product cards) |

### Architecture Comparison Summary

| Surface Category | Type-Segmented? | Passes `productType`? | Type-Aware Rendering? |
|-----------------|----------------|----------------------|---------------------|
| Storefront type sections (4) | Yes | N/A (dedicated cards) | Yes |
| Product detail page | N/A (single product) | N/A (reads directly) | Yes |
| All `SmartProductCard` surfaces (13) | No | 2 of 13 | No |
| Shopping cart | No | No | No |
| Variant selector/display | No | No | No |

---

## Recommended Implementation Approach

**Option A — Type-aware SmartProductCard** (recommended):
1. Make `SmartProductCard` branch on `productType` for CTA, stock display, metadata, and type badge
2. Pass `productType` from callers that currently omit it (GAP-3, GAP-4)
3. Keep storefront's custom sections as-is — they provide richer layout variants (immersive/editorial/classic) that `SmartProductCard` doesn't need to replicate
4. Lowest risk, highest impact — fixes 4 of 6 gaps with changes to 3 files

**Option B — Delegate to type-specific sub-cards**:
- `SmartProductCard` detects `productType` and delegates to `DigitalCard`/`ServiceCard`/`HybridCard` for non-physical types
- Requires extracting those cards from storefront sections into shared components
- More consistent UX across surfaces but higher refactor risk

---

## Phased Implementation Plan

### Phase 0: Backend Service Fixes (GAP-10)
**Goal:** Ensure all API services that feed `SmartProductCard` callers select and map `product_type`  
**Effort:** Small-Medium (4 service files)  
**Risk:** Low (additive — adding a field to SELECT and response mapping)

**Blocking dependency for Phase 1.** Frontend callers can't pass `productType` if the API doesn't return it.

- **0.1** `FeaturedService.ts` — Add `productType: row.product_type` to `transformFeaturedProduct()` response object (line ~325). The column is already fetched via `SELECT mv.*` — only the mapping is missing.
- **0.2** `FeaturedProductsSingletonService.ts` — Add `product_type` to the explicit column list in `listFeaturedProducts()` (line ~297-313) and add `productType: fp.product_type` to `mapPrismaFeaturedProduct()` mapping function.
- **0.3** `FeaturedProductsService.ts` — Add `product_type` to the explicit column lists in `generateTrendingProducts()` (line ~76) and `generateRecommendedProducts()` (line ~171), and add `product_type: item.product_type` to the return objects (lines ~123, ~227).
- **0.4** `recommendationService.ts` — Add `mgd.product_type` to the SELECT in `getProductsViewedBySameUsers()` (line ~519) and add `productType: row.product_type` to the recommendation mapping (line ~590).
- **0.5** Verify `DiscoveryService.ts` already selects `product_type` (confirmed: 7 queries) — no change needed
- **0.6** Verify `routes/storefront.ts` already selects and maps `product_type` (confirmed: line 117, 311) — no change needed
- **0.7** Verify `routes/storefront-featured.ts` already selects and maps `product_type` (confirmed: line 210, 437) — no change needed
- **0.8** Verify `routes/public-api.ts` already selects and maps `product_type` (confirmed: line 2856, 2898) — no change needed
- **0.9** Verify `SingleProductService.ts` already selects and maps `product_type` (confirmed: Prisma select + mapping) — no change needed
- **0.10** Audit recently viewed API endpoint — verify it returns `product_type` (check route or service that feeds `LastViewed.tsx`)
- **0.11** Run `checkapi` to verify no TypeScript errors after changes

**Files touched:** 4-5 backend service files  
**Testing:** Verify API responses include `productType` field for digital/service/hybrid products via API calls or browser network tab

### Phase 1: Frontend Data Pipeline Fixes (GAP-3)
**Goal:** Ensure `productType` is passed to `SmartProductCard` in all frontend surfaces  
**Effort:** Medium (10 files, mechanical changes)  
**Risk:** Low  
**Depends on:** Phase 0 (API must return `productType` first)

- **1.1** `RandomFeaturedProducts.tsx` — Add `productType: product.productType` to product prop
- **1.2** `ProductDisplay.tsx` — Add `productType: product.productType` to product prop
- **1.3** `ProductRecommendations.tsx` — Add `productType` to `RecommendedProduct` interface and product prop
- **1.4** `FeaturedTypeProducts.tsx` — Add `productType` to `FeaturedTypeProduct` interface and product prop
- **1.5** `FeaturedBucket.tsx` — Add `productType: product.productType` to product prop
- **1.6** `LastViewed.tsx` — Add `productType` to `LastViewedProduct` interface and product prop
- **1.7** `DirectoryEntryClassicLayout.tsx` — Add `productType: product.productType` to product prop
- **1.8** `DirectoryEntryEditorialLayout.tsx` — Add `productType: product.productType` to product prop
- **1.9** `DirectoryEntryImmersiveLayout.tsx` — Add `productType: product.productType` to product prop
- **1.10** `DirectoryEntryPremiumLayout.tsx` — Add `productType: product.productType` to product prop
- **1.11** Verify `StorefrontFeaturedProducts.tsx` already passes `productType` (confirmed: line 526) — no change needed
- **1.12** Verify `ProductSection.tsx` passes full product object (confirmed) — no change needed
- **1.13** Audit `UniversalDirectoryGrid.tsx`, `ShopsPageClient.tsx`, `EnhancedStorefrontProductCard.tsx`, `ProductCardLayouts.tsx`, `StorefrontImmersiveLayout.tsx` for missing `productType`
- **1.14** Run `checkweb` to verify no TypeScript errors after changes

**Files touched:** 10-15 frontend files  
**Testing:** Verify `productType` appears in props for digital/service/hybrid products via browser dev tools across all surfaces

### Phase 2: SmartProductCard Type-Aware CTA (GAP-1, GAP-6)
**Goal:** Correct CTA button and purchase flow per product type  
**Effort:** Medium  
**Risk:** Medium (touches the most-used component)

- **2.1** Extract `productType` from product data at top of `SmartProductCard`: `const productType = product.productType || 'physical'`
- **2.2** Create a `TypeAwareCTA` helper or inline conditional that renders:
  - `physical` / `hybrid` (with variants) → existing "View Options" link
  - `physical` / `hybrid` (no variants) → existing `AddToCartButton`
  - `digital` → "Get" button (link to `/products/{id}` for download flow)
  - `service` → "Book Now" button (link to `/products/{id}` for booking flow)
- **2.3** Replace the purchase UI block in all 4 variants (featured, grid, list, compact) with the type-aware CTA
- **2.4** For `service` type, consider rendering `BookingCTA` component (already exists in `ServiceSection`)

**Files touched:** `SmartProductCard.tsx` (primary), possibly import `BookingCTA`  
**Testing:** Verify CTA text/behavior for each product type across featured, grid, list, compact variants

### Phase 3: Type-Specific Stock & Badge Display (GAP-1, GAP-5)
**Goal:** Hide irrelevant stock info for digital/service; show type badge  
**Effort:** Small-Medium  
**Risk:** Low

- **3.1** Conditionally hide stock count and out-of-stock badges when `productType` is `digital` or `service`
- **3.2** For `hybrid`, show stock only if physical component has stock data
- **3.3** Add a type badge (small pill with icon + label) to `SmartProductCard` in all variants:
  - Physical: Package icon, no badge (default, no visual noise)
  - Digital: Download icon, blue badge "Digital"
  - Service: Calendar icon, green badge "Service"
  - Hybrid: Globe icon, purple badge "Hybrid"
- **3.4** Mirror the badge style from the storefront's custom cards (`DigitalCard`, `ServiceCard`, `HybridCard`) for consistency

**Files touched:** `SmartProductCard.tsx`  
**Testing:** Verify stock display and type badges for each product type across all variants

### Phase 4: Type-Specific Metadata Row (GAP-1)
**Goal:** Show type-specific metadata in card body  
**Effort:** Medium  
**Risk:** Low

- **4.1** Add a type-specific metadata row to `SmartProductCard` (between description and price):
  - `digital`: file type, file size, license type, download limit (from `product.metadata`)
  - `service`: duration, service area, service location, provider name, pricing model (from `product.metadata`)
  - `hybrid`: physical component + digital component indicators (from `product.metadata`)
  - `physical`: no additional metadata (existing fields suffice)
- **4.2** Reuse the metadata extraction pattern from storefront's custom cards (e.g., `DigitalCard` lines 53-57, `ServiceCard` lines 61-67)
- **4.3** Ensure metadata is extracted from both `product.metadata.*` and camelCase fallbacks (matching storefront card pattern)
- **4.4** Keep the metadata row compact — only show 2-3 most relevant fields per type to avoid card bloat

**Files touched:** `SmartProductCard.tsx`  
**Testing:** Verify metadata display for digital/service/hybrid products with and without metadata fields

### Phase 5: Featured Products Type Segmentation (GAP-2)
**Goal:** Optionally segment featured products by type within featured sections  
**Effort:** Medium  
**Risk:** Low  
**Priority:** Lower — only needed if merchants feature mixed-type products and want type-grouped display

- **5.1** Within `StorefrontFeaturedProducts` `FeaturedSection`, optionally sub-segment products by `productType` and render with type-appropriate cards
- **5.2** OR: Keep single-section display but ensure `SmartProductCard` type-awareness (Phases 2-4) makes mixed-type display correct
- **5.3** Consider a type filter/tab within featured sections if merchants have many products of different types

**Files touched:** `StorefrontFeaturedProducts.tsx` (optional)  
**Testing:** Verify featured sections render correct CTAs and metadata for mixed product types

### Phase 6: Shopping Cart Type Awareness (GAP-7)
**Goal:** Cart display adapts to product type  
**Effort:** Medium  
**Risk:** Medium (touches cart hook + cart page + checkout flow)

- **6.1** Thread `productType` through `useMultiCart` hook — store it when adding to cart, include it in cart item objects
- **6.2** For `digital` products in cart: hide stock limit, set quantity to 1 (or allow multiple license purchases), show "Digital Download" fulfillment label
- **6.3** For `service` products in cart: hide stock limit, show booking date/time if selected, show "Service Booking" fulfillment label
- **6.4** For `hybrid` products in cart: show stock limit (physical component), show "Shipping + Download" fulfillment label
- **6.5** Add a small type badge/icon next to cart item name (matching `SmartProductCard` badge style from Phase 3)
- **6.6** Post-purchase: digital items should show download link; services should show booking confirmation

**Files touched:** `carts/page.tsx`, `useMultiCart.ts` (hook), possibly `AddToCartButton.tsx`  
**Testing:** Add digital/service/hybrid products to cart, verify correct display and quantity controls

### Phase 7: Variant Selector Type Awareness (GAP-8)
**Goal:** Variant UI adapts to product type  
**Effort:** Small-Medium  
**Risk:** Low

- **7.1** Pass `productType` to `ProductVariantSelector` as a prop
- **7.2** For `digital` products: replace stock-based availability with "Available"/"Limited" based on download limit, not stock count
- **7.3** For `service` products: replace "Out of Stock" with "Fully Booked" or "Unavailable"; consider showing booking slot availability
- **7.4** For `hybrid` products: show combined availability (physical stock + digital availability)
- **7.5** Update `VariantInfoCard.tsx` to show type-appropriate labels and a type badge
- **7.6** Consider whether digital/service products even need variant selectors — may want to hide selector for types that don't use variants

**Files touched:** `ProductVariantSelector.tsx`, `VariantInfoCard.tsx`, callers that render variant selectors  
**Testing:** View product detail page for digital/service/hybrid products with variants, verify correct labels

### Phase 8: Recommendations Type Context (GAP-9)
**Goal:** Recommendations consider product type for relevance  
**Effort:** Medium  
**Risk:** Low  
**Priority:** Lower — algorithmic improvement, not a display bug

- **8.1** API fix already covered in Phase 0.4 (`recommendationService.ts` — `product_type` added to SELECT and mapping)
- **8.2** Frontend pass-through already covered in Phase 1.3 (`ProductRecommendations.tsx` — `productType` added to interface and prop)
- **8.3** Consider type-affinity in recommendation ranking (service products → service recommendations) — algorithmic improvement beyond display fix
- **8.4** Verify end-to-end: view a service product, confirm recommendations include `productType` in API response and cards render type-aware

**Files touched:** API route, `RecommendationsSingletonService.ts`, `ProductRecommendations.tsx`  
**Testing:** View a service product, verify recommendations include other services

### Phase 9: Audit & Edge Cases
**Goal:** Ensure all surfaces are consistent  
**Effort:** Small  
**Risk:** Low

- **9.1** Audit remaining `SmartProductCard` consumers: `UniversalDirectoryGrid.tsx`, `ShopsPageClient.tsx`, `EnhancedStorefrontProductCard.tsx`, `ProductCardLayouts.tsx`
- **9.2** Verify type-aware rendering in search results (if separate component exists)
- **9.3** Verify type-aware rendering in category pages (`/directory/categories/[slug]`)
- **9.4** Ensure `ProductData` type interface in `SmartProductCard.tsx` includes `productType` (may already exist — verify)
- **9.5** Add `productType` to `PublicProduct` type in `ProductSingleton` if missing
- **9.6** Verify backend API returns `productType` in all product list endpoints (MV, featured, search, directory, recommendations, recently viewed)
- **9.7** Test with migration 059 (multi-select product types) — ensure card logic handles both single-type and multi-type products

**Files touched:** Audit-dependent  
**Testing:** Full sweep of all product display surfaces with test products of each type

---

## Key Files Reference

### Primary Fix Targets

| File | Role | Gaps |
|------|------|------|
| `apps/web/src/components/products/SmartProductCard.tsx` | Universal product card — used by 13 surfaces | GAP-1, GAP-5, GAP-6 |
| `apps/web/src/app/carts/page.tsx` | Shopping cart display | GAP-7 |
| `apps/web/src/components/products/ProductVariantSelector.tsx` | Variant selector on product detail | GAP-8 |
| `apps/web/src/components/variants/VariantInfoCard.tsx` | Variant info display | GAP-8 |

### Backend Services Needing `product_type` Fix (Phase 0)

| File | Issue | Fix |
|------|-------|-----|
| `apps/api/src/services/FeaturedService.ts` | `transformFeaturedProduct()` doesn't map `product_type` to response (column is fetched via `SELECT mv.*`) | Add `productType: row.product_type` to mapping |
| `apps/api/src/services/FeaturedProductsSingletonService.ts` | Explicit column list omits `product_type`; `mapPrismaFeaturedProduct()` doesn't map it | Add `product_type` to SELECT + mapping |
| `apps/api/src/services/FeaturedProductsService.ts` | `generateTrendingProducts()` and `generateRecommendedProducts()` omit `product_type` in SELECT and return objects | Add `product_type` to both SELECTs and return mappings |
| `apps/api/src/services/recommendationService.ts` | `getProductsViewedBySameUsers()` selects 40+ columns but omits `product_type` | Add `mgd.product_type` to SELECT + `productType: row.product_type` to mapping |

### Backend Services Already Correct (No Change Needed)

| File | Evidence |
|------|----------|
| `apps/api/src/services/DiscoveryService.ts` | Selects `product_type` in all 7 queries |
| `apps/api/src/routes/storefront.ts` | Selects and maps `product_type` (lines 117, 311) |
| `apps/api/src/routes/storefront-featured.ts` | Selects and maps `product_type` (lines 210, 437) |
| `apps/api/src/routes/public-api.ts` | Selects and maps `product_type` (lines 2856, 2898) |
| `apps/api/src/services/SingleProductService.ts` | Prisma select includes `product_type`; maps to `productType` (line 391, 857) |

### Callers Needing `productType` Prop Added (Phase 1)

| File | Surface |
|------|---------|
| `apps/web/src/components/directory/RandomFeaturedProducts.tsx` | Directory random featured |
| `apps/web/src/components/storefront/ProductDisplay.tsx` | Storefront grid/gallery |
| `apps/web/src/components/products/ProductRecommendations.tsx` | Product detail recommendations |
| `apps/web/src/components/products/FeaturedTypeProducts.tsx` | Product detail featured buckets |
| `apps/web/src/components/storefront/FeaturedBucket.tsx` | Storefront featured buckets |
| `apps/web/src/components/directory/LastViewed.tsx` | Recently viewed |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryClassicLayout.tsx` | Directory entry (classic) |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryEditorialLayout.tsx` | Directory entry (editorial) |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryImmersiveLayout.tsx` | Directory entry (immersive) |
| `apps/web/src/app/directory/[slug]/layouts/DirectoryEntryPremiumLayout.tsx` | Directory entry (premium) |

### Already Passing `productType` (No Change Needed)

| File | Surface |
|------|---------|
| `apps/web/src/components/storefront/StorefrontFeaturedProducts.tsx` | Storefront featured products |
| `apps/web/src/components/storefront/sections/ProductSection.tsx` | Storefront physical section |

### Reference Implementations (Type-Aware, Working Correctly)

| File | Role |
|------|------|
| `apps/web/src/components/storefront/sections/DigitalSection.tsx` | Type-aware digital card (file type, size, license, download limit) |
| `apps/web/src/components/storefront/sections/ServiceSection.tsx` | Type-aware service card (BookingCTA, duration, area, provider) |
| `apps/web/src/components/storefront/sections/HybridSection.tsx` | Type-aware hybrid card (physical + digital component indicators) |
| `apps/web/src/components/products/sections/ProductTypeSection.tsx` | Type-aware detail page sections (switch on resolvedType) |
| `apps/web/src/components/products/sections/ProductPurchasePanel.tsx` | Type-aware purchase panel (type badge, type-specific purchase UI) |
| `apps/web/src/app/tenant/[id]/StorefrontClientWrapper.tsx` | Storefront orchestrator — type bucketing logic |
| `apps/web/src/app/tenant/[id]/StorefrontImmersiveLayout.tsx` | Immersive layout — has own type bucketing + custom sections |

---

## Dependencies

- **MV `mv_storefront_discovery`**: Has `product_type` column at `create_scope_aware_mvs.sql:598` plus derived booleans (`is_digital_product`, `is_physical_product`, `is_service`). No MV changes needed.
- **Migration 059** (`059_product_types_multi_select.sql`): Multi-select product types — may change how `productType` is stored and retrieved. Verify card logic works with both single-type and multi-type products.
- **Capability system**: `product_service_enabled`, `product_digital_enabled`, `product_hybrid_enabled` flags gate whether each type appears in storefront sections. Card-level type awareness is independent of these flags — a digital product should render correctly in featured/directory even if the dedicated digital section is disabled.
- **Phase 0 is blocking**: Frontend Phase 1 depends on backend Phase 0. No frontend changes will work until the API services return `product_type`.

---

## Acceptance Criteria

### Backend Services (Phase 0)
- [ ] `FeaturedService.ts` `transformFeaturedProduct()` maps `productType: row.product_type`
- [ ] `FeaturedProductsSingletonService.ts` selects `product_type` and maps it in `mapPrismaFeaturedProduct()`
- [ ] `FeaturedProductsService.ts` selects `product_type` in both `generateTrendingProducts()` and `generateRecommendedProducts()`
- [ ] `recommendationService.ts` selects `mgd.product_type` and maps `productType` in response
- [ ] `checkapi` passes with no TypeScript errors

### SmartProductCard (Phases 1-4)
- [ ] All 13 `SmartProductCard` callers pass `productType` in the product prop
- [ ] All 4 card variants (featured, grid, list, compact) are type-aware
- [ ] A digital product shows "Get" CTA (not "Add to Cart"), no stock count, "Digital" type badge, and digital metadata (file type, license) when available
- [ ] A service product shows "Book Now" CTA, no stock count, "Service" type badge, and service metadata (duration, service area) when available
- [ ] A hybrid product shows "View Details" CTA, stock count (physical component only), "Hybrid" type badge, and component indicators when available
- [ ] A physical product renders identically to current behavior (no regression)

### Shopping Cart (Phase 6)
- [ ] Cart items show a type badge/icon next to product name
- [ ] Digital products in cart: no stock limit, quantity defaults to 1, "Digital Download" fulfillment label
- [ ] Service products in cart: no stock limit, "Service Booking" fulfillment label, booking date/time shown if selected
- [ ] Hybrid products in cart: stock limit shown (physical component), "Shipping + Download" fulfillment label

### Variant Selector (Phase 7)
- [ ] Variant selector shows type-appropriate availability labels (not "Out of Stock" for digital/service)
- [ ] `VariantInfoCard` shows type badge and type-appropriate attribute labels

### Phase 10: Skill Document (Post-Implementation)
**Goal:** Capture insights, patterns, and pitfalls from the implementation for future reference  
**Effort:** Small  
**Risk:** None

- **10.1** Create skill document at `.devin/skills/product-type-display-alignment.md`
- **10.2** Document the architectural decision: Option A (type-aware `SmartProductCard`) vs Option B (delegate to sub-cards) — record which was chosen and why
- **10.3** Document the `productType` data flow: backend API → caller component → `SmartProductCard` product prop → type-aware rendering branches
- **10.4** Record the full surface inventory (13 `SmartProductCard` callers + cart + variant selector) as a checklist for future product-type-related changes
- **10.5** Document patterns used for type-aware rendering:
  - CTA branching (Add to Cart vs Get vs Book Now vs View Details)
  - Stock display suppression for digital/service
  - Type badge component (icon + color + label per type)
  - Metadata extraction from `product.metadata.*` with camelCase fallbacks
- **10.6** Record any pitfalls encountered during implementation:
  - Callers that strip fields when constructing product props
  - Backend endpoints that don't return `productType`
  - Migration 059 multi-select interactions
  - Cart hook changes needed for `productType` threading
- **10.7** Include a "Verification Checklist" section listing all surfaces to test when product-type display logic changes
- **10.8** Cross-reference related skill docs (e.g., `fix-tenant-dashboard-load-loop.md` pattern for skill doc structure)

**Files touched:** `.devin/skills/product-type-display-alignment.md` (new)  
**Testing:** N/A — documentation only

---

### Cross-Cutting
- [ ] No TypeScript errors (`checkapi` and `checkweb` both pass)
- [ ] Storefront's custom type sections (`DigitalSection`, `ServiceSection`, `HybridSection`) continue to work unchanged
- [ ] Works with migration 059 (multi-select product types) — card logic handles both single-type and multi-type products
- [ ] All API services that feed `SmartProductCard` callers return `productType` in product list responses (featured, trending, recommended, recommendations, discovery, storefront, public-api)
- [ ] Skill document created at `.devin/skills/product-type-display-alignment.md` with implementation insights

---

## Part 2: Backend Order & Receipt Handling Gaps

This section analyzes how different product types (physical, digital, service, hybrid) are handled — or not handled — across the backend order lifecycle: order creation, stock management, status updates, fulfillment, notifications, and receipt/email generation.

### 11. Order Creation (`checkout.ts`)

**File:** `apps/api/src/routes/checkout.ts`

**Current behavior:** The `/api/checkout/orders` route validates items by looking up `product_variants` or `inventory_items`, checks stock availability, calculates pricing, and creates order + payment records. The `fulfillment_method` is passed in the request body and stored in order metadata.

**Gaps:**

- **11.1 Stock checks applied to all product types.** The route checks `variant.stock < item.quantity` and `inventoryItem.stock < item.quantity` for every item regardless of `product_type`. Digital products (unlimited downloads) and service products (availability by appointment, not stock) will fail or behave incorrectly if their `stock` field is 0 or null.
  - Lines 287, 336: Stock validation runs unconditionally with no `product_type` guard.
  - **Impact:** A digital product with `stock = 0` cannot be ordered. A service product with `stock = 0` cannot be booked. Merchants must manually set high stock values as a workaround.

- **11.2 No `product_type` stored on `order_items`.** The `itemData` object constructed during validation (lines 307-319 for variants, lines 352-363 for inventory items) does not include `product_type`. The order item record will not carry product type information, forcing downstream services to re-query `inventory_items` to determine type.
  - **Impact:** Every downstream service (fulfillment, notifications, receipt generation) must do an additional DB lookup to get `product_type`, or worse, assumes physical.

- **11.3 No validation of fulfillment method vs product type.** A customer can select `fulfillment_method: 'pickup'` for a digital-only order, or `fulfillment_method: 'shipping'` for a service product. There is no validation that the chosen fulfillment method is compatible with the product types in the cart.
  - **Impact:** Digital orders may be stuck in `unfulfilled` status because they're waiting for a physical pickup that will never happen. Service orders may get shipping tracking numbers that are meaningless.

- **11.4 No service-specific booking data captured.** Service products typically need appointment date/time, service location, or service provider selection at checkout. The route accepts `shipping_address` and `notes` but has no structured fields for service booking metadata.
  - **Impact:** Service orders contain no booking details, making it impossible to schedule or fulfill the service.

### 12. Stock Management (`StockService.ts`)

**File:** `apps/api/src/services/StockService.ts`

**Current behavior:** `decrementStockForOrder` reduces stock for all order items after payment. `restoreStockForOrder` adds stock back on cancellation. `checkStockAvailability` verifies sufficient stock.

**Gaps:**

- **12.1 Stock decremented for all product types.** `decrementStockForOrder` iterates all order items and decrements stock without checking `product_type`. Digital products (which should have unlimited or no stock) and service products (which use availability calendars, not stock counts) will have their stock decremented.
  - Lines 29-78: No `product_type` check before decrementing.
  - **Impact:** Digital products may show "out of stock" after N purchases if stock was set to N. Service products lose availability slots incorrectly.

- **12.2 Stock restored for all product types on cancellation.** `restoreStockForOrder` similarly restores stock for all items regardless of type. For digital products, this artificially inflates a meaningless stock counter.
  - Lines 102-151: No `product_type` check before restoring.

- **12.3 No digital access revocation on cancellation.** When a digital order is cancelled, stock is restored but there is no call to revoke digital access grants. The `DigitalFulfillmentService` creates access grants but there is no corresponding revocation flow in the cancellation path.
  - **Impact:** Cancelled digital orders may still have active download links.

### 13. Order Status Enum

**File:** `apps/api/prisma/schema.prisma` (lines 5166-5175)

**Current values:** `draft`, `confirmed`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`

**Gaps:**

- **13.1 No digital-specific statuses.** There is no `digitally_delivered` or `access_granted` status. Digital orders go from `paid` → `processing` → `shipped` → `delivered`, which is semantically incorrect for digital goods.
  - **Impact:** Order status doesn't reflect the actual state of digital fulfillment. A digital order marked as `shipped` is misleading.

- **13.2 No service-specific statuses.** There is no `scheduled`, `in_progress` (service being performed), or `completed` status for service orders. Service orders follow the physical goods lifecycle.
  - **Impact:** A service order marked as `shipped` or `delivered` doesn't indicate whether the service has been scheduled or performed.

- **13.3 `processing` and `shipped` are physical-centric.** These statuses assume physical logistics. For digital orders, "processing" should mean "generating access grants" and there should be no "shipped" state. For service orders, "processing" should mean "service in progress."

### 14. Fulfillment Status Enum

**File:** `apps/api/prisma/schema.prisma` (lines 5124-5130)

**Current values:** `unfulfilled`, `processing`, `partially_fulfilled`, `fulfilled`, `cancelled`

**Gaps:**

- **14.1 `partially_fulfilled` not used for hybrid products.** Hybrid products (physical + digital components) should use `partially_fulfilled` when the digital component is delivered but the physical component is still pending shipment. However, no code currently sets this status for hybrid orders.
  - **Impact:** Hybrid orders show as `unfulfilled` even when the digital component has been delivered, or show as `fulfilled` when only the digital part is done.

- **14.2 No `digitally_delivered` fulfillment status.** Digital orders that have been fulfilled (access grants created) are not marked with a distinct status. They remain `unfulfilled` unless manually updated.
  - **Impact:** Merchants cannot see which digital orders have been fulfilled vs pending.

### 15. Fulfillment Service (`FulfillmentService.ts`)

**File:** `apps/api/src/services/FulfillmentService.ts`

**Current behavior:** Handles pickup/delivery scheduling, time slot management, and customer notifications for order status updates. Uses `fulfillment_method` ('pickup' | 'delivery') and `order_status`.

**Gaps:**

- **15.1 No product type awareness.** `scheduleFulfillment` creates fulfillment schedules for all orders regardless of product type. Digital-only orders should not require pickup/delivery scheduling.
  - Lines (scheduleFulfillment): No `product_type` check. The method accepts `fulfillmentMethod: 'pickup' | 'delivery'` with no option for digital fulfillment.
  - **Impact:** Digital orders may be assigned pickup time slots that are meaningless, or merchants may be confused by fulfillment schedules for digital products.

- **15.2 No service scheduling.** There is no scheduling logic for service products (appointment booking, calendar integration, provider assignment). The fulfillment service only handles physical logistics (pickup/delivery time slots).
  - **Impact:** Service orders have no scheduling infrastructure, making it impossible to manage service appointments through the platform.

- **15.3 Notifications are physical-only.** All notification types (`order_fulfilled`, `order_shipped`, `order_out_for_delivery`, `order_delivered`) are physical-logistics oriented. There are no notification types for digital delivery confirmation or service appointment reminders.

### 16. Digital Fulfillment Service (`DigitalFulfillmentService.ts`)

**File:** `apps/api/src/services/digital-assets/DigitalFulfillmentService.ts`

**Current behavior:** Explicitly checks `product_type` and only processes `digital` and `hybrid` products. Creates access grants, updates `digital_delivery_status`, and sends download emails.

**Gaps:**

- **16.1 No service product handling.** The service explicitly skips items where `productType !== 'digital' && productType !== 'hybrid'` (line 66). Service products are never processed by this service, and there is no equivalent `ServiceFulfillmentService`.
  - **Impact:** Service products have no fulfillment path at all. After payment, nothing happens.

- **16.2 No hybrid partial fulfillment coordination.** For hybrid products (physical + digital), the service processes the digital component but does not coordinate with the physical fulfillment pipeline. There is no logic to mark the digital part as fulfilled while the physical part remains pending.
  - **Impact:** Hybrid orders may have digital access granted but remain in `unfulfilled` status, confusing both merchants and customers.

- **16.3 No order-level status update after digital fulfillment.** After creating access grants, the service updates `digital_delivery_status` on individual order items but does not update the order's `fulfillment_status`. The order remains `unfulfilled`.
  - **Impact:** Orders with only digital products appear unfulfilled even after access has been granted and emails sent.

### 17. Payment Webhook Handler (`StripeWebhookHandler.ts`)

**File:** `apps/api/src/services/payments/webhooks/StripeWebhookHandler.ts`

**Current behavior:** On `payment_intent.succeeded`, updates payment status, updates order status, creates status history, and calls `fulfillDigitalProducts`. The same pattern is replicated in `checkout/stripe.ts`, `checkout/paypal.ts`, and `checkout/square.ts`.

**Gaps:**

- **17.1 Only digital fulfillment triggered post-payment.** After successful payment, only `fulfillDigitalProducts` is called. There is no equivalent `fulfillServiceProducts` or `scheduleServiceBooking` call.
  - Line 131: `await this.fulfillDigitalProducts(payment.order_id, payment.tenant_id);`
  - **Impact:** Service products receive no post-payment processing. No booking is created, no provider is assigned, no confirmation is sent.

- **17.2 Stock not decremented in webhook.** The `StockService.decrementStockForOrder` is called in the checkout payment routes (`checkout/stripe.ts`, `checkout/paypal.ts`, `checkout/square.ts`) but not in the webhook handler. If payment succeeds via webhook (async), stock is not decremented.
  - **Impact:** Stock counts may be incorrect for orders paid via Stripe webhooks vs direct payment routes.

- **17.3 `product_type` fallback to 'physical'.** When mapping order items for real-time notification (line 479), the code uses `(item.inventory_items as any)?.product_type || 'physical'`. This fallback masks missing `product_type` data rather than surfacing it.
  - **Impact:** Items with missing `product_type` are silently treated as physical in notifications.

- **17.4 Duplicated digital fulfillment logic across payment gateways.** The same digital fulfillment block is copy-pasted in `checkout/stripe.ts` (lines 209-228), `checkout/paypal.ts` (lines 323-342), and `checkout/square.ts` (lines 124-143). Any fix or addition (e.g., service fulfillment) must be replicated in all three places.
  - **Impact:** Risk of inconsistency when adding new product-type-specific fulfillment logic.

### 18. Order Management Service (`OrderManagementService.ts`)

**File:** `apps/api/src/services/OrderManagementService.ts`

**Current behavior:** Manages multi-location order operations — fetching orders, statistics, and updating order status. Uses `order_status` enum and stores `fulfillmentMethod` in metadata.

**Gaps:**

- **18.1 No product type awareness in status updates.** `updateOrderStatus` updates the order status and creates CRM alerts but does not consider product type. The same status transitions are applied regardless of whether the order contains physical, digital, service, or hybrid products.
  - **Impact:** A digital order can be marked as `shipped` which is semantically incorrect. A service order can be marked as `delivered` without the service being performed.

- **18.2 No product type in order response.** The `OrderLocationInfo` returned by the service does not include `product_type` for order items. The response contains `fulfillmentMethod` from metadata but no item-level type information.
  - **Impact:** Frontend order management UI cannot display product type badges or apply type-specific actions.

### 19. Order Notifications (`OrderNotificationService.ts`)

**File:** `apps/api/src/services/OrderNotificationService.ts`

**Current behavior:** Sends email notifications for order events: `order_placed`, `order_cancelled`, `order_fulfilled`, `order_shipped`, `order_out_for_delivery`, `order_delivered`, `deposit_forfeited`, `refund_processed`.

**Gaps:**

- **19.1 All notification templates are physical-centric.** The `order_fulfilled` notification (lines 207-251) branches on `fulfillmentMethod` ('shipping' vs 'pickup') but has no branch for digital delivery or service completion.
  - **Impact:** Customers who ordered digital products receive "Order Ready for Pickup" emails. Customers who ordered services receive "Order Shipped" emails.

- **19.2 No digital delivery confirmation notification.** There is no `OrderNotificationType` for digital delivery. The `DigitalDownloadEmailService` handles download emails separately, but there is no integration with the main `OrderNotificationService`.
  - **Impact:** Digital delivery notifications are not logged in `notification_logs` and not tracked in CRM alerts. The `DigitalDownloadEmailService.sendDownloadReceipt` method is also a TODO stub (line 35: "TODO: Integrate with your email service") — it only logs to console, no actual email is sent.

- **19.3 No service appointment notification.** There is no notification type for service booking confirmation, appointment reminders, or service completion. Service customers receive no communication about their appointment.

- **19.4 No receipt/invoice email for order completion.** The `OrderNotificationService` sends status update emails but never a formal receipt or invoice for the order. The `InvoiceEmailService` exists but is only used for platform SaaS subscription invoices, not customer order receipts.
  - **Impact:** Customers do not receive a proper order receipt with itemized list, prices, and totals. Only status update emails are sent.

### 20. Buyer Orders API (`buyer-orders.ts`)

**File:** `apps/api/src/routes/buyer-orders.ts`

**Current behavior:** Provides endpoints for buyers to view their orders, view order details, mark as picked up, and cancel orders.

**Gaps:**

- **20.1 No `product_type` in order item responses.** The order item mapping (lines 146-165, 324-339, 513-532) includes `id`, `name`, `sku`, `quantity`, `unitPrice`, `imageUrl` but not `product_type`.
  - **Impact:** Frontend buyer order pages cannot display product type badges or show type-specific information (e.g., download links for digital, appointment details for service).

- **20.2 No digital access links in order details.** The order detail response does not include download URLs or access grant information for digital products. A customer viewing their order has no way to access their digital purchases from the order detail page.
  - **Impact:** Customers must find the original download email to access digital purchases. If the email was lost, there is no recovery path via the order page.

- **20.3 Pickup endpoint requires physical fulfillment method.** The `PATCH /:orderId/pickup` endpoint (lines 572-711) checks that `metadata.fulfillment_method` is in `['pickup', 'delivery', 'shipping']`. Digital-only orders with no fulfillment method will be rejected.
  - Lines 630-637: `allowedMethods` check rejects orders without a physical fulfillment method.
  - **Impact:** Digital orders cannot be marked as fulfilled through this endpoint. There is no alternative endpoint for marking digital orders as fulfilled.

- **20.4 Cancellation restores stock for all types.** The cancel endpoint (lines 714-871) calls `stockService.restoreStockForOrder(orderId)` unconditionally (line 802). No product type check, no digital access revocation.
  - **Impact:** Cancelled digital orders have stock restored (meaningless) but access grants remain active.

### 21. Tenant Orders API (`tenant-orders.ts`)

**File:** `apps/api/src/routes/tenant-orders.ts`

**Current behavior:** Provides endpoints for tenants/merchants to view orders, update fulfillment status, and archive orders.

**Gaps:**

- **21.1 No `product_type` in order item responses.** Same as buyer-orders — the order item mapping (lines 229-237, 388-396) does not include `product_type`.
  - **Impact:** Merchant order management UI cannot display or filter by product type.

- **21.2 Fulfillment status update has no product type logic.** The `PUT /fulfillment` endpoint (lines 446-722) accepts `fulfillmentStatus`, `trackingNumber`, `cancellationReason`, `shippingProvider` — all physical-logistics fields. No fields for digital delivery confirmation or service completion.
  - **Impact:** Merchants must use physical fulfillment terminology ("shipped", "delivered") for digital and service orders.

- **21.3 No digital-specific fulfillment actions.** There is no endpoint for a merchant to manually trigger digital re-delivery, revoke access, or view access grant status for an order.
  - **Impact:** Merchants cannot manage digital product access from the order management interface.

- **21.4 No service-specific fulfillment actions.** There is no endpoint for a merchant to mark a service as scheduled, in progress, or completed. No fields for assigning a service provider or updating appointment details.
  - **Impact:** Service orders cannot be managed through the standard order management workflow.

### 22. Receipt & Email Generation

**Files:** `apps/api/src/services/email/InvoiceEmailService.ts`, `apps/api/src/services/email/DigitalDownloadEmailService.ts`

**Current behavior:** `InvoiceEmailService` generates branded invoice emails for platform SaaS subscriptions. `DigitalDownloadEmailService` generates download receipt emails for digital products.

**Gaps:**

- **22.1 No customer order receipt email.** Neither service generates a receipt for a customer order. `InvoiceEmailService` is designed for SaaS subscription invoices (it includes "Service Plan" and "tier" fields, not order items). `OrderNotificationService` sends status updates but not a formal receipt with itemized products.
  - **Impact:** Customers never receive a proper order receipt. They get "New Order Received" (merchant), "Order Ready for Pickup" (customer), etc., but no itemized receipt.

- **22.2 `DigitalDownloadEmailService` is not wired to email service.** The `sendDownloadReceipt` method (lines 29-58) has a TODO comment: "TODO: Integrate with your email service (SendGrid, Resend, etc.)". It only logs to console in development mode. No actual email is sent.
  - **Impact:** Digital product customers do not receive download emails. The access grants are created in the database, but the customer is never notified via email.

- **22.3 No service booking confirmation email.** There is no email template for service booking confirmations. No email includes appointment details (date, time, location, provider).
  - **Impact:** Service customers receive no booking confirmation, no appointment details, and no reminders.

- **22.4 No hybrid order receipt.** For hybrid orders (physical + digital), there is no receipt that shows both the physical items (with shipping info) and digital items (with download links). The notification system treats the order as a single physical shipment.
  - **Impact:** Hybrid order customers may not realize they have digital downloads available, or may not know the physical component's tracking info.

### 23. Summary of Missing Product-Type-Specific Logic

| Backend Area | Physical | Digital | Service | Hybrid |
|---|---|---|---|---|
| Stock validation at checkout | ✅ Correct | ❌ Blocks if stock=0 | ❌ Blocks if stock=0 | ❌ Same as physical |
| Stock decrement/restore | ✅ Correct | ❌ Unnecessary | ❌ Incorrect | ❌ No split logic |
| Order status enum | ✅ Correct | ❌ No digital statuses | ❌ No service statuses | ❌ No partial statuses |
| Fulfillment scheduling | ✅ Correct | ❌ Unnecessary | ❌ No booking system | ❌ No split logic |
| Post-payment fulfillment | ✅ Via stock + notifications | ⚠️ DigitalFulfillmentService (but email is stub) | ❌ No service fulfillment | ⚠️ Digital only, no physical coordination |
| Order notifications | ✅ Correct | ❌ Physical templates used | ❌ No service templates | ❌ No hybrid templates |
| Receipt/invoice email | ❌ No order receipt | ❌ Email is TODO stub | ❌ No booking confirmation | ❌ No hybrid receipt |
| Order item `product_type` | ✅ In DB | ❌ Not in API responses | ❌ Not in API responses | ❌ Not in API responses |
| Cancellation handling | ✅ Stock restored | ❌ Access not revoked | ❌ No booking cancellation | ❌ No split handling |
| Merchant order management | ✅ Correct | ❌ Physical-only actions | ❌ No service actions | ❌ No hybrid actions |

### 24. Recommended Backend Fixes (Priority Order)

**P0 — Blocking correct behavior:**

- **24.1** Skip stock validation for `digital` and `service` product types in `checkout.ts` (or validate using type-specific availability, not stock count)
- **24.2** Skip stock decrement/restore for `digital` and `service` product types in `StockService.ts`
- **24.3** Wire `DigitalDownloadEmailService.sendDownloadReceipt` to the actual `emailService` (remove TODO stub)
- **24.4** Update order `fulfillment_status` to `fulfilled` after `DigitalFulfillmentService.fulfillOrder` completes for digital-only orders
- **24.5** Add `product_type` to order item API responses in `buyer-orders.ts` and `tenant-orders.ts`

**P1 — Correct semantics & UX:**

- **24.6** Add digital-specific and service-specific notification types to `OrderNotificationService` (e.g., `digital_delivered`, `service_scheduled`, `service_completed`)
- **24.7** Add `product_type` to `order_items` table or ensure it's always selected from `inventory_items` in all order queries
- **24.8** Validate `fulfillment_method` compatibility with product types at checkout (digital-only orders should not require pickup/shipping)
- **24.9** Add digital access revocation to the cancellation flow (`buyer-orders.ts` cancel endpoint and `tenant-orders.ts` fulfillment cancel)
- **24.10** Create a customer order receipt email template that includes itemized products with type-specific information

**P2 — Service product support:**

- **24.11** Create `ServiceFulfillmentService` for service booking, scheduling, and provider assignment
- **24.12** Add service booking fields to checkout (appointment date/time, provider selection, service location)
- **24.13** Add service-specific order statuses (`scheduled`, `in_progress`, `completed`)
- **24.14** Add service appointment confirmation and reminder emails
- **24.15** Add service scheduling UI to merchant order management

**P2 — Hybrid product support:**

- **24.16** Implement partial fulfillment for hybrid orders (digital component delivered immediately, physical component follows normal fulfillment)
- **24.17** Use `partially_fulfilled` status when digital component is delivered but physical is pending
- **24.18** Create hybrid order receipt showing both digital download links and physical shipping info

---

## Part 3: Customer Dashboard Order View Gaps

This section analyzes the customer-facing order dashboard components to identify where product type awareness is missing from order list views, order detail views, fulfillment timelines, and receipt displays. The goal is to define what a product-type-centric order view would look like for customers.

### 25. Customer Order Service (`CustomerOrderService.ts`)

**File:** `apps/web/src/services/CustomerOrderService.ts`

**Current behavior:** Fetches orders from the API and maps raw response data to `CustomerOrder` and `CustomerOrderItem` interfaces.

**Gaps:**

- **25.1 `CustomerOrderItem.productType` missing `'service'`.** The interface (line 89) defines `productType?: 'physical' | 'digital' | 'hybrid'` — `'service'` is not included. Service products will have `productType: undefined` on the frontend.
  - **Impact:** Service orders cannot be identified by the frontend, preventing any type-specific UI.

- **25.2 `getOrder()` does not map `productType`.** The single-order detail method (lines 229-260) maps `name`, `sku`, `imageUrl`, `unitPrice` but does NOT include `productType` in the item mapping. Compare with `getCustomerOrders()` (line 328) which does map `productType: item.inventory_items?.product_type`.
  - **Impact:** When a customer views a single order detail page, `productType` is missing from items even if the API returns it. The downloads page and order detail page cannot determine product types.

- **25.3 `getBuyerOrders()` returns raw API data without mapping.** The buyer orders method (lines 628-652) returns `response.data` directly without any field mapping. The `BuyerOrderHistory.tsx` component defines its own `BuyerOrder` interface that lacks `productType` entirely.
  - **Impact:** The guest order lookup at `/my-orders` has no access to product type information.

- **25.4 `OrderRequest` interface has no `productType` awareness.** The order creation interface (lines 105-128) includes `fulfillmentMethod: 'pickup' | 'delivery' | 'shipping'` with no option for digital or service fulfillment. This is a frontend constraint that mirrors the backend gap.
  - **Impact:** Even if the backend supported it, the frontend cannot request digital or service fulfillment.

### 26. Buyer Order History (`BuyerOrderHistory.tsx` — guest lookup at `/my-orders`)

**File:** `apps/web/src/app/my-orders/BuyerOrderHistory.tsx`

**Current behavior:** Guest customers search for orders by email/phone. Shows a list of orders with status badges, fulfillment method, and item count. Clicking an order shows a detail view with shipping info, deposit info, digital downloads, refunds, and an `OrderReceipt`.

**Gaps:**

- **26.1 `BuyerOrder` interface has no `productType` on items.** The items interface (lines 45-52) includes `id`, `name`, `sku`, `quantity`, `unitPrice`, `imageUrl` — no `productType` field.
  - **Impact:** The order list and detail view cannot display product type badges or apply type-specific UI.

- **26.2 Order list cards show no product type indicators.** The order list (lines 1096-1223) shows order number, status badges (draft, paid, confirmed, fulfilled), tenant name, date, fulfillment method icon, and item count. There is no indication of whether an order contains digital, service, or hybrid products.
  - **Impact:** A customer with mixed order types (physical, digital, service) cannot distinguish them at a glance. A digital order looks identical to a physical order in the list.

- **26.3 Fulfillment method labels are physical-only.** `getFulfillmentLabel` (lines 335-340) returns 'Pickup', 'Delivery', 'Shipping', or 'Standard'. There is no label for digital delivery ('Instant Download') or service fulfillment ('Scheduled Service').
  - **Impact:** Digital orders show 'Standard' which is misleading. Service orders show 'Standard' which doesn't convey booking info.

- **26.4 Fulfillment icons are physical-only.** `getFulfillmentIcon` (lines 329-333) returns Package (pickup), Truck (delivery), or MapPin (default). No icon for digital (Download) or service (Calendar/Clock).
  - **Impact:** Visual cues don't differentiate order types.

- **26.5 Action buttons are physical-only.** The order detail view (lines 400-464) shows "Confirm Pickup", "Confirm Delivery", "Confirm Received" — all physical fulfillment actions. No "Download Digital Products" or "View Service Appointment" actions.
  - **Impact:** Digital order customers have no clear CTA to access their downloads from the order detail. Service customers have no way to view or manage their appointment.

- **26.6 Digital downloads section only shown in detail view.** The digital downloads section (lines 717-833) is only rendered when an order is selected for detail view. There is no indicator in the order list that an order has digital downloads available.
  - **Impact:** Customers may not realize they have digital downloads available unless they click into each order.

- **26.7 No service appointment UI.** There is no UI for displaying service appointment details (date, time, location, provider, status). The detail view has sections for shipping, deposits, digital downloads, refunds, and cancellation — but nothing for service bookings.
  - **Impact:** Service customers have no way to view their appointment details from the order dashboard.

- **26.8 Status filter tabs are physical-centric.** The filter tabs (lines 1073-1088) are: All, Draft, Active, Completed, Cancelled. There is no "Digital Downloads" or "Services" filter.
  - **Impact:** Customers cannot filter orders by product type to find their digital downloads or service appointments.

- **26.9 `canConfirmFulfillment` excludes digital orders.** The check (lines 359-362) requires `fulfillmentMethod` to be 'pickup', 'delivery', or 'shipping'. Digital orders with no fulfillment method cannot be confirmed.
  - **Impact:** Digital orders have no customer-side fulfillment confirmation flow.

### 27. Account Orders Page (`account/orders/page.tsx` — authenticated at `/account/orders`)

**File:** `apps/web/src/app/account/orders/page.tsx`

**Current behavior:** Authenticated customers view their order history with search, status filter, and pagination. Clicking an order shows a receipt view with actions.

**Gaps:**

- **27.1 No product type badges on order list items.** The order list (lines 496-644) shows order number, status badge, date, item thumbnails, item names, and total. No product type badge or indicator on individual items.
  - **Impact:** Customer cannot tell if an order contains digital, service, or hybrid products from the list view.

- **27.2 No digital download section in receipt view.** Unlike `BuyerOrderHistory.tsx`, the account orders receipt view (lines 233-407) does NOT include a digital downloads section. It renders `OrderReceipt` with actions but no download links.
  - **Impact:** Authenticated customers cannot access digital downloads from the order detail page. They must navigate to `/account/downloads` separately.

- **27.3 Status filter options are physical-centric.** The filter dropdown (lines 446-456) includes: all, draft, confirmed, paid, processing, shipped, delivered, cancelled, refunded, fulfilled. No filter for "Digital", "Service", or "Has Downloads".
  - **Impact:** Customers cannot filter by product type.

- **27.4 Action buttons are physical-only.** The receipt actions (lines 343-401) include "Continue Checkout" (draft), "Confirm Pickup/Delivery/Received", and "Cancel Order". No "Download" or "View Appointment" actions.
  - **Impact:** Same as BuyerOrderHistory — digital and service customers lack relevant CTAs.

- **27.5 Order items passed to `OrderReceipt` without `productType`.** When constructing the `cart` prop for `OrderReceipt` (lines 308-318), item mapping includes `id`, `name`, `sku`, `quantity`, `unitPrice` — no `productType`.
  - **Impact:** The receipt component cannot display product type badges or type-specific information.

### 28. Account Order Detail Page (`account/orders/[orderId]/page.tsx`)

**File:** `apps/web/src/app/account/orders/[orderId]/page.tsx`

**Current behavior:** Shows a single order detail with a fulfillment timeline, order items, shipping address, contact info, payment summary, and a toggleable receipt view.

**Gaps:**

- **28.1 Fulfillment timeline is hardcoded for physical orders.** `getFulfillmentSteps` (lines 85-96) returns exactly 4 steps: "Order Placed" → "Processing" → "Shipped" → "Delivered". These steps are physical-logistics-specific.
  - **Impact:** Digital orders show a "Shipped" step that will never complete. Service orders show "Shipped" and "Delivered" which are semantically wrong. The timeline should adapt based on product type:
    - Physical: Order Placed → Processing → Shipped → Delivered
    - Digital: Order Placed → Payment Confirmed → Access Granted → Downloaded
    - Service: Order Placed → Payment Confirmed → Scheduled → In Progress → Completed
    - Hybrid: Order Placed → Payment Confirmed → Digital Delivered → Physical Shipped → Delivered

- **28.2 No product type badges on order items.** The items list (lines 179-197) shows image, name, SKU, quantity, and price. No product type badge.
  - **Impact:** Customer cannot see which items are physical, digital, service, or hybrid.

- **28.3 No digital download section.** The order detail page does not include any digital download UI. No download links, no access grant status, no download limits.
  - **Impact:** Customer must navigate to `/account/downloads` to access digital purchases. There is no link or CTA directing them there.

- **28.4 No service appointment section.** No UI for service appointment details (date, time, provider, location, status, reschedule button).
  - **Impact:** Service customers have no appointment management from the order detail page.

- **28.5 Shipping address shown for all order types.** The shipping address card (lines 205-227) is shown whenever `order.shippingAddress` exists. For digital-only orders, this may show a billing address that the customer mistakes for a shipping address.
  - **Impact:** Confusing for digital-only orders where no physical shipping occurs.

- **28.6 Items passed to `OrderReceipt` without `productType`.** Same gap as 27.5 — the receipt cart construction (lines 308-314) omits `productType`.

### 29. Order Receipt Component (`OrderReceipt.tsx`)

**File:** `apps/web/src/components/checkout/OrderReceipt.tsx`

**Current behavior:** Shared receipt component used by both `BuyerOrderHistory.tsx` and `account/orders/page.tsx`. Displays order info, customer info, fulfillment method, store info, order items, and pricing breakdown.

**Gaps:**

- **29.1 Items interface has no `productType`.** The `cart.items` interface (lines 17-23) includes `id`, `name`, `sku`, `quantity`, `unitPrice` — no `productType` field.
  - **Impact:** The receipt cannot display product type badges or type-specific information per item.

- **29.2 Fulfillment method section is physical-only.** The fulfillment section (lines 449-624) handles three cases: pickup (with store hours, QR code, directions), delivery (with address), and shipping (with address). No case for digital delivery or service appointment.
  - **Impact:** Digital orders show no fulfillment info (no download links in receipt). Service orders show no appointment details. The receipt is incomplete for non-physical products.

- **29.3 No digital download links in receipt.** The receipt shows order items with name, SKU, and price but no download links for digital products. A customer printing the receipt has no way to access their digital purchases.
  - **Impact:** The printed receipt is useless for digital product access. Customers must go to the downloads page separately.

- **29.4 No service appointment details in receipt.** No fields for appointment date, time, provider, location, or service-specific instructions.
  - **Impact:** Service receipts lack essential booking information.

- **29.5 Status badges are physical-centric.** `getStatusBadge` (lines 167-184) maps: pending, processing, shipped, fulfilled, cancelled. No badges for digital-specific statuses (e.g., "Access Granted", "Downloaded") or service-specific statuses (e.g., "Scheduled", "In Progress", "Completed").
  - **Impact:** Status display doesn't reflect the actual state of non-physical orders.

- **29.6 Store hours and QR directions shown for all orders.** The store information section (lines 627-760) always shows store hours, address, and QR code for directions. For digital-only orders, this is irrelevant.
  - **Impact:** Digital order receipts include unnecessary physical store information, adding clutter.

- **29.7 Receipt visibility check excludes non-physical statuses.** Line 311: `if (cart.status !== 'paid' && cart.status !== 'fulfilled' && !isDepositForfeited && !isCancelled) return null;`. This means orders with digital-specific or service-specific statuses (if they existed) would not render a receipt.
  - **Impact:** If new statuses are added for digital/service orders, the receipt component must be updated or it will render nothing.

### 30. Digital Downloads Page (`account/downloads/page.tsx`)

**File:** `apps/web/src/app/account/downloads/page.tsx`

**Current behavior:** Dedicated page for accessing digital product downloads. Fetches all customer orders, filters for digital/hybrid items, and displays download cards with asset info, download limits, and expiry.

**Strengths (most product-type-aware component):**

- Correctly filters for `productType === 'digital' || productType === 'hybrid'` (line 72-73)
- Shows product type badge: "Digital" or "Hybrid" (lines 242-248)
- Handles multiple asset types: file, link, license_key, access_grant
- Shows download status, limits, expiry, and download count
- Uses `DownloadProgress` component for file downloads

**Gaps:**

- **30.1 Relies on `getCustomerOrders()` which fetches ALL orders.** The page (lines 59-110) fetches up to 100 orders, then iterates each to check for digital items, then makes a separate API call per order to get downloads. This is N+1 API calls.
  - **Impact:** Slow page load for customers with many orders. Should have a dedicated API endpoint that returns all downloads for a customer directly.

- **30.2 No link from order detail pages to downloads page.** Neither `BuyerOrderHistory.tsx` nor `account/orders/page.tsx` nor `account/orders/[orderId]/page.tsx` link to `/account/downloads` when an order contains digital products.
  - **Impact:** Customers may not discover the downloads page exists.

- **30.3 No service-specific page.** There is no equivalent `/account/services` or `/account/appointments` page for service products. The downloads page is the only product-type-specific customer page.
  - **Impact:** Service customers have no dedicated page to view and manage their appointments.

- **30.4 `productType` in `DigitalDownload` interface includes `'physical'`.** Line 22: `productType: 'digital' | 'hybrid' | 'physical'`. While the page filters for digital/hybrid only, the interface still includes `'physical'` — and still excludes `'service'`.
  - **Impact:** If service products ever appear in download results, the type system won't catch it.

### 31. Summary of Customer Dashboard Gaps

| Dashboard Area | Physical | Digital | Service | Hybrid |
|---|---|---|---|---|
| Order list: product type badge | ❌ Not shown | ❌ Not shown | ❌ Not shown | ❌ Not shown |
| Order list: type-specific icon | ✅ Package/Truck | ❌ No Download icon | ❌ No Calendar icon | ❌ No combined icon |
| Order list: type-specific CTA | ✅ Confirm Pickup/Delivery | ❌ No Download CTA | ❌ No View Appointment | ❌ No combined CTA |
| Order detail: fulfillment timeline | ✅ Correct steps | ❌ Physical steps shown | ❌ Physical steps shown | ❌ Physical steps only |
| Order detail: digital downloads | N/A | ⚠️ Only in BuyerOrderHistory, not account/orders | N/A | ⚠️ Only in BuyerOrderHistory |
| Order detail: service appointment | N/A | N/A | ❌ No appointment UI | N/A |
| Order detail: product type badge on items | ❌ Not shown | ❌ Not shown | ❌ Not shown | ❌ Not shown |
| Receipt: product type on items | ❌ Not in interface | ❌ Not in interface | ❌ Not in interface | ❌ Not in interface |
| Receipt: digital download links | N/A | ❌ Not included | N/A | ❌ Not included |
| Receipt: service appointment details | N/A | N/A | ❌ Not included | N/A |
| Receipt: fulfillment method section | ✅ Pickup/Delivery/Shipping | ❌ No digital section | ❌ No service section | ❌ No hybrid section |
| Status filter: product type option | ❌ No filter | ❌ No "Has Downloads" | ❌ No "Services" | ❌ No filter |
| Dedicated type-specific page | N/A | ✅ `/account/downloads` | ❌ No services page | ⚠️ Partial (downloads only) |
| Service layer: `productType` mapped | ✅ In list endpoint | ⚠️ In list, not in detail | ❌ Missing from interface | ⚠️ In list, not in detail |

### 32. Recommended Customer Dashboard Fixes (Priority Order)

**P0 — Fix data flow and basic visibility:**

- **32.1** Add `'service'` to `CustomerOrderItem.productType` union type in `CustomerOrderService.ts`
- **32.2** Map `productType` in `getOrder()` (single order detail) — currently only mapped in `getCustomerOrders()`
- **32.3** Add `productType` to `BuyerOrder` items interface in `BuyerOrderHistory.tsx`
- **32.4** Add `productType` to `OrderReceipt` cart items interface and display type badges on each line item
- **32.5** Pass `productType` when constructing cart props for `OrderReceipt` in all three call sites (`BuyerOrderHistory.tsx`, `account/orders/page.tsx`, `account/orders/[orderId]/page.tsx`)

**P1 — Product-type-centric order list:**

- **32.6** Add product type badge/indicator to order list cards (derive primary type from items or show "Mixed" for hybrid orders)
- **32.7** Add type-specific icons to order list: Download icon for digital, Calendar icon for service, combined icon for hybrid
- **32.8** Add type-specific CTAs to order list: "Download" for digital orders, "View Appointment" for service orders
- **32.9** Add product type filter to status filter tabs: "Digital", "Service", "Has Downloads"
- **32.10** Add "Has Digital Downloads" indicator badge on order list cards for orders with digital products

**P1 — Product-type-centric order detail:**

- **32.11** Make fulfillment timeline adaptive based on product type:
  - Physical: Order Placed → Processing → Shipped → Delivered
  - Digital: Order Placed → Payment Confirmed → Access Granted → Downloaded
  - Service: Order Placed → Payment Confirmed → Scheduled → In Progress → Completed
  - Hybrid: Combined timeline showing both digital and physical milestones
- **32.12** Add digital downloads section to `account/orders/page.tsx` receipt view (currently only in `BuyerOrderHistory.tsx`)
- **32.13** Add digital downloads section to `account/orders/[orderId]/page.tsx`
- **32.14** Add "Go to Downloads" link/button in order detail when order has digital products
- **32.15** Hide or de-emphasize shipping address for digital-only orders
- **32.16** Hide store hours/directions QR code for digital-only orders in `OrderReceipt`

**P1 — Product-type-centric receipt:**

- **32.17** Add digital delivery section to `OrderReceipt` fulfillment method area (showing download links, access expiry, download count)
- **32.18** Add service appointment section to `OrderReceipt` (showing date, time, provider, location, instructions)
- **32.19** Add hybrid fulfillment section to `OrderReceipt` (showing both digital download links and physical shipping info)
- **32.20** Update `getStatusBadge` in `OrderReceipt` to handle digital-specific and service-specific statuses
- **32.21** Update receipt visibility check (line 311) to include digital/service-specific statuses

**P2 — Service product support:**

- **32.22** Create `/account/appointments` page for service bookings (mirroring `/account/downloads` pattern)
- **32.23** Add service appointment card component with date, time, provider, location, status, and reschedule/cancel actions
- **32.24** Add "View Appointment" CTA on order list and detail for service orders
- **32.25** Add service appointment details to `OrderReceipt`
- **32.26** Add service-specific fulfillment timeline steps

**P2 — Hybrid product support:**

- **32.27** Show split fulfillment status on order list: "Digital: Delivered, Physical: Shipped"
- **32.28** Show split fulfillment timeline in order detail: digital milestones + physical milestones
- **32.29** Include both digital download links and physical shipping info in receipt for hybrid orders
- **32.30** Add "Partially Fulfilled" badge for hybrid orders where digital is delivered but physical is pending

---

## Phased Implementation Plan for Parts 2 & 3

This plan covers backend order/receipt handling (Part 2, §11–§24) and customer dashboard order views (Part 3, §25–§32). Part 1 (frontend display, §1–§10) is already in flight and is a prerequisite for some phases here.

Phases are numbered B1–B7 (backend) and F1–F6 (frontend/customer dashboard). Backend phases generally precede corresponding frontend phases since the frontend depends on backend data.

### Dependencies

```
Part 1 Phase 0 (backend product_type in API responses)
  └─→ B1 (stock + checkout fixes) — independent, can start immediately
  └─→ B2 (digital fulfillment fixes) — independent, can start immediately
       └─→ F2 (customer dashboard digital downloads) — depends on B2
  └─→ B3 (order status + fulfillment status) — independent
       └─→ F3 (adaptive fulfillment timeline) — depends on B3
  └─→ B4 (notifications + receipt emails) — depends on B2, B3
  └─→ B5 (API responses: product_type in order items) — independent
       └─→ F1 (customer dashboard data flow) — depends on B5
  └─→ B6 (service fulfillment) — independent, can start immediately
       └─→ F5 (service appointment UI) — depends on B6
  └─→ B7 (hybrid fulfillment) — depends on B2, B6
       └─→ F6 (hybrid order views) — depends on B7
```

### Phase B1: Stock & Checkout Product-Type Fixes (§11, §12)
**Goal:** Stop blocking digital/service orders with physical-stock logic
**Effort:** Medium
**Risk:** Medium (touches checkout flow + stock service)
**Priority:** P0 — blocking correct behavior

**Backend changes:**

- **B1.1** `StockService.ts` — Skip `decrementStockForOrder` for items where `product_type` is `digital` or `service`. Query `inventory_items.product_type` for each order item before decrementing.
- **B1.2** `StockService.ts` — Skip `restoreStockForOrder` for items where `product_type` is `digital` or `service`.
- **B1.3** `checkout.ts` — Skip stock validation (`variant.stock < item.quantity` / `inventoryItem.stock < item.quantity`) for items where `product_type` is `digital` or `service`. Look up `product_type` from `inventory_items` or `product_variants` during validation.
- **B1.4** `checkout.ts` — Validate `fulfillment_method` compatibility with product types: reject `pickup`/`delivery`/`shipping` for digital-only orders; reject `shipping` for service-only orders (unless service has a physical location component).
- **B1.5** `checkout.ts` — Store `product_type` on each `order_items` record during order creation (add to `itemData` object). If schema doesn't have a `product_type` column on `order_items`, store it in `metadata` JSON as a fallback.

**Files touched:** `StockService.ts`, `checkout.ts`, possibly `schema.prisma` (if adding column)
**Testing:**
- Create a digital product with `stock = 0`, verify checkout succeeds
- Create a service product with `stock = 0`, verify checkout succeeds
- Cancel a digital order, verify stock is NOT restored (no error)
- Create a physical product order, verify stock IS decremented and restored on cancel
- Attempt checkout with `fulfillment_method: 'pickup'` for digital-only cart, verify rejection
**Acceptance criteria:**
- [ ] Digital products with `stock = 0` can be ordered
- [ ] Service products with `stock = 0` can be ordered
- [ ] Stock is not decremented for digital/service items
- [ ] Stock is not restored for digital/service items on cancellation
- [ ] `fulfillment_method` is validated against product types
- [ ] `checkapi` passes

---

### Phase B2: Digital Fulfillment Fixes (§16, §17, §22)
**Goal:** Complete the digital fulfillment pipeline — status updates, email wiring, access revocation
**Effort:** Medium
**Risk:** Low-Medium
**Priority:** P0 — blocking correct behavior

**Backend changes:**

- **B2.1** `DigitalFulfillmentService.ts` — After `fulfillOrder` completes for a digital-only order, update the order's `fulfillment_status` to `fulfilled` and `order_status` to `delivered`. For hybrid orders, set `fulfillment_status` to `partially_fulfilled`.
- **B2.2** `DigitalDownloadEmailService.ts` — Wire `sendDownloadReceipt` to the actual email service (remove TODO stub). Use the existing `emailService` or `Resend`/`SendGrid` integration used by `OrderNotificationService`.
- **B2.3** `buyer-orders.ts` — In the cancel endpoint, after restoring stock, check if the order has digital products. If so, revoke all active digital access grants for that order (set `is_revoked = true` on `digital_access_grants`).
- **B2.4** `tenant-orders.ts` — In the fulfillment cancel endpoint, same digital access revocation as B2.3.
- **B2.5** `StripeWebhookHandler.ts` — Add `StockService.decrementStockForOrder` call after successful payment (currently only in checkout payment routes, not webhook handler). Or: extract stock decrement into a shared post-payment function and call from all 4 places (webhook + 3 checkout routes).
- **B2.6** Extract digital fulfillment logic from `checkout/stripe.ts`, `checkout/paypal.ts`, `checkout/square.ts` into a shared `postPaymentFulfillment(orderId, tenantId)` function to eliminate duplication. Call from all 3 checkout routes + webhook handler.

**Files touched:** `DigitalFulfillmentService.ts`, `DigitalDownloadEmailService.ts`, `buyer-orders.ts`, `tenant-orders.ts`, `StripeWebhookHandler.ts`, `checkout/stripe.ts`, `checkout/paypal.ts`, `checkout/square.ts`
**Testing:**
- Place a digital-only order, verify `fulfillment_status` becomes `fulfilled` after payment
- Place a hybrid order, verify `fulfillment_status` becomes `partially_fulfilled` after digital component is delivered
- Verify digital download email is actually sent (check email service logs)
- Cancel a digital order, verify `digital_access_grants.is_revoked = true` for all grants
- Verify stock is decremented for orders paid via Stripe webhook
**Acceptance criteria:**
- [ ] Digital-only orders auto-fulfill after payment (`fulfillment_status = fulfilled`)
- [ ] Hybrid orders show `partially_fulfilled` after digital component delivery
- [ ] `DigitalDownloadEmailService.sendDownloadReceipt` sends actual emails
- [ ] Cancelling a digital order revokes access grants
- [ ] Stock is decremented regardless of payment path (direct vs webhook)
- [ ] `checkapi` passes

---

### Phase B3: Order Status & Fulfillment Status Enums (§13, §14)
**Goal:** Add product-type-specific statuses so order state reflects actual fulfillment state
**Effort:** Medium
**Risk:** Medium (schema migration + enum changes affect existing code)
**Priority:** P1 — correct semantics

**Backend changes:**

- **B3.1** `schema.prisma` — Add to `order_status` enum: `access_granted` (digital delivered), `scheduled` (service booked), `in_progress` (service being performed). Add to `fulfillment_status` enum: `digitally_delivered` (digital component complete, physical pending in hybrid).
- **B3.2** Create migration SQL for the enum additions. Use `ALTER TYPE ... ADD VALUE` for PostgreSQL enums.
- **B3.3** `OrderManagementService.ts` — Add product-type-aware status validation in `updateOrderStatus`: reject `shipped` for digital-only orders, reject `delivered` for service orders unless `in_progress` was set first, etc. Add a `getValidStatusTransitions(orderId)` method that returns valid next statuses based on order item product types.
- **B3.4** `OrderManagementService.ts` — Include `product_type` for order items in the `OrderLocationInfo` response (query `inventory_items.product_type` and include in returned data).
- **B3.5** `buyer-orders.ts` and `tenant-orders.ts` — Add `product_type` to order item mappings in all API responses (list, detail, etc.).

**Files touched:** `schema.prisma`, new migration SQL, `OrderManagementService.ts`, `buyer-orders.ts`, `tenant-orders.ts`
**Testing:**
- Verify new enum values are accepted by the database
- Attempt to set `shipped` on a digital-only order, verify rejection
- Verify `product_type` appears in order item API responses for both buyer and tenant endpoints
**Acceptance criteria:**
- [ ] `order_status` enum includes `access_granted`, `scheduled`, `in_progress`
- [ ] `fulfillment_status` enum includes `digitally_delivered`
- [ ] Status transitions are validated against product types
- [ ] `product_type` is included in all order item API responses
- [ ] `checkapi` passes

---

### Phase B4: Notifications & Receipt Emails (§19, §22)
**Goal:** Send product-type-appropriate notifications and receipts
**Effort:** Large
**Risk:** Medium
**Priority:** P1 — correct UX

**Backend changes:**

- **B4.1** `OrderNotificationService.ts` — Add new notification types: `digital_delivered`, `service_scheduled`, `service_completed`. Add template branches in `buildCustomerEmailPayload` for each type.
  - `digital_delivered`: "Your digital products are ready to download" + download links
  - `service_scheduled`: "Your service is confirmed" + appointment details
  - `service_completed`: "Your service has been completed" + summary
- **B4.2** `OrderNotificationService.ts` — In `order_fulfilled` notification, check order item product types. If digital-only, use `digital_delivered` template instead of physical pickup/shipping template. If service, use `service_completed` template. If hybrid, send both digital and physical info.
- **B4.3** Create `OrderReceiptEmailService.ts` — New service for sending customer order receipt emails with itemized products, prices, totals, and type-specific information (download links for digital, appointment details for service, shipping info for physical). Triggered after successful payment.
- **B4.4** Wire `OrderReceiptEmailService` into the post-payment flow (call from the shared `postPaymentFulfillment` function created in B2.6).
- **B4.5** `OrderNotificationService.ts` — Integrate with `DigitalDownloadEmailService` so digital delivery notifications are logged in `notification_logs` and tracked in CRM alerts (currently `DigitalDownloadEmailService` operates independently).

**Files touched:** `OrderNotificationService.ts`, new `OrderReceiptEmailService.ts`, `checkout/stripe.ts`, `checkout/paypal.ts`, `checkout/square.ts`, `StripeWebhookHandler.ts`
**Testing:**
- Place a digital order, verify customer receives "digital_delivered" email (not "order ready for pickup")
- Place a service order, verify customer receives "service_scheduled" email
- Place a physical order, verify existing notification behavior unchanged
- Verify receipt email includes itemized products with correct type-specific info
**Acceptance criteria:**
- [ ] Digital orders send `digital_delivered` notification (not physical template)
- [ ] Service orders send `service_scheduled` notification
- [ ] Customer order receipt email is sent after payment with itemized products
- [ ] Digital delivery notifications are logged in `notification_logs`
- [ ] `checkapi` passes

---

### Phase B5: Order API Response Enrichment (§20, §21)
**Goal:** Include `product_type` and digital access info in all order API responses
**Effort:** Small-Medium
**Risk:** Low
**Priority:** P0 — frontend depends on this

**Backend changes:**

- **B5.1** `buyer-orders.ts` — Add `product_type` to order item mapping in all response paths (list, detail, etc.). Include `productType: item.inventory_items?.product_type` in the item object.
- **B5.2** `buyer-orders.ts` — In the order detail response, include digital access grant information: download URLs, access expiry, download count, download limit, revoked status. Query `digital_access_grants` for orders with digital items.
- **B5.3** `tenant-orders.ts` — Add `product_type` to order item mapping in all response paths.
- **B5.4** `buyer-orders.ts` — Add a `PATCH /:orderId/fulfill` endpoint for digital orders (or extend the existing pickup endpoint to accept digital fulfillment confirmation). This allows customers to confirm digital delivery without requiring a physical fulfillment method.
- **B5.5** Create a dedicated `GET /api/orders/customer/:email/downloads` endpoint that returns all digital downloads for a customer across all orders (eliminates the N+1 problem in the frontend downloads page).

**Files touched:** `buyer-orders.ts`, `tenant-orders.ts`
**Testing:**
- GET order detail for a digital order, verify `productType` and `downloadUrl`/`accessExpiry` in response
- GET order list, verify `productType` on each item
- GET customer downloads endpoint, verify all digital downloads returned in single call
**Acceptance criteria:**
- [ ] `product_type` is in all order item API responses (buyer + tenant)
- [ ] Digital access grant info is included in order detail responses
- [ ] Dedicated customer downloads endpoint exists (no N+1)
- [ ] `checkapi` passes

---

### Phase B6: Service Fulfillment Service (§15, §16, §17)
**Goal:** Create the service product fulfillment pipeline — booking, scheduling, notifications
**Effort:** Large
**Risk:** Medium
**Priority:** P2 — service product support

**Backend changes:**

- **B6.1** Create `ServiceFulfillmentService.ts` — New service for service product fulfillment. Methods: `hasServiceProducts(orderId)`, `fulfillOrder(orderId)` (creates booking record, assigns provider if specified, sends confirmation), `cancelBooking(orderId)`.
- **B6.2** Create `service_bookings` table (migration + Prisma model) — Fields: `id`, `order_id`, `order_item_id`, `tenant_id`, `customer_email`, `customer_name`, `customer_phone`, `scheduled_date`, `scheduled_time`, `duration_minutes`, `provider_id` (nullable), `provider_name` (nullable), `service_location` (nullable), `status` (`pending` | `confirmed` | `in_progress` | `completed` | `cancelled`), `notes`, `created_at`, `updated_at`.
- **B6.3** `checkout.ts` — Add service booking fields to the order creation request: `service_booking` object with `preferred_date`, `preferred_time`, `service_location`, `provider_id` (optional). Store in order metadata or create `service_bookings` record during checkout.
- **B6.4** Wire `ServiceFulfillmentService.fulfillOrder` into the shared `postPaymentFulfillment` function (B2.6). After successful payment, if order has service products, create booking record and send confirmation notification.
- **B6.5** `tenant-orders.ts` — Add endpoints for service fulfillment management: `PUT /fulfillment` with service-specific fields (`providerId`, `scheduledDate`, `scheduledTime`, `serviceLocation`, `serviceStatus`). Add `POST /:orderId/service/assign-provider` endpoint.
- **B6.6** `OrderNotificationService.ts` — Add `service_scheduled` and `service_reminder` notification types. Send reminder 24h before appointment (requires a scheduled job).

**Files touched:** new `ServiceFulfillmentService.ts`, new migration SQL, `schema.prisma`, `checkout.ts`, `tenant-orders.ts`, `OrderNotificationService.ts`
**Testing:**
- Place a service order with preferred date/time, verify booking record is created after payment
- Verify service confirmation email is sent with appointment details
- Merchant updates service status to `in_progress` then `completed`, verify status transitions
- Cancel a service order, verify booking is cancelled
**Acceptance criteria:**
- [ ] `ServiceFulfillmentService` creates bookings after payment
- [ ] Service bookings table exists with correct schema
- [ ] Service confirmation notifications are sent
- [ ] Merchants can manage service fulfillment status
- [ ] `checkapi` passes

---

### Phase B7: Hybrid Fulfillment Coordination (§16, §17)
**Goal:** Coordinate digital + physical fulfillment for hybrid orders
**Effort:** Medium
**Risk:** Medium
**Priority:** P2 — hybrid product support
**Depends on:** B2 (digital fulfillment), B6 (service fulfillment if hybrid includes service component)

**Backend changes:**

- **B7.1** `DigitalFulfillmentService.ts` — After fulfilling the digital component of a hybrid order, set `fulfillment_status` to `partially_fulfilled` (not `fulfilled`). Only set `fulfilled` when both digital and physical components are complete.
- **B7.2** Create `HybridFulfillmentCoordinator.ts` (or add to `FulfillmentService.ts`) — Method `checkHybridFulfillmentComplete(orderId)`: checks if all digital items have `digital_delivery_status = 'delivered'` AND all physical items have `fulfillment_status = 'fulfilled'`. If both complete, set order `fulfillment_status = fulfilled` and `order_status = delivered`.
- **B7.3** `tenant-orders.ts` — When merchant marks physical fulfillment as complete for a hybrid order, call `checkHybridFulfillmentComplete` to determine if the order is fully fulfilled.
- **B7.4** `buyer-orders.ts` — When customer confirms physical pickup/delivery for a hybrid order, call `checkHybridFulfillmentComplete`.
- **B7.5** `OrderNotificationService.ts` — For hybrid order `order_fulfilled` notification, include both digital download links and physical fulfillment confirmation in the same email.

**Files touched:** `DigitalFulfillmentService.ts`, new `HybridFulfillmentCoordinator.ts` or `FulfillmentService.ts`, `tenant-orders.ts`, `buyer-orders.ts`, `OrderNotificationService.ts`
**Testing:**
- Place a hybrid order, verify digital component is delivered immediately and `fulfillment_status = partially_fulfilled`
- Complete physical fulfillment, verify `fulfillment_status = fulfilled` and `order_status = delivered`
- Verify notification includes both digital and physical info
**Acceptance criteria:**
- [ ] Hybrid orders use `partially_fulfilled` after digital delivery
- [ ] Hybrid orders auto-transition to `fulfilled` when both components complete
- [ ] Notifications include both digital and physical info for hybrid orders
- [ ] `checkapi` passes

---

### Phase F1: Customer Dashboard Data Flow (§25)
**Goal:** Fix the frontend service layer to carry `productType` to all customer dashboard components
**Effort:** Small
**Risk:** Low
**Priority:** P0 — all frontend phases depend on this
**Depends on:** B5 (backend returns `product_type` in order responses)

**Frontend changes:**

- **F1.1** `CustomerOrderService.ts` — Add `'service'` to `CustomerOrderItem.productType` union type (line 89): `'physical' | 'digital' | 'hybrid' | 'service'`.
- **F1.2** `CustomerOrderService.ts` — In `getOrder()` (lines 229-260), add `productType: item.inventory_items?.product_type || item.productType` to the item mapping. Currently only `getCustomerOrders()` maps this.
- **F1.3** `CustomerOrderService.ts` — In `getBuyerOrders()` (lines 628-652), map the raw API response to include `productType` on items, similar to `getCustomerOrders()`. Or: update `BuyerOrderHistory.tsx` to use `CustomerOrder` type instead of its own `BuyerOrder` type.
- **F1.4** `CustomerOrderService.ts` — Add `OrderRequest.fulfillmentMethod` to include `'digital'` and `'service'` options (mirror backend changes from B1.4).
- **F1.5** `CustomerOrderService.ts` — Add `getCustomerDownloads(email)` method that calls the new dedicated downloads endpoint from B5.5 (eliminates N+1 in downloads page).

**Files touched:** `CustomerOrderService.ts`
**Testing:**
- Call `getOrder(orderId)` for a digital order, verify `items[0].productType === 'digital'`
- Call `getOrder(orderId)` for a service order, verify `items[0].productType === 'service'`
- Call `getBuyerOrders()`, verify `productType` on items
- Call `getCustomerDownloads()`, verify single API call returns all downloads
**Acceptance criteria:**
- [ ] `CustomerOrderItem.productType` includes `'service'`
- [ ] `getOrder()` maps `productType` on items
- [ ] `getBuyerOrders()` returns items with `productType`
- [ ] `getCustomerDownloads()` method exists
- [ ] `checkweb` passes

---

### Phase F2: Digital Downloads in Order Views (§26, §27, §28, §30)
**Goal:** Surface digital download links in all order views, not just the guest detail modal
**Effort:** Medium
**Risk:** Low
**Depends on:** F1 (data flow), B2 (digital fulfillment fixes)

**Frontend changes:**

- **F2.1** `BuyerOrderHistory.tsx` — Add "Has Downloads" badge on order list cards for orders containing digital products. Derive from `items.some(i => i.productType === 'digital' || i.productType === 'hybrid')`.
- **F2.2** `account/orders/page.tsx` — Add digital downloads section to the receipt view (lines 233-407). Fetch downloads using `customerOrderService.getOrderDownloads(orderId)` and render the same download card UI as `BuyerOrderHistory.tsx` (lines 717-833). Extract the download card UI into a shared `DigitalDownloadsCard` component.
- **F2.3** `account/orders/[orderId]/page.tsx` — Add digital downloads section below the order items card. Include "Go to Downloads" link to `/account/downloads`.
- **F2.4** Create shared `DigitalDownloadsCard.tsx` component — Extract from `BuyerOrderHistory.tsx` lines 717-833. Reusable component that takes `orderId` and renders download cards with access status, download limits, and download buttons.
- **F2.5** `account/downloads/page.tsx` — Replace the N+1 fetch loop (lines 59-110) with `customerOrderService.getCustomerDownloads(email)` single call from F1.5.
- **F2.6** `account/downloads/page.tsx` — Add `'service'` to `DigitalDownload.productType` type (line 22) and remove `'physical'` (not applicable).

**Files touched:** `BuyerOrderHistory.tsx`, `account/orders/page.tsx`, `account/orders/[orderId]/page.tsx`, new `DigitalDownloadsCard.tsx`, `account/downloads/page.tsx`
**Testing:**
- View order list, verify "Has Downloads" badge on digital orders
- View account order detail, verify digital downloads section appears for digital orders
- View `/account/downloads`, verify single API call loads all downloads
- Verify `DigitalDownloadsCard` renders correctly in all 3 locations
**Acceptance criteria:**
- [ ] Order list shows "Has Downloads" badge for digital/hybrid orders
- [ ] `account/orders/page.tsx` receipt view includes digital downloads section
- [ ] `account/orders/[orderId]/page.tsx` includes digital downloads + link to downloads page
- [ ] `DigitalDownloadsCard` is a reusable shared component
- [ ] Downloads page uses single API call (no N+1)
- [ ] `checkweb` passes

---

### Phase F3: Adaptive Fulfillment Timeline (§28)
**Goal:** Order detail fulfillment timeline adapts based on product type
**Effort:** Medium
**Risk:** Low
**Depends on:** B3 (new order statuses), F1 (data flow)

**Frontend changes:**

- **F3.1** `account/orders/[orderId]/page.tsx` — Replace hardcoded `getFulfillmentSteps()` (lines 85-96) with a product-type-aware function:
  - Detect order's primary product type from `order.items` (if all items same type, use that; if mixed, use `hybrid`)
  - Physical: Order Placed → Processing → Shipped → Delivered
  - Digital: Order Placed → Payment Confirmed → Access Granted → Downloaded
  - Service: Order Placed → Payment Confirmed → Scheduled → In Progress → Completed
  - Hybrid: Order Placed → Payment Confirmed → Digital Delivered → Physical Shipped → Delivered
- **F3.2** Create `FulfillmentTimeline.tsx` component — Reusable timeline that takes `order` + `productType` and renders the correct steps with icons, labels, completion states. Use Lucide icons: `CheckCircle`, `CreditCard`, `Download`, `Calendar`, `Clock`, `Package`, `Truck`.
- **F3.3** `BuyerOrderHistory.tsx` — In the order detail view, replace the implicit status display with `FulfillmentTimeline` component for consistency.
- **F3.4** `account/orders/page.tsx` — In the receipt view, show a compact timeline indicator (optional — may just use status badge).

**Files touched:** `account/orders/[orderId]/page.tsx`, new `FulfillmentTimeline.tsx`, `BuyerOrderHistory.tsx`, `account/orders/page.tsx`
**Testing:**
- View a physical order detail, verify 4-step physical timeline
- View a digital order detail, verify 4-step digital timeline (no "Shipped" step)
- View a service order detail, verify 5-step service timeline
- View a hybrid order detail, verify 5-step hybrid timeline
**Acceptance criteria:**
- [ ] Fulfillment timeline adapts based on product type
- [ ] `FulfillmentTimeline` is a reusable component
- [ ] Digital orders don't show "Shipped" step
- [ ] Service orders show "Scheduled" and "In Progress" steps
- [ ] `checkweb` passes

---

### Phase F4: Product-Type-Centric Order List & Receipt (§26, §27, §29)
**Goal:** Order list cards and receipts show product type indicators and type-specific info
**Effort:** Medium-Large
**Risk:** Low
**Depends on:** F1 (data flow), F2 (downloads)

**Frontend changes:**

- **F4.1** Create `ProductTypeBadge.tsx` component — Small badge showing product type with icon + color + label. Variants: `physical` (Package, blue), `digital` (Download, purple), `service` (Calendar, green), `hybrid` (Layers, orange). Reusable across order list, order detail, and receipt.
- **F4.2** `BuyerOrderHistory.tsx` — Add `ProductTypeBadge` to order list cards (derive primary type from items). Add type-specific icons to `getFulfillmentIcon`: `Download` for digital, `Calendar` for service. Add type-specific labels to `getFulfillmentLabel`: "Instant Download" for digital, "Scheduled Service" for service.
- **F4.3** `BuyerOrderHistory.tsx` — Add type-specific CTAs to order detail: "Download Digital Products" button for digital orders (scrolls to downloads section or links to `/account/downloads`), "View Appointment" button for service orders.
- **F4.4** `account/orders/page.tsx` — Add `ProductTypeBadge` to order list items. Add type filter to status filter dropdown: "Digital", "Service", "Has Downloads". Add type-specific CTAs to receipt actions.
- **F4.5** `OrderReceipt.tsx` — Add `productType` to `cart.items` interface. Display `ProductTypeBadge` next to each item name. Add digital delivery section to fulfillment method area (download links, access expiry). Add service appointment section (date, time, provider, location). Hide store hours/QR directions for digital-only orders.
- **F4.6** `OrderReceipt.tsx` — Update `getStatusBadge` to handle `access_granted`, `scheduled`, `in_progress`, `digitally_delivered` statuses. Update receipt visibility check (line 311) to include new statuses.
- **F4.7** All three `OrderReceipt` call sites (`BuyerOrderHistory.tsx`, `account/orders/page.tsx`, `account/orders/[orderId]/page.tsx`) — Pass `productType` when constructing cart item props.
- **F4.8** `BuyerOrderHistory.tsx` — Update `canConfirmFulfillment` check (lines 359-362) to allow digital orders (no fulfillment method required). Add "Confirm Download" action for digital orders.
- **F4.9** `account/orders/[orderId]/page.tsx` — Hide or de-emphasize shipping address card for digital-only orders. Show "Billing Address" label instead of "Shipping Address" for digital orders.

**Files touched:** new `ProductTypeBadge.tsx`, `BuyerOrderHistory.tsx`, `account/orders/page.tsx`, `OrderReceipt.tsx`, `account/orders/[orderId]/page.tsx`
**Testing:**
- View order list with mixed types, verify type badges on each card
- View digital order receipt, verify download links in fulfillment section
- View service order receipt, verify appointment details in fulfillment section
- View digital order receipt, verify store hours/QR are hidden
- Filter order list by "Digital", verify only digital orders shown
- Verify `ProductTypeBadge` renders correctly for all 4 types
**Acceptance criteria:**
- [ ] `ProductTypeBadge` component exists and is used in order list, detail, and receipt
- [ ] Order list shows type badges and type-specific icons/labels
- [ ] Order list has type filter options
- [ ] `OrderReceipt` shows digital delivery section for digital orders
- [ ] `OrderReceipt` shows service appointment section for service orders
- [ ] `OrderReceipt` hides store info for digital-only orders
- [ ] `OrderReceipt` items show `ProductTypeBadge`
- [ ] `checkweb` passes

---

### Phase F5: Service Appointment UI (§26, §28, §30)
**Goal:** Service customers can view and manage appointments from the dashboard
**Effort:** Large
**Risk:** Medium
**Depends on:** B6 (service fulfillment backend), F1 (data flow)

**Frontend changes:**

- **F5.1** Create `ServiceAppointmentCard.tsx` component — Displays service appointment details: date, time, duration, provider name, service location, status badge, and action buttons (Reschedule, Cancel). Fetches data from order item's service booking info.
- **F5.2** Create `/account/appointments` page — Dedicated page for service bookings (mirrors `/account/downloads` pattern). Fetches all service bookings for the customer. Shows list of `ServiceAppointmentCard` components sorted by upcoming date.
- **F5.3** `BuyerOrderHistory.tsx` — In order detail view, add `ServiceAppointmentCard` section for orders containing service products (alongside digital downloads and shipping sections).
- **F5.4** `account/orders/[orderId]/page.tsx` — Add `ServiceAppointmentCard` section for service orders.
- **F5.5** `account/orders/page.tsx` — Add "View Appointment" CTA on order list cards for service orders. Links to `/account/appointments` or opens appointment detail.
- **F5.6** Add navigation link to `/account/appointments` in the customer dashboard sidebar (via database `navigation_links` table — follow the platform's database-driven navigation pattern).

**Files touched:** new `ServiceAppointmentCard.tsx`, new `account/appointments/page.tsx`, `BuyerOrderHistory.tsx`, `account/orders/[orderId]/page.tsx`, `account/orders/page.tsx`, database `navigation_links` (SQL insert)
**Testing:**
- Place a service order, verify appointment card appears in order detail
- Navigate to `/account/appointments`, verify all service bookings listed
- Verify appointment card shows correct date, time, provider, location, status
- Verify "Reschedule" and "Cancel" buttons appear (functionality may be future phase)
**Acceptance criteria:**
- [ ] `ServiceAppointmentCard` component exists
- [ ] `/account/appointments` page exists and shows all service bookings
- [ ] Service appointment info appears in order detail views
- [ ] "View Appointment" CTA appears on service order list cards
- [ ] Navigation link to appointments page exists in sidebar
- [ ] `checkweb` passes

---

### Phase F6: Hybrid Order Views (§26, §28, §29)
**Goal:** Hybrid orders show split fulfillment status and combined info
**Effort:** Medium
**Risk:** Low-Medium
**Depends on:** B7 (hybrid fulfillment backend), F2 (downloads), F3 (timeline), F4 (receipt)

**Frontend changes:**

- **F6.1** `BuyerOrderHistory.tsx` — For hybrid orders, show split fulfillment status badge: "Digital: Delivered, Physical: Shipped" (or similar compact representation). Use `partially_fulfilled` status to trigger this display.
- **F6.2** `FulfillmentTimeline.tsx` — For hybrid orders, render a split timeline showing both digital milestones (Access Granted) and physical milestones (Shipped, Delivered) as parallel tracks or a combined sequence.
- **F6.3** `OrderReceipt.tsx` — For hybrid orders, fulfillment method section shows both: digital download links (from F4.5) AND physical shipping/pickup info. Both sections rendered, clearly labeled.
- **F6.4** `account/orders/[orderId]/page.tsx` — For hybrid orders, show both digital downloads section and shipping/pickup info. Add "Partially Fulfilled" badge when digital is delivered but physical is pending.
- **F6.5** `BuyerOrderHistory.tsx` — Update `canConfirmFulfillment` to handle hybrid orders: allow physical fulfillment confirmation even when digital is already delivered.

**Files touched:** `BuyerOrderHistory.tsx`, `FulfillmentTimeline.tsx`, `OrderReceipt.tsx`, `account/orders/[orderId]/page.tsx`
**Testing:**
- Place a hybrid order, verify split fulfillment status on order list
- View hybrid order detail, verify split timeline with both digital and physical milestones
- View hybrid order receipt, verify both download links and shipping info
- Verify "Partially Fulfilled" badge shows when digital is delivered but physical is pending
**Acceptance criteria:**
- [ ] Hybrid orders show split fulfillment status on order list
- [ ] `FulfillmentTimeline` shows combined digital + physical milestones for hybrid orders
- [ ] `OrderReceipt` shows both digital downloads and shipping info for hybrid orders
- [ ] "Partially Fulfilled" badge appears for partially completed hybrid orders
- [ ] `checkweb` passes

---

### Phase Sequencing Summary

| Phase | Domain | Effort | Priority | Depends On |
|-------|--------|--------|----------|------------|
| B1 | Backend: Stock & Checkout | Medium | P0 | Part 1 Phase 0 |
| B2 | Backend: Digital Fulfillment | Medium | P0 | — |
| B3 | Backend: Status Enums | Medium | P1 | — |
| B4 | Backend: Notifications & Receipts | Large | P1 | B2, B3 |
| B5 | Backend: API Response Enrichment | Small-Med | P0 | — |
| B6 | Backend: Service Fulfillment | Large | P2 | — |
| B7 | Backend: Hybrid Coordination | Medium | P2 | B2, B6 |
| F1 | Frontend: Data Flow | Small | P0 | B5 |
| F2 | Frontend: Digital Downloads | Medium | P0 | F1, B2 |
| F3 | Frontend: Adaptive Timeline | Medium | P1 | B3, F1 |
| F4 | Frontend: Order List & Receipt | Med-Large | P1 | F1, F2 |
| F5 | Frontend: Service Appointments | Large | P2 | B6, F1 |
| F6 | Frontend: Hybrid Views | Medium | P2 | B7, F2, F3, F4 |

### Recommended Execution Order

**Sprint 1 (P0 — unblock everything):**
1. B1 (stock & checkout fixes) + B5 (API enrichment) + B2 (digital fulfillment) — all independent, can be done in parallel
2. F1 (frontend data flow) — immediately after B5

**Sprint 2 (P0/P1 — customer-facing improvements):**
3. F2 (digital downloads in order views) — after F1 + B2
4. B3 (status enums) — independent

**Sprint 3 (P1 — correct semantics & UX):**
5. B4 (notifications & receipts) — after B2 + B3
6. F3 (adaptive timeline) — after B3 + F1
7. F4 (order list & receipt) — after F1 + F2

**Sprint 4 (P2 — service & hybrid):**
8. B6 (service fulfillment) — independent
9. B7 (hybrid coordination) — after B2 + B6
10. F5 (service appointments) — after B6 + F1
11. F6 (hybrid views) — after B7 + F2 + F3 + F4

### Cross-Cutting Acceptance Criteria

- [ ] `checkapi` passes after all backend phases
- [ ] `checkweb` passes after all frontend phases
- [ ] Digital product with `stock = 0` can be ordered, fulfilled, and downloaded
- [ ] Service product with `stock = 0` can be ordered, booked, and managed
- [ ] Hybrid product delivers digital component immediately, physical component follows normal fulfillment
- [ ] Customer order list shows product type badges and type-specific CTAs
- [ ] Customer order detail shows adaptive fulfillment timeline
- [ ] Customer receipt shows type-specific info (download links, appointment details, shipping)
- [ ] Cancelled digital orders have access revoked
- [ ] Customer receives product-type-appropriate email notifications
- [ ] No regressions in physical product order flow

---

## Additional Gaps Discovered During Part 1 Implementation

**Date:** 2026-06-27 (post Part 1 Phases 1–7)
**Context:** While implementing type-aware display across `SmartProductCard`, `StorefrontFeaturedProducts`, shopping cart, and variant selector, the following additional gaps were identified for Part 2 (backend) and Part 3 (customer dashboard).

---

### Part 2 (Backend) — New Gaps

#### GAP-B8: `productType` Not Persisted on `order_items` at Checkout
**Found during:** Phase 6 (cart type awareness)
**Problem:** `AddToCartButton` now passes `productType` to the cart, but when checkout creates `order_items`, there is no `product_type` column on the `order_items` table. The `productType` is lost at order creation time. Backend phases B1.5 and B5.1 mention storing/mapping `product_type`, but no migration adds the column.
**Impact:** All downstream customer dashboard features (F1–F6) depend on `product_type` being available in order responses. Without a persisted column, the backend must do an N+1 join to `inventory_items.product_type` for every order query.
**Recommendation:** Add `product_type` column to `order_items` table in a new migration. Populate during checkout from the cart item's `productType` or from `inventory_items.product_type`. This eliminates the need for joins in B5.1/B5.3 and makes the data resilient to product deletion.

#### GAP-B9: Cart Manager Does Not Validate `productType` on Add
**Found during:** Phase 6.1 (CartItem interface)
**Problem:** `cartManager.ts` now accepts `productType?: string` on `CartItem` but performs no validation. A malformed or unknown `productType` value (e.g., `"subscription"`, empty string) would flow through to the cart display and potentially to checkout.
**Impact:** Low — current callers (`AddToCartButton`, `SmartProductCard`) always pass valid values or omit the field. But if future code paths add items directly to `cartManager`, invalid values could cause UI glitches.
**Recommendation:** Add a validation check in `addToCartManager` that normalizes `productType` to one of `physical | digital | service | hybrid` (defaulting to `physical` if missing or unrecognized).

#### GAP-B10: `ProductPurchasePanel` Availability Status Uses Physical-Only Labels
**Found during:** Phase 7 (variant selector)
**Problem:** `ProductPurchasePanel.tsx` (lines 238–268) shows "In Stock" / "Out of Stock" for all product types. For digital products, "Out of Stock" is misleading (should be "Unavailable"). For service products, "Out of Stock" should be "Fully Booked". The `effectiveAvailability` variable is derived from stock count, which is physical-centric.
**Impact:** Customers see "Out of Stock" for digital/service products that are actually available but have `stock = 0` in the database (common for digital/service products where stock is not meaningful).
**Recommendation:** In `ProductPurchasePanel`, derive availability label from `product.productType`:
- `digital`: "Available" / "Unavailable" (ignore stock)
- `service`: "Open Slots" / "Fully Booked" (ignore stock or use booking slot count)
- `hybrid`: Show physical stock + "Digital Available"
- `physical`: Keep existing stock-based logic

#### GAP-B11: `TierBasedLandingPage` Variant Selector Lacks `productType` Prop
**Found during:** Phase 7.3
**Problem:** Fixed in Part 1 — `TierBasedLandingPage.tsx` now passes `productType` to `ProductVariantSelector`. However, the landing page's availability status display (similar to GAP-B10) also uses physical-only "In Stock" / "Out of Stock" labels.
**Impact:** Same as GAP-B10 but on landing pages.
**Recommendation:** Apply the same type-aware availability labels to `TierBasedLandingPage`'s product display.

#### GAP-B12: Checkout `fulfillment_method` Validation Does Not Consider `productType`
**Found during:** Phase 6 (cart type awareness)
**Problem:** The cart now knows each item's `productType`, but checkout validation does not use this information. A customer could select "pickup" for a digital-only cart or "shipping" for a service-only cart. B1.4 mentions this but does not specify how `productType` reaches the checkout validation layer.
**Impact:** Customers may be charged shipping for digital products or asked to pick up service bookings.
**Recommendation:** Thread `productType` from cart items into checkout request payload. Validate `fulfillment_method` against cart item types before processing payment.

---

### Part 3 (Customer Dashboard) — New Gaps

#### GAP-F7: `ProductTypeBadge` Component Duplication
**Found during:** Phases 3, 6, 7
**Problem:** Type badge rendering logic now exists in 3 places:
1. `SmartProductCard.tsx` — `ProductTypeBadge` helper (Phase 3)
2. `carts/page.tsx` — `productTypeBadge` helper (Phase 6)
3. `VariantInfoCard.tsx` — inline `typeBadge` IIFE (Phase 7)
**Impact:** Styling inconsistency risk, maintenance burden. The F4.1 phase plans to create a shared `ProductTypeBadge.tsx` for the customer dashboard, but it should also be used by the cart and variant components.
**Recommendation:** Extract a single shared `ProductTypeBadge` component (in `components/products/` or `components/common/`) and refactor all 3 current implementations to use it. The F4.1 component should be this shared component, not a new one.

#### GAP-F8: Cart `productType` Not Passed to Checkout — Customer Dashboard Cannot Show Type
**Found during:** Phase 6 (cart type awareness)
**Problem:** The cart now displays `productType` badges and fulfillment labels, but when the customer proceeds to checkout, `productType` is not included in the checkout request payload. The order is created without `product_type` on `order_items` (see GAP-B8). This means the customer dashboard's order history will not have `productType` available unless the backend does a join to `inventory_items`.
**Impact:** Customer dashboard phases F1–F6 all depend on `productType` being in order responses. Without checkout passing it through, there's a gap in the data chain.
**Recommendation:** Include `productType` in the checkout line items payload (from cart items). Backend should persist it on `order_items` (GAP-B8).

#### GAP-F9: `VariantPopupModal` Does Not Show Type Badge or Type-Aware Availability
**Found during:** Phase 7 (variant selector)
**Problem:** `VariantPopupModal.tsx` now passes `productType` to `ProductVariantSelector`, but the modal itself does not show a type badge next to the product name, and its price/availability display does not adapt to product type.
**Impact:** Customers opening the variant modal for a digital product see physical-style availability labels.
**Recommendation:** Add `ProductTypeBadge` to the modal header (next to product name). Update the modal's availability display to use type-aware labels (same logic as GAP-B10).

#### GAP-F10: `ProductPurchasePanel` Quantity Selector Not Type-Aware
**Found during:** Phase 7 (variant selector)
**Problem:** `ProductPurchasePanel.tsx` (lines 357–392) shows a quantity selector with `max={maxQuantity}` derived from stock. For digital products, quantity should default to 1 (or allow multiple license purchases without stock limit). For service products, quantity should be 1 (one booking per order). The quantity selector is only hidden for service products (via `isServiceProduct` check routing to "Book This Service" panel), but digital products still show the stock-limited quantity selector.
**Impact:** Digital products show "max 0" or "max 999" depending on stock value, which is confusing.
**Recommendation:** For `digital` products: hide stock-based max, allow quantity > 1 (for multi-license), remove "max X" label. For `hybrid` products: show stock-based max only for the physical component. For `physical`: keep existing behavior.

#### GAP-F11: Featured Products Grouping Does Not Handle Missing `productType` Gracefully
**Found during:** Phase 5 (featured products segmentation)
**Problem:** `StorefrontFeaturedProducts.tsx` groups products by `productType` with fallback to `'physical'`. Products with an unexpected `productType` value (not in `productTypeOrder`) are grouped into "Other Products". This is functional but could confuse users if the backend returns a type that doesn't match the 4 known types.
**Impact:** Low — backend should only return valid types. But if a new type is added (e.g., `"subscription"`), it would silently group into "Other" without any indication.
**Recommendation:** Add a console warning in dev mode when an unknown `productType` is encountered. Consider a fallback to `SmartProductCard`'s default (physical) rendering instead of a separate "Other" group.

---

### Updated Phase Integration

These new gaps integrate into the existing phase plan as follows:

| Gap | Phase | Priority | Effort | Notes |
|-----|-------|----------|--------|-------|
| GAP-B8 | B1 (or new B1.5) | P0 | Small | Migration + checkout change |
| GAP-B9 | B1 | P2 | Trivial | Validation in cartManager |
| GAP-B10 | B1 or F4 | P1 | Small | Label change in ProductPurchasePanel |
| GAP-B11 | F4 | P2 | Small | Same fix as B10 for landing page |
| GAP-B12 | B1 | P0 | Small | Checkout validation |
| GAP-F7 | F4 | P1 | Small | Extract shared component |
| GAP-F8 | B1 / F1 | P0 | Small | Checkout payload + persistence |
| GAP-F9 | F4 | P2 | Small | Modal type badge + labels |
| GAP-F10 | F4 | P1 | Small | Quantity selector type-awareness |
| GAP-F11 | — | P2 | Trivial | Dev warning + fallback |

**Revised Sprint 1 (P0):** Add GAP-B8 (migration + column), GAP-B12 (checkout validation), GAP-F8 (checkout payload) to Sprint 1 alongside B1, B5, B2, F1.

**Revised Sprint 2 (P0/P1):** Add GAP-B10 (availability labels), GAP-F7 (shared badge component), GAP-F10 (quantity selector) to Sprint 2 alongside F2, B3.

---

## Audit: Part 2 & Part 3 Implementation Status

**Date:** 2026-06-28
**Context:** Full codebase audit to confirm whether Part 2 (backend phases B1–B7) and Part 3 (frontend phases F1–F6, plus GAP-B8–B12 and GAP-F7–F11) have already been implemented.

---

### Part 2 (Backend) — Audit Results

| Phase / Gap | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| **B1** | Stock decrement skips digital/service items | ✅ **DONE** | `StockService.ts:31-36` — checks `product_type`, skips `digital` and `service`. Also `restoreStockForOrder:112-117` and `checkStockAvailability:207-211` skip digital/service. |
| **B2** | Digital fulfillment: access grants, auto-fulfill, order status | ✅ **DONE** | `DigitalFulfillmentService.ts` — creates access grants, sets `digital_delivery_status`, marks digital-only orders as `fulfilled/delivered`, hybrid as `partially_fulfilled`. `DigitalAccessService.ts:186` — `revokeAccess()` for cancellations. |
| **B3** | Order status enum includes type-specific values | ✅ **DONE** | `OrderManagementService.ts:271-319` — `getValidStatusTransitions` removes `shipped` for digital-only and service-only orders. `updateOrderStatus:353-366` rejects `shipped` for digital/service-only. Statuses include `access_granted`, `scheduled`, `in_progress`. |
| **B4** | Notifications: digital_delivered, service_scheduled, service_completed | ✅ **DONE** | `OrderNotificationService.ts:16-28` — `OrderNotificationType` includes `digital_delivered`, `service_scheduled`, `service_completed`. Email templates at lines 376–453. Helper methods `notifyDigitalDelivered`, `notifyServiceScheduled`, `notifyServiceCompleted` at lines 716–791. |
| **B5** | API responses include `productType` on order items | ✅ **DONE** | `buyer-orders.ts:165,341,537` — `productType: item.product_type \|\| item.inventory_items?.product_type \|\| 'physical'`. `tenant-orders.ts:238,400` — same mapping. `DownloadAccessService.ts:165,201` — includes `productType`. |
| **B6** | Service fulfillment: bookings, scheduling, merchant management | ✅ **DONE** | `ServiceFulfillmentService.ts` — `fulfillOrder` creates `service_bookings`, sends `service_scheduled` notification, sets order to `scheduled`. `cancelBookings`, `updateBooking`, `assignProvider` methods. `tenant-orders.ts:845-906` — merchant PUT endpoint for booking updates with notification on `completed`. |
| **B7** | Hybrid fulfillment coordinator | ✅ **DONE** | `HybridFulfillmentCoordinator.ts` — checks digital delivered + physical fulfilled + service completed, transitions to `fulfilled/delivered` when all complete. `PostPaymentFulfillment.ts` — orchestrates stock + digital + service + receipt in sequence. |
| **GAP-B8** | `product_type` column on `order_items` | ✅ **DONE** | `schema.prisma:2608` — `product_type product_type @default(physical)` on `order_items`. Index at line 2622. Checkout at `checkout.ts:243,323,372` sets `product_type` on validated items. |
| **GAP-B9** | Cart manager validates/normalizes `productType` | ✅ **DONE** | `cartManager.ts:211-218` — `addToCart` normalizes `productType` to `physical \| digital \| service \| hybrid`, defaults to `physical` if missing or unrecognized. |
| **GAP-B10** | `ProductPurchasePanel` type-aware availability labels | ✅ **DONE** | `ProductPurchasePanel.tsx:115-118,250-267` — `isDigitalProduct`/`isServiceProduct`/`isHybridProduct` flags. Labels: "Available"/"Unavailable" (digital), "Open Slots"/"Fully Booked" (service), "Digital Available" hint (hybrid). |
| **GAP-B11** | `TierBasedLandingPage` type-aware availability labels | ✅ **DONE** | `TierBasedLandingPage.tsx:1445,1465` — availability labels adapt to product type: "Available"/"Unavailable" (digital), "Open Slots"/"Fully Booked" (service), "In Stock"/"Out of Stock" (physical/hybrid). Also passes `productType` to `ProductVariantSelector` at line 1707. |
| **GAP-B12** | Checkout `fulfillment_method` validation vs product types | ✅ **DONE** | `checkout.ts:380-397` — validates `fulfillment_method` against product types. Rejects pickup/delivery/shipping for digital-only orders. Rejects shipping for service-only orders. |

**Part 2 Summary:** All 12 items complete.

---

### Part 3 (Customer Dashboard) — Audit Results

| Phase / Gap | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| **F1** | `CustomerOrderService` includes `productType` in order item types | ✅ **DONE** | `CustomerOrderService.ts:89` — `productType?: 'physical' \| 'digital' \| 'hybrid' \| 'service'` on `CustomerOrderItem`. `getCustomerDownloads` method at line 685. `getCustomerServiceBookings` used in appointments page. |
| **F2** | Order list shows type badges and type-specific indicators | ✅ **DONE** | `BuyerOrderHistory.tsx:1084-1093` — `ProductTypeBadge` for single-type orders, `hybrid` badge for mixed. `account/orders/page.tsx:552-560` — same logic. "DOWNLOADS" badge for digital items at line 1032. Service booking links at line 663. |
| **F3** | Order detail shows adaptive fulfillment timeline | ✅ **DONE** | `FulfillmentTimeline.tsx` — type-specific step sequences for `digital` (Order Placed → Payment → Access Granted → Downloaded), `service` (→ Scheduled → Completed), `hybrid` (→ Digital Access → Shipped → Delivered), `physical` (→ Processing → Shipped → Delivered). Used in `account/orders/[orderId]/page.tsx:150-158` with `getDominantProductType()`. |
| **F4** | Receipt shows type-specific info (download links, appointment details, shipping) | ✅ **DONE** | `OrderReceipt.tsx:7,24,769-824` — imports `ProductTypeBadge`, `productType` on item interface, groups hybrid orders by type with labels "Physical Products", "Digital Downloads", "Service Appointments", "Hybrid Products". Badges on individual items. |
| **F5** | Digital downloads card on order detail and downloads page | ✅ **DONE** | `DigitalDownloadsCard.tsx` component exists. Used in `account/orders/[orderId]/page.tsx:350-352`, `account/orders/page.tsx:309-311`, `BuyerOrderHistory.tsx:723`. Dedicated downloads page at `account/downloads/`. |
| **F6** | Service appointments card and appointments page | ✅ **DONE** | `ServiceAppointmentCard.tsx` component exists. Used in `account/orders/[orderId]/page.tsx:362-366`. Dedicated appointments page at `account/appointments/page.tsx` — fetches `getCustomerServiceBookings`, shows upcoming/past with `ServiceAppointmentCard`. |
| **GAP-F7** | Shared `ProductTypeBadge` component | ✅ **DONE** | `ProductTypeBadge.tsx` — shared component in `components/products/`. Used across 9 files: `SmartProductCard`, `carts/page.tsx`, `VariantInfoCard`, `VariantPopupModal`, `BuyerOrderHistory`, `account/orders/page.tsx`, `account/orders/[orderId]/page.tsx`, `OrderReceipt.tsx`. |
| **GAP-F8** | Checkout payload includes `productType` | ✅ **DONE** | `checkout.ts:243,323,372` — `product_type` set on validated items from `inventory_items.product_type` or variant's parent item. Persisted to `order_items.product_type` column (GAP-B8). |
| **GAP-F9** | `VariantPopupModal` shows type badge | ✅ **DONE** | `VariantPopupModal.tsx:7,151-153` — imports `ProductTypeBadge`, renders it next to product name with `showPhysical` prop. |
| **GAP-F10** | `ProductPurchasePanel` quantity selector type-aware | ✅ **DONE** | `ProductPurchasePanel.tsx:388,396,403-411` — digital: `max={undefined}`, no stock limit, shows "multi-license" label. Hybrid: shows "physical max {stock}". Physical: shows "max {stock}". Service: routes to "Book This Service" panel (no quantity selector). |
| **GAP-F11** | Featured products grouping handles unknown types gracefully | ✅ **DONE** | `StorefrontFeaturedProducts.tsx:381-383` — `console.warn` in dev mode for unknown `productType` values. Unknown types grouped under "Other Products" at line 610. |

**Part 3 Summary:** All 11 items complete.

---

### Overall Audit Summary

| Part | Total Items | Complete | Not Done | Partial |
|------|-------------|----------|----------|---------|
| Part 2 (Backend) | 12 | 12 | 0 | 0 |
| Part 3 (Frontend) | 11 | 11 | 0 | 0 |
| **Total** | **23** | **23** | **0** | **0** |

### Remaining Work

All 23 items across Part 2 (backend) and Part 3 (frontend) are now complete. No remaining work.

