-- ============================================================
-- Storefront Maps Capability Split Migration
--
-- Extracts Maps features from storefront_options into a new
-- storefront_mapss capability type. Creates tenant_storefront_maps_settings
-- table for Maps-specific merchant preferences.
--
-- Strategy: ADDITIVE and NON-BREAKING. Old feature keys and columns
--           remain intact. New keys are added alongside old ones.
--           Resolver will check new keys first, then fall back to old.
--
-- Prerequisites: features_list, capability_type_list,
--                capability_features_list, tier_features_list,
--                subscription_tiers_list, tenant_storefront_options_settings
-- Date: 2026-07-15
-- ============================================================


-- ============================================================
-- STEP 1: Create tenant_storefront_maps_settings table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_storefront_maps_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,
  maps_enabled BOOLEAN DEFAULT true,
  interactive_maps BOOLEAN DEFAULT true,
  map_display BOOLEAN DEFAULT true,
  location_display BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_storefront_maps_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_storefront_maps_tenant ON tenant_storefront_maps_settings(tenant_id);

CREATE OR REPLACE FUNCTION update_storefront_maps_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_storefront_maps_settings_updated_at ON tenant_storefront_maps_settings;
CREATE TRIGGER trigger_storefront_maps_settings_updated_at
  BEFORE UPDATE ON tenant_storefront_maps_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_storefront_maps_settings_updated_at();

ALTER TABLE tenant_storefront_maps_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_storefront_maps_isolation ON tenant_storefront_maps_settings;
CREATE POLICY tenant_storefront_maps_isolation ON tenant_storefront_maps_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ============================================================
-- STEP 2: Migrate existing maps merchant prefs
-- ============================================================

INSERT INTO tenant_storefront_maps_settings (
  id, tenant_id, maps_enabled, interactive_maps, map_display, location_display, created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  tso.tenant_id,
  COALESCE(tso.storefront_opt_enabled, true),
  COALESCE(tso.interactive_maps, true),
  COALESCE(tso.map_display, true),
  COALESCE(tso.location_display, true),
  tso.created_at,
  tso.updated_at
FROM tenant_storefront_options_settings tso
WHERE tso.page_type = 'storefront' OR tso.page_type IS NULL
ON CONFLICT (tenant_id) DO NOTHING;


-- ============================================================
-- STEP 3: Insert storefront_maps feature keys
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('storefront_maps_flexible',   'Maps Flexible',     'Flexible tier — unlocks all maps features',              'storefront_maps', true, 1,  NOW(), NOW()),
  ('storefront_maps_enabled',    'Maps Enabled',      'Master gate — enables storefront maps features',         'storefront_maps', true, 2,  NOW(), NOW()),
  ('storefront_maps_disabled',   'Maps Disabled',     'Master disable gate for storefront maps',                'storefront_maps', true, 3,  NOW(), NOW()),
  ('storefront_maps',            'Storefront Maps',   'Group gate — enables storefront maps group',             'storefront_maps', true, 10, NOW(), NOW()),
  ('storefront_maps_on',         'Maps Group On',     'Group ON gate for storefront maps',                      'storefront_maps', true, 11, NOW(), NOW()),
  ('storefront_maps_interactive','Interactive Maps',  'Embedded interactive map on storefront',                 'storefront_maps', true, 20, NOW(), NOW()),
  ('storefront_maps_display',    'Map Display',       'Show map display on storefront',                         'storefront_maps', true, 21, NOW(), NOW()),
  ('storefront_maps_location',   'Location Display',  'Show location display on storefront',                    'storefront_maps', true, 22, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
  is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, updated_at = NOW();


-- ============================================================
-- STEP 4: Create storefront_maps capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'storefront_maps', 'Storefront Maps',
  'Storefront maps and location display — interactive maps, map display, location display.',
  'storefront_maps', true, 9, NOW(), NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, updated_at = NOW();


-- ============================================================
-- STEP 5: Link features to capability type
-- ============================================================

DO $$
DECLARE
  v_cap_key  TEXT  := 'storefront_maps';
  v_keys     TEXT[] := ARRAY[
    'storefront_maps_flexible','storefront_maps_enabled','storefront_maps_disabled',
    'storefront_maps','storefront_maps_on',
    'storefront_maps_interactive','storefront_maps_display','storefront_maps_location'
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
  v_tier TEXT;
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = 'storefront_maps' LIMIT 1;
  IF v_cap_id IS NULL THEN RAISE EXCEPTION 'Capability type storefront_maps not found'; END IF;

  -- Domain gates
  FOR v_new, v_old IN SELECT * FROM (VALUES
    ('storefront_maps_flexible','storefront_opt_flexible'),
    ('storefront_maps_enabled', 'storefront_opt_enabled'),
    ('storefront_maps_disabled','storefront_opt_disabled')
  ) AS t(n,o) LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    SELECT gen_random_uuid()::text, tfl.tier_id, v_cap_id, v_new, v_new, true, false,
      json_build_object('capability_type','storefront_maps')
    FROM tier_features_list tfl WHERE tfl.feature_key = v_old AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- Individual maps keys
  FOR v_new, v_old, v_name IN SELECT * FROM (VALUES
    ('storefront_maps_interactive', 'storefront_opt_interactive_maps',  'Interactive Maps'),
    ('storefront_maps_display',     'storefront_opt_map_display',       'Map Display'),
    ('storefront_maps_location',    'storefront_opt_location_display',  'Location Display')
  ) AS t(n,o,nm) LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    SELECT gen_random_uuid()::text, tfl.tier_id, v_cap_id, v_new, v_name, true, false,
      json_build_object('capability_type','storefront_maps')
    FROM tier_features_list tfl WHERE tfl.feature_key = v_old AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- Group gates (no old group gate for maps — assign to tiers with any maps feature enabled)
  FOR v_tier IN SELECT DISTINCT tier_id FROM tier_features_list
    WHERE capability_type_id = v_cap_id AND feature_key IN ('storefront_maps_interactive','storefront_maps_display','storefront_maps_location') AND is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier, v_cap_id, 'storefront_maps', 'Storefront Maps', true, false, '{"capability_type":"storefront_maps"}'),
      (gen_random_uuid()::text, v_tier, v_cap_id, 'storefront_maps_on', 'Maps Group On', true, false, '{"capability_type":"storefront_maps"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Maps tier feature assignments copied';
END $$;


-- ============================================================
-- STEP 7: Assign group keys to all tiers with maps enabled
-- ============================================================

DO $$
DECLARE
  v_cap_id TEXT; v_tier TEXT;
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = 'storefront_maps' LIMIT 1;
  IF v_cap_id IS NULL THEN RAISE EXCEPTION 'Capability type storefront_maps not found'; END IF;
  FOR v_tier IN SELECT DISTINCT tier_id FROM tier_features_list
    WHERE capability_type_id = v_cap_id AND feature_key = 'storefront_maps_enabled' AND is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier, v_cap_id, 'storefront_maps', 'Storefront Maps', true, false, '{"capability_type":"storefront_maps"}'),
      (gen_random_uuid()::text, v_tier, v_cap_id, 'storefront_maps_on', 'Maps Group On', true, false, '{"capability_type":"storefront_maps"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;
  RAISE NOTICE 'Maps group keys assigned to all enabled tiers';
END $$;


-- ============================================================
-- STEP 8: Unlink old maps keys from storefront_options
-- ============================================================

DELETE FROM capability_features_list
WHERE capability_type_id = (SELECT id FROM capability_type_list WHERE key = 'storefront_options' LIMIT 1)
AND feature_id IN (
  SELECT id FROM features_list WHERE key IN (
    'storefront_opt_interactive_maps','storefront_opt_map_display','storefront_opt_location_display'
  )
);


-- ============================================================
-- STEP 9: Link capability type to a representative tier
-- ============================================================

UPDATE capability_type_list SET tier_id = 'tier_professional'
WHERE key = 'storefront_maps' AND tier_id IS NULL;


-- ============================================================
-- STEP 10: Navigation link — Storefront Maps (tenant sidebar)
-- ============================================================

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-storefront-maps',
  'Storefront Maps',
  '/t/{tenantId}/settings/storefront-maps',
  'map',
  'NEW',
  'new',
  ARRAY['tenant'],
  (SELECT sort_order FROM navigation_links WHERE id = 'nav-tenant-storefront-layouts') + 10,
  true,
  false,
  '',
  'IS_TENANT_ADMIN',
  '',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-storefront-layouts'),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE id = 'nav-tenant-storefront-layouts')
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-storefront-maps')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-storefront-layouts');

UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-storefront-maps'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-storefront-layouts')
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-storefront-maps');


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================
-- SELECT count(*) FROM tenant_storefront_maps_settings;
-- SELECT * FROM capability_type_list WHERE key = 'storefront_maps';
-- SELECT key, name, sort_order FROM features_list WHERE category = 'storefront_maps' ORDER BY sort_order;
-- SELECT f.key FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'storefront_options' AND f.key IN ('storefront_opt_interactive_maps','storefront_opt_map_display','storefront_opt_location_display')
--   ORDER BY f.key;
-- (should return 0 rows)
