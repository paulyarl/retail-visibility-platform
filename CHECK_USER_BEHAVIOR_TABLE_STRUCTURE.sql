-- Check the structure of user_behavior_simple table
-- This will show us what type entity_id column actually is

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_behavior_simple'
ORDER BY ordinal_position;

-- Also check if there are other columns we can use for text entity IDs
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'user_behavior_simple'
  AND (column_name ILIKE '%entity%' OR column_name ILIKE '%id%')
ORDER BY column_name;
