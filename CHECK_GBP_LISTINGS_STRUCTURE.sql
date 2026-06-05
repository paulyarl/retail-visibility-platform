-- Check the actual structure of directory_gbp_listings
-- This will show us what columns actually exist

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'directory_gbp_listings'
ORDER BY ordinal_position;

-- Also check a few sample rows to understand the data structure
SELECT *
FROM directory_gbp_listings
LIMIT 3;

-- Check what category-related columns exist
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'directory_gbp_listings'
  AND (column_name ILIKE '%category%' OR column_name ILIKE '%gbp%')
ORDER BY column_name;
