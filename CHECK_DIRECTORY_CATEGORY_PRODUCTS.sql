-- Check if directory_category_products MV exists

-- Check if it exists as a materialized view
SELECT 
  schemaname,
  matviewname,
  matviewowner,
  ispopulated,
  definition
FROM pg_matviews
WHERE matviewname = 'directory_category_products';

-- Check if it exists as a regular table
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'directory_category_products';

-- If it exists, check its structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'directory_category_products'
ORDER BY ordinal_position;
