-- ============================================================================
-- CHECK 3-CATEGORY MV DATA FOR TENANT
-- ============================================================================

-- Check if the storefront_category_counts MV has category_type data
SELECT 
  'MV Category Type Check' as check_type,
  category_type,
  is_primary,
  COUNT(*) as count,
  SUM(product_count) as total_products,
  STRING_AGG(DISTINCT name, ', ' ORDER BY name) as sample_categories
FROM storefront_category_counts 
WHERE tenant_id = 't-zjd1o7sm'
GROUP BY category_type, is_primary
ORDER BY category_type, is_primary DESC;

-- Sample data with category types
SELECT 
  'Sample MV Data' as check_type,
  id,
  name,
  slug,
  category_type,
  is_primary,
  product_count,
  tenant_id
FROM storefront_category_counts 
WHERE tenant_id = 't-zjd1o7sm'
ORDER BY category_type, is_primary DESC, name
LIMIT 10;

-- Check if category-counts utility is querying the right MV
SELECT 
  'MV Structure Check' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'storefront_category_counts' 
  AND column_name IN ('category_type', 'is_primary', 'tenant_id')
ORDER BY column_name;
