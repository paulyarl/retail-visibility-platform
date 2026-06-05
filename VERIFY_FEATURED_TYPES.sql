-- ===================================================================
-- FEATURED PRODUCTS DUAL SYSTEM - VERIFICATION SCRIPT
-- Run this to confirm the migrations were successful
-- ===================================================================

-- 1. Verify featured_type column exists in inventory_items
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'inventory_items' 
  AND column_name = 'featured_type';

-- 2. Check existing featured products have been migrated to store_selection
SELECT COUNT(*) as migrated_featured_products,
       featured_type
FROM inventory_items 
WHERE is_featured = true 
GROUP BY featured_type;

-- 3. Verify materialized view includes featured_type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'storefront_products' 
  AND column_name = 'featured_type';

-- 4. Test the materialized view has data with featured types
SELECT COUNT(*) as total_mv_products,
       COUNT(*) FILTER (WHERE featured_type = 'store_selection') as store_selection,
       COUNT(*) FILTER (WHERE featured_type = 'new_arrival') as new_arrival,
       COUNT(*) FILTER (WHERE featured_type = 'seasonal') as seasonal,
       COUNT(*) FILTER (WHERE featured_type = 'sale') as sale,
       COUNT(*) FILTER (WHERE featured_type = 'staff_pick') as staff_pick
FROM storefront_products;

-- 5. Verify indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'storefront_products' 
  AND (indexname LIKE '%featured%' OR indexname LIKE '%type%');

-- 6. Test API endpoint compatibility - sample query
SELECT tenant_id, 
       featured_type,
       COUNT(*) as count,
       featured_priority,
       featured_at
FROM storefront_products 
WHERE is_actively_featured = true
  AND featured_type = 'store_selection'
GROUP BY tenant_id, featured_type, featured_priority, featured_at
ORDER BY featured_priority DESC, featured_at DESC
LIMIT 10;

-- 7. Verify check constraint exists
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'inventory_items'::regclass 
  AND conname = 'check_featured_type';

-- ===================================================================
-- EXPECTED RESULTS:
-- 1. featured_type column should exist with TEXT type and default 'store_selection'
-- 2. Existing featured products should show as 'store_selection' type
-- 3. storefront_products should have featured_type column
-- 4. Should see counts by featured_type (mostly store_selection initially)
-- 5. Should see indexes like idx_storefront_products_featured_type
-- 6. Should see sample featured products with proper ordering
-- 7. Should see check constraint for valid featured types
-- ===================================================================
