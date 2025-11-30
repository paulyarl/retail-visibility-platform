-- Check the definition of the storefront_category_counts materialized view
-- This will show us what underlying tables we need to update

SELECT 
  definition
FROM pg_matviews 
WHERE matviewname = 'storefront_category_counts';

-- Also check the source tables that feed into this view
SELECT 
  schemaname,
  tablename,
  tableowner,
  tablespace
FROM pg_tables 
WHERE tablename IN ('directory_listings', 'tenant_categories', 'platform_categories')
ORDER BY tablename;
