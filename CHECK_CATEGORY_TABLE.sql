-- Check what category-related tables actually exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%category%' OR table_name LIKE '%tenant%')
ORDER BY table_name;
