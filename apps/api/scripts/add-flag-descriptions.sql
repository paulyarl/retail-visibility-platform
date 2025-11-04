-- Add descriptions to platform feature flags

UPDATE "platform_feature_flags" 
SET "description" = 'Enforces strict alignment between product feeds and Google Merchant Center requirements' 
WHERE "flag" = 'FF_FEED_ALIGNMENT_ENFORCE';

UPDATE "platform_feature_flags" 
SET "description" = 'Tracks and reports feed coverage metrics for product catalog completeness' 
WHERE "flag" = 'FF_FEED_COVERAGE';

UPDATE "platform_feature_flags" 
SET "description" = 'Enables SKU scanning feature with USB scanner, camera, and manual barcode entry for product management' 
WHERE "flag" = 'FF_SKU_SCANNING';

UPDATE "platform_feature_flags" 
SET "description" = 'Syncs tenant product categories with Google Business Profile category taxonomy' 
WHERE "flag" = 'FF_TENANT_GBP_CATEGORY_SYNC';

UPDATE "platform_feature_flags" 
SET "description" = 'Syncs tenant business hours with Google Business Profile operating hours' 
WHERE "flag" = 'FF_TENANT_GBP_HOURS_SYNC';
