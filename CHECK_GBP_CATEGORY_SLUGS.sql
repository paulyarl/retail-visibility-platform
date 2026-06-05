-- Check GBP category names and their generated slugs
-- This will show us what categories exist and what their slugs should be

SELECT 
  gbp_category_name,
  COUNT(*) as store_count,
  -- Generate the slug using the same logic as our slugify function
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(gbp_category_name, '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '')) as expected_slug
FROM directory_gbp_stats
WHERE gbp_category_name IS NOT NULL
  AND store_count > 0
GROUP BY gbp_category_name
ORDER BY store_count DESC
LIMIT 20;

-- Check if "International" category exists
SELECT 
  gbp_category_name,
  COUNT(*) as store_count,
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(gbp_category_name, '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '')) as expected_slug
FROM directory_gbp_stats
WHERE gbp_category_name ILIKE '%international%'
GROUP BY gbp_category_name, store_count
ORDER BY store_count DESC;

-- Check if "Shoe store" category exists  
SELECT 
  gbp_category_name,
  COUNT(*) as store_count,
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(gbp_category_name, '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '')) as expected_slug
FROM directory_gbp_stats
WHERE gbp_category_name ILIKE '%shoe%'
GROUP BY gbp_category_name, store_count
ORDER BY store_count DESC;
