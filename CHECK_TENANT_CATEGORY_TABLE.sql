-- ============================================================================
-- CHECK TENANT CATEGORY TABLE STRUCTURE
-- ============================================================================

-- Check what tenant category tables actually exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name ILIKE '%tenant_category%'
  AND table_schema = 'public'
ORDER BY table_name;

-- Check the structure of the actual table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'tenant_categories'
ORDER BY ordinal_position;

-- Sample data from the actual table
SELECT *
FROM tenant_categories
LIMIT 5;

-- Check if there's a singular version
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenant_category'
ORDER BY ordinal_position;
