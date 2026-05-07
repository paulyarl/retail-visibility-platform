# GBP Secondary Categories Implementation Plan

**Objective:** Make GBP categories (store types) work exactly like product categories in the directory, allowing stores to appear in multiple store type listings based on all their GBP categories (primary + secondary).

**Status:** 📋 PLANNING
**Priority:** HIGH - Improves directory discoverability and transparency
**Estimated Effort:** 4-6 hours

---

## Current State

### ✅ What's Working
- GBP primary category stored in `tenant_business_profiles_list`
- GBP primary + secondary stored in `tenants.metadata`
- Frontend can save and display both primary and secondary
- Store types query reads primary from metadata
- Trigger syncs GBP changes to directory

### ❌ What's Missing
- GBP secondary categories not in materialized view
- Stores only appear in primary store type listing
- No way to browse stores by secondary GBP categories
- Secondary categories not visible in directory

---

## Design Goals

### 1. **Parity with Product Categories**
- Stores appear in ALL their GBP category listings (primary + secondary)
- Same flattened/normalized pattern as product categories
- Consistent query patterns and API responses

### 2. **Maximum Discoverability**
- Users can find stores by any of their GBP categories
- "Browse by Store Type" shows all relevant stores
- Search can filter by any GBP category

### 3. **Data Integrity**
- Single source of truth: `tenants.metadata`
- Materialized view for fast queries
- Automatic sync when categories change

### 4. **Performance**
- Materialized view for sub-20ms queries
- Proper indexes for filtering
- Efficient refresh strategy

---

## Architecture Pattern (Following Product Categories)

### Product Categories Pattern (Reference)
```
1. Source: directory_settings.primary_category + secondary_categories
2. Junction: directory_listing_categories (listing_id, category_id, is_primary)
3. Materialized View: directory_category_listings (flattened, one row per listing per category)
4. Stats View: directory_category_stats (aggregated counts)
5. API: /api/directory/mv/categories (fast queries)
```

### GBP Categories Pattern (To Implement)
```
1. Source: tenants.metadata.gbp_categories.primary + secondary
2. Junction: gbp_listing_categories (listing_id, gbp_category_id, is_primary) [NEW]
3. Materialized View: directory_gbp_listings (flattened, one row per listing per GBP category) [NEW]
4. Stats View: directory_gbp_stats (aggregated counts) [NEW]
5. API: /api/directory/store-types (updated to use new views)
```

---

## Implementation Plan

### Phase 1: Database Schema (2 hours)

#### Step 1.1: Create GBP Listing Categories Junction Table
**File:** `apps/api/prisma/manual_migrations/16_create_gbp_listing_categories.sql`

```sql
-- Junction table linking directory listings to GBP categories
CREATE TABLE IF NOT EXISTS gbp_listing_categories (
  listing_id TEXT NOT NULL REFERENCES directory_listings_list(id) ON DELETE CASCADE,
  gbp_category_id TEXT NOT NULL REFERENCES gbp_categories_list(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (listing_id, gbp_category_id)
);

-- Indexes for fast queries
CREATE INDEX idx_gbp_listing_categories_listing ON gbp_listing_categories(listing_id);
CREATE INDEX idx_gbp_listing_categories_category ON gbp_listing_categories(gbp_category_id);
CREATE INDEX idx_gbp_listing_categories_primary ON gbp_listing_categories(is_primary) WHERE is_primary = true;
```

#### Step 1.2: Create Directory GBP Listings Materialized View
**File:** `apps/api/prisma/manual_migrations/17_create_directory_gbp_listings_mv.sql`

```sql
-- Flattened view: one row per listing per GBP category
CREATE MATERIALIZED VIEW directory_gbp_listings AS
SELECT 
  -- Listing ID (can appear multiple times, once per GBP category)
  dl.id,
  dl.tenant_id,
  
  -- Business information
  dl.business_name,
  dl.slug,
  dl.address,
  dl.city,
  dl.state,
  dl.zip_code,
  dl.phone,
  dl.email,
  dl.website,
  
  -- Location data
  dl.latitude,
  dl.longitude,
  
  -- GBP Category information (from normalized table)
  gc.id as gbp_category_id,
  gc.name as gbp_category_name,
  gc.display_name as gbp_category_display_name,
  glc.is_primary,
  
  -- Metrics
  dl.logo_url,
  dl.description,
  dl.rating_avg,
  dl.rating_count,
  dl.product_count,
  dl.is_featured,
  dl.subscription_tier,
  dl.use_custom_website,
  
  -- Timestamps
  dl.created_at,
  dl.updated_at,
  
  -- Computed flags (for fast filtering)
  EXISTS(SELECT 1 FROM tenants WHERE id = dl.tenant_id) as tenant_exists,
  t.location_status = 'active' as is_active_location,
  t.directory_visible as is_directory_visible,
  t.google_sync_enabled as is_google_synced

FROM directory_listings_list dl
INNER JOIN gbp_listing_categories glc ON glc.listing_id = dl.id
INNER JOIN gbp_categories_list gc ON gc.id = glc.gbp_category_id
INNER JOIN tenants t ON t.id = dl.tenant_id
WHERE dl.is_published = true;

-- UNIQUE index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_directory_gbp_listings_unique
  ON directory_gbp_listings(id, gbp_category_id);

-- Other indexes
CREATE INDEX idx_directory_gbp_listings_tenant ON directory_gbp_listings(tenant_id);
CREATE INDEX idx_directory_gbp_listings_category ON directory_gbp_listings(gbp_category_id);
CREATE INDEX idx_directory_gbp_listings_city ON directory_gbp_listings(city);
CREATE INDEX idx_directory_gbp_listings_state ON directory_gbp_listings(state);
```

#### Step 1.3: Create Directory GBP Stats Materialized View
**File:** `apps/api/prisma/manual_migrations/18_create_directory_gbp_stats_mv.sql`

```sql
-- Aggregated statistics per GBP category
CREATE MATERIALIZED VIEW directory_gbp_stats AS
SELECT 
  gc.id as gbp_category_id,
  gc.name as gbp_category_name,
  gc.display_name as gbp_category_display_name,
  
  -- Store counts
  COUNT(DISTINCT dgl.id) as store_count,
  COUNT(DISTINCT CASE WHEN dgl.is_primary = true THEN dgl.id END) as primary_store_count,
  COUNT(DISTINCT CASE WHEN dgl.is_primary = false THEN dgl.id END) as secondary_store_count,
  
  -- Product metrics
  SUM(dgl.product_count) as total_products,
  AVG(dgl.product_count) as avg_products_per_store,
  
  -- Rating metrics
  AVG(dgl.rating_avg) as avg_rating,
  SUM(dgl.rating_count) as total_ratings,
  
  -- Featured stores
  COUNT(DISTINCT CASE WHEN dgl.is_featured = true THEN dgl.id END) as featured_store_count,
  
  -- Geographic distribution
  COUNT(DISTINCT dgl.state) as state_count,
  COUNT(DISTINCT dgl.city) as city_count,
  COUNT(DISTINCT CASE WHEN dgl.city IS NOT NULL AND dgl.state IS NOT NULL 
    THEN dgl.city || ', ' || dgl.state END) as unique_locations,
  ARRAY_AGG(DISTINCT dgl.city ORDER BY dgl.city) FILTER (WHERE dgl.city IS NOT NULL) as cities,
  ARRAY_AGG(DISTINCT dgl.state ORDER BY dgl.state) FILTER (WHERE dgl.state IS NOT NULL) as states,
  
  -- Sync status
  COUNT(DISTINCT CASE WHEN dgl.is_google_synced = true THEN dgl.id END) as synced_store_count,
  
  -- Timestamps
  MIN(dgl.created_at) as first_store_added,
  MAX(dgl.updated_at) as last_store_updated

FROM gbp_categories_list gc
LEFT JOIN directory_gbp_listings dgl ON dgl.gbp_category_id = gc.id
GROUP BY 
  gc.id,
  gc.name,
  gc.display_name;

-- Indexes
CREATE UNIQUE INDEX idx_directory_gbp_stats_category_id_unique
  ON directory_gbp_stats(gbp_category_id);

CREATE INDEX idx_directory_gbp_stats_store_count 
  ON directory_gbp_stats(store_count DESC);
```

---

### Phase 2: Sync Mechanism (1.5 hours)

#### Step 2.1: Update GBP Category Save Endpoint
**File:** `apps/api/src/index.ts` (PUT /api/tenant/gbp-category)

Add sync to `gbp_listing_categories` table after updating metadata:

```typescript
// After updating tenants.metadata...

// Sync GBP categories to gbp_listing_categories table
// Delete existing associations
await pool.query(
  'DELETE FROM gbp_listing_categories WHERE listing_id = $1',
  [tenantId]
);

// Insert primary category
await pool.query(
  `INSERT INTO gbp_listing_categories (listing_id, gbp_category_id, is_primary)
   VALUES ($1, $2, true)
   ON CONFLICT (listing_id, gbp_category_id) DO UPDATE
   SET is_primary = EXCLUDED.is_primary`,
  [tenantId, primary.id]
);

// Insert secondary categories
if (secondary && secondary.length > 0) {
  for (const cat of secondary) {
    await pool.query(
      `INSERT INTO gbp_listing_categories (listing_id, gbp_category_id, is_primary)
       VALUES ($1, $2, false)
       ON CONFLICT (listing_id, gbp_category_id) DO UPDATE
       SET is_primary = EXCLUDED.is_primary`,
      [tenantId, cat.id]
    );
  }
}

console.log('[PUT /api/tenant/gbp-category] Synced GBP categories to gbp_listing_categories');
```

#### Step 2.2: Update Directory Refresh Endpoint
**File:** `apps/api/src/routes/directory-tenant.ts`

Add GBP materialized views to refresh:

```typescript
// Refresh all directory materialized views
await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_listings');
await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stats');
await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_listings'); // NEW
await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_stats'); // NEW
```

#### Step 2.3: Create Trigger for Auto-Sync
**File:** `apps/api/prisma/manual_migrations/19_create_gbp_category_sync_trigger.sql`

```sql
-- Trigger to sync GBP categories when metadata changes
CREATE OR REPLACE FUNCTION sync_gbp_categories_to_junction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if GBP categories changed
  IF (OLD.metadata->'gbp_categories' IS DISTINCT FROM NEW.metadata->'gbp_categories') THEN
    -- Delete existing associations
    DELETE FROM gbp_listing_categories WHERE listing_id = NEW.id;
    
    -- Insert primary category
    IF NEW.metadata->'gbp_categories'->'primary'->>'id' IS NOT NULL THEN
      INSERT INTO gbp_listing_categories (listing_id, gbp_category_id, is_primary)
      VALUES (
        NEW.id,
        NEW.metadata->'gbp_categories'->'primary'->>'id',
        true
      )
      ON CONFLICT (listing_id, gbp_category_id) DO UPDATE
      SET is_primary = EXCLUDED.is_primary;
    END IF;
    
    -- Insert secondary categories
    IF NEW.metadata->'gbp_categories'->'secondary' IS NOT NULL THEN
      INSERT INTO gbp_listing_categories (listing_id, gbp_category_id, is_primary)
      SELECT 
        NEW.id,
        sec->>'id',
        false
      FROM jsonb_array_elements(NEW.metadata->'gbp_categories'->'secondary') AS sec
      WHERE sec->>'id' IS NOT NULL
      ON CONFLICT (listing_id, gbp_category_id) DO UPDATE
      SET is_primary = EXCLUDED.is_primary;
    END IF;
    
    -- Refresh materialized views (debounced)
    PERFORM refresh_directory_mv_debounced();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to tenants table
DROP TRIGGER IF EXISTS sync_gbp_categories_trigger ON tenants;
CREATE TRIGGER sync_gbp_categories_trigger
  AFTER UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION sync_gbp_categories_to_junction();
```

---

### Phase 3: API Updates (1 hour)

#### Step 3.1: Update Store Types Endpoint
**File:** `apps/api/src/services/store-type-directory.service.ts`

Replace current query with stats view query:

```typescript
async getStoreTypes(
  location?: { lat: number; lng: number },
  radiusMiles?: number
) {
  try {
    console.log('[StoreTypeService] Fetching GBP store types from directory_gbp_stats');

    // Query stats materialized view
    const result = await getDirectPool().query(`
      SELECT 
        gbp_category_id,
        gbp_category_name,
        gbp_category_display_name,
        store_count,
        primary_store_count,
        secondary_store_count,
        total_products,
        avg_rating,
        unique_locations,
        cities,
        states,
        featured_store_count,
        synced_store_count,
        first_store_added,
        last_store_updated
      FROM directory_gbp_stats
      WHERE store_count > 0
      ORDER BY store_count DESC
    `);

    console.log(`[StoreTypeService] Found ${result.rows.length} GBP store types`);

    return result.rows.map(row => ({
      id: row.gbp_category_id,
      name: row.gbp_category_name,
      displayName: row.gbp_category_display_name,
      slug: this.slugify(row.gbp_category_name),
      storeCount: row.store_count,
      primaryStoreCount: row.primary_store_count,
      secondaryStoreCount: row.secondary_store_count,
      totalProducts: row.total_products,
      avgRating: row.avg_rating || 0,
      uniqueLocations: row.unique_locations,
      cities: row.cities || [],
      states: row.states || [],
      featuredStoreCount: row.featured_store_count,
      syncedStoreCount: row.synced_store_count,
      firstStoreAdded: row.first_store_added,
      lastStoreUpdated: row.last_store_updated,
    }));
  } catch (error) {
    console.error('[StoreTypeService] Error fetching store types:', error);
    return [];
  }
}
```

#### Step 3.2: Add Store Type Detail Endpoint
**File:** `apps/api/src/routes/directory-store-types.ts`

Add endpoint to get stores by GBP category:

```typescript
router.get('/store-types/:categoryId/stores', async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const { page = '1', limit = '12' } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Get stores from materialized view
    const result = await getDirectPool().query(`
      SELECT * FROM directory_gbp_listings
      WHERE gbp_category_id = $1
      ORDER BY 
        is_primary DESC,  -- Primary stores first
        rating_avg DESC NULLS LAST,
        product_count DESC NULLS LAST,
        created_at DESC
      LIMIT $2 OFFSET $3
    `, [categoryId, limitNum, skip]);

    // Get total count
    const countResult = await getDirectPool().query(`
      SELECT COUNT(*) as count FROM directory_gbp_listings
      WHERE gbp_category_id = $1
    `, [categoryId]);

    const total = parseInt(countResult.rows[0]?.count || '0');

    res.json({
      success: true,
      stores: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching stores by type:', error);
    res.status(500).json({ error: 'failed_to_fetch_stores' });
  }
});
```

---

### Phase 4: Frontend Updates (1.5 hours)

#### Step 4.1: Update Directory Page
**File:** `apps/web/src/app/directory/page.tsx`

Display both primary and secondary store counts:

```tsx
<div className="text-sm text-gray-600">
  {type.storeCount} {type.storeCount === 1 ? 'store' : 'stores'}
  {type.primaryStoreCount > 0 && type.secondaryStoreCount > 0 && (
    <span className="ml-1 text-xs text-gray-500">
      ({type.primaryStoreCount} primary, {type.secondaryStoreCount} also)
    </span>
  )}
</div>
```

#### Step 4.2: Update Store Type Browse Page
**File:** `apps/web/src/app/directory/store-type/[slug]/page.tsx`

Show primary/secondary indicators on store cards:

```tsx
{store.is_primary ? (
  <Badge variant="default">Primary Category</Badge>
) : (
  <Badge variant="secondary">Also in this category</Badge>
)}
```

#### Step 4.3: Update Dashboard Store Info Card
**File:** `apps/web/src/components/dashboard/TenantDashboard.tsx`

Display all GBP categories:

```tsx
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <Store className="h-4 w-4 text-gray-500" />
    <span className="font-medium">Store Type:</span>
    <span>{profile.gbpCategoryName || 'Not set'}</span>
  </div>
  {profile.gbpSecondaryCategories?.length > 0 && (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span className="ml-6">Also:</span>
      <span>{profile.gbpSecondaryCategories.map(c => c.name).join(', ')}</span>
    </div>
  )}
</div>
```

---

## Testing Plan

### Unit Tests
- [ ] Junction table CRUD operations
- [ ] Materialized view queries
- [ ] Sync trigger functionality
- [ ] API endpoint responses

### Integration Tests
- [ ] Save GBP categories → sync to junction table
- [ ] Junction table → materialized view refresh
- [ ] Store appears in all category listings
- [ ] Primary/secondary indicators correct

### Manual Testing
1. Save GBP categories (1 primary + 3 secondary)
2. Verify junction table has 4 rows
3. Refresh materialized views
4. Check "Browse by Store Type" shows all 4 categories
5. Click each category → store appears in all 4 listings
6. Verify primary/secondary badges
7. Check dashboard shows all categories

---

## Migration Strategy

### Step 1: Run Migrations
```bash
# Create junction table
psql $DATABASE_URL -f apps/api/prisma/manual_migrations/16_create_gbp_listing_categories.sql

# Create materialized views
psql $DATABASE_URL -f apps/api/prisma/manual_migrations/17_create_directory_gbp_listings_mv.sql
psql $DATABASE_URL -f apps/api/prisma/manual_migrations/18_create_directory_gbp_stats_mv.sql

# Create trigger
psql $DATABASE_URL -f apps/api/prisma/manual_migrations/19_create_gbp_category_sync_trigger.sql
```

### Step 2: Backfill Existing Data
```sql
-- Sync existing GBP categories from metadata to junction table
INSERT INTO gbp_listing_categories (listing_id, gbp_category_id, is_primary)
SELECT 
  t.id,
  t.metadata->'gbp_categories'->'primary'->>'id',
  true
FROM tenants t
WHERE t.metadata->'gbp_categories'->'primary'->>'id' IS NOT NULL
ON CONFLICT (listing_id, gbp_category_id) DO NOTHING;

-- Sync secondary categories
INSERT INTO gbp_listing_categories (listing_id, gbp_category_id, is_primary)
SELECT 
  t.id,
  sec->>'id',
  false
FROM tenants t,
  jsonb_array_elements(t.metadata->'gbp_categories'->'secondary') AS sec
WHERE t.metadata->'gbp_categories'->'secondary' IS NOT NULL
  AND sec->>'id' IS NOT NULL
ON CONFLICT (listing_id, gbp_category_id) DO NOTHING;
```

### Step 3: Refresh Materialized Views
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_listings;
REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_stats;
```

### Step 4: Deploy Code Changes
1. Deploy backend API changes
2. Deploy frontend changes
3. Verify directory shows all GBP categories

---

## Success Criteria

- [ ] Stores appear in ALL their GBP category listings (primary + secondary)
- [ ] "Browse by Store Type" shows accurate counts (primary + secondary)
- [ ] Store type detail pages show all relevant stores
- [ ] Primary/secondary indicators display correctly
- [ ] Dashboard shows all GBP categories
- [ ] Materialized view queries < 20ms
- [ ] Auto-sync works when categories change
- [ ] No duplicate stores in listings
- [ ] Backward compatible with existing data

---

## Rollback Plan

If issues arise:

1. **Disable trigger:** `DROP TRIGGER sync_gbp_categories_trigger ON tenants;`
2. **Revert API endpoints** to use old query
3. **Keep new tables** for future retry
4. **No data loss** - metadata still intact

---

## Future Enhancements

### Phase 5: Advanced Features
- [ ] GBP category hierarchy (parent/child relationships)
- [ ] Category suggestions based on business type
- [ ] Category popularity trends
- [ ] Category-based recommendations
- [ ] Multi-language category names
- [ ] Category icons/emojis

### Phase 6: Analytics
- [ ] Track which categories drive most traffic
- [ ] A/B test category combinations
- [ ] Category conversion metrics
- [ ] Category search analytics

---

## Notes

- **Pattern Consistency:** This follows the exact same pattern as product categories for maintainability
- **Performance:** Materialized views ensure fast queries even with many stores
- **Flexibility:** Junction table allows easy addition of metadata (e.g., confidence scores)
- **Scalability:** Indexed properly for growth
- **User Experience:** Maximum discoverability through all categories

---

**Next Steps:**
1. Review and approve plan
2. Create migration files
3. Implement sync mechanism
4. Update API endpoints
5. Update frontend
6. Test thoroughly
7. Deploy to staging
8. Deploy to production
