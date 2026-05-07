# MV Endpoint Audit - Slug Field Realignment

## Overview
Audit of existing endpoints that use updated MVs but don't leverage new slug fields.

## New MV Fields Available

### mv_global_discovery (Sprint 1)
| Field | Description | Usage |
|-------|-------------|-------|
| `product_slug` | Cross-tenant product identifier | Cross-tenant matching, "Available Nearby" |
| `universal_sku` | UPC for UPC products | UPC matching |
| `brand_normalized` | Normalized brand name | Brand analytics, filtering |
| `category_normalized` | Normalized category name | Category analytics, filtering |
| `slug_type` | 'upc' or 'lpc' | Product type detection |
| `slug_prefix` | Slug prefix | Filtering |
| `platform_purchase_count` | Cross-tenant purchases | Platform trending |
| `platform_revenue_cents` | Cross-tenant revenue | Platform analytics |
| `platform_total_stock` | Cross-tenant stock | Availability tracking |
| `platform_tenant_count` | Stores carrying product | Adoption metrics |

### mv_trending_products (Sprint 1)
| Field | Description | Usage |
|-------|-------------|-------|
| `platform_trending_score` | Cross-tenant trending | Platform-wide trending |

### storefront_products (Sprint 2)
| Field | Description | Usage |
|-------|-------------|-------|
| `product_slug` | Cross-tenant identifier | Cross-tenant matching |
| `other_tenants_count` | Other stores carrying | "Available Nearby" |
| `platform_total_stock` | Total platform stock | Availability |

### mv_platform_product_analytics (Sprint 2 - NEW)
| Field | Description | Usage |
|-------|-------------|-------|
| `tenant_adoption_count` | Stores carrying product | Adoption tracking |
| `demand_tier` | high_demand/medium_demand/etc | Product intelligence |
| `availability_tier` | high/medium/low_availability | Stock intelligence |
| `price_tier` | premium/mid_range/value/budget | Price intelligence |

---

## Services Requiring Updates

### Priority 1: High Impact

#### 1. DiscoveryService.ts
**File:** `apps/api/src/services/DiscoveryService.ts`
**MVs Used:** `mv_global_discovery`
**Current State:** SELECT queries don't include slug fields
**Impact:** Discovery endpoints miss cross-tenant product data

**Updates Needed:**
- Add `product_slug`, `brand_normalized`, `category_normalized`, `slug_type` to SELECT
- Add `platform_tenant_count`, `platform_purchase_count` for platform metrics
- Update `transformDiscoveryProduct()` to include new fields

#### 2. FeaturedProductsService.ts
**File:** `apps/api/src/services/FeaturedProductsService.ts`
**MVs Used:** `mv_global_discovery`
**Current State:** SELECT queries don't include slug fields
**Impact:** Featured products miss cross-tenant context

**Updates Needed:**
- Add slug fields to SELECT
- Enable filtering by `brand_normalized`, `category_normalized`

#### 3. ShopService.ts
**File:** `apps/api/src/services/ShopService.ts`
**MVs Used:** `mv_global_discovery`
**Current State:** SELECT queries don't include slug fields
**Impact:** Shop endpoints miss product intelligence

**Updates Needed:**
- Add slug fields to SELECT
- Add platform metrics for product cards

#### 4. recommendationService.ts
**File:** `apps/api/src/services/recommendationService.ts`
**MVs Used:** `mv_global_discovery`
**Current State:** SELECT queries don't include slug fields
**Impact:** Recommendations miss cross-tenant signals

**Updates Needed:**
- Use `platform_trending_score` for recommendations
- Use `brand_normalized`, `category_normalized` for similar products

### Priority 2: Medium Impact

#### 5. ProductService.ts
**File:** `apps/api/src/services/ProductService.ts`
**MVs Used:** `mv_global_discovery`
**Updates Needed:**
- Add slug fields for product detail pages
- Enable "Available Nearby" feature

#### 6. ShopCategoriesService.ts
**File:** `apps/api/src/services/ShopCategoriesService.ts`
**MVs Used:** `mv_global_discovery`
**Updates Needed:**
- Use `category_normalized` for consistent category matching

#### 7. FeaturedService.ts
**File:** `apps/api/src/services/FeaturedService.ts`
**MVs Used:** `mv_global_discovery`
**Updates Needed:**
- Add slug fields for featured product queries

#### 8. ShopsFeaturedService.ts
**File:** `apps/api/src/services/ShopsFeaturedService.ts`
**MVs Used:** `storefront_products`, `mv_trending_products`
**Updates Needed:**
- Use `other_tenants_count` for "Available Nearby"
- Use `platform_trending_score` for platform-wide trending

### Priority 3: Routes

#### Routes using mv_global_discovery:
- `routes/directory-random-featured.ts` (15 matches)
- `routes/public/shops.ts` (10 matches)
- `routes/directory-featured-stats.ts` (8 matches)
- `routes/public-api.ts` (8 matches)
- `routes/store-reviews.ts` (7 matches)
- `routes/storefront-featured.ts` (6 matches)
- `routes/tenant-logo.ts` (4 matches)
- `routes/directory-featured-products.ts` (3 matches)
- `routes/directory-premium-featured.ts` (2 matches)
- `routes/recommendations.ts` (2 matches)
- `routes/shop-categories.ts` (2 matches)

#### Routes using storefront_products:
- `routes/public-api.ts` (9 matches)
- `routes/storefront.ts` (9 matches)
- `routes/variant-aware-products.ts` (7 matches)
- `routes/smart-sale-tagging.ts` (6 matches)
- `routes/storefront-featured.ts` (4 matches)
- `routes/variant-bulk-operations.ts` (4 matches)
- `routes/public/catalog.ts` (3 matches)

---

## Implementation Plan

### Phase 1: Core Services (Week 1)
1. Update `DiscoveryService.ts` - Add slug fields to all SELECT queries
2. Update `FeaturedProductsService.ts` - Add slug fields
3. Update `ShopService.ts` - Add slug fields

### Phase 2: Recommendation & Product Services (Week 2)
1. Update `recommendationService.ts` - Use platform metrics
2. Update `ProductService.ts` - Enable cross-tenant features
3. Update `ShopCategoriesService.ts` - Use normalized categories

### Phase 3: Featured Services (Week 3)
1. Update `FeaturedService.ts`
2. Update `ShopsFeaturedService.ts`
3. Update `FeaturedProductsSingletonService.ts`

### Phase 4: Routes (Week 4)
1. Update all routes to pass slug fields to responses
2. Add new query parameters for slug-based filtering
3. Update frontend services to consume new fields

---

## Testing Checklist

- [ ] Discovery endpoints return `product_slug`
- [ ] Featured endpoints return `brand_normalized`, `category_normalized`
- [ ] Shop endpoints return `platform_tenant_count`
- [ ] Recommendation endpoints use `platform_trending_score`
- [ ] Product detail pages show "Available Nearby" when `other_tenants_count > 0`
- [ ] Category filtering uses `category_normalized`
- [ ] Brand filtering uses `brand_normalized`

---

## SQL Template for Updates

```sql
-- Add to existing SELECT queries:
product_slug,
brand_normalized,
category_normalized,
slug_type,
platform_tenant_count,
platform_purchase_count,
platform_revenue_cents,
platform_total_stock
```

## Response Interface Updates

```typescript
// Add to product response interfaces:
product_slug?: string;
brand_normalized?: string;
category_normalized?: string;
slug_type?: 'upc' | 'lpc';
platform_tenant_count?: number;
platform_purchase_count?: number;
other_tenants_count?: number;
```
