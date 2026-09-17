-- ============================================================
-- Custom Badge Slots Capability Migration
--
-- Adds: featured_custom_badge_slots feature key to features_list
-- Links: feature to existing featured_options capability type
-- Enables: feature for professional, enterprise, organization,
--          chain_professional, chain_enterprise tiers + trial mirrors
--
-- Strategy: Capability-aware. Uses the existing featured_options
--           capability_type_list entry as the parent capability.
--           Follows the pattern from 057_product_types_capability_split.sql.
--           tier_features_list.id has no default, so we generate UUIDs explicitly.
--
-- Prerequisites: features_list, capability_type_list, capability_features_list,
--                tier_features_list, subscription_tiers_list tables must exist
-- Date: 2026-06-27
-- ============================================================


-- ============================================================
-- STEP 1: Insert featured_custom_badge_slots feature key into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'featured_custom_badge_slots',
  'Custom Badge Slots',
  'Allows merchants to create custom badge types for their storefront products.',
  'featured_options',
  true,
  50,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 2: Link feature to the existing featured_options capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'featured_options';
  v_feature_key          TEXT  := 'featured_custom_badge_slots';
  v_capability_type_id   TEXT;
  v_feature_id           TEXT;
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key LIMIT 1;
  IF v_capability_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type % not found', v_capability_type_key;
  END IF;

  SELECT id INTO v_feature_id FROM features_list WHERE key = v_feature_key LIMIT 1;
  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'Feature key % not found in features_list', v_feature_key;
  END IF;

  INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
  VALUES (v_capability_type_id, v_feature_id, true, 50, NOW(), NOW())
  ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
    is_active  = true,
    sort_order = 50;

  RAISE NOTICE 'Linked feature % to capability type %', v_feature_key, v_capability_type_key;
END $$;


-- ============================================================
-- STEP 3: Enable featured_custom_badge_slots for qualifying tiers
-- ============================================================
-- Available on: professional, enterprise, organization,
--               chain_professional, chain_enterprise
-- Plus trial mirrors of those tiers.
-- Uses capability_type_id linkage + explicit id generation.

DO $$
DECLARE
  v_tier_id           TEXT;
  v_cap_type_id       TEXT;
  v_tier_key          TEXT;
  v_feature_key       TEXT  := 'featured_custom_badge_slots';
  v_feature_name      TEXT  := 'Custom Badge Slots';
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'featured_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type featured_options not found';
  END IF;

  FOR v_tier_key IN
    SELECT * FROM (VALUES
      -- Professional tier and above
      ('professional'),
      ('enterprise'),
      ('organization'),
      ('chain_professional'),
      ('chain_enterprise'),

      -- Trial mirrors
      ('trial_professional'),
      ('trial_enterprise'),
      ('trial_chain_professional'),
      ('trial_chain_enterprise')
    ) AS t(tier_key)
  LOOP
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
      v_feature_key,
      v_feature_name,
      true,
      false,
      '{"capability_type": "featured_options"}'
    )
    ON CONFLICT (tier_id, feature_key) DO UPDATE SET
      is_enabled   = true,
      feature_name = EXCLUDED.feature_name,
      updated_at   = NOW();

    RAISE NOTICE 'Enabled % for tier %', v_feature_key, v_tier_key;
  END LOOP;

  RAISE NOTICE 'featured_custom_badge_slots feature enabled for qualifying tiers';
END $$;
