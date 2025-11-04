-- Verify FF_TENANT_GBP_HOURS_SYNC flag configuration

SELECT 'Platform Flag:' as type, flag, enabled, allow_tenant_override, description 
FROM "platform_feature_flags" 
WHERE flag = 'FF_TENANT_GBP_HOURS_SYNC'
UNION ALL
SELECT 'Tenant Flag:' as type, flag, enabled, NULL as allow_tenant_override, description 
FROM "tenant_feature_flags" 
WHERE flag = 'FF_TENANT_GBP_HOURS_SYNC' AND tenant_id = 'chain_location_1762183000976_0';
