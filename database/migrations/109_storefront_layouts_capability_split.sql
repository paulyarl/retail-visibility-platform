-- ============================================================
-- Storefront Layouts Capability Split Migration
--
-- Extracts Layout features from storefront_options into a new
-- storefront_layouts capability type. Creates tenant_storefront_layouts_settings
-- table for Layout-specific merchant preferences.
--
-- Strategy: ADDITIVE and NON-BREAKING. Old feature keys and columns
--           remain intact. New keys are added alongside old ones.
--           Resolver will check new keys first, then fall back to old.
--
-- Prerequisites: features_list, capability_type_list,
--                capability_features_list, tier_features_list,
--                subscription_tiers_list, tenant_storefront_options_settings
-- Date: 2026-07-14
-- ============================================================


-- ============================================================
-- STEP 1: Create tenant_storefront_layouts_settings table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_storefront_layouts_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,
  layouts_enabled BOOLEAN DEFAULT true,
  storefront_layout VARCHAR(50) DEFAULT 'classic',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_storefront_layouts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_storefront_layouts_tenant ON tenant_storefront_layouts_settings(tenant_id);

CREATE OR REPLACE FUNCTION update_storefront_layouts_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_storefront_layouts_settings_updated_at ON tenant_storefront_layouts_settings;
CREATE TRIGGER trigger_storefront_layouts_settings_updated_at
  BEFORE UPDATE ON tenant_storefront_layouts_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_storefront_layouts_settings_updated_at();

ALTER TABLE tenant_storefront_layouts_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_storefront_layouts_isolation ON tenant_storefront_layouts_settings;
CREATE POLICY tenant_storefront_layouts_isolation ON tenant_storefront_layouts_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ============================================================
-- STEP 2: Migrate existing layout merchant prefs
-- ============================================================

INSERT INTO tenant_storefront_layouts_settings (
  id, tenant_id, layouts_enabled, storefront_layout, created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  tso.tenant_id,
  COALESCE(tso.storefront_opt_enabled, true),
  COALESCE(tso.storefront_layout, 'classic'),
  tso.created_at,
  tso.updated_at
FROM tenant_storefront_options_settings tso
WHERE tso.page_type = 'storefront' OR tso.page_type IS NULL
ON CONFLICT (tenant_id) DO NOTHING;


-- ============================================================
-- STEP 3: Insert storefront_layouts feature keys
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('storefront_layouts_flexible',  'Layouts Flexible',   'Flexible tier — unlocks all layout features',           'storefront_layouts', true, 1,  NOW(), NOW()),
  ('storefront_layouts_enabled',   'Layouts Enabled',    'Master gate — enables storefront layout selection',     'storefront_layouts', true, 2,  NOW(), NOW()),
  ('storefront_layouts_disabled',  'Layouts Disabled',   'Master disable gate for storefront layouts',            'storefront_layouts', true, 3,  NOW(), NOW()),
  ('storefront_layouts',           'Storefront Layouts', 'Group gate — enables storefront layout selection',      'storefront_layouts', true, 10, NOW(), NOW()),
  ('storefront_layouts_on',        'Layouts Group On',   'Group ON gate for storefront layouts',                  'storefront_layouts', true, 11, NOW(), NOW()),
  ('storefront_layouts_classic',   'Classic Layout',     'Classic storefront layout',                             'storefront_layouts', true, 20, NOW(), NOW()),
  ('storefront_layouts_editorial', 'Editorial Layout',   'Editorial storefront layout',                           'storefront_layouts', true, 21, NOW(), NOW()),
  ('storefront_layouts_immersive', 'Immersive Layout',   'Immersive storefront layout',                           'storefront_layouts', true, 22, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
  is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, updated_at = NOW();


-- ============================================================
-- STEP 4: Create storefront_layouts capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'storefront_layouts', 'Storefront Layouts',
  'Storefront layout selection — classic, editorial, immersive.',
  'storefront_layouts', true, 8, NOW(), NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, updated_at = NOW();


-- ============================================================
-- STEP 5: Link features to capability type
-- ============================================================

DO $$
DECLARE
  v_cap_key  TEXT  := 'storefront_layouts';
  v_keys     TEXT[] := ARRAY[
    'storefront_layouts_flexible','storefront_layouts_enabled','storefront_layouts_disabled',
    'storefront_layouts','storefront_layouts_on',
    'storefront_layouts_classic','storefront_layouts_editorial','storefront_layouts_immersive'
  ];
  v_cap_id TEXT;
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = v_cap_key;
  IF v_cap_id IS NULL THEN RAISE EXCEPTION 'Capability type % not found', v_cap_key; END IF;
  FOR i IN 1 .. array_length(v_keys, 1) LOOP
    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    SELECT v_cap_id, fl.id, true, i, NOW(), NOW()
    FROM features_list fl WHERE fl.key = v_keys[i]
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET is_active = true, sort_order = i;
  END LOOP;
  RAISE NOTICE 'Linked % features to %', array_length(v_keys, 1), v_cap_key;
END $$;


-- ============================================================
-- STEP 6: Copy tier assignments from old keys to new keys
-- ============================================================

DO $$
DECLARE
  v_cap_id TEXT;
  v_new TEXT; v_old TEXT; v_name TEXT;
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = 'storefront_layouts' LIMIT 1;
  IF v_cap_id IS NULL THEN RAISE EXCEPTION 'Capability type storefront_layouts not found'; END IF;

  -- Domain gates
  FOR v_new, v_old IN SELECT * FROM (VALUES
    ('storefront_layouts_flexible','storefront_opt_flexible'),
    ('storefront_layouts_enabled', 'storefront_opt_enabled'),
    ('storefront_layouts_disabled','storefront_opt_disabled')
  ) AS t(n,o) LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    SELECT gen_random_uuid()::text, tfl.tier_id, v_cap_id, v_new, v_new, true, false,
      json_build_object('capability_type','storefront_layouts')
    FROM tier_features_list tfl WHERE tfl.feature_key = v_old AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- Individual layout keys
  FOR v_new, v_old, v_name IN SELECT * FROM (VALUES
    ('storefront_layouts_classic',  'storefront_opt_layout_classic',  'Classic Layout'),
    ('storefront_layouts_editorial','storefront_opt_layout_editorial','Editorial Layout'),
    ('storefront_layouts_immersive','storefront_opt_layout_immersive','Immersive Layout')
  ) AS t(n,o,nm) LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    SELECT gen_random_uuid()::text, tfl.tier_id, v_cap_id, v_new, v_name, true, false,
      json_build_object('capability_type','storefront_layouts')
    FROM tier_features_list tfl WHERE tfl.feature_key = v_old AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- Group gates
  FOR v_new, v_old, v_name IN SELECT * FROM (VALUES
    ('storefront_layouts_on','storefront_opt_layout_on',     'Layouts Group On'),
    ('storefront_layouts',   'storefront_opt_layout_enabled','Storefront Layouts')
  ) AS t(n,o,nm) LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    SELECT gen_random_uuid()::text, tfl.tier_id, v_cap_id, v_new, v_name, true, false,
      json_build_object('capability_type','storefront_layouts')
    FROM tier_features_list tfl WHERE tfl.feature_key = v_old AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Layouts tier feature assignments copied';
END $$;


-- ============================================================
-- STEP 7: Assign group keys to all tiers with layouts enabled
-- ============================================================

DO $$
DECLARE
  v_cap_id TEXT; v_tier TEXT;
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = 'storefront_layouts' LIMIT 1;
  IF v_cap_id IS NULL THEN RAISE EXCEPTION 'Capability type storefront_layouts not found'; END IF;
  FOR v_tier IN SELECT DISTINCT tier_id FROM tier_features_list
    WHERE capability_type_id = v_cap_id AND feature_key = 'storefront_layouts_enabled' AND is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier, v_cap_id, 'storefront_layouts', 'Storefront Layouts', true, false, '{"capability_type":"storefront_layouts"}'),
      (gen_random_uuid()::text, v_tier, v_cap_id, 'storefront_layouts_on', 'Layouts Group On', true, false, '{"capability_type":"storefront_layouts"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;
  RAISE NOTICE 'Layouts group keys assigned to all enabled tiers';
END $$;


-- ============================================================
-- STEP 8: Unlink old layout keys from storefront_options
-- ============================================================

DELETE FROM capability_features_list
WHERE capability_type_id = (SELECT id FROM capability_type_list WHERE key = 'storefront_options' LIMIT 1)
AND feature_id IN (
  SELECT id FROM features_list WHERE key IN (
    'storefront_opt_layout_classic','storefront_opt_layout_editorial','storefront_opt_layout_immersive',
    'storefront_opt_layout_on','storefront_opt_layout_enabled'
  )
);


-- ============================================================
-- STEP 9: Link capability type to a representative tier
-- ============================================================

UPDATE capability_type_list SET tier_id = 'tier_professional'
WHERE key = 'storefront_layouts' AND tier_id IS NULL;


-- ============================================================
-- STEP 10: Navigation link — Storefront Layouts (tenant sidebar)
-- ============================================================

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-storefront-layouts',
  'Storefront Layouts',
  '/t/{tenantId}/settings/storefront-layouts',
  'layout-template',
  'NEW',
  'new',
  ARRAY['tenant'],
  (SELECT sort_order FROM navigation_links WHERE id = 'nav-tenant-storefront-hours') + 10,
  true,
  false,
  '',
  'IS_TENANT_ADMIN',
  '',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-storefront-hours'),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE id = 'nav-tenant-storefront-hours')
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-storefront-layouts')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-storefront-hours');

UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-storefront-layouts'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-storefront-hours')
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-storefront-layouts');


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================
-- SELECT count(*) FROM tenant_storefront_layouts_settings;
-- SELECT * FROM capability_type_list WHERE key = 'storefront_layouts';
-- SELECT key, name, sort_order FROM features_list WHERE category = 'storefront_layouts' ORDER BY sort_order;
-- SELECT f.key FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'storefront_options' AND f.key LIKE 'storefront_opt_layout%'
--   ORDER BY f.key;
-- (should return 0 rows)
