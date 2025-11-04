-- Delete the non-standard gbp_hours flags

DELETE FROM "tenant_feature_flags" WHERE "flag" = 'gbp_hours';
DELETE FROM "platform_feature_flags" WHERE "flag" = 'gbp_hours';
