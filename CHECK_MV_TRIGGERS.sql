-- Check triggers for both materialized views

-- Check directory_category_listings triggers
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%refresh_mv%' OR trigger_name LIKE '%directory_category%'
ORDER BY event_object_table, trigger_name;

-- Check directory_category_products triggers
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%directory_category%'
ORDER BY event_object_table, trigger_name;

-- Check indexes on directory_category_listings
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'directory_category_listings'
ORDER BY indexname;

-- Check indexes on directory_category_products
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'directory_category_products'
ORDER BY indexname;
