-- ============================================================
-- Storefront Options: Gallery Magazine Feature Key
--
-- Seeds the feature key for the Magazine Gallery display mode
-- within the storefront_options capability type. This enables
-- a magazine/mosaic layout as an alternative to the carousel
-- for both product galleries and directory entry galleries.
--
-- Also adds a BSaaS catalog entry for à la carte purchase by
-- tiers that don't include it natively, and adds the
-- gallery_display_mode column to tenant_storefront_options_settings.
--
-- Prerequisites: features_list, capability_type_list,
--                capability_features_list, tier_features_list,
--                bsaas_catalog, tenant_storefront_options_settings
-- Date: 2026-07-12
-- ============================================================


-- ============================================================
-- STEP 1: Insert gallery_magazine feature key into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('storefront_opt_gallery_magazine', 'Magazine Gallery', 'Magazine-style mosaic gallery display mode — shows all images at once instead of a carousel', 'storefront_options', true, 42, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 2: Link feature key to storefront_options capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'storefront_options';
  v_feature_key          TEXT  := 'storefront_opt_gallery_magazine';
  v_capability_type_id   TEXT;
  v_feature_id           TEXT;
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  IF v_capability_type_id IS NULL THEN
    RAISE NOTICE 'Capability type % not found — skipping capability_features_list linkage', v_capability_type_key;
    RETURN;
  END IF;

  SELECT id INTO v_feature_id FROM features_list WHERE key = v_feature_key;
  IF v_feature_id IS NOT NULL THEN
    INSERT INTO capability_features_list (capability_type_id, feature_id)
    VALUES (v_capability_type_id, v_feature_id)
    ON CONFLICT (capability_type_id, feature_id) DO NOTHING;
    RAISE NOTICE 'Linked feature % to capability type %', v_feature_key, v_capability_type_key;
  ELSE
    RAISE NOTICE 'Feature key % not found in features_list — skipped', v_feature_key;
  END IF;
END $$;


-- ============================================================
-- STEP 3: Enable feature for eligible tiers in tier_features_list
--
-- Per sprint plan:
--   Trial: not available
--   Starter/storefront: not available (carousel only)
--   Commitment: not available
--   E-commerce: not available
--   Omnichannel: included
--   Professional: included
--   Organization: included
--   Enterprise: included
-- ============================================================

INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, capability_type_id, is_enabled)
SELECT gen_random_uuid()::text, stl.id, 'storefront_opt_gallery_magazine', 'Magazine Gallery',
  (SELECT id FROM capability_type_list WHERE key = 'storefront_options'), true
FROM subscription_tiers_list stl
WHERE stl.tier_key IN ('omnichannel', 'professional', 'organization', 'enterprise',
                       'chain_professional', 'chain_enterprise')
ON CONFLICT DO NOTHING;


-- ============================================================
-- STEP 4: Add BSaaS catalog entry for à la carte purchase
--
-- Lower tiers (discovery, storefront, commitment, ecommerce,
-- chain_starter) can purchase this feature individually.
-- ============================================================

INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order, trial_eligible, demo_eligible, is_private)
VALUES (
  'storefront_opt_gallery_magazine',
  'Magazine Gallery',
  'Display all product and directory images in a stunning magazine mosaic layout. Maximum visual impact — no more clicking through one image at a time.',
  900,
  'monthly',
  7,
  true,
  50,
  true,
  true,
  false
)
ON CONFLICT (feature_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  trial_eligible = EXCLUDED.trial_eligible,
  demo_eligible  = EXCLUDED.demo_eligible,
  is_private     = EXCLUDED.is_private,
  updated_at     = NOW();


-- ============================================================
-- STEP 5: Add gallery_display_mode column to tenant_storefront_options_settings
-- ============================================================

DO $$
BEGIN
  ALTER TABLE tenant_storefront_options_settings
    ADD COLUMN IF NOT EXISTS gallery_display_mode VARCHAR(20) DEFAULT 'carousel';
  RAISE NOTICE 'Added gallery_display_mode column to tenant_storefront_options_settings';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Column may already exist: %', SQLERRM;
END $$;


-- ============================================================
-- VERIFICATION QUERIES (run manually to confirm)
-- ============================================================
-- SELECT key, name, sort_order FROM features_list
-- WHERE key = 'storefront_opt_gallery_magazine';
--
-- SELECT ctl.key AS capability_type, fl.key AS feature
-- FROM capability_features_list cfl
-- JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
-- JOIN features_list fl ON fl.id = cfl.feature_id
-- WHERE ctl.key = 'storefront_options' AND fl.key = 'storefront_opt_gallery_magazine';
--
-- SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
-- FROM tier_features_list tfl
-- JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
-- WHERE tfl.feature_key = 'storefront_opt_gallery_magazine';
--
-- SELECT feature_key, marketing_name, price_cents, trial_days, is_active
-- FROM bsaas_catalog WHERE feature_key = 'storefront_opt_gallery_magazine';
--
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'tenant_storefront_options_settings' AND column_name = 'gallery_display_mode';
