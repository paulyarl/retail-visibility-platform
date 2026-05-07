-- ============================================================================
-- FIND WHERE GBP CATEGORIES CONNECT TO TENANTS
-- ============================================================================

-- Check gbp_listing_categories - this likely connects tenants to GBP categories
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'gbp_listing_categories'
ORDER BY ordinal_position;

-- Sample data from gbp_listing_categories
SELECT *
FROM gbp_listing_categories
LIMIT 5;

-- Check if it has tenant_id
SELECT 
  'Tenant ID Check' as check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gbp_listing_categories' 
    AND column_name = 'tenant_id'
  ) as has_tenant_id;

-- Check for primary/secondary flags
SELECT 
  'Primary/Secondary Flags Check' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'gbp_listing_categories' 
  AND (column_name ILIKE '%primary%' OR column_name ILIKE '%secondary%')
ORDER BY column_name;

-- Also check tenants table for any GBP-related columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenants' 
  AND (column_name ILIKE '%gbp%' OR column_name ILIKE '%google%' OR column_name ILIKE '%business%')
ORDER BY column_name;
