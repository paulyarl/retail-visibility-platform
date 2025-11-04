-- Enable FF_TENANT_GBP_HOURS_SYNC at platform level

UPDATE "platform_feature_flags" 
SET "enabled" = true 
WHERE "flag" = 'FF_TENANT_GBP_HOURS_SYNC';
