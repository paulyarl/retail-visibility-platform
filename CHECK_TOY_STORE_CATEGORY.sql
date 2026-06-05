-- Check if there are any other stores with "Toy Store" category

-- 1. Find all stores with Toy Store as primary category
SELECT 
  'Stores with Toy Store primary category' as check_type,
  dll.tenant_id,
  dll.business_name,
  dll.primary_category,
  dll.is_published
FROM directory_listings_list dll
WHERE dll.primary_category = 'Toy Store'
ORDER BY dll.business_name;

-- 2. Find all stores with Toy Store in secondary categories
SELECT 
  'Stores with Toy Store in secondary categories' as check_type,
  dll.tenant_id,
  dll.business_name,
  dll.primary_category,
  dll.secondary_categories,
  dll.is_published
FROM directory_listings_list dll
WHERE 'Toy Store' = ANY(dll.secondary_categories)
ORDER BY dll.business_name;

-- 3. Check what categories are assigned in junction table for the Toy Store
SELECT 
  'Categories assigned to Visible Shelf Store' as check_type,
  pc.name as category_name,
  pc.slug as category_slug,
  dlc.is_primary
FROM directory_listing_categories dlc
JOIN directory_listings_list dll ON dll.id = dlc.listing_id
JOIN platform_categories pc ON pc.id = dlc.category_id
WHERE dll.business_name LIKE '%Visible%'
ORDER BY dlc.is_primary DESC, pc.name;

-- 4. Count stores by category to see distribution
SELECT 
  dll.primary_category,
  COUNT(*) as store_count
FROM directory_listings_list dll
WHERE dll.is_published = true
GROUP BY dll.primary_category
ORDER BY store_count DESC;
