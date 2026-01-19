-- Check if directory_category table has the category data
SELECT 
  id,
  name,
  slug,
  "googleCategoryId",
  "tenantId"
FROM directory_category 
WHERE id LIKE 'tid-m8ijkrnk_%'
ORDER BY name;

-- Check if any categories exist for this tenant
SELECT 
  COUNT(*) as total_categories,
  COUNT(*) FILTER (WHERE "tenantId" = 'tid-m8ijkrnk') as tenant_categories
FROM directory_category;

-- Check sample of all categories
SELECT 
  id,
  name,
  slug,
  "tenantId"
FROM directory_category 
ORDER BY "tenantId", name
LIMIT 10;
