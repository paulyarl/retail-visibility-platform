-- Check what directory listings exist for t-rerko4xw
SELECT 
  'Directory Listings for t-rerko4xw' as debug_type,
  dcl.category_slug,
  dcl.category_id,
  pc.name as category_name,
  pc.is_active
FROM directory_category_listings dcl
JOIN platform_categories pc ON pc.id = dcl.category_id
WHERE dcl.tenant_id = 't-rerko4xw'
ORDER BY category_slug;

-- Check what tenants have directory listings
SELECT 
  'Tenants with Directory Listings' as debug_type,
  dcl.tenant_id,
  t.name as tenant_name,
  COUNT(*) as category_count
FROM directory_category_listings dcl
JOIN tenants t ON t.id = dcl.tenant_id
GROUP BY dcl.tenant_id, t.name
ORDER BY category_count DESC;

-- Check all tenants and their status
SELECT 
  'All Tenants Status' as debug_type,
  id,
  name,
  location_status,
  directory_visible,
  subscription_tier
FROM tenants
ORDER BY name;
