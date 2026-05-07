# Directory Materialized Views - Code Retrofit Guide

**Purpose:** Detailed code changes to leverage materialized views  
**Timeline:** Phase 4 of migration plan  
**Impact:** 10-50x performance improvement on category pages

---

## Overview

This document details all code changes needed to leverage the new materialized views for maximum performance.

### Files to Modify
1. `apps/api/src/routes/directory-v2.ts` - Main directory API
2. `apps/web/src/app/directory/categories/[categorySlug]/CategoryViewClient.tsx` - Frontend
3. `apps/api/src/routes/directory-simple.ts` - Simple directory routes (if used)

---

## Part 1: Backend API Retrofit

### File: `apps/api/src/routes/directory-v2.ts`

#### Change 1: Update Category Search Query

**Location:** Line 103-146 (search endpoint)

**BEFORE:**
```typescript
if (category && typeof category === 'string') {
  conditions.push(`(LOWER(primary_category) LIKE LOWER($${paramIndex}) OR LOWER(secondary_categories::text) LIKE LOWER($${paramIndex}))`);
  params.push(`%${category}%`);
  paramIndex++;
}

const listingsQuery = `
  SELECT * FROM directory_listings_list
  WHERE ${whereClause}
    AND (business_hours IS NULL OR business_hours::text != 'null')
    AND tenant_id IN (SELECT id FROM tenants WHERE id IS NOT NULL)
  ORDER BY ${orderByClause}
  LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
`;
```

**AFTER:**
```typescript
// Use materialized view for category filtering
const useMaterializedView = category && typeof category === 'string';

if (useMaterializedView) {
  // Convert category to slug format (e.g., "Frozen Foods" -> "frozen-foods")
  const categorySlug = category.toLowerCase().replace(/\s+/g, '-');
  
  // Build query using materialized view
  const mvConditions: string[] = ['category_slug = $1', 'tenant_exists = true', 'is_active_location = true', 'is_directory_visible = true'];
  const mvParams: any[] = [categorySlug];
  let mvParamIndex = 2;
  
  // Add additional filters
  if (q && typeof q === 'string') {
    mvConditions.push(`(LOWER(business_name) LIKE LOWER($${mvParamIndex}) OR LOWER(city) LIKE LOWER($${mvParamIndex}))`);
    mvParams.push(`%${q}%`);
    mvParamIndex++;
  }
  
  if (city && typeof city === 'string') {
    mvConditions.push(`LOWER(city) = LOWER($${mvParamIndex})`);
    mvParams.push(city);
    mvParamIndex++;
  }
  
  if (state && typeof state === 'string') {
    mvConditions.push(`LOWER(state) = LOWER($${mvParamIndex})`);
    mvParams.push(state);
    mvParamIndex++;
  }
  
  const mvWhereClause = mvConditions.join(' AND ');
  
  // Query materialized view
  const listingsQuery = `
    SELECT 
      id, tenant_id, business_name, slug, address, city, state, zip_code,
      phone, email, website, latitude, longitude, primary_category, 
      secondary_categories, logo_url, description, rating_avg, rating_count,
      product_count, is_featured, subscription_tier, use_custom_website,
      created_at, updated_at
    FROM directory_category_listings_mv
    WHERE ${mvWhereClause}
    ORDER BY ${orderByClause}
    LIMIT $${mvParamIndex} OFFSET $${mvParamIndex + 1}
  `;
  
  const listingsResult = await getDirectPool().query(listingsQuery, [...mvParams, limitNum, skip]);
  
  // Count query
  const countQuery = `
    SELECT COUNT(*) as count FROM directory_category_listings_mv
    WHERE ${mvWhereClause}
  `;
  const countResult = await getDirectPool().query(countQuery, mvParams);
  
  // ... rest of response handling
  
} else {
  // Fallback to base table for non-category queries
  if (q && typeof q === 'string') {
    conditions.push(`(LOWER(business_name) LIKE LOWER($${paramIndex}) OR LOWER(city) LIKE LOWER($${paramIndex}) OR LOWER(primary_category) LIKE LOWER($${paramIndex}))`);
    params.push(`%${q}%`);
    paramIndex++;
  }
  
  // ... existing base table query logic
}
```

---

#### Change 2: Add Category Stats Endpoint

**Location:** After `/search` endpoint (around line 206)

**ADD NEW ENDPOINT:**
```typescript
/**
 * GET /api/directory/categories/:slug/stats
 * Get pre-computed statistics for a category
 */
router.get('/categories/:slug/stats', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    // Query materialized view for stats
    const result = await getDirectPool().query(
      'SELECT * FROM directory_category_stats_mv WHERE category_slug = $1',
      [slug]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'category_not_found',
        message: `No statistics found for category: ${slug}`
      });
    }
    
    const stats = result.rows[0];
    
    // Transform to camelCase for frontend
    return res.json({
      stats: {
        categorySlug: stats.category_slug,
        storeCount: stats.store_count,
        featuredStoreCount: stats.featured_store_count,
        syncedStoreCount: stats.synced_store_count,
        totalProducts: stats.total_products,
        avgProductsPerStore: parseFloat(stats.avg_products_per_store || 0),
        maxProducts: stats.max_products,
        avgRating: parseFloat(stats.avg_rating || 0),
        totalReviews: stats.total_reviews,
        uniqueLocations: stats.unique_locations,
        cities: stats.cities || [],
        states: stats.states || [],
        tierDistribution: {
          trial: stats.trial_count,
          starter: stats.starter_count,
          professional: stats.professional_count,
          enterprise: stats.enterprise_count,
          organization: stats.organization_count,
        },
        firstStoreAdded: stats.first_store_added,
        lastStoreAdded: stats.last_store_added,
        statsGeneratedAt: stats.stats_generated_at,
      }
    });
  } catch (error) {
    console.error('Category stats error:', error);
    return res.status(500).json({ error: 'stats_failed' });
  }
});
```

---

#### Change 3: Add Health Check Endpoint

**Location:** After category stats endpoint

**ADD NEW ENDPOINT:**
```typescript
/**
 * GET /api/directory/health/materialized-views
 * Check health of materialized views
 */
router.get('/health/materialized-views', async (req: Request, res: Response) => {
  try {
    // Check if views exist and are populated
    const viewsResult = await getDirectPool().query(`
      SELECT 
        matviewname,
        ispopulated,
        pg_size_pretty(pg_total_relation_size('public.' || matviewname)) as size
      FROM pg_matviews 
      WHERE matviewname LIKE 'directory_%'
      ORDER BY matviewname
    `);
    
    // Check last refresh time
    const refreshResult = await getDirectPool().query(`
      SELECT 
        view_name,
        MAX(refresh_completed_at) as last_refresh,
        EXTRACT(EPOCH FROM (NOW() - MAX(refresh_completed_at)))::INTEGER as seconds_since_refresh
      FROM directory_mv_refresh_log
      WHERE status = 'completed'
      GROUP BY view_name
    `);
    
    const views = viewsResult.rows.map(row => ({
      name: row.matviewname,
      populated: row.ispopulated,
      size: row.size,
    }));
    
    const refreshStatus = refreshResult.rows.reduce((acc, row) => {
      acc[row.view_name] = {
        lastRefresh: row.last_refresh,
        secondsSinceRefresh: row.seconds_since_refresh,
        isStale: row.seconds_since_refresh > 300, // Alert if > 5 minutes
      };
      return acc;
    }, {});
    
    const isHealthy = views.every(v => v.populated) && 
                     Object.values(refreshStatus).every((s: any) => !s.isStale);
    
    return res.json({
      healthy: isHealthy,
      views,
      refreshStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({ 
      healthy: false,
      error: 'health_check_failed' 
    });
  }
});
```

---

#### Change 4: Update Categories List Endpoint

**Location:** Line 212-244 (`/categories` endpoint)

**ENHANCE WITH STATS:**
```typescript
router.get('/categories', async (req: Request, res: Response) => {
  try {
    // Get categories with stats from materialized view
    const statsResult = await getDirectPool().query(`
      SELECT 
        category_slug,
        store_count,
        total_products,
        avg_rating,
        unique_locations
      FROM directory_category_stats_mv
      WHERE store_count > 0
      ORDER BY store_count DESC
    `);
    
    // Map to category format with stats
    const categoriesWithStats = statsResult.rows.map(row => ({
      name: row.category_slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      slug: row.category_slug,
      storeCount: row.store_count,
      productCount: row.total_products,
      avgRating: parseFloat(row.avg_rating || 0),
      locationCount: row.unique_locations,
    }));
    
    // Merge with predefined categories (for empty categories)
    const predefinedCategories = [
      { name: 'Retail Store', slug: 'retail-store' },
      { name: 'Restaurant', slug: 'restaurant' },
      // ... rest of predefined list
    ];
    
    // Combine and deduplicate
    const allCategories = [...categoriesWithStats];
    predefinedCategories.forEach(predef => {
      if (!allCategories.find(c => c.slug === predef.slug)) {
        allCategories.push({
          ...predef,
          storeCount: 0,
          productCount: 0,
          avgRating: 0,
          locationCount: 0,
        });
      }
    });
    
    return res.json({ 
      categories: allCategories.sort((a, b) => b.storeCount - a.storeCount)
    });
  } catch (error) {
    console.error('Categories error:', error);
    return res.status(500).json({ error: 'categories_failed' });
  }
});
```

---

## Part 2: Frontend Retrofit

### File: `apps/web/src/app/directory/categories/[categorySlug]/CategoryViewClient.tsx`

#### Change 1: Use Category Stats Endpoint

**Location:** Line 82-96 (fetchData function)

**BEFORE:**
```typescript
// 1. Fetch all categories to get current category info
const categoriesRes = await fetch(`${apiBaseUrl}/api/directory/categories`);
if (categoriesRes.ok) {
  const catData = await categoriesRes.json();
  const currentCat = catData.data?.categories?.find((c: Category) => c.slug === categorySlug);
  setCategory(currentCat || null);
}
```

**AFTER:**
```typescript
// 1. Fetch category stats from new endpoint (much faster)
const statsRes = await fetch(`${apiBaseUrl}/api/directory/categories/${categorySlug}/stats`);
if (statsRes.ok) {
  const statsData = await statsRes.json();
  setCategory({
    id: categorySlug,
    name: categorySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    slug: categorySlug,
    googleCategoryId: null,
    storeCount: statsData.stats.storeCount,
    productCount: statsData.stats.totalProducts,
    avgRating: statsData.stats.avgRating,
    uniqueLocations: statsData.stats.uniqueLocations,
  });
}
```

---

#### Change 2: Add Category Stats Display

**Location:** After category header (around line 150)

**ADD NEW COMPONENT:**
```typescript
{category && (
  <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
    <h2 className="text-lg font-semibold mb-4">Category Overview</h2>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center">
        <div className="text-3xl font-bold text-blue-600">{category.storeCount}</div>
        <div className="text-sm text-gray-600">Stores</div>
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-green-600">{category.productCount?.toLocaleString()}</div>
        <div className="text-sm text-gray-600">Products</div>
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-amber-600">
          {category.avgRating ? category.avgRating.toFixed(1) : 'N/A'}
        </div>
        <div className="text-sm text-gray-600">Avg Rating</div>
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-purple-600">{category.uniqueLocations}</div>
        <div className="text-sm text-gray-600">Locations</div>
      </div>
    </div>
  </div>
)}
```

---

## Part 3: Performance Monitoring

### Add Performance Logging

**File:** `apps/api/src/routes/directory-v2.ts`

**ADD HELPER FUNCTION:**
```typescript
// Add at top of file
const logQueryPerformance = (endpoint: string, duration: number, usedMV: boolean) => {
  console.log(`[Directory Performance] ${endpoint}: ${duration}ms (MV: ${usedMV})`);
  
  // Optional: Send to monitoring service
  if (duration > 100) {
    console.warn(`[Directory Performance] Slow query detected: ${endpoint} took ${duration}ms`);
  }
};

// Use in endpoints
router.get('/search', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const usedMV = !!(category && typeof category === 'string');
  
  try {
    // ... query logic
    
    const duration = Date.now() - startTime;
    logQueryPerformance('/search', duration, usedMV);
    
    return res.json({ ... });
  } catch (error) {
    const duration = Date.now() - startTime;
    logQueryPerformance('/search (error)', duration, usedMV);
    // ... error handling
  }
});
```

---

## Part 4: Testing Checklist

### Backend Tests

- [ ] Category search returns correct results
- [ ] Category stats endpoint returns valid data
- [ ] Health check endpoint works
- [ ] Fallback to base table works for non-category queries
- [ ] Performance logging captures metrics
- [ ] Error handling works for missing categories

### Frontend Tests

- [ ] Category pages load faster
- [ ] Category stats display correctly
- [ ] No breaking changes to existing functionality
- [ ] Mobile responsive
- [ ] Loading states work

### Performance Tests

```bash
# Test category page performance
time curl "http://localhost:4000/api/directory/search?category=frozen-foods"

# Test category stats
time curl "http://localhost:4000/api/directory/categories/frozen-foods/stats"

# Test health check
curl "http://localhost:4000/api/directory/health/materialized-views"
```

**Expected Results:**
- Category search: <50ms (from 200-500ms)
- Category stats: <5ms (from 300-800ms)
- Health check: <10ms

---

## Part 5: Rollback Strategy

### If Performance Doesn't Improve

**Option 1: Disable MV Usage (Keep Views)**
```typescript
// Add feature flag
const USE_MATERIALIZED_VIEWS = process.env.USE_DIRECTORY_MV === 'true';

if (USE_MATERIALIZED_VIEWS && category && typeof category === 'string') {
  // Use MV
} else {
  // Use base table
}
```

**Option 2: Revert Code Changes**
```bash
git revert <commit-hash>
```

**Option 3: Drop Views**
```sql
DROP MATERIALIZED VIEW IF EXISTS directory_category_stats_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS directory_category_listings_mv CASCADE;
```

---

## Summary of Changes

### Backend (directory-v2.ts)
1. ✅ Updated category search to use MV
2. ✅ Added category stats endpoint
3. ✅ Added health check endpoint
4. ✅ Enhanced categories list with stats
5. ✅ Added performance logging

### Frontend (CategoryViewClient.tsx)
1. ✅ Use category stats endpoint
2. ✅ Display category overview stats

### New Capabilities Unlocked
- **10-50x faster** category page loads
- **Real-time stats** without expensive aggregations
- **Health monitoring** for materialized views
- **Graceful fallback** to base table
- **Performance tracking** for optimization

---

## Next Steps After Retrofit

1. **Monitor Performance:**
   - Check logs for query times
   - Monitor health check endpoint
   - Track refresh frequency

2. **Optimize Further:**
   - Add caching layer if needed
   - Consider CDN for static category data
   - Add Redis for frequently accessed categories

3. **Expand Usage:**
   - Use stats for trending categories
   - Add category recommendations
   - Build category analytics dashboard
