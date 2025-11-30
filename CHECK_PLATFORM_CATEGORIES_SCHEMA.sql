-- Check platform_categories table schema
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'platform_categories' 
ORDER BY ordinal_position;

-- Sample data from platform_categories
SELECT * FROM platform_categories LIMIT 5;

-- Check tenant_categories_list for tenant-specific category assignments
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'tenant_categories_list' 
ORDER BY ordinal_position;

-- Sample data from tenant_categories_list
SELECT * FROM tenant_categories_list WHERE tenant_id = 't-zjd1o7sm' LIMIT 5;
