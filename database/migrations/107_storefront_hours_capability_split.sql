-- ============================================================
-- Storefront Hours Capability Split Migration
--
-- Extracts Hours features from storefront_options into a new
-- storefront_hours capability type. Creates tenant_storefront_hours_settings
-- table for Hours-specific merchant preferences.
--
-- Strategy: ADDITIVE and NON-BREAKING. Old feature keys and columns
--           remain intact. New keys are added alongside old ones.
--           Resolver will check new keys first, then fall back to old.
--
-- Prerequisites: features_list, capability_type_list,
--                capability_features_list, tier_features_list,
--                subscription_tiers_list, tenant_storefront_options_settings
--                tables must exist
-- Date: 2026-07-13
-- ============================================================


-- ============================================================
-- STEP 1: Create tenant_storefront_hours_settings table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_storefront_hours_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,

  -- Master toggle
  hours_enabled BOOLEAN DEFAULT true,

  -- Hours display toggle
  hours_display BOOLEAN DEFAULT true,

  -- Hours sub-features
  hours_animated BOOLEAN DEFAULT true,
  hours_status BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_storefront_hours_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storefront_hours_tenant ON tenant_storefront_hours_settings(tenant_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_storefront_hours_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_storefront_hours_settings_updated_at ON tenant_storefront_hours_settings;
CREATE TRIGGER trigger_storefront_hours_settings_updated_at
  BEFORE UPDATE ON tenant_storefront_hours_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_storefront_hours_settings_updated_at();

-- Enable RLS
ALTER TABLE tenant_storefront_hours_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenants can only see their own row
DROP POLICY IF EXISTS tenant_storefront_hours_isolation ON tenant_storefront_hours_settings;
CREATE POLICY tenant_storefront_hours_isolation ON tenant_storefront_hours_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ============================================================
-- STEP 2: Migrate existing hours merchant prefs from tenant_storefront_options_settings
-- ============================================================

INSERT INTO tenant_storefront_hours_settings (
  id, tenant_id,
  hours_enabled, hours_display, hours_animated, hours_status,
  created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  tso.tenant_id,
  COALESCE(tso.storefront_opt_enabled, true),
  COALESCE(tso.hours_display, true),
  COALESCE(tso.hours_animated, true),
  COALESCE(tso.hours_status, true),
  tso.created_at,
  tso.updated_at
FROM tenant_storefront_options_settings tso
WHERE tso.page_type = 'storefront' OR tso.page_type IS NULL
ON CONFLICT (tenant_id) DO NOTHING;


-- ============================================================
-- STEP 3: Insert storefront_hours feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  -- Domain master gates
  ('storefront_hours_flexible',     'Hours Flexible',      'Flexible tier — unlocks all hours features',              'storefront_hours', true, 1,  NOW(), NOW()),
  ('storefront_hours_enabled',      'Hours Enabled',       'Master gate — enables business hours capability',         'storefront_hours', true, 2,  NOW(), NOW()),
  ('storefront_hours_disabled',     'Hours Disabled',      'Master disable gate for business hours capability',       'storefront_hours', true, 3,  NOW(), NOW()),

  -- Hours group gate
  ('storefront_hours',              'Business Hours',      'Group gate — enables business hours display',             'storefront_hours', true, 10, NOW(), NOW()),
  ('storefront_hours_on',           'Hours Group On',      'Group ON gate for business hours',                        'storefront_hours', true, 11, NOW(), NOW()),

  -- Hours display (separate from group — controls whether hours section shows)
  ('storefront_hours_display',      'Hours Display',       'Enables hours display section on storefront',             'storefront_hours', true, 20, NOW(), NOW()),

  -- Individual hours features
  ('storefront_hours_animated',     'Animated Hours',      'Animated hours display (open/closed indicators)',         'storefront_hours', true, 30, NOW(), NOW()),
  ('storefront_hours_status',       'Hours Status',        'Open/closed status indicator from business hours',        'storefront_hours', true, 31, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 4: Create storefront_hours capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'storefront_hours',
  'Storefront Hours',
  'Business hours display, animated indicators, and open/closed status for storefront.',
  'storefront_hours',
  true,
  7,
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
-- STEP 5: Link storefront_hours features to capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'storefront_hours';
  v_feature_keys         TEXT[] := ARRAY[
    'storefront_hours_flexible',
    'storefront_hours_enabled',
    'storefront_hours_disabled',
    'storefront_hours',
    'storefront_hours_on',
    'storefront_hours_display',
    'storefront_hours_animated',
    'storefront_hours_status'
  ];
  v_capability_type_id TEXT;
  v_missing_keys       TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  IF v_capability_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type % not found', v_capability_type_key;
  END IF;

  FOR i IN 1 .. array_length(v_feature_keys, 1) LOOP
    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    SELECT v_capability_type_id, fl.id, true, i, NOW(), NOW()
    FROM features_list fl
    WHERE fl.key = v_feature_keys[i]
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET is_active = true, sort_order = i;

    IF NOT FOUND THEN
      v_missing_keys := array_append(v_missing_keys, v_feature_keys[i]);
      RAISE NOTICE 'Feature key not found in features_list: %', v_feature_keys[i];
    END IF;
  END LOOP;

  IF array_length(v_missing_keys, 1) > 0 THEN
    RAISE NOTICE 'Missing feature keys (skipped): %', v_missing_keys;
  END IF;

  RAISE NOTICE 'Linked % features to capability type %', array_length(v_feature_keys, 1) - COALESCE(array_length(v_missing_keys, 1), 0), v_capability_type_key;
END $$;


-- ============================================================
-- STEP 6: Copy tier assignments from old keys to new keys
-- ============================================================

DO $$
DECLARE
  v_cap_type_id   TEXT;
  v_new_key       TEXT;
  v_old_key       TEXT;
  v_feature_name  TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'storefront_hours' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type storefront_hours not found';
  END IF;

  -- Domain gates: copy from old storefront_opt master gates
  FOR v_new_key, v_old_key IN
    SELECT * FROM (VALUES
      ('storefront_hours_flexible', 'storefront_opt_flexible'),
      ('storefront_hours_enabled',  'storefront_opt_enabled'),
      ('storefront_hours_disabled', 'storefront_opt_disabled')
    ) AS t(new_key, old_key)
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    SELECT
      gen_random_uuid()::text,
      tfl.tier_id,
      v_cap_type_id,
      v_new_key,
      v_new_key,
      true,
      false,
      json_build_object('capability_type', 'storefront_hours')
    FROM tier_features_list tfl
    WHERE tfl.feature_key = v_old_key
      AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;

    RAISE NOTICE 'Copied tier assignments: % <- %', v_new_key, v_old_key;
  END LOOP;

  -- Renamed hours keys: copy from old storefront_opt_hours_* keys
  FOR v_new_key, v_old_key, v_feature_name IN
    SELECT * FROM (VALUES
      ('storefront_hours_display',   'storefront_opt_hours_display',   'Hours Display'),
      ('storefront_hours_animated',  'storefront_opt_hours_animated',  'Animated Hours'),
      ('storefront_hours_status',    'storefront_opt_hours_status',    'Hours Status')
    ) AS t(new_key, old_key, feature_name)
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    SELECT
      gen_random_uuid()::text,
      tfl.tier_id,
      v_cap_type_id,
      v_new_key,
      v_feature_name,
      true,
      false,
      json_build_object('capability_type', 'storefront_hours')
    FROM tier_features_list tfl
    WHERE tfl.feature_key = v_old_key
      AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;

    RAISE NOTICE 'Copied tier assignments: % <- %', v_new_key, v_old_key;
  END LOOP;

  -- Group gate: copy from old storefront_opt_hours_on / storefront_opt_hours_enabled
  FOR v_new_key, v_old_key, v_feature_name IN
    SELECT * FROM (VALUES
      ('storefront_hours_on', 'storefront_opt_hours_on',     'Hours Group On'),
      ('storefront_hours',    'storefront_opt_hours_enabled', 'Business Hours')
    ) AS t(new_key, old_key, feature_name)
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    SELECT
      gen_random_uuid()::text,
      tfl.tier_id,
      v_cap_type_id,
      v_new_key,
      v_feature_name,
      true,
      false,
      json_build_object('capability_type', 'storefront_hours')
    FROM tier_features_list tfl
    WHERE tfl.feature_key = v_old_key
      AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;

    RAISE NOTICE 'Copied tier assignments: % <- %', v_new_key, v_old_key;
  END LOOP;

  RAISE NOTICE 'Hours tier feature assignments copied from old keys to new keys';
END $$;


-- ============================================================
-- STEP 7: Assign storefront_hours group key to all tiers with hours enabled
-- ============================================================

DO $$
DECLARE
  v_cap_type_id TEXT;
  v_tier_id     TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'storefront_hours' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type storefront_hours not found';
  END IF;

  FOR v_tier_id IN
    SELECT DISTINCT tfl.tier_id
    FROM tier_features_list tfl
    WHERE tfl.capability_type_id = v_cap_type_id
      AND tfl.feature_key = 'storefront_hours_enabled'
      AND tfl.is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_hours', 'Business Hours', true, false, '{"capability_type": "storefront_hours"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_hours_on', 'Hours Group On', true, false, '{"capability_type": "storefront_hours"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Hours group keys assigned to all tiers with hours enabled';
END $$;


-- ============================================================
-- STEP 8: Unlink old hours keys from storefront_options capability type
-- ============================================================

DELETE FROM capability_features_list
WHERE capability_type_id = (
  SELECT id FROM capability_type_list WHERE key = 'storefront_options' LIMIT 1
)
AND feature_id IN (
  SELECT id FROM features_list
  WHERE key IN (
    'storefront_opt_hours_display',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_hours_on',
    'storefront_opt_hours_enabled'
  )
);

-- Unlinked old hours keys from storefront_options capability type


-- ============================================================
-- STEP 9: Link capability type to a representative tier (for admin UI)
-- ============================================================

UPDATE capability_type_list ct
SET tier_id = 'tier_professional'
WHERE ct.key = 'storefront_hours'
  AND ct.tier_id IS NULL;


-- ============================================================
-- STEP 10: Navigation link — Business Hours (tenant sidebar)
-- ============================================================

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-storefront-hours',
  'Business Hours',
  '/t/{tenantId}/settings/storefront-hours',
  'clock',
  'NEW',
  'new',
  ARRAY['tenant'],
  (SELECT sort_order FROM navigation_links WHERE id = 'nav-tenant-storefront-gallery') + 10,
  true,
  false,
  '',
  'IS_TENANT_ADMIN',
  '',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-storefront-gallery'),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE id = 'nav-tenant-storefront-gallery')
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-storefront-hours')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-storefront-gallery');

-- Update parent to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-storefront-hours'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-storefront-gallery')
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-storefront-hours');


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Verify table exists
-- SELECT count(*) FROM tenant_storefront_hours_settings;

-- Verify capability type
-- SELECT * FROM capability_type_list WHERE key = 'storefront_hours';

-- Verify storefront_hours features
-- SELECT key, name, sort_order FROM features_list WHERE category = 'storefront_hours' ORDER BY sort_order;

-- Verify capability-feature links
-- SELECT f.key, f.name FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'storefront_hours'
--   ORDER BY cf.sort_order;

-- Verify old hours keys are unlinked from storefront_options
-- SELECT f.key FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'storefront_options' AND f.key LIKE 'storefront_opt_hours%'
--   ORDER BY f.key;
-- (should return 0 rows)

-- Verify tier features for Professional (storefront_hours)
-- SELECT tf.feature_key, tf.feature_name FROM tier_features_list tf
--   WHERE tf.tier_id = (SELECT id FROM subscription_tiers_list WHERE tier_key = 'professional')
--   AND tf.feature_key LIKE 'storefront_hours%'
--   ORDER BY tf.feature_key;

-- Verify data migration
-- SELECT ths.tenant_id, ths.hours_enabled, ths.hours_display, ths.hours_animated, ths.hours_status
-- FROM tenant_storefront_hours_settings ths
-- LIMIT 10;
