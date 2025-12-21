-- Check what columns actually exist in directory_category_listings MV

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'directory_category_listings'
ORDER BY ordinal_position;
