-- ============================================================================
-- CHECK STOREFRONT_CATEGORY_COUNTS MV STRUCTURE
-- ============================================================================

-- Get the structure of the existing MV
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'storefront_category_counts'
ORDER BY ordinal_position;

-- Sample data from the existing MV
SELECT *
FROM storefront_category_counts
WHERE product_count > 0
ORDER BY product_count DESC
LIMIT 10;

-- Check how many tenants use this MV
SELECT 
  tenant_id,
  COUNT(*) as category_count,
  SUM(product_count) as total_products
FROM storefront_category_counts
GROUP BY tenant_id
ORDER BY total_products DESC;

-- Check if this MV handles multiple category types
SELECT DISTINCT
  'Check category types in MV' as analysis,
  COUNT(*) as total_records,
  COUNT(CASE WHEN category_id LIKE 'cat_%' THEN 1 END) as platform_categories,
  COUNT(CASE WHEN category_id NOT LIKE 'cat_%' THEN 1 END) as other_categories
FROM storefront_category_counts;

-- Look for GBP category information in tenants table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenants'
  AND (column_name ILIKE '%google%' OR column_name ILIKE '%gbp%' OR column_name ILIKE '%business%')
ORDER BY column_name;

-- Check tenant_category table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenant_categories'
ORDER BY column_name;
