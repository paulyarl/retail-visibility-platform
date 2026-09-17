-- Link features to a capability type (replicates Admin UI "Edit Capability Type" flow)
-- This script:
--   1. Ensures the capability type exists (insert or update)
--   2. Ensures all feature keys exist in features_list (insert missing)
--   3. Wipes old capability_features_list links for this type
--   4. Re-creates links with sort_order
--
-- Usage: set the two variables below, then run the entire script in one transaction.

-- ============================================================
-- CONFIGURATION
-- ============================================================
\set capability_type_key     'product_options'
\set capability_type_name    'Product Options'
-- Comma-separated feature keys, in desired display order:
\set feature_keys            'product_digital,product_physical,product_hybrid,product_flexible,product_enabled,product_disabled,product_variant,product_gallery,product_video,product_layout_classic,product_layout_immersive,product_layout_editorial,product_opt_categories,product_opt_enhanced_seo,product_opt_fulfillment,product_opt_hours_display,product_opt_location_availability,product_opt_location_display,product_opt_map_display,product_opt_qr_codes,product_opt_recently_viewed,product_opt_recommended,product_opt_reviews'

-- ============================================================
-- STEP 1: Upsert capability_type_list
-- ============================================================
INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  :'capability_type_key',
  :'capability_type_name',
  NULL,
  :'capability_type_key',
  true,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name       = EXCLUDED.name,
  updated_at = NOW();

-- ============================================================
-- STEP 2: Ensure every feature key exists in features_list
-- (skip if you already inserted them via another migration)
-- ============================================================
-- This block is idempotent; existing rows are untouched.
-- Uncomment and customise only for keys that are NOT yet in features_list.
--
-- INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
-- VALUES
--   ('my_new_feature', 'My New Feature', 'Does something cool', NULL, true, 0, NOW(), NOW())
-- ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- STEP 3: Delete old capability → feature links
-- ============================================================
DELETE FROM capability_features_list
WHERE capability_type_id = (SELECT id FROM capability_type_list WHERE key = :'capability_type_key');

-- ============================================================
-- STEP 4: Re-create links with sort_order
-- ============================================================
-- We use a CTE to turn the comma-separated list into rows with an ordinality.
WITH feature_keys_ordered AS (
  SELECT
    trim(key) AS key,
    ord       AS sort_order
  FROM unnest(string_to_array(:'feature_keys', ',')) WITH ORDINALITY AS t(key, ord)
)
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
SELECT
  ctl.id,
  fl.id,
  true,
  fko.sort_order,
  NOW(),
  NOW()
FROM feature_keys_ordered fko
JOIN features_list fl ON fl.key = fko.key
JOIN capability_type_list ctl ON ctl.key = :'capability_type_key'
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT
  ctl.key   AS capability_type,
  fl.key    AS feature_key,
  fl.name   AS feature_name,
  cfl.sort_order
FROM capability_features_list cfl
JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
JOIN features_list fl ON fl.id = cfl.feature_id
WHERE ctl.key = :'capability_type_key'
ORDER BY cfl.sort_order;
