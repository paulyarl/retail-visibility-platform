-- Create gbp_hours flag (the actual flag name used by the routes)

INSERT INTO "platform_feature_flags" ("id", "flag", "enabled", "description", "rollout", "allow_tenant_override", "updated_at")
VALUES (
  gen_random_uuid()::text,
  'gbp_hours',
  true,
  'Syncs tenant business hours with Google Business Profile operating hours',
  'Enabled for pilot tenants',
  true,
  NOW()
)
ON CONFLICT ("flag") DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "description" = EXCLUDED."description",
  "allow_tenant_override" = EXCLUDED."allow_tenant_override";

-- Also create tenant flag for the specific tenant
INSERT INTO "tenant_feature_flags" ("id", "tenant_id", "flag", "enabled", "description", "updated_at")
VALUES (
  gen_random_uuid()::text,
  'chain_location_1762183000976_0',
  'gbp_hours',
  true,
  'Business hours sync enabled',
  NOW()
)
ON CONFLICT ("tenant_id", "flag") DO UPDATE SET
  "enabled" = EXCLUDED."enabled";
