-- ============================================================
-- MIGRATION 125: Seed funnel_options_builder_on into Growth + Scale tiers
-- Reason: The funnel builder is the ONLY way to create funnels.
-- Growth and Scale tiers had funnel step features (order_bump, upsell,
-- downsell, oto) but lacked the builder_on group gate, making those
-- steps unusable. The builder is coupled to the capability type until
-- an alternative funnel creation method exists.
-- ============================================================

DO $$
DECLARE
  v_cap_type_id TEXT;
  v_tier_id TEXT;
  v_tier_key TEXT;
  v_growth_tiers TEXT[] := ARRAY[
    'storefront', 'commitment', 'ecommerce', 'omnichannel', 'chain_starter'
  ];
  v_scale_tiers TEXT[] := ARRAY[
    'professional', 'chain_professional'
  ];
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'funnel_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type funnel_options not found';
  END IF;

  -- Growth + Scale tiers: add funnel_options_builder_on
  FOREACH v_tier_key IN ARRAY v_growth_tiers || v_scale_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'funnel_options_builder_on', 'Funnel Builder On', true, false, '{"capability_type":"funnel_options"}')
    ON CONFLICT (tier_id, feature_key) DO UPDATE SET is_enabled = true, is_inherited = false;
  END LOOP;

  RAISE NOTICE 'funnel_options_builder_on seeded into Growth + Scale tiers';
END $$;

-- Verification:
-- SELECT t.tier_key, tf.feature_key, tf.is_enabled FROM tier_features_list tf
--   JOIN subscription_tiers_list t ON t.id = tf.tier_id
--   WHERE tf.feature_key = 'funnel_options_builder_on'
--   ORDER BY t.tier_key;
