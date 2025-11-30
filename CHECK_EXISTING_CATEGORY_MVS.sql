-- ============================================================================
-- CHECK FOR EXISTING CATEGORY MATERIALIZED VIEWS
-- ============================================================================

-- Find all materialized views related to categories
SELECT 
  schemaname,
  matviewname,
  definition,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews 
WHERE matviewname ILIKE '%category%'
   OR matviewname ILIKE '%gbp%'
   OR matviewname ILIKE '%product%'
   OR matviewname ILIKE '%directory%'
ORDER BY matviewname;

-- Check regular views too
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views 
WHERE viewname ILIKE '%category%'
   OR viewname ILIKE '%gbp%'
   OR viewname ILIKE '%product%'
   OR viewname ILIKE '%directory%'
ORDER BY viewname;

-- Look for tables that might be category-related
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name ILIKE '%category%'
   OR table_name ILIKE '%gbp%'
   OR table_name ILIKE '%google%'
   OR table_name ILIKE '%product%'
   AND table_schema = 'public'
ORDER BY table_name;

-- Check if there are any existing category count tables/mvs
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name ILIKE '%category_count%'
   OR table_name ILIKE '%category_summary%'
   OR table_name ILIKE '%product_count%'
ORDER BY table_name, ordinal_position;

-- Sample existing category data structure
SELECT 
  'platform_categories' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_records,
  COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as root_categories,
  MAX(level) as max_level
FROM platform_categories;

SELECT 
  'inventory_items' as table_name,
  COUNT(*) as total_items,
  COUNT(CASE WHEN tenant_category_id IS NOT NULL THEN 1 END) as items_with_tenant_category,
  COUNT(CASE WHEN category_id IS NOT NULL THEN 1 END) as items_with_product_category,
  COUNT(DISTINCT tenant_category_id) as unique_tenant_categories,
  COUNT(DISTINCT category_id) as unique_product_categories
FROM inventory_items
WHERE item_status = 'active';

-- Check for tenant GBP category fields
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenants'
  AND (column_name ILIKE '%gbp%' OR column_name ILIKE '%google%' OR column_name ILIKE '%category%')
ORDER BY column_name;
