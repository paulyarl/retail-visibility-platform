-- Find which store is in directory_listing_categories but NOT in the MV
SELECT 
  dl.id,
  dl.tenant_id,
  dl.business_name,
  dl.primary_category,
  dl.is_published,
  t.location_status,
  t.directory_visible,
  dlc.category_id,
  pc.name as category_name,
  'Missing from MV' as status
FROM directory_listings_list dl
INNER JOIN directory_listing_categories dlc ON dlc.listing_id = dl.id
INNER JOIN platform_categories pc ON pc.id = dlc.category_id
INNER JOIN tenants t ON t.id = dl.tenant_id
LEFT JOIN directory_category_listings dcl ON dcl.tenant_id = dl.tenant_id
WHERE dlc.is_primary = true
  AND dcl.tenant_id IS NULL;
