-- Migration: Seed storefront_types capability group with feature keys
-- Description: Inserts storefront type feature keys into features_list,
--              ensures the storefront_types capability type exists,
--              links features via capability_features_list,
--              and enables them per tier.
-- Prerequisites: features_list, capability_type_list, capability_features_list,
--                tier_features_list, subscription_tiers_list tables must exist
-- Date: 2026-06-23

-- ============================================================
-- 1. Insert storefront feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  -- Master gates
  ('storefront',              'Storefront',              'Master toggle for storefront capability',                'storefront', true, 0,  NOW(), NOW()),
  ('storefront_enabled',      'Storefront Enabled',      'Explicit activation gate for storefront',                'storefront', true, 1,  NOW(), NOW()),
  ('storefront_disabled',     'Storefront Disabled',     'Explicit deactivation gate for storefront',              'storefront', true, 2,  NOW(), NOW()),

  -- Type gates
  ('storefront_online',       'Online Storefront',       'Enable online/e-commerce storefront type',               'storefront', true, 10, NOW(), NOW()),
  ('storefront_retail',       'Retail Storefront',       'Enable physical retail storefront type',                 'storefront', true, 11, NOW(), NOW()),
  ('storefront_service',      'Service Storefront',      'Enable service-based storefront type',                   'storefront', true, 12, NOW(), NOW()),
  ('storefront_social',       'Social Storefront',       'Enable social commerce storefront type (TikTok/Instagram)', 'storefront', true, 13, NOW(), NOW()),

  -- Flexible gate
  ('storefront_flexible', 'Flexible Storefront Type','Allow merchant to choose between multiple storefront types', 'storefront', true, 20, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- ============================================================
-- 2. Upsert storefront_types capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'storefront_types',
  'Storefront Types',
  'Storefront type selection including online, retail, service, and social commerce types.',
  'storefront_types',
  true,
  3,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();

-- ============================================================
-- 3. Link features to storefront_types capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'storefront_types';
  v_feature_keys         TEXT[] := ARRAY[
    'storefront',
    'storefront_enabled',
    'storefront_disabled',
    'storefront_online',
    'storefront_retail',
    'storefront_service',
    'storefront_social',
    'storefront_flexible'
  ];
  v_capability_type_id TEXT;
  v_missing_keys       TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  IF v_capability_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type % not found', v_capability_type_key;
  END IF;

  DELETE FROM capability_features_list WHERE capability_type_id = v_capability_type_id;

  FOR i IN 1 .. array_length(v_feature_keys, 1) LOOP
    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    SELECT v_capability_type_id, fl.id, true, i, NOW(), NOW()
    FROM features_list fl
    WHERE fl.key = v_feature_keys[i];

    IF NOT FOUND THEN
      v_missing_keys := array_append(v_missing_keys, v_feature_keys[i]);
      RAISE NOTICE 'Feature key not found in features_list: %', v_feature_keys[i];
    END IF;
  END LOOP;

  IF array_length(v_missing_keys, 1) > 0 THEN
    RAISE NOTICE 'Missing feature keys (skipped): %', v_missing_keys;
  END IF;

  RAISE NOTICE 'Linked % features to capability type %', array_length(v_feature_keys, 1) - array_length(v_missing_keys, 1), v_capability_type_key;
END $$;

-- ============================================================
-- 4. Enable storefront type features for tiers
-- ============================================================
-- Active tiers (sorted by sort_order):
--   1.  discovery          ($29)   — retail + online
--   2.  storefront         ($59)   — retail + online + service
--   3.  commitment         ($79)   — same as storefront
--   4.  ecommerce          ($99)   — + social + flexible
--   5.  omnichannel        ($149)  — same as ecommerce
--   6.  professional       ($199)  — same as ecommerce
--   7.  chain_starter      ($299)  — same as ecommerce
--   8.  chain_professional ($399)  — same as ecommerce
--   9.  organization       ($499)  — same as ecommerce
--   10. enterprise         ($499)  — Everything (flexible)

DO $$
DECLARE
  v_tier_id           TEXT;
  v_cap_type_id       TEXT;
  v_tier_key          TEXT;
  v_feature_key       TEXT;
  v_feature_name      TEXT;
  v_marketing_name    TEXT;
  v_highlight         BOOLEAN;
  v_highlight_order   INT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'storefront_types' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type storefront_types not found';
  END IF;

  FOR v_tier_key, v_feature_key, v_feature_name, v_marketing_name, v_highlight, v_highlight_order IN
    SELECT * FROM (VALUES
      -- ─── discovery: retail + online ───
      ('discovery', 'storefront',              'Storefront',              'Storefront',       true,  1),
      ('discovery', 'storefront_online',       'Online Storefront',       NULL,               false, 0),
      ('discovery', 'storefront_retail',       'Retail Storefront',       NULL,               false, 0),

      -- ─── storefront: + service ───
      ('storefront', 'storefront',              'Storefront',              'Storefront',       true,  1),
      ('storefront', 'storefront_online',       'Online Storefront',       NULL,               false, 0),
      ('storefront', 'storefront_retail',       'Retail Storefront',       NULL,               false, 0),
      ('storefront', 'storefront_service',      'Service Storefront',      NULL,               false, 0),

      -- ─── commitment: same as storefront ───
      ('commitment', 'storefront',              'Storefront',              'Storefront',       true,  1),
      ('commitment', 'storefront_online',       'Online Storefront',       NULL,               false, 0),
      ('commitment', 'storefront_retail',       'Retail Storefront',       NULL,               false, 0),
      ('commitment', 'storefront_service',      'Service Storefront',      NULL,               false, 0),

      -- ─── ecommerce: + social + flexible ───
      ('ecommerce', 'storefront',              'Storefront',              'Storefront',       true,  1),
      ('ecommerce', 'storefront_online',       'Online Storefront',       NULL,               false, 0),
      ('ecommerce', 'storefront_retail',       'Retail Storefront',       NULL,               false, 0),
      ('ecommerce', 'storefront_service',      'Service Storefront',      NULL,               false, 0),
      ('ecommerce', 'storefront_social',       'Social Storefront',       'Social Commerce',  true,  2),
      ('ecommerce', 'storefront_flexible', 'Flexible Storefront Type', NULL,              false, 0),

      -- ─── omnichannel: same as ecommerce ───
      ('omnichannel', 'storefront',              'Storefront',              'Storefront',       true,  1),
      ('omnichannel', 'storefront_online',       'Online Storefront',       NULL,               false, 0),
      ('omnichannel', 'storefront_retail',       'Retail Storefront',       NULL,               false, 0),
      ('omnichannel', 'storefront_service',      'Service Storefront',      NULL,               false, 0),
      ('omnichannel', 'storefront_social',       'Social Storefront',       'Social Commerce',  true,  2),
      ('omnichannel', 'storefront_flexible', 'Flexible Storefront Type', NULL,              false, 0),

      -- ─── professional: same as ecommerce ───
      ('professional', 'storefront',              'Storefront',              'Storefront',       true,  1),
      ('professional', 'storefront_online',       'Online Storefront',       NULL,               false, 0),
      ('professional', 'storefront_retail',       'Retail Storefront',       NULL,               false, 0),
      ('professional', 'storefront_service',      'Service Storefront',      NULL,               false, 0),
      ('professional', 'storefront_social',       'Social Storefront',       'Social Commerce',  true,  2),
      ('professional', 'storefront_flexible', 'Flexible Storefront Type', NULL,              false, 0),

      -- ─── chain_starter: same as ecommerce ───
      ('chain_starter', 'storefront',              'Storefront',              'Storefront',       true,  1),
      ('chain_starter', 'storefront_online',       'Online Storefront',       NULL,               false, 0),
      ('chain_starter', 'storefront_retail',       'Retail Storefront',       NULL,               false, 0),
      ('chain_starter', 'storefront_service',      'Service Storefront',      NULL,               false, 0),
      ('chain_starter', 'storefront_social',       'Social Storefront',       'Social Commerce',  true,  2),
      ('chain_starter', 'storefront_flexible', 'Flexible Storefront Type', NULL,              false, 0),

      -- ─── chain_professional: same as ecommerce ───
      ('chain_professional', 'storefront',              'Storefront',              'Storefront',       true,  1),
      ('chain_professional', 'storefront_online',       'Online Storefront',       NULL,               false, 0),
      ('chain_professional', 'storefront_retail',       'Retail Storefront',       NULL,               false, 0),
      ('chain_professional', 'storefront_service',      'Service Storefront',      NULL,               false, 0),
      ('chain_professional', 'storefront_social',       'Social Storefront',       'Social Commerce',  true,  2),
      ('chain_professional', 'storefront_flexible', 'Flexible Storefront Type', NULL,              false, 0),

      -- ─── organization: same as ecommerce ───
      ('organization', 'storefront',              'Storefront',              'Storefront',       true,  1),
      ('organization', 'storefront_online',       'Online Storefront',       NULL,               false, 0),
      ('organization', 'storefront_retail',       'Retail Storefront',       NULL,               false, 0),
      ('organization', 'storefront_service',      'Service Storefront',      NULL,               false, 0),
      ('organization', 'storefront_social',       'Social Storefront',       'Social Commerce',  true,  2),
      ('organization', 'storefront_flexible', 'Flexible Storefront Type', NULL,              false, 0),

      -- ─── enterprise: Everything (flexible) ───
      ('enterprise', 'storefront',              'Storefront',              'Storefront',       true,  1),
      ('enterprise', 'storefront_online',       'Online Storefront',       NULL,               false, 0),
      ('enterprise', 'storefront_retail',       'Retail Storefront',       NULL,               false, 0),
      ('enterprise', 'storefront_service',      'Service Storefront',      NULL,               false, 0),
      ('enterprise', 'storefront_social',       'Social Storefront',       'Social Commerce',  true,  2),
      ('enterprise', 'storefront_flexible', 'Flexible Storefront Type', NULL,              false, 0)
    ) AS t(tier_key, feature_key, feature_name, marketing_name, is_highlight, highlight_order)
  LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata, is_highlighted, highlight_order, marketing_name)
    VALUES (
      gen_random_uuid()::text,
      v_tier_id,
      v_cap_type_id,
      v_feature_key,
      v_feature_name,
      true,
      false,
      '{"capability_type": "storefront_types"}',
      v_highlight,
      v_highlight_order,
      v_marketing_name
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Storefront type tier features populated for all active tiers';
END $$;

-- ============================================================
-- 5. Verification queries (run manually to confirm)
-- ============================================================
-- SELECT ctl.key AS capability_type, fl.key AS feature_key, fl.name AS feature_name, cfl.sort_order
-- FROM capability_features_list cfl
-- JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
-- JOIN features_list fl ON fl.id = cfl.feature_id
-- WHERE ctl.key = 'storefront_types'
-- ORDER BY cfl.sort_order;

-- SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
-- FROM tier_features_list tfl
-- JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
-- WHERE tfl.feature_key LIKE 'storefront_%'
-- ORDER BY stl.sort_order, tfl.feature_key;
