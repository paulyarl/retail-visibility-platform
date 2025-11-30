-- Check the exact schema for directory_listings_list
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'directory_listings_list' 
ORDER BY ordinal_position;

-- Check a sample record to see the ID format
SELECT * FROM directory_listings_list LIMIT 1;
