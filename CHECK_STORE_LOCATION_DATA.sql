-- Check if directory_listings_list has location data
SELECT 
  business_name,
  city,
  state,
  latitude,
  longitude,
  CASE 
    WHEN latitude IS NULL OR longitude IS NULL THEN 'Missing location'
    ELSE 'Has location'
  END as location_status
FROM directory_listings_list 
WHERE is_published = true
  AND tenant_id IN (
    SELECT DISTINCT tenant_id 
    FROM storefront_products 
    WHERE is_actively_featured = true
  )
ORDER BY business_name
LIMIT 10;

-- Check how many stores have location data
SELECT 
  COUNT(*) as total_published_stores,
  COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as stores_with_location,
  COUNT(CASE WHEN latitude IS NULL OR longitude IS NULL THEN 1 END) as stores_without_location
FROM directory_listings_list 
WHERE is_published = true;
