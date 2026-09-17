-- 050_org_bsaas_features.sql
-- Add org_bot_management and org_branding_control as BSaaS-eligible features.
-- These are bundled in chain_enterprise but purchasable à la carte for
-- chain_starter and chain_professional tiers.
--
-- Prerequisites: 049_organization_options_capability.sql must be run first.

-- ============================================================
-- 1. Insert BSaaS feature keys into features_list (if not exists)
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  (
    'org_bot_management',
    'Org Bot Management',
    'Chain-wide chatbot management dashboard with cross-location bot status, org-level bot widget, and aggregated bot analytics',
    'organization',
    true,
    100,
    NOW(),
    NOW()
  ),
  (
    'org_branding_control',
    'Org Branding Control',
    'Chain-wide branding control: custom logo, colors, and messaging propagated to all location storefronts',
    'organization',
    true,
    101,
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
-- 2. Link BSaaS features to organization_options capability type
-- ============================================================

DO $$
DECLARE
  v_cap_type_id TEXT;
  v_feature_key TEXT;
  v_existing    INT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'organization_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type organization_options not found. Run 049 first.';
  END IF;

  -- Link org_bot_management
  v_feature_key := 'org_bot_management';
  SELECT count(*) INTO v_existing FROM capability_features_list
    WHERE capability_type_id = v_cap_type_id
    AND feature_id = (SELECT id FROM features_list WHERE key = v_feature_key LIMIT 1);

  IF v_existing = 0 THEN
    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    SELECT v_cap_type_id, fl.id, true, 100, NOW(), NOW()
    FROM features_list fl WHERE fl.key = v_feature_key;
    RAISE NOTICE 'Linked % to organization_options', v_feature_key;
  ELSE
    RAISE NOTICE '% already linked to organization_options', v_feature_key;
  END IF;

  -- Link org_branding_control
  v_feature_key := 'org_branding_control';
  SELECT count(*) INTO v_existing FROM capability_features_list
    WHERE capability_type_id = v_cap_type_id
    AND feature_id = (SELECT id FROM features_list WHERE key = v_feature_key LIMIT 1);

  IF v_existing = 0 THEN
    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    SELECT v_cap_type_id, fl.id, true, 101, NOW(), NOW()
    FROM features_list fl WHERE fl.key = v_feature_key;
    RAISE NOTICE 'Linked % to organization_options', v_feature_key;
  ELSE
    RAISE NOTICE '% already linked to organization_options', v_feature_key;
  END IF;
END $$;

-- ============================================================
-- 3. Enable org_bot_management + org_branding_control for chain_enterprise (bundled)
-- ============================================================

DO $$
DECLARE
  v_enterprise_tier_id TEXT;
  v_cap_type_id        TEXT;
BEGIN
  SELECT id INTO v_enterprise_tier_id FROM subscription_tiers_list WHERE tier_key = 'chain_enterprise' LIMIT 1;
  IF v_enterprise_tier_id IS NULL THEN
    RAISE NOTICE 'chain_enterprise tier not found — skipping bundled enable';
    RETURN;
  END IF;

  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'organization_options' LIMIT 1;

  -- org_bot_management
  INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata, is_highlighted, highlight_order, marketing_name)
  VALUES (
    gen_random_uuid()::text,
    v_enterprise_tier_id,
    v_cap_type_id,
    'org_bot_management',
    'Org Bot Management',
    true,
    false,
    '{"capability_type": "organization_options"}'::jsonb,
    true,
    1,
    'Org Bot Management'
  )
  ON CONFLICT DO NOTHING;

  -- org_branding_control
  INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata, is_highlighted, highlight_order, marketing_name)
  VALUES (
    gen_random_uuid()::text,
    v_enterprise_tier_id,
    v_cap_type_id,
    'org_branding_control',
    'Org Branding Control',
    true,
    false,
    '{"capability_type": "organization_options"}'::jsonb,
    false,
    0,
    NULL
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Enabled org_bot_management + org_branding_control for chain_enterprise';
END $$;

-- ============================================================
-- 4. Verification queries
-- ============================================================

-- SELECT key, name, category FROM features_list WHERE key IN ('org_bot_management', 'org_branding_control');

-- SELECT tfl.tier_id, stl.tier_key, tfl.feature_key, tfl.is_enabled
-- FROM tier_features_list tfl
-- JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
-- WHERE tfl.feature_key IN ('org_bot_management', 'org_branding_control');
