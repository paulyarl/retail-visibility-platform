-- 378: Grant integration_clover to all three Entry Presence triad tiers.
--
-- Clover POS sync is a default feature of the triad, not a hidden capability
-- upsell: a merchant arriving from the Clover App Market signs up, lands on a
-- trial of one of these tiers, and can connect immediately. trial_* keys proxy
-- to their base tier at check time (TierService.checkTierFeatureAccess), so
-- granting the three base tiers covers every triad trial automatically.
--
-- `starter` keeps its existing grant (legacy grandfathered tenants); the
-- canonical minimum-tier map (FEATURE_TIER_MAP) moves to `discovery`, the
-- cheapest triad tier, so upgrade prompts point at the triad.
--
-- Idempotent: upserts on (tier_id, feature_key). capability_type_id is copied
-- from an existing integration_clover row so this works on any env.

DO $$
DECLARE
  v_triad        text[] := ARRAY['presence', 'discovery', 'storefront'];
  v_cap_type_id  text;
  v_tier         record;
BEGIN
  -- Copy the capability type from an existing grant row, if any.
  SELECT capability_type_id INTO v_cap_type_id
  FROM tier_features_list
  WHERE feature_key = 'integration_clover' AND capability_type_id IS NOT NULL
  LIMIT 1;

  FOR v_tier IN
    SELECT id, tier_key FROM subscription_tiers_list WHERE tier_key = ANY(v_triad)
  LOOP
    INSERT INTO tier_features_list (
      id, tier_id, capability_type_id, feature_key, feature_name,
      is_enabled, is_inherited, metadata, created_at, updated_at
    )
    VALUES (
      gen_random_uuid()::text, v_tier.id, v_cap_type_id,
      'integration_clover', 'Clover POS Integration',
      true, false, '{"capability_type": "integration_options"}', now(), now()
    )
    ON CONFLICT (tier_id, feature_key)
    DO UPDATE SET is_enabled = true, updated_at = now();
  END LOOP;
END $$;
