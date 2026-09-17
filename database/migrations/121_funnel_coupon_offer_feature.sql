-- ============================================================
-- MIGRATION: Seed funnel_options_builder_coupon_offer feature
-- Reason: Sprint 9 Coupon-Funnel Convergence
-- ============================================================

-- Step 1: Register the feature key
INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'funnel_options_builder_coupon_offer',
  'Funnel Coupon Offer Step',
  'Allow a coupon offer as a sales funnel step type',
  'funnel_options',
  true,
  24,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Step 2: Link the feature to the funnel_options capability type
DO $$
DECLARE
  v_capability_type_id TEXT;
  v_feature_id TEXT;
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = 'funnel_options' LIMIT 1;
  SELECT id INTO v_feature_id FROM features_list WHERE key = 'funnel_options_builder_coupon_offer' LIMIT 1;

  IF v_capability_type_id IS NULL OR v_feature_id IS NULL THEN
    RAISE NOTICE 'Skipping capability feature link — capability type or feature not found';
    RETURN;
  END IF;

  INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
  VALUES (v_capability_type_id, v_feature_id, true, 24, NOW(), NOW())
  ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
END $$;

-- Step 3: Enable the feature for Scale and Enterprise tiers
DO $$
DECLARE
  v_cap_type_id TEXT;
  v_tier_id TEXT;
  v_tier_key TEXT;
  v_feature_id TEXT;
  v_scale_tiers TEXT[] := ARRAY['professional', 'chain_professional'];
  v_enterprise_tiers TEXT[] := ARRAY['enterprise', 'organization', 'chain_enterprise'];
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'funnel_options' LIMIT 1;
  SELECT id INTO v_feature_id FROM features_list WHERE key = 'funnel_options_builder_coupon_offer' LIMIT 1;

  IF v_cap_type_id IS NULL OR v_feature_id IS NULL THEN
    RAISE NOTICE 'Skipping tier feature assignment — capability type or feature not found';
    RETURN;
  END IF;

  FOREACH v_tier_key IN ARRAY v_scale_tiers || v_enterprise_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES (
      gen_random_uuid()::text,
      v_tier_id,
      v_cap_type_id,
      'funnel_options_builder_coupon_offer',
      'Funnel Coupon Offer Step',
      true,
      false,
      '{"capability_type":"funnel_options"}'
    )
    ON CONFLICT (tier_id, feature_key) DO UPDATE SET
      is_enabled = EXCLUDED.is_enabled,
      is_inherited = EXCLUDED.is_inherited,
      feature_name = EXCLUDED.feature_name;
  END LOOP;
END $$;

-- Verification:
-- SELECT key, name, sort_order FROM features_list WHERE key = 'funnel_options_builder_coupon_offer';
-- SELECT f.key FROM capability_features_list cf JOIN features_list f ON f.id = cf.feature_id JOIN capability_type_list ct ON ct.id = cf.capability_type_id WHERE f.key = 'funnel_options_builder_coupon_offer';
-- SELECT t.tier_key, tf.feature_key, tf.is_enabled FROM tier_features_list tf JOIN subscription_tiers_list t ON t.id = tf.tier_id WHERE tf.feature_key = 'funnel_options_builder_coupon_offer';
