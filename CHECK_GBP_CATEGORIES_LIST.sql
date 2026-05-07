-- ============================================================================
-- CHECK GBP_CATEGORIES_LIST TABLE (THE RIGHT ONE)
-- ============================================================================

-- Check the structure of gbp_categories_list
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'gbp_categories_list'
ORDER BY ordinal_position;

-- Sample data from gbp_categories_list
SELECT *
FROM gbp_categories_list
LIMIT 5;

-- Check if it has tenant_id
SELECT 
  'Tenant ID Check' as check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gbp_categories_list' 
    AND column_name = 'tenant_id'
  ) as has_tenant_id;

-- Check for primary/secondary flags
SELECT 
  'Primary/Secondary Flags Check' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'gbp_categories_list' 
  AND (column_name ILIKE '%primary%' OR column_name ILIKE '%secondary%')
ORDER BY column_name;
