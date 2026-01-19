-- Check what columns actually exist in the materialized view
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'storefront_products' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if the view exists and what it looks like
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'storefront_products' 
  AND table_schema = 'public'
  AND (column_name LIKE '%category%' OR column_name LIKE '%featured%')
ORDER BY column_name;
