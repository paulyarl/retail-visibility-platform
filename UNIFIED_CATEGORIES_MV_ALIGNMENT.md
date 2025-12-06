# Unified Categories - Materialized View Alignment Strategy

## Overview

The unified categories system must **align with existing materialized views** to minimize disruption and maximize performance. This document outlines how the new `tenant_category_assignments` table will integrate with existing MVs.

---

## Existing Materialized Views

### 1. **`directory_category_listings`** (Product Categories)
**Purpose:** Flattened view of directory listings by product category  
**Source:** `directory_listings_list.primary_category` + `secondary_categories`  
**Pattern:** One row per listing per category (UNNEST pattern)

**Key Columns:**
- `category_slug` - Slugified category name for filtering
- `primary_category` - Original category name
- `secondary_categories` - Array of secondary categories

### 2. **`directory_category_stats`** (Product Category Stats)
**Purpose:** Pre-aggregated statistics per product category  
**Source:** Aggregates from `directory_category_listings`

**Key Columns:**
- `category_slug` - Unique identifier
- `store_count` - Number of stores in category
- `total_products` - Total products across stores

### 3. **`directory_gbp_listings`** (GBP Store Types)
**Purpose:** Flattened view of directory listings by GBP category  
**Source:** `gbp_listing_categories` + `gbp_categories_list`  
**Pattern:** One row per listing per GBP category

**Key Columns:**
- `gbp_category_id` - GBP category ID
- `gbp_category_name` - GBP category name
- `is_primary` - Whether this is the primary GBP category

### 4. **`directory_gbp_stats`** (GBP Category Stats)
**Purpose:** Pre-aggregated statistics per GBP category  
**Source:** Aggregates from `directory_gbp_listings`

---

## Problem: Current Duplication

**Current State:**
```
Product Categories (Directory)
├── directory_listings_list.primary_category
├── directory_listings_list.secondary_categories
└── MVs: directory_category_listings, directory_category_stats

GBP Categories (Store Types)
├── gbp_listing_categories (junction table)
├── gbp_categories_list (lookup table)
└── MVs: directory_gbp_listings, directory_gbp_stats

❌ Two separate systems
❌ Different data structures
❌ Separate MVs for each
```

---

## Solution: Unified Source with MV Compatibility

### New Architecture

```
Unified Categories
├── tenant_category_assignments (NEW - single source of truth)
│   ├── is_assigned_to_gbp (boolean)
│   └── is_assigned_to_directory (boolean)
│
├── Backward Compatibility Layer
│   ├── Sync to directory_listings_list (for existing MVs)
│   └── Sync to gbp_listing_categories (for existing MVs)
│
└── Existing MVs continue to work (no changes needed!)
    ├── directory_category_listings
    ├── directory_category_stats
    ├── directory_gbp_listings
    └── directory_gbp_stats
```

---

## Implementation Strategy: Phased MV Migration

### Phase 1: Parallel Systems (Week 3-4)
**Goal:** New unified table works alongside existing MVs

```sql
-- New unified table
tenant_category_assignments
  ├── Stores all categories
  ├── Platform flags (gbp/directory)
  └── Single source of truth

-- Sync function keeps old tables updated
CREATE FUNCTION sync_categories_to_legacy()
RETURNS TRIGGER AS $$
BEGIN
  -- Update directory_listings_list
  UPDATE directory_listings_list
  SET 
    primary_category = (
      SELECT category_name 
      FROM tenant_category_assignments
      WHERE tenant_id = NEW.tenant_id 
        AND is_primary = true 
        AND is_assigned_to_directory = true
    ),
    secondary_categories = (
      SELECT ARRAY_AGG(category_name ORDER BY display_order)
      FROM tenant_category_assignments
      WHERE tenant_id = NEW.tenant_id 
        AND is_primary = false 
        AND is_assigned_to_directory = true
    )
  WHERE tenant_id = NEW.tenant_id;
  
  -- Update gbp_listing_categories
  -- (similar pattern)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Existing MVs continue to work!
-- No changes needed to MV definitions
```

**Benefits:**
- ✅ Zero downtime
- ✅ Existing MVs keep working
- ✅ No query changes needed
- ✅ Gradual migration possible

---

### Phase 2: Enhanced MVs (Week 5-6)
**Goal:** Create new unified MVs that leverage both category types

#### New MV: `directory_unified_listings`

```sql
-- Combines BOTH product categories AND GBP categories
-- One row per listing per category (either type)
CREATE MATERIALIZED VIEW directory_unified_listings AS
SELECT 
  -- Listing identifiers
  dl.id,
  dl.tenant_id,
  
  -- Business information
  dl.business_name,
  dl.slug,
  dl.city,
  dl.state,
  
  -- Unified category information
  tca.category_id,
  tca.category_name,
  tca.category_source, -- 'gbp' or 'directory'
  tca.is_primary,
  tca.is_assigned_to_gbp,
  tca.is_assigned_to_directory,
  
  -- Metrics
  dl.rating_avg,
  dl.rating_count,
  dl.product_count,
  dl.is_featured,
  
  -- Timestamps
  dl.created_at,
  dl.updated_at

FROM directory_listings_list dl
INNER JOIN tenant_category_assignments tca ON tca.tenant_id = dl.tenant_id
WHERE dl.is_published = true
  AND tca.is_assigned_to_directory = true; -- Only directory-assigned categories

-- Indexes
CREATE UNIQUE INDEX idx_directory_unified_listings_unique
  ON directory_unified_listings(id, category_id);

CREATE INDEX idx_directory_unified_listings_category
  ON directory_unified_listings(category_id);

CREATE INDEX idx_directory_unified_listings_source
  ON directory_unified_listings(category_source);

CREATE INDEX idx_directory_unified_listings_primary
  ON directory_unified_listings(is_primary) WHERE is_primary = true;
```

#### New MV: `directory_unified_stats`

```sql
-- Aggregated stats across both category types
CREATE MATERIALIZED VIEW directory_unified_stats AS
SELECT 
  category_id,
  category_name,
  category_source,
  
  -- Store counts
  COUNT(DISTINCT tenant_id) as store_count,
  COUNT(DISTINCT tenant_id) FILTER (WHERE is_primary = true) as primary_count,
  COUNT(DISTINCT tenant_id) FILTER (WHERE is_primary = false) as secondary_count,
  
  -- Product counts
  SUM(product_count) as total_products,
  AVG(product_count) as avg_products_per_store,
  
  -- Rating stats
  AVG(rating_avg) FILTER (WHERE rating_count > 0) as avg_rating,
  SUM(rating_count) as total_reviews,
  
  -- Location distribution
  COUNT(DISTINCT city || ', ' || state) as unique_locations,
  
  -- Metadata
  MIN(created_at) as first_store_added,
  MAX(created_at) as last_store_added,
  NOW() as stats_generated_at

FROM directory_unified_listings
GROUP BY category_id, category_name, category_source;

-- Indexes
CREATE UNIQUE INDEX uq_directory_unified_stats_category
  ON directory_unified_stats(category_id);

CREATE INDEX idx_directory_unified_stats_store_count
  ON directory_unified_stats(store_count DESC);

CREATE INDEX idx_directory_unified_stats_source
  ON directory_unified_stats(category_source);
```

---

### Phase 3: Deprecate Old MVs (Week 7-8)
**Goal:** Gradually migrate queries to new unified MVs

**Migration Path:**
1. **Week 7:** Deploy new unified MVs alongside old ones
2. **Week 7:** Update API queries to use new MVs (with feature flag)
3. **Week 8:** Monitor performance and correctness
4. **Week 8:** Deprecate old MVs after validation

---

## MV Refresh Strategy

### Current Refresh Pattern
```sql
-- Existing MVs refresh independently
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_listings;
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_listings;
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_stats;
```

### Unified Refresh Pattern
```sql
-- Single refresh function for all unified MVs
CREATE OR REPLACE FUNCTION refresh_directory_unified_mvs()
RETURNS void AS $$
BEGIN
  -- Refresh in dependency order
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_unified_listings;
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_unified_stats;
  
  -- Optional: Also refresh legacy MVs during transition
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_listings;
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_listings;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh (every 5 minutes)
SELECT cron.schedule(
  'refresh-directory-unified-mvs',
  '*/5 * * * *',
  'SELECT refresh_directory_unified_mvs()'
);
```

---

## Query Migration Examples

### Before (Separate Queries)

**Product Category Query:**
```sql
SELECT * FROM directory_category_listings
WHERE category_slug = 'frozen-foods'
ORDER BY rating_avg DESC
LIMIT 12;
```

**GBP Category Query:**
```sql
SELECT * FROM directory_gbp_listings
WHERE gbp_category_id = 'gcid:grocery_store'
ORDER BY rating_avg DESC
LIMIT 12;
```

### After (Unified Query)

**Single Query for Both:**
```sql
SELECT * FROM directory_unified_listings
WHERE category_id = 'frozen-foods' -- or 'gcid:grocery_store'
ORDER BY rating_avg DESC
LIMIT 12;

-- Can also filter by source
WHERE category_source = 'directory' -- or 'gbp'
```

---

## Performance Considerations

### MV Size Comparison

**Current (Separate):**
```
directory_category_listings:  ~5,000 rows (1 store × 1-3 categories)
directory_gbp_listings:       ~5,000 rows (1 store × 1-10 GBP categories)
Total:                        ~10,000 rows
```

**Unified:**
```
directory_unified_listings:   ~10,000 rows (same total)
  - Combines both types
  - No duplication
  - Single index structure
```

**Benefits:**
- ✅ Same total size
- ✅ Simpler query patterns
- ✅ Single refresh operation
- ✅ Consistent data structure

---

## Backward Compatibility Guarantee

### During Transition (Weeks 3-8)

**Old MVs continue to work:**
```sql
-- These queries keep working unchanged
SELECT * FROM directory_category_listings WHERE category_slug = 'grocery';
SELECT * FROM directory_gbp_listings WHERE gbp_category_id = 'gcid:grocery';
```

**New MVs available:**
```sql
-- New queries can use unified MVs
SELECT * FROM directory_unified_listings WHERE category_id = 'grocery';
```

**Sync mechanism ensures consistency:**
```sql
-- Trigger keeps old tables updated
CREATE TRIGGER sync_categories_after_change
  AFTER INSERT OR UPDATE OR DELETE ON tenant_category_assignments
  FOR EACH ROW EXECUTE FUNCTION sync_categories_to_legacy();
```

---

## Testing Strategy

### MV Consistency Tests

```sql
-- Test 1: Verify row counts match
SELECT 
  'Legacy' as source,
  COUNT(*) as row_count
FROM directory_category_listings
UNION ALL
SELECT 
  'Unified (directory only)' as source,
  COUNT(*) as row_count
FROM directory_unified_listings
WHERE category_source = 'directory';

-- Test 2: Verify same stores appear in both
SELECT 
  l.tenant_id,
  l.business_name,
  l.category_slug as legacy_category,
  u.category_id as unified_category
FROM directory_category_listings l
FULL OUTER JOIN directory_unified_listings u 
  ON u.id = l.id AND u.category_id = l.category_slug
WHERE l.id IS NULL OR u.id IS NULL;

-- Should return 0 rows (all stores match)

-- Test 3: Verify stats match
SELECT 
  'Legacy' as source,
  category_slug,
  store_count
FROM directory_category_stats
UNION ALL
SELECT 
  'Unified' as source,
  category_id,
  store_count
FROM directory_unified_stats
WHERE category_source = 'directory'
ORDER BY category_slug, source;
```

---

## Rollback Plan

### If Unified MVs Have Issues

```sql
-- Step 1: Stop using new MVs
UPDATE feature_flags SET enabled = false WHERE flag = 'use_unified_mvs';

-- Step 2: Revert queries to old MVs
-- (No code changes needed - old MVs still working)

-- Step 3: Drop new MVs if needed
DROP MATERIALIZED VIEW IF EXISTS directory_unified_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS directory_unified_listings CASCADE;

-- Step 4: Old system continues working
-- No data loss, no downtime
```

---

## Migration Checklist

### Pre-Migration
- [x] Document existing MV structure
- [x] Identify all queries using existing MVs
- [x] Design unified MV schema
- [x] Plan backward compatibility layer

### Phase 1: Parallel Systems
- [ ] Create `tenant_category_assignments` table
- [ ] Create sync triggers to legacy tables
- [ ] Verify legacy MVs still refresh correctly
- [ ] Test backward compatibility

### Phase 2: Unified MVs
- [ ] Create `directory_unified_listings` MV
- [ ] Create `directory_unified_stats` MV
- [ ] Set up refresh schedule
- [ ] Run consistency tests

### Phase 3: Migration
- [ ] Deploy feature flag for unified MVs
- [ ] Migrate queries gradually (10% → 50% → 100%)
- [ ] Monitor performance metrics
- [ ] Verify data consistency

### Phase 4: Cleanup
- [ ] Deprecate old MVs after 30 days
- [ ] Remove sync triggers
- [ ] Update documentation
- [ ] Archive old MV definitions

---

## Success Metrics

### Performance
- ✅ MV refresh time < 5 seconds
- ✅ Query performance same or better
- ✅ Index size reasonable

### Correctness
- ✅ 100% data consistency between old and new MVs
- ✅ Zero data loss during migration
- ✅ All queries return correct results

### Adoption
- ✅ All queries migrated to unified MVs
- ✅ Old MVs deprecated
- ✅ Documentation updated

---

## Conclusion

The unified categories system **aligns perfectly** with existing materialized view patterns:

1. **Maintains compatibility** - Old MVs keep working during transition
2. **Follows established patterns** - Uses same flattening approach (UNNEST/JOIN)
3. **Improves consistency** - Single source of truth for all categories
4. **Simplifies queries** - One MV instead of two separate ones
5. **Zero downtime** - Gradual migration with rollback capability

**Key Insight:** By syncing the unified table back to legacy tables, we get the best of both worlds - a clean new architecture with zero disruption to existing systems.
