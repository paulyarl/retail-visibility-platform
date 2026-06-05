-- Check platform directory categories table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name LIKE '%directory%' AND table_name LIKE '%categor%'
ORDER BY table_name, ordinal_position;

-- Check tenant directory settings
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name LIKE '%directory%' AND table_name LIKE '%setting%'
ORDER BY table_name, ordinal_position;

-- Look for tables that might contain platform categories
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name ILIKE '%directory%' OR table_name ILIKE '%categor%')
ORDER BY table_name;
