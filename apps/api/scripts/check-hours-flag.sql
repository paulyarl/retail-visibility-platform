-- Check FF_TENANT_GBP_HOURS_SYNC flag status

SELECT flag, enabled, allow_tenant_override, description 
FROM "platform_feature_flags" 
WHERE flag = 'FF_TENANT_GBP_HOURS_SYNC';
