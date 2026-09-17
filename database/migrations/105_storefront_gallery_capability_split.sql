-- ============================================================
-- Storefront Gallery Capability Split Migration
--
-- Extracts Gallery features from storefront_options into a new
-- storefront_gallery capability type. Creates tenant_storefront_gallery_settings
-- table for Gallery-specific merchant preferences.
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
-- STEP 1: Create tenant_storefront_gallery_settings table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_storefront_gallery_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,

  -- Master toggle
  gallery_enabled BOOLEAN DEFAULT true,

  -- Display mode (carousel vs magazine)
  gallery_display_mode VARCHAR(20) DEFAULT 'carousel',

  -- Image limit merchant prefs
  image_gallery_5 BOOLEAN DEFAULT true,
  image_gallery_10 BOOLEAN DEFAULT false,
  image_gallery_15 BOOLEAN DEFAULT false,
  default_gallery_limit INTEGER DEFAULT 5,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_storefront_gallery_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storefront_gallery_tenant ON tenant_storefront_gallery_settings(tenant_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_storefront_gallery_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_storefront_gallery_settings_updated_at ON tenant_storefront_gallery_settings;
CREATE TRIGGER trigger_storefront_gallery_settings_updated_at
  BEFORE UPDATE ON tenant_storefront_gallery_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_storefront_gallery_settings_updated_at();

-- Enable RLS
ALTER TABLE tenant_storefront_gallery_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenants can only see their own row
DROP POLICY IF EXISTS tenant_storefront_gallery_isolation ON tenant_storefront_gallery_settings;
CREATE POLICY tenant_storefront_gallery_isolation ON tenant_storefront_gallery_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ============================================================
-- STEP 2: Migrate existing gallery merchant prefs from tenant_storefront_options_settings
-- ============================================================

INSERT INTO tenant_storefront_gallery_settings (
  id, tenant_id,
  gallery_enabled, gallery_display_mode,
  image_gallery_5, image_gallery_10, image_gallery_15, default_gallery_limit,
  created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  tso.tenant_id,
  COALESCE(tso.storefront_opt_enabled, true),
  COALESCE(tso.gallery_display_mode, 'carousel'),
  COALESCE(tso.image_gallery_5, true),
  COALESCE(tso.image_gallery_10, false),
  COALESCE(tso.image_gallery_15, false),
  COALESCE(tso.default_gallery_limit, 5),
  tso.created_at,
  tso.updated_at
FROM tenant_storefront_options_settings tso
WHERE tso.page_type = 'storefront' OR tso.page_type IS NULL
ON CONFLICT (tenant_id) DO NOTHING;


-- ============================================================
-- STEP 3: Insert storefront_gallery feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  -- Domain master gates
  ('storefront_gallery_flexible',     'Gallery Flexible',      'Flexible tier — unlocks all gallery features',              'storefront_gallery', true, 1,  NOW(), NOW()),
  ('storefront_gallery_enabled',      'Gallery Enabled',       'Master gate — enables gallery capability',                  'storefront_gallery', true, 2,  NOW(), NOW()),
  ('storefront_gallery_disabled',     'Gallery Disabled',      'Master disable gate for gallery capability',                'storefront_gallery', true, 3,  NOW(), NOW()),

  -- Gallery group gate
  ('storefront_gallery',              'Gallery Display',       'Group gate — enables image gallery',                        'storefront_gallery', true, 10, NOW(), NOW()),
  ('storefront_gallery_on',           'Gallery Group On',      'Group ON gate for image gallery',                           'storefront_gallery', true, 11, NOW(), NOW()),

  -- Image limits
  ('storefront_gallery_limit_5',      '5 Image Gallery',       'Allow up to 5 images in gallery',                           'storefront_gallery', true, 20, NOW(), NOW()),
  ('storefront_gallery_limit_10',     '10 Image Gallery',      'Allow up to 10 images in gallery',                         'storefront_gallery', true, 21, NOW(), NOW()),
  ('storefront_gallery_limit_15',     '15 Image Gallery',      'Allow up to 15 images in gallery',                         'storefront_gallery', true, 22, NOW(), NOW()),

  -- Carousel sub-group (new — explicit carousel mode)
  ('storefront_gallery_carousel',     'Carousel Gallery',      'Carousel gallery display mode (one image at a time)',       'storefront_gallery', true, 30, NOW(), NOW()),
  ('storefront_gallery_carousel_on',  'Carousel Gallery (On)', 'Group ON gate for carousel gallery mode',                   'storefront_gallery', true, 31, NOW(), NOW()),

  -- Magazine sub-group
  ('storefront_gallery_magazine',     'Magazine Gallery',      'Magazine/mosaic gallery display mode (all images at once)', 'storefront_gallery', true, 40, NOW(), NOW()),
  ('storefront_gallery_magazine_on',  'Magazine Gallery (On)', 'Group ON gate for magazine gallery mode',                   'storefront_gallery', true, 41, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 4: Create storefront_gallery capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'storefront_gallery',
  'Storefront Gallery',
  'Image gallery display modes, limits, and carousel/magazine layouts for storefront.',
  'storefront_gallery',
  true,
  6,
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
-- STEP 5: Link storefront_gallery features to capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'storefront_gallery';
  v_feature_keys         TEXT[] := ARRAY[
    'storefront_gallery_flexible',
    'storefront_gallery_enabled',
    'storefront_gallery_disabled',
    'storefront_gallery',
    'storefront_gallery_on',
    'storefront_gallery_limit_5',
    'storefront_gallery_limit_10',
    'storefront_gallery_limit_15',
    'storefront_gallery_carousel',
    'storefront_gallery_carousel_on',
    'storefront_gallery_magazine',
    'storefront_gallery_magazine_on'
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
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'storefront_gallery' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type storefront_gallery not found';
  END IF;

  -- Domain gates: copy from old storefront_opt master gates
  FOR v_new_key, v_old_key IN
    SELECT * FROM (VALUES
      ('storefront_gallery_flexible', 'storefront_opt_flexible'),
      ('storefront_gallery_enabled',  'storefront_opt_enabled'),
      ('storefront_gallery_disabled', 'storefront_opt_disabled')
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
      json_build_object('capability_type', 'storefront_gallery')
    FROM tier_features_list tfl
    WHERE tfl.feature_key = v_old_key
      AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;

    RAISE NOTICE 'Copied tier assignments: % <- %', v_new_key, v_old_key;
  END LOOP;

  -- Renamed gallery keys: copy from old storefront_opt_gallery_* keys
  FOR v_new_key, v_old_key, v_feature_name IN
    SELECT * FROM (VALUES
      ('storefront_gallery',              'storefront_opt_gallery',              'Gallery Display'),
      ('storefront_gallery_on',           'storefront_opt_gallery_on',           'Gallery Group On'),
      ('storefront_gallery_limit_5',      'storefront_opt_image_gallery_5',      '5 Image Gallery'),
      ('storefront_gallery_limit_10',     'storefront_opt_image_gallery_10',     '10 Image Gallery'),
      ('storefront_gallery_limit_15',     'storefront_opt_image_gallery_15',     '15 Image Gallery'),
      ('storefront_gallery_magazine',     'storefront_opt_gallery_magazine',     'Magazine Gallery')
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
      json_build_object('capability_type', 'storefront_gallery')
    FROM tier_features_list tfl
    WHERE tfl.feature_key = v_old_key
      AND tfl.is_enabled = true
    ON CONFLICT (tier_id, feature_key) DO NOTHING;

    RAISE NOTICE 'Copied tier assignments: % <- %', v_new_key, v_old_key;
  END LOOP;

  RAISE NOTICE 'Gallery tier feature assignments copied from old keys to new keys';
END $$;


-- ============================================================
-- STEP 7: Assign new carousel/magazine_on keys to all tiers with gallery enabled
-- ============================================================

DO $$
DECLARE
  v_cap_type_id TEXT;
  v_tier_id     TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'storefront_gallery' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type storefront_gallery not found';
  END IF;

  FOR v_tier_id IN
    SELECT DISTINCT tfl.tier_id
    FROM tier_features_list tfl
    WHERE tfl.capability_type_id = v_cap_type_id
      AND tfl.feature_key = 'storefront_gallery_enabled'
      AND tfl.is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_gallery_carousel',     'Carousel Gallery',      true, false, '{"capability_type": "storefront_gallery"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_gallery_carousel_on',  'Carousel Gallery (On)', true, false, '{"capability_type": "storefront_gallery"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_gallery_magazine_on',  'Magazine Gallery (On)', true, false, '{"capability_type": "storefront_gallery"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Carousel and magazine_on keys assigned to all tiers with gallery enabled';
END $$;


-- ============================================================
-- STEP 8: Unlink old gallery keys from storefront_options capability type
-- ============================================================

DELETE FROM capability_features_list
WHERE capability_type_id = (
  SELECT id FROM capability_type_list WHERE key = 'storefront_options' LIMIT 1
)
AND feature_id IN (
  SELECT id FROM features_list
  WHERE key IN (
    'storefront_opt_gallery',
    'storefront_opt_gallery_on',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5',
    'storefront_opt_image_gallery_10',
    'storefront_opt_image_gallery_15',
    'storefront_opt_gallery_magazine'
  )
);

-- Unlinked old gallery keys from storefront_options capability type


-- ============================================================
-- STEP 9: Link capability type to a representative tier (for admin UI)
-- ============================================================

UPDATE capability_type_list ct
SET tier_id = 'tier_professional'
WHERE ct.key = 'storefront_gallery'
  AND ct.tier_id IS NULL;


-- ============================================================
-- STEP 10: Navigation link — Image Gallery (tenant sidebar)
-- ============================================================

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-storefront-gallery',
  'Image Gallery',
  '/t/{tenantId}/settings/storefront-gallery',
  'image',
  'NEW',
  'new',
  ARRAY['tenant'],
  (SELECT sort_order FROM navigation_links WHERE id = 'nav-tenant-storefront-qr') + 10,
  true,
  false,
  '',
  'IS_TENANT_ADMIN',
  '',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-storefront-qr'),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE id = 'nav-tenant-storefront-qr')
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-storefront-gallery')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-storefront-qr');

-- Update parent to include this child in childrenKeys
UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-storefront-gallery'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-storefront-qr')
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-storefront-gallery');


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Verify table exists
-- SELECT count(*) FROM tenant_storefront_gallery_settings;

-- Verify capability type
-- SELECT * FROM capability_type_list WHERE key = 'storefront_gallery';

-- Verify storefront_gallery features
-- SELECT key, name, sort_order FROM features_list WHERE category = 'storefront_gallery' ORDER BY sort_order;

-- Verify capability-feature links
-- SELECT f.key, f.name FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'storefront_gallery'
--   ORDER BY cf.sort_order;

-- Verify old gallery keys are unlinked from storefront_options
-- SELECT f.key FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'storefront_options' AND f.key LIKE 'storefront_opt_gallery%'
--   ORDER BY f.key;
-- (should return 0 rows)

-- Verify tier features for Professional (storefront_gallery)
-- SELECT tf.feature_key, tf.feature_name FROM tier_features_list tf
--   WHERE tf.tier_id = (SELECT id FROM subscription_tiers_list WHERE tier_key = 'professional')
--   AND tf.feature_key LIKE 'storefront_gallery%'
--   ORDER BY tf.feature_key;

-- Verify data migration
-- SELECT tgs.tenant_id, tgs.gallery_enabled, tgs.gallery_display_mode, tgs.default_gallery_limit
-- FROM tenant_storefront_gallery_settings tgs
-- LIMIT 10;
