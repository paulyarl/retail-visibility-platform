-- 092_chain_starter_org_tabs_unlock.sql
-- Set chain_starter org features to the essential set for org success.
--
-- chain_starter keeps: org_enabled (overview+billing), org_tab_locations,
--   org_tab_team, org_panel_task_checklist, org_panel_quick_links,
--   org_panel_system_status, org_propagation_products.
--
-- Removed from chain_starter (premium tier incentives):
--   org_tab_propagation, org_tab_capabilities, org_tab_commerce,
--   org_panel_recommendations, org_panel_crm_summary,
--   org_propagation_categories, org_propagation_business_info,
--   org_propagation_settings.
--
-- Tier differentiation: org_flexible (enterprise only), premium tabs/panels,
-- and BSaaS add-ons.

DO $$
DECLARE
  v_tier_id     TEXT;
  v_cap_type_id TEXT;
BEGIN
  SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = 'chain_starter' AND is_active = true LIMIT 1;
  IF v_tier_id IS NULL THEN
    RAISE NOTICE 'chain_starter tier not found or inactive — skipping';
    RETURN;
  END IF;

  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'organization_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type organization_options not found';
  END IF;

  -- 1. Add org_tab_team (if not already present)
  INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata, is_highlighted, highlight_order, marketing_name)
  VALUES (
    gen_random_uuid()::text,
    v_tier_id,
    v_cap_type_id,
    'org_tab_team',
    'Org Tab: Team',
    true,
    false,
    '{"capability_type": "organization_options"}'::jsonb,
    false,
    0,
    NULL
  )
  ON CONFLICT (tier_id, feature_key) DO NOTHING;

  -- 2. Remove premium features that should not be on chain_starter
  DELETE FROM tier_features_list
  WHERE tier_id = v_tier_id
    AND feature_key IN (
      'org_tab_propagation',
      'org_tab_capabilities',
      'org_tab_commerce',
      'org_panel_recommendations',
      'org_panel_crm_summary',
      'org_propagation_categories',
      'org_propagation_business_info',
      'org_propagation_settings'
    );

  RAISE NOTICE 'Set chain_starter org features to essential set (added team, removed premium)';
END $$;

-- ============================================================
-- Verification
-- ============================================================
-- SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
-- FROM tier_features_list tfl
-- JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
-- WHERE tfl.feature_key LIKE 'org_%' AND stl.tier_key = 'chain_starter'
-- ORDER BY tfl.feature_key;
