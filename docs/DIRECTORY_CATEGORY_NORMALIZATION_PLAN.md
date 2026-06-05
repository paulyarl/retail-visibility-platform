# Directory Category Normalization Plan

**Date:** 2024-11-28  
**Status:** Ready for Implementation  
**Priority:** HIGH - Foundation for platform maturity

---

## Executive Summary

Migrate from **text-based ad-hoc categories** to a **proper normalized category system** with 1:1 Google taxonomy alignment. This establishes a single source of truth for categories across the entire platform.

---

## Current State (Problems)

### Existing Schema
```sql
-- directory_listings_list table
primary_category: TEXT           -- ❌ Ad-hoc text, no validation
secondary_categories: TEXT[]     -- ❌ Array of text, no relationships

-- Problems:
-- 1. No Google taxonomy alignment
-- 2. Duplicate category definitions
-- 3. Typos and inconsistencies
-- 4. No category hierarchy
-- 5. Hard to update category names
```

### Example Current Data
```sql
-- Listing 1
primary_category: "Health & Beauty"
secondary_categories: ["Frozen Foods", "Dairy & Eggs"]

-- Listing 2  
primary_category: "Health and Beauty"  -- ❌ Inconsistent!
secondary_categories: ["frozen foods"]  -- ❌ Different case!
```

---

## Proposed Solution (Normalized Design)

### New Schema

#### Table 1: `platform_categories` (Master Category Table)
```sql
CREATE TABLE platform_categories (
  id TEXT PRIMARY KEY DEFAULT ('cat_' || gen_random_uuid()),
  
  -- Category identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  
  -- Google taxonomy alignment (1:1 relationship)
  google_category_id TEXT UNIQUE NOT NULL,
  
  -- Hierarchy support
  parent_id TEXT REFERENCES platform_categories(id) ON DELETE SET NULL,
  level INTEGER DEFAULT 0,  -- 0 = root, 1 = child, etc.
  
  -- Display & sorting
  icon_emoji TEXT,  -- e.g., "🏥" for Health & Beauty
  sort_order INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT valid_level CHECK (level >= 0 AND level <= 5)
);

-- Indexes
CREATE INDEX idx_platform_categories_google_id ON platform_categories(google_category_id);
CREATE INDEX idx_platform_categories_slug ON platform_categories(slug);
CREATE INDEX idx_platform_categories_parent ON platform_categories(parent_id);
CREATE INDEX idx_platform_categories_active ON platform_categories(is_active) WHERE is_active = true;
```

#### Table 2: `directory_listing_categories` (Junction Table)
```sql
CREATE TABLE directory_listing_categories (
  listing_id TEXT NOT NULL REFERENCES directory_listings_list(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES platform_categories(id) ON DELETE CASCADE,
  
  -- Designation
  is_primary BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  PRIMARY KEY (listing_id, category_id),
  
  -- Only one primary category per listing
  CONSTRAINT one_primary_per_listing UNIQUE (listing_id, is_primary) 
    WHERE is_primary = true
);

-- Indexes
CREATE INDEX idx_directory_listing_categories_listing ON directory_listing_categories(listing_id);
CREATE INDEX idx_directory_listing_categories_category ON directory_listing_categories(category_id);
CREATE INDEX idx_directory_listing_categories_primary ON directory_listing_categories(is_primary) WHERE is_primary = true;
```

---

## Migration Strategy

### Phase 1: Create New Tables (Non-Breaking)

**File:** `apps/api/prisma/manual_migrations/04_create_platform_categories.sql`

```sql
-- ============================================================================
-- PHASE 1: CREATE NORMALIZED CATEGORY TABLES
-- Purpose: Establish single source of truth for categories
-- Migration: 04_create_platform_categories
-- ============================================================================

BEGIN;

-- Create master category table
CREATE TABLE IF NOT EXISTS platform_categories (
  id TEXT PRIMARY KEY DEFAULT ('cat_' || gen_random_uuid()),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  google_category_id TEXT UNIQUE NOT NULL,
  parent_id TEXT REFERENCES platform_categories(id) ON DELETE SET NULL,
  level INTEGER DEFAULT 0,
  icon_emoji TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT valid_level CHECK (level >= 0 AND level <= 5)
);

-- Create indexes
CREATE INDEX idx_platform_categories_google_id ON platform_categories(google_category_id);
CREATE INDEX idx_platform_categories_slug ON platform_categories(slug);
CREATE INDEX idx_platform_categories_parent ON platform_categories(parent_id);
CREATE INDEX idx_platform_categories_active ON platform_categories(is_active) WHERE is_active = true;

-- Create junction table
CREATE TABLE IF NOT EXISTS directory_listing_categories (
  listing_id TEXT NOT NULL REFERENCES directory_listings_list(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES platform_categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (listing_id, category_id),
  CONSTRAINT one_primary_per_listing UNIQUE (listing_id, is_primary) WHERE is_primary = true
);

-- Create indexes
CREATE INDEX idx_directory_listing_categories_listing ON directory_listing_categories(listing_id);
CREATE INDEX idx_directory_listing_categories_category ON directory_listing_categories(category_id);
CREATE INDEX idx_directory_listing_categories_primary ON directory_listing_categories(is_primary) WHERE is_primary = true;

-- Track migration
INSERT INTO manual_migrations (
  migration_name,
  description,
  executed_by,
  rollback_sql,
  status
) VALUES (
  '04_create_platform_categories',
  'Create normalized category tables with Google taxonomy alignment',
  CURRENT_USER,
  'DROP TABLE IF EXISTS directory_listing_categories CASCADE;
   DROP TABLE IF EXISTS platform_categories CASCADE;',
  'applied'
) ON CONFLICT (migration_name) DO UPDATE
  SET executed_at = NOW(),
      status = 'applied';

COMMIT;

-- Verification
SELECT 'platform_categories' as table_name, COUNT(*) as row_count FROM platform_categories
UNION ALL
SELECT 'directory_listing_categories' as table_name, COUNT(*) as row_count FROM directory_listing_categories;
```

---

### Phase 2: Seed Platform Categories

**File:** `apps/api/prisma/manual_migrations/05_seed_platform_categories.sql`

```sql
-- ============================================================================
-- PHASE 2: SEED PLATFORM CATEGORIES
-- Purpose: Populate master category table with initial categories
-- Migration: 05_seed_platform_categories
-- ============================================================================

BEGIN;

-- Insert common grocery/retail categories
-- Note: Replace google_category_id values with actual Google taxonomy IDs

INSERT INTO platform_categories (name, slug, description, google_category_id, icon_emoji, sort_order) VALUES
  ('Fresh Produce', 'fresh-produce', 'Fresh fruits and vegetables', 'gcid:2890', '🥬', 10),
  ('Meat & Seafood', 'meat-seafood', 'Fresh and frozen meats, poultry, and seafood', 'gcid:2891', '🥩', 20),
  ('Dairy & Eggs', 'dairy-eggs', 'Milk, cheese, yogurt, and eggs', 'gcid:2892', '🥛', 30),
  ('Frozen Foods', 'frozen-foods', 'Frozen meals, vegetables, and desserts', 'gcid:2893', '🧊', 40),
  ('Bakery', 'bakery', 'Fresh bread, pastries, and baked goods', 'gcid:2894', '🥖', 50),
  ('Pantry Staples', 'pantry-staples', 'Canned goods, pasta, rice, and dry goods', 'gcid:2895', '🥫', 60),
  ('Snacks & Candy', 'snacks-candy', 'Chips, cookies, candy, and snack foods', 'gcid:2896', '🍿', 70),
  ('Beverages', 'beverages', 'Soft drinks, juice, water, and other beverages', 'gcid:2897', '🥤', 80),
  ('Health & Beauty', 'health-beauty', 'Personal care, cosmetics, and health products', 'gcid:2898', '💄', 90),
  ('Household', 'household', 'Cleaning supplies, paper products, and home essentials', 'gcid:2899', '🧹', 100),
  ('Pet Supplies', 'pet-supplies', 'Pet food, toys, and accessories', 'gcid:2900', '🐾', 110),
  ('Baby & Kids', 'baby-kids', 'Baby food, diapers, and children\'s products', 'gcid:2901', '👶', 120)
ON CONFLICT (slug) DO NOTHING;

-- Track migration
INSERT INTO manual_migrations (
  migration_name,
  description,
  executed_by,
  status
) VALUES (
  '05_seed_platform_categories',
  'Seed initial platform categories with Google taxonomy IDs',
  CURRENT_USER,
  'applied'
) ON CONFLICT (migration_name) DO UPDATE
  SET executed_at = NOW(),
      status = 'applied';

COMMIT;

-- Verification
SELECT 
  id,
  name,
  slug,
  google_category_id,
  icon_emoji,
  is_active
FROM platform_categories
ORDER BY sort_order;
```

---

### Phase 3: Migrate Existing Data

**File:** `apps/api/prisma/manual_migrations/06_migrate_listing_categories.sql`

```sql
-- ============================================================================
-- PHASE 3: MIGRATE EXISTING LISTING CATEGORIES
-- Purpose: Populate junction table from existing text-based categories
-- Migration: 06_migrate_listing_categories
-- ============================================================================

BEGIN;

-- Step 1: Migrate primary categories
INSERT INTO directory_listing_categories (listing_id, category_id, is_primary)
SELECT 
  dl.id as listing_id,
  pc.id as category_id,
  true as is_primary
FROM directory_listings_list dl
INNER JOIN platform_categories pc ON (
  -- Match by name (case-insensitive)
  LOWER(pc.name) = LOWER(dl.primary_category)
  OR
  -- Match by slug
  pc.slug = LOWER(REPLACE(dl.primary_category, ' ', '-'))
  OR
  -- Match with & handling
  pc.slug = LOWER(REPLACE(REPLACE(dl.primary_category, ' & ', '-'), ' ', '-'))
)
WHERE dl.primary_category IS NOT NULL
  AND dl.primary_category != ''
ON CONFLICT (listing_id, category_id) DO NOTHING;

-- Step 2: Migrate secondary categories
INSERT INTO directory_listing_categories (listing_id, category_id, is_primary)
SELECT 
  dl.id as listing_id,
  pc.id as category_id,
  false as is_primary
FROM directory_listings_list dl
CROSS JOIN UNNEST(dl.secondary_categories) as secondary_cat
INNER JOIN platform_categories pc ON (
  LOWER(pc.name) = LOWER(secondary_cat)
  OR
  pc.slug = LOWER(REPLACE(secondary_cat, ' ', '-'))
  OR
  pc.slug = LOWER(REPLACE(REPLACE(secondary_cat, ' & ', '-'), ' ', '-'))
)
WHERE dl.secondary_categories IS NOT NULL
  AND array_length(dl.secondary_categories, 1) > 0
ON CONFLICT (listing_id, category_id) DO NOTHING;

-- Track migration
INSERT INTO manual_migrations (
  migration_name,
  description,
  executed_by,
  status
) VALUES (
  '06_migrate_listing_categories',
  'Migrate existing text-based categories to normalized junction table',
  CURRENT_USER,
  'applied'
) ON CONFLICT (migration_name) DO UPDATE
  SET executed_at = NOW(),
      status = 'applied';

COMMIT;

-- Verification
SELECT 
  'Total listings' as metric,
  COUNT(DISTINCT id) as count
FROM directory_listings_list
UNION ALL
SELECT 
  'Listings with categories' as metric,
  COUNT(DISTINCT listing_id) as count
FROM directory_listing_categories
UNION ALL
SELECT 
  'Total category assignments' as metric,
  COUNT(*) as count
FROM directory_listing_categories
UNION ALL
SELECT 
  'Primary category assignments' as metric,
  COUNT(*) as count
FROM directory_listing_categories
WHERE is_primary = true;

-- Show listings without categories (need manual review)
SELECT 
  dl.id,
  dl.business_name,
  dl.primary_category,
  dl.secondary_categories
FROM directory_listings_list dl
LEFT JOIN directory_listing_categories dlc ON dlc.listing_id = dl.id
WHERE dlc.listing_id IS NULL
  AND dl.is_published = true
LIMIT 10;
```

---

### Phase 4: Update Materialized Views

**File:** `apps/api/prisma/manual_migrations/07_update_mv_with_categories.sql`

```sql
-- ============================================================================
-- PHASE 4: UPDATE MATERIALIZED VIEWS WITH NORMALIZED CATEGORIES
-- Purpose: Rebuild MVs to use platform_categories instead of text
-- Migration: 07_update_mv_with_categories
-- ============================================================================

BEGIN;

-- Drop existing materialized views
DROP MATERIALIZED VIEW IF EXISTS directory_category_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS directory_category_listings CASCADE;

-- ============================================================================
-- MATERIALIZED VIEW 1: directory_category_listings
-- One row per listing per category (flattened for fast filtering)
-- ============================================================================

CREATE MATERIALIZED VIEW directory_category_listings AS
SELECT 
  -- Listing ID (can appear multiple times, once per category)
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
  
  -- Category information (from normalized table)
  pc.id as category_id,
  pc.name as category_name,
  pc.slug as category_slug,
  pc.google_category_id,
  pc.parent_id as category_parent_id,
  pc.icon_emoji as category_icon,
  dlc.is_primary,
  
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
INNER JOIN directory_listing_categories dlc ON dlc.listing_id = dl.id
INNER JOIN platform_categories pc ON pc.id = dlc.category_id
INNER JOIN tenants t ON t.id = dl.tenant_id
WHERE dl.is_published = true
  AND pc.is_active = true;

-- ============================================================================
-- INDEXES FOR MATERIALIZED VIEW 1
-- ============================================================================

-- Primary index: Category ID lookup (most common query)
CREATE INDEX idx_directory_category_listings_category_id 
ON directory_category_listings(category_id);

-- Google taxonomy ID lookup
CREATE INDEX idx_directory_category_listings_google_id 
ON directory_category_listings(google_category_id);

-- Category slug lookup (for SEO URLs)
CREATE INDEX idx_directory_category_listings_category_slug 
ON directory_category_listings(category_slug);

-- Composite index: Category + location filtering
CREATE INDEX idx_directory_category_listings_category_location 
ON directory_category_listings(category_id, city, state);

-- Primary categories only
CREATE INDEX idx_directory_category_listings_primary 
ON directory_category_listings(category_id, is_primary) 
WHERE is_primary = true;

-- Featured listings per category
CREATE INDEX idx_directory_category_listings_featured 
ON directory_category_listings(is_featured, category_id) 
WHERE is_featured = true;

-- Sorting indexes
CREATE INDEX idx_directory_category_listings_rating 
ON directory_category_listings(category_id, rating_avg DESC NULLS LAST, rating_count DESC);

CREATE INDEX idx_directory_category_listings_products 
ON directory_category_listings(category_id, product_count DESC NULLS LAST);

CREATE INDEX idx_directory_category_listings_newest 
ON directory_category_listings(category_id, created_at DESC);

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX uq_directory_category_listings_id_category
ON directory_category_listings(id, category_id);

-- ============================================================================
-- MATERIALIZED VIEW 2: directory_category_stats
-- Aggregated statistics per category
-- ============================================================================

CREATE MATERIALIZED VIEW directory_category_stats AS
SELECT
  -- Category identity
  pc.id as category_id,
  pc.name as category_name,
  pc.slug as category_slug,
  pc.google_category_id,
  pc.parent_id as category_parent_id,
  pc.icon_emoji as category_icon,
  pc.level as category_level,
  
  -- Store counts
  COUNT(DISTINCT dcl.tenant_id) as store_count,
  COUNT(DISTINCT dcl.id) FILTER (WHERE dcl.is_primary = true) as primary_store_count,
  COUNT(DISTINCT dcl.id) FILTER (WHERE dcl.is_primary = false) as secondary_store_count,
  
  -- Product metrics
  SUM(dcl.product_count) as total_products,
  AVG(dcl.product_count) as avg_products_per_store,
  
  -- Rating metrics
  AVG(dcl.rating_avg) as avg_rating,
  SUM(dcl.rating_count) as total_ratings,
  
  -- Location diversity
  COUNT(DISTINCT dcl.city || ', ' || dcl.state) as unique_locations,
  array_agg(DISTINCT dcl.city ORDER BY dcl.city) FILTER (WHERE dcl.city IS NOT NULL) as cities,
  array_agg(DISTINCT dcl.state ORDER BY dcl.state) FILTER (WHERE dcl.state IS NOT NULL) as states,
  
  -- Featured stores
  COUNT(DISTINCT dcl.id) FILTER (WHERE dcl.is_featured = true) as featured_store_count,
  
  -- Google sync status
  COUNT(DISTINCT dcl.id) FILTER (WHERE dcl.is_google_synced = true) as synced_store_count,
  
  -- Timestamps
  MIN(dcl.created_at) as first_store_added,
  MAX(dcl.updated_at) as last_store_updated,
  NOW() as stats_generated_at

FROM platform_categories pc
LEFT JOIN directory_category_listings dcl ON dcl.category_id = pc.id
WHERE pc.is_active = true
GROUP BY 
  pc.id,
  pc.name,
  pc.slug,
  pc.google_category_id,
  pc.parent_id,
  pc.icon_emoji,
  pc.level;

-- ============================================================================
-- INDEXES FOR MATERIALIZED VIEW 2
-- ============================================================================

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX uq_directory_category_stats_category_id
ON directory_category_stats(category_id);

-- Lookup by slug
CREATE INDEX idx_directory_category_stats_slug
ON directory_category_stats(category_slug);

-- Lookup by Google ID
CREATE INDEX idx_directory_category_stats_google_id
ON directory_category_stats(google_category_id);

-- Popular categories (by store count)
CREATE INDEX idx_directory_category_stats_store_count
ON directory_category_stats(store_count DESC);

-- Track migration
INSERT INTO manual_migrations (
  migration_name,
  description,
  executed_by,
  status
) VALUES (
  '07_update_mv_with_categories',
  'Update materialized views to use normalized category tables',
  CURRENT_USER,
  'applied'
) ON CONFLICT (migration_name) DO UPDATE
  SET executed_at = NOW(),
      status = 'applied';

COMMIT;

-- Verification
SELECT 
  matviewname,
  ispopulated,
  pg_size_pretty(pg_total_relation_size('public.' || matviewname)) as size
FROM pg_matviews 
WHERE matviewname LIKE 'directory_%'
ORDER BY matviewname;

-- Sample data
SELECT 
  category_name,
  category_slug,
  google_category_id,
  store_count,
  total_products
FROM directory_category_stats
ORDER BY store_count DESC
LIMIT 10;
```

---

### Phase 5: Update Triggers

**File:** `apps/api/prisma/manual_migrations/08_update_triggers_for_categories.sql`

```sql
-- ============================================================================
-- PHASE 5: UPDATE TRIGGERS FOR CATEGORY CHANGES
-- Purpose: Refresh MVs when categories or assignments change
-- Migration: 08_update_triggers_for_categories
-- ============================================================================

BEGIN;

-- ============================================================================
-- TRIGGER 1: platform_categories Changes
-- Refresh when category metadata changes
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_on_platform_category_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only refresh if meaningful data changed
  IF (TG_OP = 'DELETE') OR
     (OLD.name IS DISTINCT FROM NEW.name) OR
     (OLD.slug IS DISTINCT FROM NEW.slug) OR
     (OLD.google_category_id IS DISTINCT FROM NEW.google_category_id) OR
     (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    
    PERFORM refresh_directory_mv_debounced();
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_platform_category_refresh ON platform_categories;

CREATE TRIGGER trigger_platform_category_refresh
AFTER INSERT OR UPDATE OR DELETE ON platform_categories
FOR EACH ROW
EXECUTE FUNCTION refresh_on_platform_category_change();

-- ============================================================================
-- TRIGGER 2: directory_listing_categories Changes
-- Refresh when category assignments change
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_on_listing_category_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Always refresh when assignments change
  PERFORM refresh_directory_mv_debounced();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_listing_category_assignment_refresh ON directory_listing_categories;

CREATE TRIGGER trigger_listing_category_assignment_refresh
AFTER INSERT OR UPDATE OR DELETE ON directory_listing_categories
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_on_listing_category_assignment_change();

-- Track migration
INSERT INTO manual_migrations (
  migration_name,
  description,
  executed_by,
  rollback_sql,
  status
) VALUES (
  '08_update_triggers_for_categories',
  'Add triggers for category table changes',
  CURRENT_USER,
  'DROP TRIGGER IF EXISTS trigger_platform_category_refresh ON platform_categories;
   DROP TRIGGER IF EXISTS trigger_listing_category_assignment_refresh ON directory_listing_categories;
   DROP FUNCTION IF EXISTS refresh_on_platform_category_change();
   DROP FUNCTION IF EXISTS refresh_on_listing_category_assignment_change();',
  'applied'
) ON CONFLICT (migration_name) DO UPDATE
  SET executed_at = NOW(),
      status = 'applied';

COMMIT;

-- Verification
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%category%'
ORDER BY event_object_table, trigger_name;
```

---

## Phase 6: Update API Endpoints

### Update `directory-mv.ts`

```typescript
/**
 * GET /api/directory/mv/search
 * Search by category ID (preferred) or slug (backward compatible)
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { categoryId, categorySlug, category, sort = 'rating', page = '1', limit = '12' } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const conditions: string[] = [
      'tenant_exists = true',
      'is_active_location = true',
      'is_directory_visible = true'
    ];
    const params: any[] = [];
    let paramIndex = 1;

    // Category filter (prefer ID over slug)
    if (categoryId && typeof categoryId === 'string') {
      conditions.push(`category_id = $${paramIndex}`);
      params.push(categoryId);
      paramIndex++;
    } else if (categorySlug && typeof categorySlug === 'string') {
      conditions.push(`category_slug = $${paramIndex}`);
      params.push(categorySlug);
      paramIndex++;
    } else if (category && typeof category === 'string') {
      // Backward compatibility: try to match slug
      conditions.push(`category_slug = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Sorting
    let orderByClause = 'rating_avg DESC NULLS LAST, rating_count DESC';
    if (sort === 'rating') {
      orderByClause = 'rating_avg DESC NULLS LAST, rating_count DESC';
    } else if (sort === 'newest') {
      orderByClause = 'created_at DESC';
    } else if (sort === 'products') {
      orderByClause = 'product_count DESC NULLS LAST';
    } else if (sort === 'featured') {
      orderByClause = 'is_featured DESC, rating_avg DESC NULLS LAST';
    }

    // Query materialized view
    const listingsQuery = `
      SELECT 
        id,
        tenant_id,
        business_name,
        slug,
        address,
        city,
        state,
        zip_code,
        phone,
        email,
        website,
        latitude,
        longitude,
        category_id,
        category_name,
        category_slug,
        google_category_id,
        category_icon,
        is_primary,
        logo_url,
        description,
        rating_avg,
        rating_count,
        product_count,
        is_featured,
        subscription_tier,
        use_custom_website,
        created_at,
        updated_at
      FROM directory_category_listings
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const listingsResult = await getDirectPool().query(listingsQuery, [...params, limitNum, skip]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM directory_category_listings
      WHERE ${whereClause}
    `;
    const countResult = await getDirectPool().query(countQuery, params);

    const total = parseInt(countResult.rows[0]?.count || '0');
    const totalPages = Math.ceil(total / limitNum);

    // Transform to camelCase
    const listings = listingsResult.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      business_name: row.business_name,
      slug: row.slug,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      phone: row.phone,
      email: row.email,
      website: row.website,
      latitude: row.latitude,
      longitude: row.longitude,
      category: {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
        googleCategoryId: row.google_category_id,
        icon: row.category_icon,
        isPrimary: row.is_primary,
      },
      logoUrl: row.logo_url,
      description: row.description,
      ratingAvg: row.rating_avg || 0,
      ratingCount: row.rating_count || 0,
      productCount: row.product_count || 0,
      isFeatured: row.is_featured || false,
      subscription_tier: row.subscription_tier || 'trial',
      useCustomWebsite: row.use_custom_website || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.json({
      listings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Directory MV search error:', error);
    return res.status(500).json({ error: 'search_failed' });
  }
});

/**
 * GET /api/directory/mv/categories
 * Get all categories with stats
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { minStores = '1', includeHierarchy = 'false' } = req.query;
    const minStoresNum = Math.max(0, Number(minStores));

    const statsQuery = `
      SELECT 
        category_id,
        category_name,
        category_slug,
        google_category_id,
        category_parent_id,
        category_icon,
        category_level,
        store_count,
        total_products,
        avg_rating,
        unique_locations,
        cities,
        states,
        featured_store_count,
        synced_store_count,
        first_store_added,
        last_store_updated
      FROM directory_category_stats
      WHERE store_count >= $1
      ORDER BY store_count DESC
    `;
    
    const result = await getDirectPool().query(statsQuery, [minStoresNum]);

    const categories = result.rows.map((row: any) => ({
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
      googleCategoryId: row.google_category_id,
      parentId: row.category_parent_id,
      icon: row.category_icon,
      level: row.category_level,
      storeCount: row.store_count,
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

    return res.json({
      categories,
      total: categories.length,
    });
  } catch (error) {
    console.error('Categories MV error:', error);
    return res.status(500).json({ error: 'categories_failed' });
  }
});

/**
 * GET /api/directory/mv/categories/:id/stats
 * Get detailed stats for a specific category (by ID or slug)
 */
router.get('/categories/:idOrSlug/stats', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;

    // Try to match by ID first, then slug
    const statsQuery = `
      SELECT 
        category_id,
        category_name,
        category_slug,
        google_category_id,
        category_parent_id,
        category_icon,
        category_level,
        store_count,
        primary_store_count,
        secondary_store_count,
        total_products,
        avg_products_per_store,
        avg_rating,
        total_ratings,
        unique_locations,
        cities,
        states,
        featured_store_count,
        synced_store_count,
        first_store_added,
        last_store_updated,
        stats_generated_at
      FROM directory_category_stats
      WHERE category_id = $1 OR category_slug = $1
    `;
    
    const result = await getDirectPool().query(statsQuery, [idOrSlug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'category_not_found' });
    }

    const row = result.rows[0];
    const stats = {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
      googleCategoryId: row.google_category_id,
      parentId: row.category_parent_id,
      icon: row.category_icon,
      level: row.category_level,
      storeCount: row.store_count,
      primaryStoreCount: row.primary_store_count,
      secondaryStoreCount: row.secondary_store_count,
      totalProducts: row.total_products,
      avgProductsPerStore: row.avg_products_per_store,
      avgRating: row.avg_rating || 0,
      totalRatings: row.total_ratings,
      uniqueLocations: row.unique_locations,
      cities: row.cities || [],
      states: row.states || [],
      featuredStoreCount: row.featured_store_count,
      syncedStoreCount: row.synced_store_count,
      firstStoreAdded: row.first_store_added,
      lastStoreUpdated: row.last_store_updated,
      statsGeneratedAt: row.stats_generated_at,
    };

    return res.json({ stats });
  } catch (error) {
    console.error('Category stats MV error:', error);
    return res.status(500).json({ error: 'stats_failed' });
  }
});
```

---

## Phase 7: Update Prisma Schema

```prisma
// Add to schema.prisma

model PlatformCategory {
  id                String   @id @default(cuid()) @map("id")
  name              String   @map("name")
  slug              String   @unique @map("slug")
  description       String?  @map("description")
  googleCategoryId  String   @unique @map("google_category_id")
  parentId          String?  @map("parent_id")
  level             Int      @default(0) @map("level")
  iconEmoji         String?  @map("icon_emoji")
  sortOrder         Int      @default(0) @map("sort_order")
  isActive          Boolean  @default(true) @map("is_active")
  isFeatured        Boolean  @default(false) @map("is_featured")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Relations
  parent            PlatformCategory?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children          PlatformCategory[] @relation("CategoryHierarchy")
  listingCategories DirectoryListingCategory[]

  @@map("platform_categories")
}

model DirectoryListingCategory {
  listingId  String   @map("listing_id")
  categoryId String   @map("category_id")
  isPrimary  Boolean  @default(false) @map("is_primary")
  createdAt  DateTime @default(now()) @map("created_at")

  // Relations
  listing  DirectoryListings @relation(fields: [listingId], references: [id], onDelete: Cascade)
  category PlatformCategory  @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([listingId, categoryId])
  @@map("directory_listing_categories")
}

// Update DirectoryListings model
model DirectoryListings {
  // ... existing fields ...
  
  // Add relation
  categories DirectoryListingCategory[]
  
  // Deprecate these fields (keep for migration, remove later)
  // primaryCategory     String?   @map("primary_category")
  // secondaryCategories String[]  @map("secondary_categories")
  
  @@map("directory_listings_list")
}
```

---

## Phase 8: Update Frontend

### Update CategoryViewClient

```typescript
// apps/web/src/app/directory/categories/[categorySlug]/CategoryViewClient.tsx

useEffect(() => {
  const fetchData = async () => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    
    // Decode slug
    const decodedSlug = decodeURIComponent(categorySlug);

    // 1. Fetch category info by slug
    const categoriesRes = await fetch(`${apiBaseUrl}/api/directory/mv/categories`);
    if (categoriesRes.ok) {
      const catData = await categoriesRes.json();
      const currentCat = catData.categories?.find((c: any) => c.slug === decodedSlug);
      setCategory(currentCat || null);
      
      // 2. Fetch stores using category ID (preferred) or slug (fallback)
      const params = new URLSearchParams();
      if (currentCat?.id) {
        params.set('categoryId', currentCat.id);  // ✅ Use ID!
      } else {
        params.set('categorySlug', decodedSlug);  // Fallback
      }
      params.set('sort', 'rating');
      params.set('limit', '100');

      const storesRes = await fetch(
        `${apiBaseUrl}/api/directory/mv/search?${params}`
      );

      if (storesRes.ok) {
        const storesData = await storesRes.json();
        setData({
          listings: storesData.listings || [],
          pagination: storesData.pagination,
        });
      }
    }
  };

  fetchData();
}, [categorySlug]);
```

---

## Benefits Summary

✅ **Single Source of Truth:** Google taxonomy ID drives everything  
✅ **1:1 Alignment:** Each category = exactly one Google ID  
✅ **No Duplication:** Category defined once, used everywhere  
✅ **Hierarchy Support:** Parent/child relationships  
✅ **Flexible:** Unlimited categories per listing  
✅ **Maintainable:** Update category once, reflects everywhere  
✅ **Google Sync Ready:** Perfect compliance  
✅ **Scalable:** Add categories without schema changes  

---

## Migration Checklist

### Staging Environment
- [ ] Run Phase 1: Create tables
- [ ] Run Phase 2: Seed categories
- [ ] Run Phase 3: Migrate data
- [ ] Run Phase 4: Update MVs
- [ ] Run Phase 5: Update triggers
- [ ] Deploy API changes (Phase 6)
- [ ] Update Prisma schema (Phase 7)
- [ ] Deploy frontend changes (Phase 8)
- [ ] Test all endpoints
- [ ] Verify Google sync still works

### Production Environment
- [ ] Backup database
- [ ] Run all migrations in order
- [ ] Deploy API
- [ ] Deploy frontend
- [ ] Monitor for 24 hours
- [ ] Deprecate old columns

---

## Rollback Plan

If issues arise:

```sql
-- Revert to old system
DROP TRIGGER IF EXISTS trigger_platform_category_refresh ON platform_categories;
DROP TRIGGER IF EXISTS trigger_listing_category_assignment_refresh ON directory_listing_categories;

-- Restore old materialized views
-- (Keep backup of old SQL)

-- Keep new tables for future retry
-- Don't drop platform_categories or directory_listing_categories
```

---

## Timeline

- **Week 1:** Phases 1-3 (Schema + Data Migration)
- **Week 2:** Phases 4-5 (MVs + Triggers)
- **Week 3:** Phases 6-8 (API + Frontend)
- **Week 4:** Testing + Production Deployment

---

**Ready to start implementation?** 🚀
