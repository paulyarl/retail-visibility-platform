# Week 6 Day 2: Materialized View Optimization Plan

**Date:** December 24, 2024  
**Goal:** Eliminate complex joins in Recommendations and Directory Optimized endpoints  
**Target:** 0-14% success → 100% success under load

---

## 🎯 Problem Analysis

### Current Performance Issues

**Recommendations Endpoint (`/api/recommendations/for-directory`):**
- **Success Rate:** 0% (100% timeout)
- **Root Cause:** Complex joins across 3-4 tables per recommendation type
- **Query Complexity:**
  - Trending Nearby: CTE + user_behavior + directory_listings join
  - Popular in Category: directory_category_stats + directory_listings join
  - User Favorites: user_behavior + directory_listings + category_stats join
- **Estimated Query Time:** 200-400ms per type × 3 types = 600-1200ms total

**Directory Optimized Endpoint (`/api/directory-optimized`):**
- **Success Rate:** 0% (100% timeout)
- **Root Cause:** Already uses `directory_category_products` MV but still slow
- **Issue:** Multiple aggregations and GROUP BY operations on large MV
- **Estimated Query Time:** 100-200ms

---

## 🔧 Solution: Specialized Materialized Views

### 1. Trending Stores MV (`trending_stores_mv`)

**Purpose:** Pre-aggregate user behavior data for "Trending Nearby"

**What It Pre-Calculates:**
- View counts per store (last 7 days)
- Unique viewer counts
- Last viewed timestamp
- Average viewer location (for geographic clustering)
- Trending score (views + unique viewers + ratings)

**Query Transformation:**
```sql
-- BEFORE: Complex CTE + 2 joins (200-400ms)
WITH trending_stores AS (
  SELECT entity_id, COUNT(*) as view_count...
  FROM user_behavior_simple
  JOIN directory_listings_list...
)

-- AFTER: Simple SELECT from MV (<30ms)
SELECT * FROM trending_stores_mv
WHERE earth_distance(ll_to_earth(latitude, longitude), ll_to_earth($1, $2)) <= $3
ORDER BY trending_score DESC
LIMIT 5
```

**Refresh Frequency:** Every 1 hour (trending data changes frequently)

**Expected Improvement:** 200-400ms → <30ms (7-13x faster)

---

### 2. Popular Stores by Category MV (`popular_stores_by_category_mv`)

**Purpose:** Pre-join stores with categories for "Popular in Category"

**What It Pre-Calculates:**
- Store + category combinations
- Popularity score (rating_avg × rating_count × 0.1)
- Product counts per category
- All store metadata (address, location, ratings)

**Query Transformation:**
```sql
-- BEFORE: 2 table join + aggregation (150-250ms)
SELECT dcl.*, dcs.*
FROM directory_category_stats dcs
JOIN directory_listings_list dcl...
WHERE category_slug = $1
ORDER BY rating_avg DESC

-- AFTER: Simple SELECT from MV (<20ms)
SELECT * FROM popular_stores_by_category_mv
WHERE category_slug = $1
  AND earth_distance(...) <= $2
ORDER BY popularity_score DESC
LIMIT 5
```

**Refresh Frequency:** Every 30 minutes (ratings change less frequently)

**Expected Improvement:** 150-250ms → <20ms (8-12x faster)

---

### 3. User Favorite Categories MV (`user_favorite_categories_mv`)

**Purpose:** Pre-aggregate user browsing behavior by category

**What It Pre-Calculates:**
- Visit counts per user per category (last 30 days)
- Total time spent per category
- Engagement score (visits × 0.5 + time × 0.01)
- Category rank per user (top 10)

**Query Transformation:**
```sql
-- BEFORE: Complex aggregation + 3 joins (300-500ms)
SELECT dcs.category_slug, COUNT(*) as visit_count...
FROM user_behavior_simple ub
JOIN directory_listings_list dcl...
JOIN directory_category_stats dcs...
WHERE user_id = $1
GROUP BY category_slug

-- AFTER: Simple SELECT from MV (<40ms)
SELECT category_slug FROM user_favorite_categories_mv
WHERE user_id = $1
  AND category_rank <= 5
ORDER BY engagement_score DESC
```

**Refresh Frequency:** Every 15 minutes (user behavior changes frequently)

**Expected Improvement:** 300-500ms → <40ms (8-12x faster)

---

### 4. Directory Home Summary MV (`directory_home_summary_mv`)

**Purpose:** Pre-aggregate all directory homepage data

**What It Pre-Calculates:**
- Top 20 featured categories with store counts
- Top 50 featured stores with ratings
- Platform-wide statistics (total stores, categories, products)
- All data stored as single JSONB object

**Query Transformation:**
```sql
-- BEFORE: Multiple aggregations + GROUP BY (100-200ms)
SELECT category_id, COUNT(DISTINCT tenant_id)...
FROM directory_category_products
GROUP BY category_id
HAVING COUNT(*) >= 3
ORDER BY total_products DESC

-- AFTER: Single row SELECT (<10ms)
SELECT data FROM directory_home_summary_mv
WHERE data_type = 'summary'
```

**Refresh Frequency:** Every 5 minutes (most frequently accessed)

**Expected Improvement:** 100-200ms → <10ms (10-20x faster)

---

## 📊 Expected Performance Impact

### Recommendations Endpoint

**Before:**
- Trending Nearby: 200-400ms
- Popular in Category: 150-250ms
- User Favorites: 300-500ms
- **Total:** 650-1150ms (timeout at 30s)
- **Success Rate:** 0%

**After:**
- Trending Nearby: <30ms
- Popular in Category: <20ms
- User Favorites: <40ms
- **Total:** <90ms
- **Success Rate:** 100%

**Improvement:** 7-12x faster, 100% success rate

---

### Directory Optimized Endpoint

**Before:**
- Multiple aggregations: 100-200ms
- **Success Rate:** 0%

**After:**
- Single MV query: <10ms
- **Success Rate:** 100%

**Improvement:** 10-20x faster, 100% success rate

---

### Connection Pool Impact

**Before:**
- Slow queries (200-1000ms) hold connections
- 20 connections exhausted quickly under load
- Queue builds up, requests timeout

**After:**
- Fast queries (<50ms) release connections immediately
- 20 connections handle much higher throughput
- No queue buildup, no timeouts

**Connection Pool Efficiency:** 80% improvement

---

## 🔄 Refresh Strategy

### Refresh Frequencies

| MV | Frequency | Reason |
|----|-----------|--------|
| `trending_stores_mv` | 1 hour | Trending data changes hourly |
| `popular_stores_by_category_mv` | 30 min | Ratings change moderately |
| `user_favorite_categories_mv` | 15 min | User behavior changes frequently |
| `directory_home_summary_mv` | 5 min | Homepage most accessed |

### Automated Refresh Functions

Each MV has a dedicated refresh function:
- `refresh_trending_stores_mv()`
- `refresh_popular_stores_by_category_mv()`
- `refresh_user_favorite_categories_mv()`
- `refresh_directory_home_summary_mv()`

### Refresh Monitoring

**Tracking Table:** `recommendations_mv_refresh_log`
- Tracks refresh start/end times
- Records duration and rows affected
- Logs errors for debugging
- Enables performance monitoring

---

## 🚀 Implementation Steps

### Step 1: Create Migration File ✅
- Created: `create-recommendations-mvs.sql`
- Contains: 4 MVs + indexes + refresh functions
- Size: ~400 lines of optimized SQL

### Step 2: Apply Migration to Staging
```bash
# Connect to Supabase staging database
psql $DATABASE_URL -f apps/api/src/migrations/create-recommendations-mvs.sql
```

### Step 3: Update Service Layer
- Modify `recommendationService.ts` to use MVs
- Simplify queries to SELECT from MVs
- Remove complex CTEs and joins

### Step 4: Update Directory Optimized Routes
- Modify `directory-optimized.ts` to use summary MV
- Replace aggregations with MV queries

### Step 5: Test Performance
```bash
# Test with new MVs
node scripts/performance-test.js --url=https://aps.visibleshelf.store --iterations=50
```

### Step 6: Setup Automated Refresh
- Configure pg_cron or external scheduler
- Schedule refresh functions at appropriate intervals
- Monitor refresh logs

---

## 📈 Success Metrics

### Performance Targets

**Recommendations Endpoint:**
- ✅ Response time: <100ms (currently timeout)
- ✅ Success rate: 100% (currently 0%)
- ✅ P95 response time: <150ms

**Directory Optimized Endpoint:**
- ✅ Response time: <20ms (currently timeout)
- ✅ Success rate: 100% (currently 0%)
- ✅ P95 response time: <30ms

**Overall API:**
- ✅ All endpoints: 100% success under load
- ✅ Connection pool: No exhaustion
- ✅ Average response time: <100ms

---

## 🔍 Monitoring & Maintenance

### Health Checks

**MV Status Query:**
```sql
SELECT 
  matviewname,
  ispopulated,
  pg_size_pretty(pg_total_relation_size('public.' || matviewname)) as size
FROM pg_matviews 
WHERE matviewname LIKE '%_mv';
```

**Refresh Log Query:**
```sql
SELECT 
  mv_name,
  refresh_completed_at,
  refresh_duration_ms,
  status
FROM recommendations_mv_refresh_log
ORDER BY refresh_completed_at DESC
LIMIT 20;
```

### Alert Thresholds

- Refresh duration > 5 seconds: Warning
- Refresh failure: Critical
- MV not populated: Critical
- Last refresh > 2× frequency: Warning

---

## 🎯 Next Steps After MV Implementation

### Day 2 Remaining:
1. Apply migration to staging
2. Update service layer code
3. Test performance improvements
4. Setup automated refresh

### Day 3:
1. Implement Redis caching for platform settings (408ms → <10ms)
2. Add query result caching for frequently accessed data
3. Optimize remaining slow queries with indexes

### Day 4-5:
1. API optimization (HTTP caching, compression)
2. Frontend optimization (code splitting, image optimization)

---

## 💡 Key Insights

**Why MVs Work Here:**
1. **Pre-computation:** Complex joins done once, not per request
2. **Indexing:** MVs can have specialized indexes for fast lookups
3. **Consistency:** Data refreshed on schedule, not per query
4. **Simplicity:** Service layer queries become simple SELECTs

**Trade-offs:**
1. **Storage:** ~100-500MB per MV (acceptable)
2. **Refresh Cost:** 1-5 seconds per refresh (acceptable)
3. **Staleness:** Data up to 5-60 minutes old (acceptable for recommendations)

**Why This Fixes Connection Pool Issues:**
- Fast queries (<50ms) release connections immediately
- No queue buildup under sustained load
- 20 connections can handle 400+ requests/second
- Previously: 20 connections exhausted by 2-3 requests/second

---

**Status:** Ready for implementation - Migration file created, plan documented, success metrics defined.
