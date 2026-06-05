-- Check what category slugs are actually stored in the database
-- This will help us understand why GBP category searches aren't returning results

SELECT DISTINCT 
  category_name,
  category_slug,
  COUNT(*) as store_count
FROM storefront_category_counts 
WHERE category_name IS NOT NULL 
  AND category_slug IS NOT NULL
GROUP BY category_name, category_slug
ORDER BY store_count DESC
LIMIT 20;

-- Also check the directory_listings materialized view
SELECT DISTINCT 
  primary_category,
  category_slug,
  COUNT(*) as store_count
FROM directory_listings_mv
WHERE primary_category IS NOT NULL 
  AND category_slug IS NOT NULL
GROUP BY primary_category, category_slug
ORDER BY store_count DESC
LIMIT 20;

-- Check if "international" or "shoe-store" exist
SELECT 
  category_name,
  category_slug,
  COUNT(*) as store_count
FROM storefront_category_counts 
WHERE category_slug ILIKE '%international%' 
   OR category_slug ILIKE '%shoe%'
GROUP BY category_name, category_slug
ORDER BY store_count DESC;
