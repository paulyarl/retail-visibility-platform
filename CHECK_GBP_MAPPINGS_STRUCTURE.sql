-- ============================================================================
-- CHECK GBP_CATEGORY_MAPPINGS TABLE STRUCTURE
-- ============================================================================

-- Check the actual structure of gbp_category_mappings
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'gbp_category_mappings'
ORDER BY ordinal_position;

-- Check if the table exists at all
SELECT 
  'Table exists check' as check_type,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'gbp_category_mappings' 
    AND table_schema = 'public'
  ) as table_exists;

-- Sample data to understand the structure
SELECT *
FROM gbp_category_mappings
LIMIT 5;

-- Check what GBP-related tables actually exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name ILIKE '%gbp%'
  AND table_schema = 'public'
ORDER BY table_name;
