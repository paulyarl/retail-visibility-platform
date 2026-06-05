-- Check what's actually in the GBP listings materialized view
-- This is where GBP category data should be stored

-- Test 1: Look for any Shoe store data in GBP listings
SELECT 'GBP Shoe store by name' as test_type, COUNT(*) as results_found
FROM directory_gbp_listings dgl
WHERE dgl.primary_category = 'Shoe store'
  AND dgl.tenant_exists = true
  AND dgl.is_active_location = true
  AND dgl.is_directory_visible = true;

-- Test 2: Check what categories actually exist in GBP listings
SELECT 'Sample GBP categories' as test_type,
       dgl.primary_category,
       dgl.category_slug,
       COUNT(*) as store_count
FROM directory_gbp_listings dgl
WHERE dgl.tenant_exists = true
  AND dgl.is_active_location = true
  AND dgl.is_directory_visible = true
  AND dgl.primary_category IS NOT NULL
GROUP BY dgl.primary_category, dgl.category_slug
ORDER BY store_count DESC
LIMIT 10;

-- Test 3: Search for Electronics store in GBP listings
SELECT 'GBP Electronics store by name' as test_type, COUNT(*) as results_found
FROM directory_gbp_listings dgl
WHERE dgl.primary_category = 'Electronics store'
  AND dgl.tenant_exists = true
  AND dgl.is_active_location = true
  AND dgl.is_directory_visible = true;

-- Test 4: Show the structure of GBP listings
SELECT 'GBP listings structure' as test_type,
       column_name,
       data_type
FROM information_schema.columns 
WHERE table_name = 'directory_gbp_listings'
  AND column_name IN ('primary_category', 'category_slug', 'business_name', 'tenant_exists')
ORDER BY column_name;
