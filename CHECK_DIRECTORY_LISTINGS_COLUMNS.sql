-- Check actual column names in directory_listings_list
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'directory_listings_list' 
    AND table_schema = 'public'
    AND (column_name LIKE '%tenant%' OR column_name LIKE '%exist%' OR column_name LIKE '%visible%')
ORDER BY column_name;

-- Show first few rows to understand the structure
SELECT *
FROM directory_listings_list 
LIMIT 3;
