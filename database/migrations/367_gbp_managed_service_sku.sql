-- Migration 367: GBP Managed Service SKU + approval mode
--
-- Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §2 (Q2/Q6/Q10)
-- Sprint: docs/LocalBiz/GBP_DFY_SPRINT_PLAN.md D4
--
-- Registers `gbp_managed_service` inside the gbp_management capability
-- module — NOT a platform_service_* key (the Services tab is one-time SKUs;
-- DFY matches the Features-tab gbp_* SKUs). Purchasing it also issues
-- `gbp_management_flexible` as a zero-cost companion via FEATURE_COMPANIONS
-- in bsaas-purchases.ts (Q10).
--
-- tenant_gbp_options_settings += gbp_approval_mode — Q3:
--   'auto_publish'  (default) platform publishes without merchant review
--   'approve_posts' posts queue for merchant approval
--   'approve_all'   posts AND review replies queue for approval

INSERT INTO features_list (key, name, description, is_active) VALUES
  ('gbp_managed_service', 'GBP Managed Service', 'Platform-operated (DFY) Google Business Profile management — posts, reviews, media, NAP, and verification handled by VisibleShelf', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO capability_features_list (capability_type_id, feature_id, is_active)
SELECT ct.id, f.id, true
FROM capability_type_list ct, features_list f
WHERE ct.key = 'gbp_management'
  AND f.key = 'gbp_managed_service'
ON CONFLICT DO NOTHING;

INSERT INTO bsaas_catalog (
  feature_key,
  marketing_name,
  description,
  price_cents,
  billing_cycle,
  trial_days,
  trial_eligible,
  is_active,
  sort_order
) VALUES (
  'gbp_managed_service',
  'GBP Managed Service',
  'Done-for-you Google Business Profile management. We handle posts, review responses, photos, business info, and verification — you approve (or auto-publish) from your dashboard.',
  9900,
  'monthly',
  14,
  true,
  true,
  15
)
ON CONFLICT DO NOTHING;

ALTER TABLE tenant_gbp_options_settings
  ADD COLUMN IF NOT EXISTS gbp_approval_mode VARCHAR(16) NOT NULL DEFAULT 'auto_publish';
