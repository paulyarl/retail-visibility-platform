-- Ensure FF_TENANT_GBP_HOURS_SYNC flag exists with description

INSERT INTO "platform_feature_flags" ("id", "flag", "enabled", "description", "rollout", "allow_tenant_override", "updated_at")
VALUES (
  gen_random_uuid()::text,
  'FF_TENANT_GBP_HOURS_SYNC',
  false,
  'Syncs tenant business hours with Google Business Profile operating hours',
  'Pilot - staged rollout',
  true,
  NOW()
)
ON CONFLICT ("flag") DO UPDATE SET
  "description" = EXCLUDED."description",
  "allow_tenant_override" = EXCLUDED."allow_tenant_override";
