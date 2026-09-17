-- 049_organization_options_capability.sql
-- Register the `organization_options` capability type and its feature keys.
-- This enables org-level capability gating for the Organization Dashboard tabs, panels, and propagation types.
--
-- Feature keys:
--   org_enabled                    — master switch for org dashboard
--   org_flexible                   — grants all tabs/panels/propagation types (most-permissive)
--   org_tab_locations              — access to Locations tab
--   org_tab_propagation            — access to Propagation tab
--   org_tab_capabilities           — access to Capabilities tab
--   org_tab_team                   — access to Team tab
--   org_tab_commerce               — access to Commerce tab
--   org_panel_task_checklist       — Task Checklist panel on Overview
--   org_panel_quick_links          — Quick Links panel on Overview
--   org_panel_system_status        — System Status panel on Overview
--   org_panel_recommendations      — Recommendations panel on Overview
--   org_panel_crm_summary          — CRM Summary panel on Overview
--   org_propagation_products       — Product propagation toggle
--   org_propagation_categories     — Category propagation toggle
--   org_propagation_business_info  — Business info propagation toggle
--   org_propagation_settings       — Settings propagation toggle
--
-- Tabs `overview` and `billing` are always available when org_enabled is true (not gated by feature keys).

-- ============================================================
-- 1. Insert org feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('org_enabled',                   'Org Dashboard Enabled',         'Master switch for organization dashboard',           'organization', true, 1,  NOW(), NOW()),
  ('org_flexible',                  'Org Flexible',                  'Grants all org tabs, panels, and propagation types', 'organization', true, 2,  NOW(), NOW()),
  ('org_tab_locations',             'Org Tab: Locations',            'Access to Locations tab',                            'organization', true, 10, NOW(), NOW()),
  ('org_tab_propagation',           'Org Tab: Propagation',          'Access to Propagation tab',                          'organization', true, 11, NOW(), NOW()),
  ('org_tab_capabilities',          'Org Tab: Capabilities',         'Access to Capabilities tab',                         'organization', true, 12, NOW(), NOW()),
  ('org_tab_team',                  'Org Tab: Team',                 'Access to Team tab',                                 'organization', true, 13, NOW(), NOW()),
  ('org_tab_commerce',              'Org Tab: Commerce',             'Access to Commerce tab',                             'organization', true, 14, NOW(), NOW()),
  ('org_panel_task_checklist',      'Org Panel: Task Checklist',     'Task Checklist panel on Overview',                   'organization', true, 20, NOW(), NOW()),
  ('org_panel_quick_links',         'Org Panel: Quick Links',        'Quick Links panel on Overview',                      'organization', true, 21, NOW(), NOW()),
  ('org_panel_system_status',       'Org Panel: System Status',      'System Status panel on Overview',                    'organization', true, 22, NOW(), NOW()),
  ('org_panel_recommendations',     'Org Panel: Recommendations',    'Recommendations panel on Overview',                  'organization', true, 23, NOW(), NOW()),
  ('org_panel_crm_summary',         'Org Panel: CRM Summary',        'CRM Summary panel on Overview',                      'organization', true, 24, NOW(), NOW()),
  ('org_propagation_products',      'Org Propagation: Products',     'Product propagation toggle',                         'organization', true, 30, NOW(), NOW()),
  ('org_propagation_categories',    'Org Propagation: Categories',   'Category propagation toggle',                        'organization', true, 31, NOW(), NOW()),
  ('org_propagation_business_info', 'Org Propagation: Business Info','Business info propagation toggle',                   'organization', true, 32, NOW(), NOW()),
  ('org_propagation_settings',      'Org Propagation: Settings',     'Settings propagation toggle',                        'organization', true, 33, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- ============================================================
-- 2. Upsert organization_options capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'organization_options',
  'Organization Options',
  'Chain-level dashboard capabilities: tab access, panel access, propagation types',
  'organization',
  true,
  15,
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
-- 3. Link features to organization_options capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'organization_options';
  v_feature_keys         TEXT[] := ARRAY[
    'org_enabled', 'org_flexible',
    'org_tab_locations', 'org_tab_propagation', 'org_tab_capabilities', 'org_tab_team', 'org_tab_commerce',
    'org_panel_task_checklist', 'org_panel_quick_links', 'org_panel_system_status', 'org_panel_recommendations', 'org_panel_crm_summary',
    'org_propagation_products', 'org_propagation_categories', 'org_propagation_business_info', 'org_propagation_settings'
  ];
  v_capability_type_id TEXT;
  v_missing_keys       TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  IF v_capability_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type % not found', v_capability_type_key;
  END IF;

  -- Wipe old links
  DELETE FROM capability_features_list WHERE capability_type_id = v_capability_type_id;

  -- Re-link with sort_order
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
-- 4. Enable org features for chain tiers
-- ============================================================
-- chain_starter:      overview + billing + locations + task_checklist + quick_links + system_status + propagation_products
-- chain_professional: all chain_starter + propagation + capabilities + team + commerce + recommendations + crm_summary + all propagation types
-- chain_enterprise:   everything (org_flexible = true)

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
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'organization_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type organization_options not found';
  END IF;

  FOR v_tier_key, v_feature_key, v_feature_name, v_marketing_name, v_highlight, v_highlight_order IN
    SELECT * FROM (VALUES
      -- ─── chain_starter: essential tabs + panels + product propagation ───
      ('chain_starter', 'org_enabled',                   'Org Dashboard Enabled',         'Organization',  true,  1),
      ('chain_starter', 'org_tab_locations',             'Org Tab: Locations',            NULL,            false, 0),
      ('chain_starter', 'org_panel_task_checklist',      'Org Panel: Task Checklist',     NULL,            false, 0),
      ('chain_starter', 'org_panel_quick_links',         'Org Panel: Quick Links',        NULL,            false, 0),
      ('chain_starter', 'org_panel_system_status',       'Org Panel: System Status',      NULL,            false, 0),
      ('chain_starter', 'org_propagation_products',      'Org Propagation: Products',     NULL,            false, 0),

      -- ─── chain_professional: all tabs + all panels + all propagation types ───
      ('chain_professional', 'org_enabled',                   'Org Dashboard Enabled',         'Organization',  true,  1),
      ('chain_professional', 'org_tab_locations',             'Org Tab: Locations',            NULL,            false, 0),
      ('chain_professional', 'org_tab_propagation',           'Org Tab: Propagation',          NULL,            false, 0),
      ('chain_professional', 'org_tab_capabilities',          'Org Tab: Capabilities',         NULL,            false, 0),
      ('chain_professional', 'org_tab_team',                  'Org Tab: Team',                 NULL,            false, 0),
      ('chain_professional', 'org_tab_commerce',              'Org Tab: Commerce',             NULL,            false, 0),
      ('chain_professional', 'org_panel_task_checklist',      'Org Panel: Task Checklist',     NULL,            false, 0),
      ('chain_professional', 'org_panel_quick_links',         'Org Panel: Quick Links',        NULL,            false, 0),
      ('chain_professional', 'org_panel_system_status',       'Org Panel: System Status',      NULL,            false, 0),
      ('chain_professional', 'org_panel_recommendations',     'Org Panel: Recommendations',    NULL,            false, 0),
      ('chain_professional', 'org_panel_crm_summary',         'Org Panel: CRM Summary',        NULL,            false, 0),
      ('chain_professional', 'org_propagation_products',      'Org Propagation: Products',     NULL,            false, 0),
      ('chain_professional', 'org_propagation_categories',    'Org Propagation: Categories',   NULL,            false, 0),
      ('chain_professional', 'org_propagation_business_info', 'Org Propagation: Business Info',NULL,            false, 0),
      ('chain_professional', 'org_propagation_settings',      'Org Propagation: Settings',     NULL,            false, 0),

      -- ─── chain_enterprise: everything (flexible) ───
      ('chain_enterprise', 'org_enabled',                   'Org Dashboard Enabled',         'Organization',  true,  1),
      ('chain_enterprise', 'org_flexible',                  'Org Flexible',                  NULL,            false, 0),
      ('chain_enterprise', 'org_tab_locations',             'Org Tab: Locations',            NULL,            false, 0),
      ('chain_enterprise', 'org_tab_propagation',           'Org Tab: Propagation',          NULL,            false, 0),
      ('chain_enterprise', 'org_tab_capabilities',          'Org Tab: Capabilities',         NULL,            false, 0),
      ('chain_enterprise', 'org_tab_team',                  'Org Tab: Team',                 NULL,            false, 0),
      ('chain_enterprise', 'org_tab_commerce',              'Org Tab: Commerce',             NULL,            false, 0),
      ('chain_enterprise', 'org_panel_task_checklist',      'Org Panel: Task Checklist',     NULL,            false, 0),
      ('chain_enterprise', 'org_panel_quick_links',         'Org Panel: Quick Links',        NULL,            false, 0),
      ('chain_enterprise', 'org_panel_system_status',       'Org Panel: System Status',      NULL,            false, 0),
      ('chain_enterprise', 'org_panel_recommendations',     'Org Panel: Recommendations',    NULL,            false, 0),
      ('chain_enterprise', 'org_panel_crm_summary',         'Org Panel: CRM Summary',        NULL,            false, 0),
      ('chain_enterprise', 'org_propagation_products',      'Org Propagation: Products',     NULL,            false, 0),
      ('chain_enterprise', 'org_propagation_categories',    'Org Propagation: Categories',   NULL,            false, 0),
      ('chain_enterprise', 'org_propagation_business_info', 'Org Propagation: Business Info',NULL,            false, 0),
      ('chain_enterprise', 'org_propagation_settings',      'Org Propagation: Settings',     NULL,            false, 0)
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
      '{"capability_type": "organization_options"}',
      v_highlight,
      v_highlight_order,
      v_marketing_name
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Organization tier features populated for all chain tiers';
END $$;

-- ============================================================
-- 5. Verification queries (run manually to confirm)
-- ============================================================
-- SELECT ctl.key AS capability_type, fl.key AS feature_key, fl.name AS feature_name, cfl.sort_order
-- FROM capability_features_list cfl
-- JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
-- JOIN features_list fl ON fl.id = cfl.feature_id
-- WHERE ctl.key = 'organization_options'
-- ORDER BY cfl.sort_order;

-- SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
-- FROM tier_features_list tfl
-- JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
-- WHERE tfl.feature_key LIKE 'org_%'
-- ORDER BY stl.sort_order, tfl.feature_key;
