-- Get ALL column names from directory_listings_list
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'directory_listings_list' 
    AND table_schema = 'public'
ORDER BY ordinal_position;
