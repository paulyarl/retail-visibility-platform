-- ============================================================
-- Storefront QR Code Capability Split Migration
--
-- Extracts QR Code features from storefront_options into a new
-- storefront_qr capability type. Creates tenant_storefront_qr_settings
-- table for QR-specific merchant preferences.
--
-- Strategy: ADDITIVE and NON-BREAKING. Old feature keys and columns
--           remain intact. New keys are added alongside old ones.
--           Resolver will check new keys first, then fall back to old.
--
-- Prerequisites: features_list, capability_type_list,
--                capability_features_list, tier_features_list,
--                subscription_tiers_list, tenant_storefront_options_settings
--                tables must exist
-- Date: 2026-07-12
-- ============================================================


-- ============================================================
-- STEP 1: Create tenant_storefront_qr_settings table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_storefront_qr_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,

  -- Master toggle
  qr_enabled BOOLEAN DEFAULT true,

  -- Classic QR sub-group
  qr_classic_enabled BOOLEAN DEFAULT true,

  -- Styled QR sub-group
  qr_styled_enabled BOOLEAN DEFAULT false,
  qr_dot_type VARCHAR(30) DEFAULT 'rounded',
  qr_corner_type VARCHAR(30) DEFAULT 'extra-rounded',
  qr_dot_color VARCHAR(20) DEFAULT '#1a56db',
  qr_corner_color VARCHAR(20) DEFAULT '#1a56db',
  qr_bg_color VARCHAR(20) DEFAULT '#ffffff',
  qr_gradient_enabled BOOLEAN DEFAULT false,
  qr_gradient_start VARCHAR(20) DEFAULT '#1a56db',
  qr_gradient_end VARCHAR(20) DEFAULT '#7c3aed',

  -- QR resolution merchant prefs
  qr_codes_512 BOOLEAN DEFAULT false,
  qr_codes_1024 BOOLEAN DEFAULT true,
  qr_codes_2048 BOOLEAN DEFAULT false,
  default_qr_resolution VARCHAR(10) DEFAULT '1024',

  -- QR content type merchant prefs
  qr_product BOOLEAN DEFAULT true,
  qr_store BOOLEAN DEFAULT true,
  qr_logo BOOLEAN DEFAULT false,
  qr_directory BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_storefront_qr_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storefront_qr_tenant ON tenant_storefront_qr_settings(tenant_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_storefront_qr_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_storefront_qr_settings_updated_at ON tenant_storefront_qr_settings;
CREATE TRIGGER trigger_storefront_qr_settings_updated_at
  BEFORE UPDATE ON tenant_storefront_qr_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_storefront_qr_settings_updated_at();

-- Enable RLS
ALTER TABLE tenant_storefront_qr_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenants can only see their own row
DROP POLICY IF EXISTS tenant_storefront_qr_isolation ON tenant_storefront_qr_settings;
CREATE POLICY tenant_storefront_qr_isolation ON tenant_storefront_qr_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ============================================================
-- STEP 1b: Add missing QR styling columns to tenant_storefront_options_settings
-- ============================================================
-- These columns were added to Prisma schema but never had a DB migration.
-- We add them here so the data migration in Step 2 can read any saved values.

ALTER TABLE tenant_storefront_options_settings
  ADD COLUMN IF NOT EXISTS qr_dot_type VARCHAR(30) DEFAULT 'rounded',
  ADD COLUMN IF NOT EXISTS qr_corner_type VARCHAR(30) DEFAULT 'extra-rounded',
  ADD COLUMN IF NOT EXISTS qr_dot_color VARCHAR(20) DEFAULT '#1a56db',
  ADD COLUMN IF NOT EXISTS qr_corner_color VARCHAR(20) DEFAULT '#1a56db',
  ADD COLUMN IF NOT EXISTS qr_bg_color VARCHAR(20) DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS qr_gradient_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qr_gradient_start VARCHAR(20) DEFAULT '#1a56db',
  ADD COLUMN IF NOT EXISTS qr_gradient_end VARCHAR(20) DEFAULT '#7c3aed';


-- ============================================================
-- STEP 2: Migrate existing QR merchant prefs from tenant_storefront_options_settings
-- ============================================================

INSERT INTO tenant_storefront_qr_settings (
  id, tenant_id,
  qr_enabled, qr_classic_enabled, qr_styled_enabled,
  qr_dot_type, qr_corner_type, qr_dot_color, qr_corner_color, qr_bg_color,
  qr_gradient_enabled, qr_gradient_start, qr_gradient_end,
  qr_codes_512, qr_codes_1024, qr_codes_2048, default_qr_resolution,
  qr_product, qr_store, qr_logo, qr_directory,
  created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  tso.tenant_id,
  -- qr_enabled: derive from storefront_opt_enabled (default true)
  COALESCE(tso.storefront_opt_enabled, true),
  -- qr_classic_enabled: default true (classic is the default mode)
  true,
  -- qr_styled_enabled: derive from whether styled features are active
  -- (we check if qr_dot_type is set to something other than default, or if any styled pref is non-default)
  false,
  -- Styled QR prefs
  COALESCE(tso.qr_dot_type, 'rounded'),
  COALESCE(tso.qr_corner_type, 'extra-rounded'),
  COALESCE(tso.qr_dot_color, '#1a56db'),
  COALESCE(tso.qr_corner_color, '#1a56db'),
  COALESCE(tso.qr_bg_color, '#ffffff'),
  COALESCE(tso.qr_gradient_enabled, false),
  COALESCE(tso.qr_gradient_start, '#1a56db'),
  COALESCE(tso.qr_gradient_end, '#7c3aed'),
  -- Resolution prefs
  COALESCE(tso.qr_codes_512, false),
  COALESCE(tso.qr_codes_1024, true),
  COALESCE(tso.qr_codes_2048, false),
  COALESCE(tso.default_qr_resolution, '1024'),
  -- Content type prefs
  COALESCE(tso.qr_product, true),
  COALESCE(tso.qr_store, true),
  COALESCE(tso.qr_logo, false),
  COALESCE(tso.qr_directory, false),
  tso.created_at,
  tso.updated_at
FROM tenant_storefront_options_settings tso
WHERE tso.page_type = 'storefront' OR tso.page_type IS NULL
ON CONFLICT (tenant_id) DO NOTHING;


-- ============================================================
-- STEP 3: Insert storefront_qr feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  -- Domain master gates
  ('storefront_qr_flexible',           'QR Code Flexible',           'Flexible tier — unlocks all QR code features',                    'storefront_qr', true, 1,  NOW(), NOW()),
  ('storefront_qr_enabled',            'QR Code Enabled',            'Master gate — enables QR code capability',                        'storefront_qr', true, 2,  NOW(), NOW()),
  ('storefront_qr_disabled',           'QR Code Disabled',           'Master disable gate for QR code capability',                      'storefront_qr', true, 3,  NOW(), NOW()),

  -- QR group gate
  ('storefront_qr',                    'QR Code Display',            'Group gate — enables QR code generation',                         'storefront_qr', true, 10, NOW(), NOW()),
  ('storefront_qr_on',                 'QR Group On',                'Group ON gate for QR code generation',                            'storefront_qr', true, 11, NOW(), NOW()),

  -- QR resolution subgroup
  ('storefront_qr_resolution',         'QR Resolution',              'Consolidated key — unlocks all QR resolutions',                   'storefront_qr', true, 20, NOW(), NOW()),
  ('storefront_qr_resolution_512',     'QR 512px Resolution',        '512px QR code resolution',                                        'storefront_qr', true, 21, NOW(), NOW()),
  ('storefront_qr_resolution_1024',    'QR 1024px Resolution',       '1024px QR code resolution',                                       'storefront_qr', true, 22, NOW(), NOW()),
  ('storefront_qr_resolution_2048',    'QR 2048px Resolution',       '2048px QR code resolution',                                       'storefront_qr', true, 23, NOW(), NOW()),

  -- QR content types subgroup
  ('storefront_qr_content',            'QR Content Types',           'Consolidated key — unlocks all QR content types',                 'storefront_qr', true, 30, NOW(), NOW()),
  ('storefront_qr_product',            'Product QR',                 'QR codes linking to product pages',                               'storefront_qr', true, 31, NOW(), NOW()),
  ('storefront_qr_store',              'Store QR',                   'QR codes linking to store pages',                                 'storefront_qr', true, 32, NOW(), NOW()),
  ('storefront_qr_logo',               'Logo QR',                    'QR codes with embedded logo',                                     'storefront_qr', true, 33, NOW(), NOW()),
  ('storefront_qr_directory',          'Directory QR',               'QR codes linking to directory listings',                          'storefront_qr', true, 34, NOW(), NOW()),

  -- Classic QR sub-group (new — explicit classic mode)
  ('storefront_qr_classic',            'Classic QR Renderer',        'Classic QR code renderer (basic generation)',                     'storefront_qr', true, 40, NOW(), NOW()),
  ('storefront_qr_classic_on',         'Classic QR (On)',            'Group ON gate for classic QR renderer',                           'storefront_qr', true, 41, NOW(), NOW()),

  -- Styled QR sub-group
  ('storefront_qr_styled',             'QR Styled Renderer',         'Group gate — enables styled QR code rendering',                   'storefront_qr', true, 50, NOW(), NOW()),
  ('storefront_qr_styled_on',          'QR Styled (On)',             'Group ON gate for QR styled renderer',                            'storefront_qr', true, 51, NOW(), NOW()),
  ('storefront_qr_styled_off',         'QR Styled (Off)',            'Group OFF gate for QR styled renderer',                           'storefront_qr', true, 52, NOW(), NOW()),
  ('storefront_qr_styled_enabled',     'QR Styled (Legacy Enabled)', 'Legacy enabled gate for QR styled renderer (alias for _on)',      'storefront_qr', true, 53, NOW(), NOW()),
  ('storefront_qr_styled_disabled',    'QR Styled (Disabled)',       'Master disabled gate for QR styled renderer',                     'storefront_qr', true, 54, NOW(), NOW()),

  -- Dot styles subgroup
  ('storefront_qr_dot_styles',         'QR Dot Styles (All)',        'Subgroup gate — unlocks all QR dot styles',                       'storefront_qr', true, 60, NOW(), NOW()),
  ('storefront_qr_dot_styles_on',      'QR Dot Styles (On)',         'Subgroup ON gate for QR dot styles',                              'storefront_qr', true, 61, NOW(), NOW()),
  ('storefront_qr_dot_rounded',        'QR Dot: Rounded',            'Rounded dot style for QR codes',                                  'storefront_qr', true, 62, NOW(), NOW()),
  ('storefront_qr_dot_dots',           'QR Dot: Dots',               'Dots dot style for QR codes',                                     'storefront_qr', true, 63, NOW(), NOW()),
  ('storefront_qr_dot_classy',         'QR Dot: Classy',             'Classy dot style for QR codes',                                   'storefront_qr', true, 64, NOW(), NOW()),
  ('storefront_qr_dot_classy_rounded', 'QR Dot: Classy Rounded',     'Classy-rounded dot style for QR codes',                           'storefront_qr', true, 65, NOW(), NOW()),
  ('storefront_qr_dot_extra_rounded',  'QR Dot: Extra Rounded',      'Extra-rounded dot style for QR codes',                            'storefront_qr', true, 66, NOW(), NOW()),

  -- Corner styles subgroup
  ('storefront_qr_corner_styles',         'QR Corner Styles (All)',     'Subgroup gate — unlocks all QR corner square styles',         'storefront_qr', true, 70, NOW(), NOW()),
  ('storefront_qr_corner_styles_on',      'QR Corner Styles (On)',      'Subgroup ON gate for QR corner styles',                       'storefront_qr', true, 71, NOW(), NOW()),
  ('storefront_qr_corner_dot',            'QR Corner: Dot',             'Dot corner square style for QR codes',                        'storefront_qr', true, 72, NOW(), NOW()),
  ('storefront_qr_corner_extra_rounded',  'QR Corner: Extra Rounded',   'Extra-rounded corner square style for QR codes',              'storefront_qr', true, 73, NOW(), NOW()),
  ('storefront_qr_corner_rounded',        'QR Corner: Rounded',         'Rounded corner square style for QR codes',                    'storefront_qr', true, 74, NOW(), NOW()),

  -- Additional style features
  ('storefront_qr_custom_colors',      'QR Custom Colors',           'Allow custom foreground/background colors for QR codes',          'storefront_qr', true, 80, NOW(), NOW()),
  ('storefront_qr_gradients',          'QR Gradients',               'Allow gradient fills for QR code dots and corners',               'storefront_qr', true, 81, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 4: Create storefront_qr capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'storefront_qr',
  'Storefront QR Code',
  'QR code generation, styling, and content types for storefront.',
  'storefront_qr',
  true,
  5,
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
-- STEP 5: Link storefront_qr features to capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'storefront_qr';
  v_feature_keys         TEXT[] := ARRAY[
    'storefront_qr_flexible',
    'storefront_qr_enabled',
    'storefront_qr_disabled',
    'storefront_qr',
    'storefront_qr_on',
    'storefront_qr_resolution',
    'storefront_qr_resolution_512',
    'storefront_qr_resolution_1024',
    'storefront_qr_resolution_2048',
    'storefront_qr_content',
    'storefront_qr_product',
    'storefront_qr_store',
    'storefront_qr_logo',
    'storefront_qr_directory',
    'storefront_qr_classic',
    'storefront_qr_classic_on',
    'storefront_qr_styled',
    'storefront_qr_styled_on',
    'storefront_qr_styled_off',
    'storefront_qr_styled_enabled',
    'storefront_qr_styled_disabled',
    'storefront_qr_dot_styles',
    'storefront_qr_dot_styles_on',
    'storefront_qr_dot_rounded',
    'storefront_qr_dot_dots',
    'storefront_qr_dot_classy',
    'storefront_qr_dot_classy_rounded',
    'storefront_qr_dot_extra_rounded',
    'storefront_qr_corner_styles',
    'storefront_qr_corner_styles_on',
    'storefront_qr_corner_dot',
    'storefront_qr_corner_extra_rounded',
    'storefront_qr_corner_rounded',
    'storefront_qr_custom_colors',
    'storefront_qr_gradients'
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
-- For each new storefront_qr_* key, find all tiers that have the
-- corresponding old storefront_opt_qr_* key enabled and insert
-- the new key for those same tiers.
-- Domain gates (flexible/enabled/disabled) are copied from the
-- old storefront_opt_* master gates.

DO $$
DECLARE
  v_cap_type_id   TEXT;
  v_old_cap_type_id TEXT;
  v_new_key       TEXT;
  v_old_key       TEXT;
  v_feature_name  TEXT;
  v_tier_id       TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'storefront_qr' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type storefront_qr not found';
  END IF;

  -- Domain gates: copy from old storefront_opt master gates
  FOR v_new_key, v_old_key IN
    SELECT * FROM (VALUES
      ('storefront_qr_flexible', 'storefront_opt_flexible'),
      ('storefront_qr_enabled',  'storefront_opt_enabled'),
      ('storefront_qr_disabled', 'storefront_opt_disabled')
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
      json_build_object('capability_type', 'storefront_qr')
    FROM tier_features_list tfl
    WHERE tfl.feature_key = v_old_key
      AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;

    RAISE NOTICE 'Copied tier assignments: % <- %', v_new_key, v_old_key;
  END LOOP;

  -- Renamed QR keys: copy from old storefront_opt_qr_* keys
  FOR v_new_key, v_old_key, v_feature_name IN
    SELECT * FROM (VALUES
      -- QR group
      ('storefront_qr',                    'storefront_opt_qr',                    'QR Code Display'),
      ('storefront_qr_on',                 'storefront_opt_qr_on',                 'QR Group On'),
      -- QR resolution
      ('storefront_qr_resolution',         'storefront_opt_qr_resolution',         'QR Resolution'),
      ('storefront_qr_resolution_512',     'storefront_opt_qr_codes_512',          'QR 512px Resolution'),
      ('storefront_qr_resolution_1024',    'storefront_opt_qr_codes_1024',         'QR 1024px Resolution'),
      ('storefront_qr_resolution_2048',    'storefront_opt_qr_codes_2048',         'QR 2048px Resolution'),
      -- QR content types
      ('storefront_qr_content',            'storefront_opt_qr_content',            'QR Content Types'),
      ('storefront_qr_product',            'storefront_opt_qr_product',            'Product QR'),
      ('storefront_qr_store',              'storefront_opt_qr_store',              'Store QR'),
      ('storefront_qr_logo',               'storefront_opt_qr_logo',               'Logo QR'),
      ('storefront_qr_directory',          'storefront_opt_qr_directory',          'Directory QR'),
      -- Styled QR
      ('storefront_qr_styled',             'storefront_opt_qr_styled',             'QR Styled Renderer'),
      ('storefront_qr_styled_on',          'storefront_opt_qr_styled_on',          'QR Styled (On)'),
      ('storefront_qr_styled_off',         'storefront_opt_qr_styled_off',         'QR Styled (Off)'),
      ('storefront_qr_styled_enabled',     'storefront_opt_qr_styled_enabled',     'QR Styled (Legacy Enabled)'),
      ('storefront_qr_styled_disabled',    'storefront_opt_qr_styled_disabled',    'QR Styled (Disabled)'),
      -- Dot styles
      ('storefront_qr_dot_styles',         'storefront_opt_qr_dot_styles',         'QR Dot Styles (All)'),
      ('storefront_qr_dot_styles_on',      'storefront_opt_qr_dot_styles_on',      'QR Dot Styles (On)'),
      ('storefront_qr_dot_rounded',        'storefront_opt_qr_dot_rounded',        'QR Dot: Rounded'),
      ('storefront_qr_dot_dots',           'storefront_opt_qr_dot_dots',           'QR Dot: Dots'),
      ('storefront_qr_dot_classy',         'storefront_opt_qr_dot_classy',         'QR Dot: Classy'),
      ('storefront_qr_dot_classy_rounded', 'storefront_opt_qr_dot_classy_rounded', 'QR Dot: Classy Rounded'),
      ('storefront_qr_dot_extra_rounded',  'storefront_opt_qr_dot_extra_rounded',  'QR Dot: Extra Rounded'),
      -- Corner styles
      ('storefront_qr_corner_styles',         'storefront_opt_qr_corner_styles',         'QR Corner Styles (All)'),
      ('storefront_qr_corner_styles_on',      'storefront_opt_qr_corner_styles_on',      'QR Corner Styles (On)'),
      ('storefront_qr_corner_dot',            'storefront_opt_qr_corner_dot',            'QR Corner: Dot'),
      ('storefront_qr_corner_extra_rounded',  'storefront_opt_qr_corner_extra_rounded',  'QR Corner: Extra Rounded'),
      ('storefront_qr_corner_rounded',        'storefront_opt_qr_corner_rounded',        'QR Corner: Rounded'),
      -- Additional style features
      ('storefront_qr_custom_colors',      'storefront_opt_qr_custom_colors',      'QR Custom Colors'),
      ('storefront_qr_gradients',          'storefront_opt_qr_gradients',          'QR Gradients')
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
      json_build_object('capability_type', 'storefront_qr')
    FROM tier_features_list tfl
    WHERE tfl.feature_key = v_old_key
      AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;

    RAISE NOTICE 'Copied tier assignments: % <- %', v_new_key, v_old_key;
  END LOOP;

  RAISE NOTICE 'QR tier feature assignments copied from old keys to new keys';
END $$;


-- ============================================================
-- STEP 7: Assign new classic QR keys to all tiers with QR enabled
-- ============================================================
-- storefront_qr_classic and storefront_qr_classic_on are new keys
-- with no old equivalent. Assign them to all tiers that have
-- storefront_qr_enabled (which was copied from storefront_opt_enabled).

DO $$
DECLARE
  v_cap_type_id TEXT;
  v_tier_id     TEXT;
  v_tier_key    TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'storefront_qr' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type storefront_qr not found';
  END IF;

  FOR v_tier_id IN
    SELECT DISTINCT tfl.tier_id
    FROM tier_features_list tfl
    WHERE tfl.capability_type_id = v_cap_type_id
      AND tfl.feature_key = 'storefront_qr_enabled'
      AND tfl.is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_qr_classic',     'Classic QR Renderer', true, false, '{"capability_type": "storefront_qr"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_qr_classic_on',  'Classic QR (On)',     true, false, '{"capability_type": "storefront_qr"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Classic QR keys assigned to all tiers with QR enabled';
END $$;


-- ============================================================
-- STEP 8: Unlink old QR keys from storefront_options capability type
-- ============================================================
-- Old storefront_opt_qr_* keys remain in features_list and
-- tier_features_list for backward compatibility, but are removed
-- from capability_features_list for the storefront_options type.

DELETE FROM capability_features_list
WHERE capability_type_id = (
  SELECT id FROM capability_type_list WHERE key = 'storefront_options' LIMIT 1
)
AND feature_id IN (
  SELECT id FROM features_list
  WHERE key IN (
    'storefront_opt_qr',
    'storefront_opt_qr_on',
    'storefront_opt_qr_resolution',
    'storefront_opt_qr_codes_512',
    'storefront_opt_qr_codes_1024',
    'storefront_opt_qr_codes_2048',
    'storefront_opt_qr_content',
    'storefront_opt_qr_product',
    'storefront_opt_qr_store',
    'storefront_opt_qr_logo',
    'storefront_opt_qr_directory',
    'storefront_opt_qr_styled',
    'storefront_opt_qr_styled_on',
    'storefront_opt_qr_styled_off',
    'storefront_opt_qr_styled_enabled',
    'storefront_opt_qr_styled_disabled',
    'storefront_opt_qr_dot_styles',
    'storefront_opt_qr_dot_styles_on',
    'storefront_opt_qr_dot_rounded',
    'storefront_opt_qr_dot_dots',
    'storefront_opt_qr_dot_classy',
    'storefront_opt_qr_dot_classy_rounded',
    'storefront_opt_qr_dot_extra_rounded',
    'storefront_opt_qr_corner_styles',
    'storefront_opt_qr_corner_styles_on',
    'storefront_opt_qr_corner_dot',
    'storefront_opt_qr_corner_extra_rounded',
    'storefront_opt_qr_corner_rounded',
    'storefront_opt_qr_custom_colors',
    'storefront_opt_qr_gradients'
  )
);

-- Unlinked old QR keys from storefront_options capability type


-- ============================================================
-- STEP 9: Link capability type to a representative tier (for admin UI)
-- ============================================================

UPDATE capability_type_list ct
SET tier_id = 'tier_professional'
WHERE ct.key = 'storefront_qr'
  AND ct.tier_id IS NULL;


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Verify table exists
-- SELECT count(*) FROM tenant_storefront_qr_settings;

-- Verify capability type
-- SELECT * FROM capability_type_list WHERE key = 'storefront_qr';

-- Verify storefront_qr features
-- SELECT key, name, sort_order FROM features_list WHERE category = 'storefront_qr' ORDER BY sort_order;

-- Verify capability-feature links
-- SELECT f.key, f.name FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'storefront_qr'
--   ORDER BY cf.sort_order;

-- Verify old QR keys are unlinked from storefront_options
-- SELECT f.key FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'storefront_options' AND f.key LIKE 'storefront_opt_qr_%'
--   ORDER BY f.key;
-- (should return 0 rows)

-- Verify tier features for Professional (storefront_qr)
-- SELECT tf.feature_key, tf.feature_name FROM tier_features_list tf
--   WHERE tf.tier_id = (SELECT id FROM subscription_tiers_list WHERE tier_key = 'professional')
--   AND tf.feature_key LIKE 'storefront_qr_%'
--   ORDER BY tf.feature_key;

-- Verify data migration
-- SELECT tqs.tenant_id, tqs.qr_enabled, tqs.qr_dot_type, tqs.default_qr_resolution
-- FROM tenant_storefront_qr_settings tqs
-- LIMIT 10;

-- ============================================================
-- STEP 6: Navigation link — QR Codes (tenant sidebar)
-- Adds a "QR Codes" link under "My Storefront" in the tenant sidebar
-- Uses dynamic parent lookup (parent IDs differ between environments)
-- ============================================================

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-storefront-qr',
  'QR Codes',
  '/t/{tenantId}/settings/storefront-qr',
  'qr',
  'NEW',
  'new',
  ARRAY['tenant'],
  (SELECT sort_order FROM navigation_links WHERE id = 'nav-tenant-storefront-policies') + 10,
  true,
  false,
  '',
  'IS_TENANT_ADMIN',
  '',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-storefront-policies'),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE id = 'nav-tenant-storefront-policies')
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-storefront-qr')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-storefront-policies');

-- Update parent to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-storefront-qr'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-storefront-policies')
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-storefront-qr');
