-- Check exact category names for the 4 grocery stores

SELECT 
  dll.business_name,
  dll.primary_category,
  dll.secondary_categories,
  pc.name as assigned_category_name,
  pc.slug as assigned_category_slug,
  dlc.is_primary,
  t.metadata->'gbp_categories'->'primary'->>'name' as gbp_primary_category_name
FROM directory_listings_list dll
JOIN tenants t ON t.id = dll.tenant_id
LEFT JOIN directory_listing_categories dlc ON dlc.listing_id = dll.id
LEFT JOIN platform_categories pc ON pc.id = dlc.category_id
WHERE dll.business_name IN (
  'Goose The Market',
  'Mecca Market',
  'Virsa Indian Grocery Store',
  'ALSUM ORGANICS L.L.C.'
)
ORDER BY dll.business_name, dlc.is_primary DESC;
