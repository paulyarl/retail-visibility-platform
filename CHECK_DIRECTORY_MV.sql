-- ============================================================================
-- CHECK DIRECTORY CATEGORY LISTINGS MATERIALIZED VIEW
-- ============================================================================

-- Check if the MV exists
SELECT 
  'MV Existence Check' as check_type,
  schemaname,
  matviewname,
  definition
FROM pg_matviews 
WHERE matviewname ILIKE '%directory_category_listings%'
ORDER BY matviewname;

-- Check if it has data
SELECT 
  'MV Data Check' as check_type,
  COUNT(*) as row_count,
  COUNT(DISTINCT slug) as unique_stores,
  COUNT(DISTINCT category_name) as unique_categories
FROM directory_category_listings
LIMIT 1;

-- Sample data from the MV
SELECT *
FROM directory_category_listings
LIMIT 3;

-- Check if the related stores query works with a test slug
SELECT 
  'Test Query Check' as check_type,
  COUNT(*) as potential_related_stores
FROM directory_category_listings dcl
WHERE dcl.slug != 'test-store'  -- Using a test slug
  AND dcl.is_published = true
LIMIT 10;
