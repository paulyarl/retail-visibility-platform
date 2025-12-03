# Directory Category Materialized Views Migration

## Problem
The `/api/admin/platform-categories` endpoint is failing with:
```
error: relation "directory_category_stats" does not exist
```

## Solution
Run the SQL migration to create both required materialized views:
1. `directory_category_listings` - Flattened view of listings per category
2. `directory_category_stats` - Aggregated statistics per category

## Prerequisites
These tables must exist:
- `platform_categories` - Master category table
- `directory_listing_categories` - Junction table (listing ↔ category)
- `directory_listings_list` - Directory listings
- `tenants` - Tenant/location data

## How to Run

### Option 1: Using Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Open the file: `CREATE_DIRECTORY_CATEGORY_MVS.sql`
3. Copy and paste the entire contents
4. Click "Run"

### Option 2: Using psql Command Line
```bash
psql $DATABASE_URL -f CREATE_DIRECTORY_CATEGORY_MVS.sql
```

### Option 3: Using Doppler (Local Development)
```bash
doppler run -- psql $DATABASE_URL -f CREATE_DIRECTORY_CATEGORY_MVS.sql
```

## What This Creates

### Materialized View 1: directory_category_listings
- One row per listing per category (denormalized for performance)
- Includes all listing details + category information
- 11 indexes for fast filtering and sorting
- Used for category page queries

### Materialized View 2: directory_category_stats
- Aggregated statistics per category
- Store counts, product metrics, ratings, locations
- 4 indexes for fast lookups
- Used for admin dashboard and category overview

### Helper Functions
- `refresh_directory_category_listings()` - Refresh listings view
- `refresh_directory_category_stats()` - Refresh stats view
- `refresh_directory_category_views()` - Refresh both views in order

## Verification

After running, check that views were created:
```sql
SELECT 
  schemaname,
  matviewname,
  hasindexes,
  ispopulated
FROM pg_matviews
WHERE matviewname IN ('directory_category_listings', 'directory_category_stats')
ORDER BY matviewname;
```

Check row counts:
```sql
SELECT 
  'directory_category_listings' as view_name,
  COUNT(*) as row_count
FROM directory_category_listings
UNION ALL
SELECT 
  'directory_category_stats' as view_name,
  COUNT(*) as row_count
FROM directory_category_stats;
```

## Refreshing the Views

These are materialized views, so they need to be refreshed periodically to reflect new data:

```sql
-- Refresh both views (recommended)
SELECT refresh_directory_category_views();

-- Or refresh individually
SELECT refresh_directory_category_listings();
SELECT refresh_directory_category_stats();
```

## Expected Result

After running the migration:
- ✅ `/api/admin/platform-categories` endpoint will work
- ✅ Category statistics will be available
- ✅ Directory category pages will load faster
- ✅ Admin dashboard will show category metrics

## Troubleshooting

### Error: "relation does not exist"
Check if prerequisite tables exist:
```sql
SELECT tablename 
FROM pg_tables 
WHERE tablename IN (
  'platform_categories',
  'directory_listing_categories',
  'directory_listings_list',
  'tenants'
);
```

### Error: "column does not exist"
The schema may have changed. Check the actual column names in the tables and update the SQL accordingly.

### Views are empty
This is normal if you don't have any:
- Categories in `platform_categories`
- Listings in `directory_listings_list`
- Category assignments in `directory_listing_categories`

The views will populate as you add data.
