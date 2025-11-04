-- Check if business hours are saved for the tenant

SELECT 
  tenant_id,
  timezone,
  periods,
  created_at,
  updated_at
FROM "business_hours"
WHERE tenant_id = 'chain_location_1762183000976_0';
