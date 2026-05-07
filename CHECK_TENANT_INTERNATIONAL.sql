-- Check if International Foods exists in tenant_categories_list for t-zjd1o7sm
SELECT * FROM tenant_categories_list 
WHERE tenant_id = 't-zjd1o7sm' AND name ILIKE '%international%';

-- Check all categories for t-zjd1o7sm
SELECT name, slug, sort_order FROM tenant_categories_list 
WHERE tenant_id = 't-zjd1o7sm' 
ORDER BY sort_order;

-- Check platform_categories for International Foods
SELECT * FROM platform_categories 
WHERE name ILIKE '%international%' OR slug ILIKE '%international%';
