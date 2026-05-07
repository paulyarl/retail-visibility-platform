-- Check what type of objects these are
SELECT 
  schemaname,
  tablename,
  tableowner,
  tablespace,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables 
WHERE tablename IN ('directory_category_listings', 'directory_listings_list', 'inventory_items', 'platform_categories')
ORDER BY tablename;

-- Check for materialized views
SELECT 
  schemaname,
  matviewname,
  matviewowner
FROM pg_matviews 
WHERE matviewname LIKE '%directory%'
ORDER BY matviewname;
