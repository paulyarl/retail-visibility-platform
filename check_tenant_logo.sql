-- Check if tenant tid-m8ijkrnk has a logo_url
SELECT 
  id,
  name,
  slug,
  logo_url,
  CASE 
    WHEN logo_url IS NOT NULL AND logo_url != '' THEN '✅ Logo exists'
    ELSE '❌ No logo'
  END as logo_status,
  created_at
FROM tenants
WHERE id = 'tid-m8ijkrnk';

-- Also check tenant_business_profiles_list for logo
SELECT 
  tenant_id,
  business_name,
  logo_url,
  CASE 
    WHEN logo_url IS NOT NULL AND logo_url != '' THEN '✅ Logo exists'
    ELSE '❌ No logo'
  END as logo_status
FROM tenant_business_profiles_list
WHERE tenant_id = 'tid-m8ijkrnk';
