-- Add product_opt_qr_logo as a separate tier-gated sub-feature under product_options QR group.
-- This mirrors the storefront pattern where qr_logo is independently gated.

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'product_opt_qr_logo',
  'QR Logo Embedding',
  'Embed merchant logo inside product page QR codes',
  NULL,
  true,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at  = NOW();

-- Link it to the product_options capability type (if not already linked)
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
SELECT
  ctl.id,
  fl.id,
  true,
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM capability_features_list WHERE capability_type_id = ctl.id),
  NOW(),
  NOW()
FROM capability_type_list ctl
JOIN features_list fl ON fl.key = 'product_opt_qr_logo'
WHERE ctl.key = 'product_options'
  AND NOT EXISTS (
    SELECT 1 FROM capability_features_list cfl
    WHERE cfl.capability_type_id = ctl.id AND cfl.feature_id = fl.id
  );

-- Enable for all tiers that already have product_opt_qr_codes
INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  tfl.tier_id,
  tfl.capability_type_id,
  'product_opt_qr_logo',
  fl.name,
  true,
  NOW(),
  NOW()
FROM tier_features_list tfl
JOIN features_list fl ON fl.key = 'product_opt_qr_logo'
WHERE tfl.feature_key = 'product_opt_qr_codes'
  AND tfl.is_enabled = true
  AND NOT EXISTS (
    SELECT 1 FROM tier_features_list tfl2
    WHERE tfl2.tier_id = tfl.tier_id
      AND tfl2.capability_type_id = tfl.capability_type_id
      AND tfl2.feature_key = 'product_opt_qr_logo'
  );
