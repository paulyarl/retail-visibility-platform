-- ============================================================================
-- CHECK ACTUAL STOREFRONT_CATEGORY_COUNTS MV STRUCTURE
-- ============================================================================

-- Get all columns in the MV
SELECT 
  'MV All Columns' as check_type,
  column_name,
  data_type,
  is_nullable,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'storefront_category_counts' 
ORDER BY ordinal_position;

-- Sample data from MV
SELECT *
FROM storefront_category_counts 
WHERE tenant_id = 't-zjd1o7sm'
LIMIT 3;

-- Check if this is the old MV or new 3-category MV
SELECT 
  'MV Version Check' as check_type,
  COUNT(*) as total_rows,
  COUNT(DISTINCT tenant_id) as unique_tenants,
  MIN(created_at) as earliest_created,
  MAX(created_at) as latest_created
FROM storefront_category_counts;
