# Materialized View Slug Registry Migration Analysis

> Analysis of existing MVs for integration with product_slug_registry V2 fields

---

## Executive Summary

The slug registry V2 introduces stable product identifiers and normalized fields that can significantly improve MV accuracy, enable cross-tenant product matching, and support new platform capabilities.

**Key Benefits:**
- `product_slug` as stable join key across all product-related tables
- `brand_normalized` for consistent brand aggregation (eliminates "Nike" vs "nike" vs "NIKE" fragmentation)
- `category_normalized` for consistent category matching
- `universal_sku` for UPC-based product tracking
- `slug_type` for UPC/LPC classification

---

## Current State: MV Analysis

### 1. mv_global_discovery (Primary Discovery MV)

**Current Product Identification:**
```sql
ii.id as inventory_item_id,
ii.sku,                    -- Tenant-specific, unstable
ii.brand,                  -- Raw brand name, inconsistent casing
ii.gtin,                   -- UPC from inventory_items
```

**Issues:**
- `ii.sku` is tenant-specific, cannot match same product across tenants
- `ii.brand` has inconsistent casing/spacing (e.g., "Nike", "nike", "NIKE INC")
- No stable cross-tenant product identifier
- Cannot identify UPC vs LPC products

**Recommended Migration:**
```sql
-- ADD to SELECT clause:
psr.product_slug,              -- Stable cross-tenant identifier
psr.universal_sku,             -- UPC for UPC products
psr.brand_normalized,          -- Normalized brand for aggregation
psr.category_normalized,       -- Normalized category
psr.slug_type,                 -- 'upc' or 'lpc' classification
psr.slug_prefix,               -- Quick filter prefix

-- ADD LEFT JOIN:
LEFT JOIN product_slug_registry psr 
  ON psr.product_slug = ii.product_slug 
  AND psr.is_active = true
```

**Impact:** HIGH - Enables cross-tenant product matching, brand analytics, trending by product (not SKU)

---

### 2. mv_category_discovery (Category-Aware MV)

**Current Category Handling:**
```sql
dc.name as product_category,
dc.slug as product_category_slug,
-- Uses directory_category which is tenant-specific
```

**Issues:**
- Category from `directory_category` is tenant-specific
- No platform-wide category normalization
- Cannot aggregate products by category across tenants accurately

**Recommended Migration:**
```sql
-- ADD to SELECT clause:
psr.category_normalized as platform_category,
-- Use for cross-tenant category aggregation

-- JOIN already added in mv_global_discovery (inherited)
```

**Impact:** MEDIUM - Enables platform-wide category analytics

---

### 3. mv_trending_products (Dynamic Trending)

**Current Trending Logic:**
```sql
-- Uses inventory_item_id for purchase counting
-- Cannot track "same product" trending across tenants
```

**Issues:**
- Same product sold by multiple tenants counted separately
- Cannot identify "trending product" platform-wide
- Misses cross-tenant demand signals

**Recommended Migration:**
```sql
-- ADD to SELECT clause:
psr.product_slug,
psr.brand_normalized,

-- ADD cross-tenant trending aggregation:
COALESCE(
  (SELECT COUNT(DISTINCT oi.order_id) 
   FROM order_items oi 
   JOIN orders o ON o.id = oi.order_id 
   JOIN inventory_items ii2 ON oi.inventory_item_id = ii2.id
   JOIN product_slug_registry psr2 ON psr2.product_slug = ii2.product_slug
   WHERE psr2.product_slug = psr.product_slug  -- Match by product_slug, not inventory_item_id
     AND o.created_at >= now() - interval '30 days'
     AND o.order_status IN ('paid', 'processing', 'shipped', 'delivered')
  ), 0
) as platform_wide_purchase_count,

-- NEW: Platform-wide trending score
(
  -- Platform-wide purchase signal (strongest)
  LEAST(1, platform_wide_purchase_count * 0.1) * 0.50 +
  -- ... rest of scoring
) as platform_trending_score
```

**Impact:** VERY HIGH - Enables true platform-wide trending detection

---

### 4. directory_category_products

**Current Brand/Category Handling:**
```sql
count(ii.id) filter (where ii.brand is not null) as products_with_brand,
-- Uses raw ii.brand for counting
```

**Issues:**
- Brand counts fragmented by casing/spacing variations
- Cannot accurately count "How many Nike products?"

**Recommended Migration:**
```sql
-- ADD to SELECT clause:
psr.brand_normalized,
psr.category_normalized,

-- ADD brand-normalized counting:
count(DISTINCT psr.brand_normalized) filter (
  where psr.brand_normalized is not null
) as unique_brands_count,

-- MODIFY existing brand count to use normalized:
count(ii.id) filter (
  where psr.brand_normalized is not null
) as products_with_normalized_brand,

-- ADD LEFT JOIN:
LEFT JOIN product_slug_registry psr 
  ON psr.product_slug = ii.product_slug 
  AND psr.is_active = true
```

**Impact:** MEDIUM - Improves brand/category analytics accuracy

---

### 5. storefront_products

**Current Product Identification:**
```sql
ii.id,
ii.sku,
ii.brand,
ii.gtin,
```

**Issues:**
- No cross-tenant product matching capability
- Cannot show "This product available at other stores"

**Recommended Migration:**
```sql
-- ADD to SELECT clause:
psr.product_slug,
psr.universal_sku,
psr.brand_normalized,
psr.slug_type,

-- ADD LEFT JOIN:
LEFT JOIN product_slug_registry psr 
  ON psr.product_slug = ii.product_slug 
  AND psr.is_active = true
```

**Impact:** HIGH - Enables "Available Nearby" feature for shoppers

---

### 6. storefront_products_mv

**Current State:**
```sql
i.id,
i.sku,
-- No product_slug
```

**Recommended Migration:**
```sql
-- ADD to SELECT clause:
psr.product_slug,
psr.brand_normalized,
psr.category_normalized,

-- ADD LEFT JOIN:
LEFT JOIN product_slug_registry psr 
  ON psr.product_slug = i.product_slug 
  AND psr.is_active = true
```

**Impact:** MEDIUM - Consistent product identification

---

## New MVs Recommended

### 1. mv_platform_product_analytics (NEW)

**Purpose:** Cross-tenant product performance analytics

```sql
CREATE MATERIALIZED VIEW mv_platform_product_analytics AS
SELECT 
  psr.product_slug,
  psr.universal_sku,
  psr.brand_normalized,
  psr.category_normalized,
  psr.slug_type,
  gpc.name as product_name,
  gpc.gtin_upc,
  
  -- Cross-tenant adoption metrics
  COUNT(DISTINCT psr.tenant_id) as tenant_adoption_count,
  COUNT(DISTINCT ii.id) as total_inventory_items,
  
  -- Cross-tenant stock metrics
  SUM(ii.stock) as total_platform_stock,
  AVG(ii.price_cents) as avg_platform_price,
  MIN(ii.price_cents) as min_platform_price,
  MAX(ii.price_cents) as max_platform_price,
  
  -- Cross-tenant engagement (from mv_global_discovery aggregation)
  SUM(COALESCE(mgd.view_count, 0)) as total_views,
  SUM(COALESCE(mgd.conversion_count, 0)) as total_purchases,
  SUM(COALESCE(mgd.revenue_cents, 0)) as total_revenue,
  
  -- Quality signals
  AVG(mgd.average_rating) as avg_rating,
  SUM(mgd.review_count) as total_reviews,
  
  -- Trending signals
  CASE 
    WHEN SUM(COALESCE(mgd.conversion_count, 0)) > 10 THEN 'high_demand'
    WHEN SUM(COALESCE(mgd.view_count, 0)) > 100 THEN 'high_interest'
    ELSE 'standard'
  END as demand_tier,
  
  MAX(ii.updated_at) as last_updated
  
FROM product_slug_registry psr
LEFT JOIN global_product_catalog gpc ON gpc.product_slug = psr.product_slug
LEFT JOIN inventory_items ii ON ii.product_slug = psr.product_slug
  AND ii.item_status = 'active'
LEFT JOIN mv_global_discovery mgd ON mgd.inventory_item_id = ii.id
WHERE psr.is_active = true
GROUP BY 
  psr.product_slug,
  psr.universal_sku,
  psr.brand_normalized,
  psr.category_normalized,
  psr.slug_type,
  gpc.name,
  gpc.gtin_upc;
```

**Impact:** VERY HIGH - Enables all Phase 2-5 capabilities from roadmap

---

### 2. mv_brand_performance (NEW)

**Purpose:** Platform-wide brand analytics

```sql
CREATE MATERIALIZED VIEW mv_brand_performance AS
SELECT 
  psr.brand_normalized as brand,
  
  -- Adoption metrics
  COUNT(DISTINCT psr.product_slug) as product_count,
  COUNT(DISTINCT psr.tenant_id) as tenant_count,
  COUNT(DISTINCT ii.id) as inventory_item_count,
  
  -- Stock metrics
  SUM(ii.stock) as total_stock,
  AVG(ii.price_cents) as avg_price,
  
  -- Engagement metrics
  SUM(COALESCE(mgd.view_count, 0)) as total_views,
  SUM(COALESCE(mgd.conversion_count, 0)) as total_purchases,
  SUM(COALESCE(mgd.revenue_cents, 0)) as total_revenue,
  
  -- Quality metrics
  AVG(mgd.average_rating) as avg_rating,
  
  -- Trending
  CASE 
    WHEN SUM(COALESCE(mgd.conversion_count, 0)) > 100 THEN 'trending'
    WHEN SUM(COALESCE(mgd.view_count, 0)) > 1000 THEN 'popular'
    ELSE 'standard'
  END as brand_tier,
  
  now() as refreshed_at
  
FROM product_slug_registry psr
LEFT JOIN inventory_items ii ON ii.product_slug = psr.product_slug
  AND ii.item_status = 'active'
LEFT JOIN mv_global_discovery mgd ON mgd.inventory_item_id = ii.id
WHERE psr.is_active = true
  AND psr.brand_normalized IS NOT NULL
GROUP BY psr.brand_normalized
ORDER BY total_revenue DESC;
```

**Impact:** HIGH - Enables Brand Analytics Dashboard (Quick Win A1)

---

### 3. mv_category_trends (NEW)

**Purpose:** Platform-wide category analytics

```sql
CREATE MATERIALIZED VIEW mv_category_trends AS
SELECT 
  psr.category_normalized as category,
  
  -- Adoption metrics
  COUNT(DISTINCT psr.product_slug) as product_count,
  COUNT(DISTINCT psr.tenant_id) as tenant_count,
  
  -- Engagement metrics
  SUM(COALESCE(mgd.view_count, 0)) as total_views,
  SUM(COALESCE(mgd.conversion_count, 0)) as total_purchases,
  SUM(COALESCE(mgd.revenue_cents, 0)) as total_revenue,
  
  -- Growth metrics (compare to 30 days ago)
  -- Would need historical tracking table
  
  now() as refreshed_at
  
FROM product_slug_registry psr
LEFT JOIN inventory_items ii ON ii.product_slug = psr.product_slug
  AND ii.item_status = 'active'
LEFT JOIN mv_global_discovery mgd ON mgd.inventory_item_id = ii.id
WHERE psr.is_active = true
  AND psr.category_normalized IS NOT NULL
GROUP BY psr.category_normalized
ORDER BY total_revenue DESC;
```

**Impact:** HIGH - Enables Category Analytics Dashboard (Quick Win A2)

---

## Migration Strategy

### Phase 1: Add Columns (Non-Breaking)

1. Add `product_slug` column to `inventory_items` if not exists
2. Populate `product_slug` from existing `sku` or `gtin` mapping
3. Create indexes on `product_slug` for MV joins

```sql
-- Add column if needed
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS product_slug VARCHAR(255);

-- Create index for MV performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_product_slug 
ON inventory_items(product_slug);

-- Populate from slug registry (if not already populated)
UPDATE inventory_items ii
SET product_slug = psr.product_slug
FROM product_slug_registry psr
WHERE ii.product_slug IS NULL
  AND (
    (psr.universal_sku IS NOT NULL AND ii.gtin = psr.universal_sku)
    OR (psr.original_sku IS NOT NULL AND ii.sku = psr.original_sku)
  );
```

### Phase 2: Update MVs (With Backward Compatibility)

1. Add new slug columns to MVs
2. Keep existing columns for backward compatibility
3. Add new indexes on slug columns

### Phase 3: Create New MVs

1. Create `mv_platform_product_analytics`
2. Create `mv_brand_performance`
3. Create `mv_category_trends`

### Phase 4: Update API Routes

1. Update discovery routes to use `product_slug` for matching
2. Add brand/category analytics endpoints
3. Add trending by product_slug (not inventory_item_id)

---

## Migration Priority Matrix

| MV | Priority | Effort | Impact | Dependencies |
|----|----------|--------|--------|--------------|
| mv_global_discovery | HIGH | 1wk | Very High | product_slug on inventory_items |
| mv_trending_products | HIGH | 1wk | Very High | mv_global_discovery update |
| storefront_products | MEDIUM | 0.5wk | High | product_slug on inventory_items |
| directory_category_products | MEDIUM | 0.5wk | Medium | product_slug on inventory_items |
| mv_platform_product_analytics (NEW) | HIGH | 1wk | Very High | All above |
| mv_brand_performance (NEW) | HIGH | 0.5wk | High | product_slug_registry |
| mv_category_trends (NEW) | MEDIUM | 0.5wk | High | product_slug_registry |

---

## Recommended Migration Order

### Sprint 1 (Week 1)
1. Add `product_slug` to `inventory_items` table
2. Populate `product_slug` from slug registry
3. Create indexes

### Sprint 1 (Week 2)
1. Update `mv_global_discovery` with slug fields
2. Create `mv_brand_performance` (NEW)
3. Create `mv_category_trends` (NEW)

### Sprint 2 (Week 1)
1. Update `mv_trending_products` with platform-wide trending
2. Create `mv_platform_product_analytics` (NEW)
3. Update `storefront_products` with slug fields

### Sprint 2 (Week 2)
1. Update `directory_category_products`
2. Update `storefront_products_mv`
3. Update API routes to use new fields

---

## Testing Checklist

- [ ] Verify `product_slug` population accuracy
- [ ] Test MV refresh performance with new joins
- [ ] Verify brand normalization accuracy
- [ ] Test cross-tenant product matching
- [ ] Validate trending scores with platform-wide aggregation
- [ ] Check backward compatibility with existing API routes

---

*Last Updated: May 2026*
*Status: Analysis Complete, Ready for Implementation*
