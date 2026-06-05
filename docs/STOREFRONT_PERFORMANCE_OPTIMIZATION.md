# Storefront Category Filtering - Performance Optimization

**Date:** 2024-11-28  
**Issue:** Category filtering on storefront has noticeable delay  
**Root Cause:** Traditional Prisma query without caching  
**Solution:** Create materialized view for storefront products

---

## Current Performance Issue

### **Problem:**
When clicking a category in the storefront sidebar, there's a noticeable delay loading products.

### **Current Implementation:**
```typescript
// apps/api/src/index.ts line 1256
app.get("/public/tenant/:tenantId/items", async (req, res) => {
  const where: any = { 
    tenantId,
    itemStatus: 'active',
    visibility: 'public'
  };
  
  if (categorySlug) {
    where.tenantCategory = {
      slug: categorySlug,  // ← JOIN with tenant_categories
    };
  }
  
  const items = await prisma.inventoryItem.findMany({
    where,
    include: {
      tenantCategory: true,  // ← Additional JOIN
    },
  });
});
```

### **Performance Issues:**
- ❌ **Direct table query** - No caching
- ❌ **JOIN overhead** - Joins `inventory_items` with `tenant_categories`
- ❌ **No indexes** - Category filtering not optimized
- ❌ **Repeated queries** - Same query runs every time
- ⏱️ **Estimated time:** 100-300ms per query

---

## Proposed Solution: Storefront Materialized View

### **Option 1: Simple Indexed Query (Quick Win)**

**Approach:** Add database indexes for faster queries

**Implementation:**
```sql
-- Add composite index for storefront queries
CREATE INDEX idx_inventory_items_storefront 
ON inventory_items(tenant_id, item_status, visibility, tenant_category_id)
WHERE item_status = 'active' AND visibility = 'public';

-- Add index for category filtering
CREATE INDEX idx_inventory_items_category_filter
ON inventory_items(tenant_id, tenant_category_id)
WHERE item_status = 'active' AND visibility = 'public';
```

**Pros:**
- ✅ Quick to implement (5 minutes)
- ✅ No code changes needed
- ✅ Immediate improvement

**Cons:**
- ⚠️ Still requires JOIN
- ⚠️ Moderate improvement (50-100ms)
- ⚠️ Doesn't scale to thousands of products

**Expected Performance:** 50-100ms (2-3x faster)

---

### **Option 2: Materialized View (Recommended)**

**Approach:** Create pre-computed view of storefront products

**Implementation:**
```sql
CREATE MATERIALIZED VIEW storefront_products AS
SELECT
  ii.id,
  ii.tenant_id,
  ii.sku,
  ii.name,
  ii.title,
  ii.description,
  ii.price,
  ii.price_cents,
  ii.stock,
  ii.quantity,
  ii.image_url,
  ii.availability,
  ii.brand,
  ii.condition,
  ii.currency,
  ii.gtin,
  ii.mpn,
  ii.manufacturer,
  ii.created_at,
  ii.updated_at,
  
  -- Category info (denormalized)
  tc.id as category_id,
  tc.name as category_name,
  tc.slug as category_slug,
  tc.google_category_id,
  
  -- Computed flags
  (ii.image_url IS NOT NULL) as has_image,
  (ii.stock > 0 OR ii.quantity > 0) as in_stock
  
FROM inventory_items ii
LEFT JOIN tenant_categories tc ON tc.id = ii.tenant_category_id
WHERE ii.item_status = 'active'
  AND ii.visibility = 'public';

-- Indexes for fast filtering
CREATE INDEX idx_storefront_products_tenant 
ON storefront_products(tenant_id);

CREATE INDEX idx_storefront_products_category 
ON storefront_products(tenant_id, category_slug);

CREATE INDEX idx_storefront_products_search 
ON storefront_products(tenant_id, name, sku);

CREATE UNIQUE INDEX uq_storefront_products_id 
ON storefront_products(id);
```

**Pros:**
- ✅ **Blazing fast** - No JOINs at query time
- ✅ **Scalable** - Works for millions of products
- ✅ **Consistent with directory** - Same pattern
- ✅ **Pre-computed** - Category data already joined

**Cons:**
- ⚠️ Requires refresh on inventory changes
- ⚠️ Additional storage (minimal)
- ⚠️ More complex setup

**Expected Performance:** <10ms (10-30x faster!)

---

### **Option 3: Redis Cache (Alternative)**

**Approach:** Cache query results in Redis

**Implementation:**
```typescript
const cacheKey = `storefront:${tenantId}:${categorySlug}:${page}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const items = await prisma.inventoryItem.findMany({...});
await redis.setex(cacheKey, 300, JSON.stringify(items)); // 5 min TTL
```

**Pros:**
- ✅ Very fast for repeated queries
- ✅ Easy to implement
- ✅ Flexible TTL

**Cons:**
- ❌ Requires Redis infrastructure
- ❌ Cache invalidation complexity
- ❌ First query still slow
- ❌ Memory overhead

**Expected Performance:** <5ms (cached), 100-300ms (uncached)

---

## Recommendation: Option 2 (Materialized View)

### **Why Materialized View is Best:**

1. **Consistent Architecture**
   - Already using MVs for directory
   - Same refresh pattern
   - Proven performance

2. **Best Performance**
   - <10ms queries (10-30x faster)
   - No JOIN overhead
   - Optimized indexes

3. **Scalability**
   - Works for any product count
   - Efficient storage
   - Fast refresh

4. **Maintainability**
   - Single source of truth
   - No cache invalidation logic
   - Simple trigger-based refresh

---

## Implementation Plan

### **Phase 1: Create Materialized View (30 minutes)**

**File:** `apps/api/prisma/manual_migrations/09_create_storefront_products_mv.sql`

```sql
BEGIN;

-- Create materialized view
CREATE MATERIALIZED VIEW storefront_products AS
SELECT
  ii.id,
  ii.tenant_id,
  ii.sku,
  ii.name,
  ii.title,
  ii.description,
  ii.price,
  ii.price_cents,
  ii.stock,
  ii.quantity,
  ii.image_url,
  ii.availability,
  ii.brand,
  ii.condition,
  ii.currency,
  ii.gtin,
  ii.mpn,
  ii.manufacturer,
  ii.metadata,
  ii.created_at,
  ii.updated_at,
  tc.id as category_id,
  tc.name as category_name,
  tc.slug as category_slug,
  tc.google_category_id,
  (ii.image_url IS NOT NULL) as has_image,
  (ii.stock > 0 OR ii.quantity > 0) as in_stock
FROM inventory_items ii
LEFT JOIN tenant_categories tc ON tc.id = ii.tenant_category_id
WHERE ii.item_status = 'active'
  AND ii.visibility = 'public';

-- Create indexes
CREATE UNIQUE INDEX uq_storefront_products_id 
ON storefront_products(id);

CREATE INDEX idx_storefront_products_tenant 
ON storefront_products(tenant_id);

CREATE INDEX idx_storefront_products_category 
ON storefront_products(tenant_id, category_slug);

CREATE INDEX idx_storefront_products_search 
ON storefront_products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Track migration
INSERT INTO manual_migrations (migration_name, description, executed_by, status)
VALUES ('09_create_storefront_products_mv', 'Create materialized view for storefront products', CURRENT_USER, 'applied');

COMMIT;
```

---

### **Phase 2: Add Refresh Trigger (15 minutes)**

```sql
-- Trigger to refresh MV when inventory changes
CREATE OR REPLACE FUNCTION refresh_storefront_products()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_products;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_storefront_products
AFTER INSERT OR UPDATE OR DELETE ON inventory_items
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_storefront_products();
```

---

### **Phase 3: Update API Endpoint (20 minutes)**

**File:** `apps/api/src/routes/storefront.ts`

```typescript
import { Router } from 'express';
import { Pool } from 'pg';

const router = Router();

// Reuse pool from directory-mv
const getDirectPool = () => {
  // Same pool config as directory-mv.ts
};

/**
 * GET /api/storefront/:tenantId/products
 * Fast storefront product listing using materialized view
 */
router.get('/:tenantId/products', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { category, search, page = '1', limit = '12' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    // Build WHERE clause
    const conditions = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;
    
    if (category) {
      conditions.push(`category_slug = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    
    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Query materialized view (FAST!)
    const query = `
      SELECT *
      FROM storefront_products
      WHERE ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as count
      FROM storefront_products
      WHERE ${whereClause}
    `;
    
    const [itemsResult, countResult] = await Promise.all([
      getDirectPool().query(query, [...params, limitNum, skip]),
      getDirectPool().query(countQuery, params),
    ]);
    
    const totalCount = parseInt(countResult.rows[0]?.count || '0');
    
    return res.json({
      items: itemsResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasMore: skip + itemsResult.rows.length < totalCount,
      },
    });
  } catch (error) {
    console.error('Storefront products error:', error);
    return res.status(500).json({ error: 'failed_to_get_items' });
  }
});

export default router;
```

---

### **Phase 4: Update Frontend (10 minutes)**

**File:** `apps/web/src/app/tenant/[id]/page.tsx`

```typescript
// Change from:
const productsRes = await fetch(
  `${apiBaseUrl}/public/tenant/${tenantId}/items?page=${page}&limit=${limit}${searchParam}${categoryParam}`
);

// To:
const productsRes = await fetch(
  `${apiBaseUrl}/api/storefront/${tenantId}/products?page=${page}&limit=${limit}${searchParam}${categoryParam}`
);
```

---

## Performance Comparison

### **Before (Current):**
```
Query: SELECT * FROM inventory_items WHERE tenant_id = X AND category...
├── Table scan: inventory_items
├── JOIN: tenant_categories
├── Filter: item_status, visibility
└── Time: 100-300ms
```

### **After (Materialized View):**
```
Query: SELECT * FROM storefront_products WHERE tenant_id = X AND category_slug = Y
├── Index scan: idx_storefront_products_category
├── No JOINs
├── Pre-filtered
└── Time: <10ms (10-30x faster!)
```

---

## Benefits

### **User Experience:**
- ✅ **Instant category switching** - No more delays
- ✅ **Smooth browsing** - Fast product loading
- ✅ **Better mobile experience** - Reduced data transfer

### **Technical:**
- ✅ **Scalable** - Works for any product count
- ✅ **Consistent** - Same pattern as directory
- ✅ **Maintainable** - Simple trigger-based refresh
- ✅ **Efficient** - Minimal storage overhead

### **Business:**
- ✅ **Higher conversion** - Faster browsing = more sales
- ✅ **Better SEO** - Faster page loads
- ✅ **Reduced bounce** - Users don't wait

---

## Rollout Plan

### **Step 1: Create MV (Non-breaking)**
- Run migration in Supabase SQL Editor
- Verify MV is populated
- Check indexes are created

### **Step 2: Add New Endpoint (Non-breaking)**
- Create `/api/storefront/:tenantId/products`
- Test with existing storefronts
- Verify performance improvement

### **Step 3: Update Frontend (Breaking)**
- Switch to new endpoint
- Test category filtering
- Monitor performance

### **Step 4: Deprecate Old Endpoint**
- Keep old endpoint for 1 week
- Monitor usage
- Remove after migration complete

---

## Monitoring

### **Key Metrics:**
- Query time: Target <10ms
- Refresh time: Target <100ms
- MV size: Monitor growth
- Error rate: Track failures

### **Alerts:**
- MV refresh failures
- Query time > 50ms
- Error rate > 1%

---

## Conclusion

**Recommendation:** Implement Option 2 (Materialized View)

**Timeline:** 1-2 hours total implementation  
**Performance Gain:** 10-30x faster (100-300ms → <10ms)  
**Risk:** Low (non-breaking rollout)  
**Effort:** Medium (similar to directory MVs)  

**This will make storefront category filtering instant!** ⚡

---

**Status:** Ready to implement  
**Priority:** High (user-facing performance issue)  
**Estimated Impact:** Significant UX improvement
