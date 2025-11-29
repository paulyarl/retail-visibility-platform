# Directory Google Taxonomy Alignment Plan

**Date:** 2024-11-28  
**Status:** Planning  
**Priority:** HIGH - Foundation for platform maturity

---

## Problem Statement

Currently, the directory system uses **ad-hoc text-based categories** instead of the platform's proper **Google taxonomy alignment system**. This creates:

- ❌ Inconsistent category data across the platform
- ❌ No Google sync compliance
- ❌ Duplicate category definitions
- ❌ No category hierarchy support
- ❌ Manual category management nightmare

## Current State

### `directory_listings_list` Table
```sql
primary_category: TEXT  -- e.g., "Health & Beauty"
secondary_categories: TEXT[]  -- e.g., ["Frozen Foods", "Dairy & Eggs"]
```

### `tenant_categories_list` Table (Proper Taxonomy)
```sql
id: TEXT (PK)
tenant_id: TEXT
name: TEXT
slug: TEXT
google_category_id: TEXT  -- ✅ Single source of truth!
parent_id: TEXT
is_active: BOOLEAN
```

### Materialized View
- Uses text-based slugs from `primary_category`
- No Google taxonomy integration
- No category hierarchy

---

## Proposed Solution

### Phase 1: Schema Migration

#### 1.1 Add Google Category ID Columns to `directory_listings_list`

```sql
ALTER TABLE directory_listings_list
ADD COLUMN primary_category_id TEXT REFERENCES tenant_categories_list(id),
ADD COLUMN secondary_category_ids TEXT[];

-- Keep old columns temporarily for migration
-- primary_category (deprecated)
-- secondary_categories (deprecated)
```

#### 1.2 Create Migration Script to Populate IDs

```sql
-- Match existing text categories to tenant_categories_list by name/slug
UPDATE directory_listings_list dl
SET primary_category_id = (
  SELECT tc.id 
  FROM tenant_categories_list tc
  WHERE tc.tenant_id = dl.tenant_id
    AND (
      LOWER(tc.name) = LOWER(dl.primary_category)
      OR tc.slug = LOWER(REPLACE(dl.primary_category, ' ', '-'))
    )
  LIMIT 1
);

-- Similar for secondary categories
```

### Phase 2: Update Materialized View

#### 2.1 New View Structure

```sql
CREATE MATERIALIZED VIEW directory_category_listings AS
SELECT 
  dl.id,
  dl.tenant_id,
  dl.business_name,
  dl.slug,
  -- ... other fields ...
  
  -- Category information from taxonomy
  tc.id as category_id,
  tc.name as category_name,
  tc.slug as category_slug,
  tc.google_category_id,
  tc.parent_id as category_parent_id,
  
  -- Flatten both primary and secondary categories
  UNNEST(
    ARRAY[dl.primary_category_id] || 
    COALESCE(dl.secondary_category_ids, ARRAY[]::TEXT[])
  ) as flattened_category_id

FROM directory_listings_list dl
INNER JOIN tenants t ON t.id = dl.tenant_id
INNER JOIN tenant_categories_list tc ON tc.id = flattened_category_id
WHERE dl.is_published = true
  AND tc.is_active = true;
```

#### 2.2 New Stats View

```sql
CREATE MATERIALIZED VIEW directory_category_stats AS
SELECT
  tc.id as category_id,
  tc.name as category_name,
  tc.slug as category_slug,
  tc.google_category_id,
  tc.parent_id,
  
  COUNT(DISTINCT dl.tenant_id) as store_count,
  SUM(dl.product_count) as total_products,
  AVG(dl.rating_avg) as avg_rating,
  -- ... other aggregations ...

FROM tenant_categories_list tc
LEFT JOIN directory_category_listings dcl ON dcl.category_id = tc.id
LEFT JOIN directory_listings_list dl ON dl.id = dcl.id
WHERE tc.is_active = true
GROUP BY tc.id, tc.name, tc.slug, tc.google_category_id, tc.parent_id;
```

### Phase 3: Update API Endpoints

#### 3.1 Search by Google Category ID

```typescript
// OLD: /api/directory/mv/search?category=health-&-beauty
// NEW: /api/directory/mv/search?categoryId=gcid:1234567890

router.get('/search', async (req, res) => {
  const { categoryId, categorySlug } = req.query;
  
  let whereClause = 'tenant_exists = true';
  
  if (categoryId) {
    // Search by Google taxonomy ID (preferred)
    whereClause += ` AND category_id = $1`;
  } else if (categorySlug) {
    // Fallback to slug for backward compatibility
    whereClause += ` AND category_slug = $1`;
  }
  
  // ... rest of query
});
```

#### 3.2 Categories Endpoint Returns Google IDs

```typescript
router.get('/categories', async (req, res) => {
  const result = await pool.query(`
    SELECT 
      category_id,
      category_name,
      category_slug,
      google_category_id,  -- ✅ Include Google ID
      store_count,
      total_products
    FROM directory_category_stats
    ORDER BY store_count DESC
  `);
  
  res.json({ categories: result.rows });
});
```

### Phase 4: Update Frontend

#### 4.1 Use Category IDs in URLs

```typescript
// OLD: /directory/categories/health-&-beauty
// NEW: /directory/categories/cat_abc123xyz

// Or keep slug for SEO but use ID internally:
// /directory/categories/health-beauty (slug for URL)
// But query API with category_id
```

#### 4.2 Category Browser Component

```typescript
// Fetch categories with Google taxonomy info
const categories = await fetch('/api/directory/mv/categories');

// Display with proper hierarchy
categories.forEach(cat => {
  console.log(`${cat.name} (Google ID: ${cat.google_category_id})`);
});
```

---

## Migration Steps

### Step 1: Backup Current Data
```sql
CREATE TABLE directory_listings_list_backup AS 
SELECT * FROM directory_listings_list;
```

### Step 2: Add New Columns (Non-Breaking)
```sql
-- Run schema migration
-- Old columns still work
```

### Step 3: Populate Category IDs
```sql
-- Run data migration script
-- Match text categories to taxonomy
```

### Step 4: Update Materialized Views
```sql
-- Drop old views
DROP MATERIALIZED VIEW directory_category_stats CASCADE;
DROP MATERIALIZED VIEW directory_category_listings CASCADE;

-- Create new views with taxonomy joins
-- (Run new SQL from Phase 2)
```

### Step 5: Update API Endpoints
```typescript
// Deploy new API code
// Support both old (slug) and new (ID) for transition
```

### Step 6: Update Frontend
```typescript
// Update to use category IDs
// Keep slug in URL for SEO
```

### Step 7: Deprecate Old Columns
```sql
-- After everything works:
ALTER TABLE directory_listings_list
DROP COLUMN primary_category,
DROP COLUMN secondary_categories;
```

---

## Benefits

✅ **Single Source of Truth:** Google taxonomy ID drives everything  
✅ **Google Sync Compliance:** Categories align with Google Business Profile  
✅ **Category Hierarchy:** Support parent/child relationships  
✅ **Consistent Data:** No duplicate category definitions  
✅ **Scalable:** Easy to add new categories via taxonomy system  
✅ **Maintainable:** Update category once, reflects everywhere  

---

## Risks & Mitigation

**Risk:** Existing data doesn't match taxonomy  
**Mitigation:** Create missing categories during migration, manual review

**Risk:** Breaking changes to API  
**Mitigation:** Support both slug and ID during transition period

**Risk:** Performance impact from joins  
**Mitigation:** Materialized views pre-compute joins, still fast

---

## Timeline

- **Week 1:** Schema migration + data population
- **Week 2:** Update materialized views + API
- **Week 3:** Update frontend + testing
- **Week 4:** Deprecate old columns + cleanup

---

## Next Steps

1. **Review this plan** with team
2. **Create test categories** in `tenant_categories_list`
3. **Run migration in staging** first
4. **Verify Google sync** still works
5. **Deploy to production**

---

## Questions to Answer

1. Do all tenants have categories in `tenant_categories_list`?
2. What happens if a category doesn't have a Google ID yet?
3. Should we support multiple Google IDs per category?
4. How do we handle category hierarchy in the directory?
5. What's the fallback if category lookup fails?
