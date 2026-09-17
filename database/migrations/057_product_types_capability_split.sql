-- ============================================================
-- Product Types Capability Split Migration
--
-- Creates: tenant_product_types_settings table
-- Adds:    product_types capability type + feature keys + tier assignments
-- Adds:    product_options_* feature keys (new canonical names)
-- Migrates: type preference columns from tenant_product_options_settings
--
-- Strategy: ADDITIVE and NON-BREAKING. Old feature keys and columns
--           remain intact. New keys are added alongside old ones.
--           Resolvers will check new keys first, then fall back to old.
--
-- Prerequisites: features_list, capability_type_list, capability_features_list,
--                tier_features_list, subscription_tiers_list,
--                tenant_product_options_settings tables must exist
-- Date: 2026-06-26
-- ============================================================


-- ============================================================
-- STEP 1: Create tenant_product_types_settings table
-- ============================================================
-- Mirrors tenant_storefront_type_settings

CREATE TABLE IF NOT EXISTS tenant_product_types_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,

  -- Master toggle
  product_types_enabled BOOLEAN DEFAULT true,

  -- Merchant-selected product type when tier allows multiple
  selected_product_type VARCHAR(20) DEFAULT 'physical',

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_product_types_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_types_tenant ON tenant_product_types_settings(tenant_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_product_types_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_types_settings_updated_at ON tenant_product_types_settings;
CREATE TRIGGER trigger_product_types_settings_updated_at
  BEFORE UPDATE ON tenant_product_types_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_product_types_settings_updated_at();

-- Enable RLS
ALTER TABLE tenant_product_types_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenants can only see their own row
DROP POLICY IF EXISTS tenant_product_types_isolation ON tenant_product_types_settings;
CREATE POLICY tenant_product_types_isolation ON tenant_product_types_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ============================================================
-- STEP 2: Migrate type preferences from tenant_product_options_settings
-- ============================================================
-- For each existing row in tenant_product_options_settings, create a
-- corresponding row in tenant_product_types_settings with the type
-- preference columns copied over.

INSERT INTO tenant_product_types_settings (id, tenant_id, product_types_enabled, selected_product_type, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  tpo.tenant_id,
  -- product_types_enabled: derive from product_enabled feature (default true)
  true,
  -- selected_product_type: pick the first enabled type from merchant prefs
  CASE
    WHEN tpo.product_physical_enabled = true THEN 'physical'
    WHEN tpo.product_digital_enabled = true THEN 'digital'
    WHEN tpo.product_hybrid_enabled = true THEN 'hybrid'
    WHEN tpo.product_service_enabled = true THEN 'service'
    ELSE 'physical'
  END,
  tpo.created_at,
  tpo.updated_at
FROM tenant_product_options_settings tpo
ON CONFLICT (tenant_id) DO NOTHING;


-- ============================================================
-- STEP 3: Add new columns to tenant_product_options_settings
-- ============================================================
-- Additive only — old columns remain for backward compatibility

ALTER TABLE tenant_product_options_settings
  ADD COLUMN IF NOT EXISTS product_options_enabled BOOLEAN DEFAULT true;

ALTER TABLE tenant_product_options_settings
  ADD COLUMN IF NOT EXISTS product_options_disabled BOOLEAN DEFAULT false;

ALTER TABLE tenant_product_options_settings
  ADD COLUMN IF NOT EXISTS page_type VARCHAR(20) DEFAULT 'product';

-- Copy existing merchant pref values into new columns (for backward compat)
UPDATE tenant_product_options_settings
SET
  product_options_enabled = true
WHERE product_options_enabled IS NULL;


-- ============================================================
-- STEP 4: Insert product_types feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  -- Master gates
  ('product_types_enabled',   'Product Types Enabled',    'Master gate — enables product types capability',          'product_types', true, 1,  NOW(), NOW()),
  ('product_types_disabled',  'Product Types Disabled',   'Master disable gate for product types',                   'product_types', true, 2,  NOW(), NOW()),
  ('product_types_flexible',  'Product Types Flexible',   'Flexible tier — unlocks all product types',               'product_types', true, 3,  NOW(), NOW()),

  -- Type gates
  ('product_types_physical',  'Physical Products',        'Enable physical/tangible product type',                   'product_types', true, 10, NOW(), NOW()),
  ('product_types_digital',   'Digital Products',         'Enable digital/downloadable product type',                'product_types', true, 11, NOW(), NOW()),
  ('product_types_hybrid',    'Hybrid Products',          'Enable hybrid (physical + digital) product type',         'product_types', true, 12, NOW(), NOW()),
  ('product_types_service',   'Service Products',         'Enable service-type product type',                        'product_types', true, 13, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 5: Insert product_options feature keys into features_list
-- ============================================================
-- New canonical names for existing product_options features

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  -- Master gates
  ('product_options_enabled',            'Product Options Enabled',         'Master gate — enables product options capability',           'product_options', true, 1,  NOW(), NOW()),
  ('product_options_disabled',           'Product Options Disabled',        'Master disable gate for product options',                    'product_options', true, 2,  NOW(), NOW()),
  ('product_options_flexible',           'Product Options Flexible',        'Flexible tier — unlocks all product options',                'product_options', true, 3,  NOW(), NOW()),

  -- Creation group
  ('product_options_creation_enabled',   'Creation Group Enabled',          'Enables all product creation feature types',                 'product_options', true, 10, NOW(), NOW()),
  ('product_options_creation_disabled',  'Creation Group Disabled',         'Disables all product creation feature types',                'product_options', true, 11, NOW(), NOW()),
  ('product_options_creation_variants',  'Product Variants',                'Support for product variants (size, color, etc.)',           'product_options', true, 12, NOW(), NOW()),
  ('product_options_creation_gallery',   'Product Gallery',                 'Multiple images per product',                                'product_options', true, 13, NOW(), NOW()),
  ('product_options_creation_video',     'Product Video',                   'Video support on product pages',                             'product_options', true, 14, NOW(), NOW()),

  -- Layout group
  ('product_options_layout_enabled',     'Layout Group Enabled',            'Enables all product page layout types',                      'product_options', true, 20, NOW(), NOW()),
  ('product_options_layout_disabled',    'Layout Group Disabled',           'Disables all product page layout types',                     'product_options', true, 21, NOW(), NOW()),
  ('product_options_layout_classic',     'Classic Product Page',            'Classic product page layout',                                'product_options', true, 22, NOW(), NOW()),
  ('product_options_layout_editorial',   'Editorial Product Page',          'Modern editorial product page layout',                       'product_options', true, 23, NOW(), NOW()),
  ('product_options_layout_immersive',   'Immersive Product Page',          'Immersive commerce product page layout',                     'product_options', true, 24, NOW(), NOW()),

  -- Sections group
  ('product_options_sections_enabled',   'Sections Group Enabled',          'Enables all product page sections',                          'product_options', true, 30, NOW(), NOW()),
  ('product_options_sections_disabled',  'Sections Group Disabled',         'Disables all product page sections',                         'product_options', true, 31, NOW(), NOW()),
  ('product_options_sections_recently_viewed',       'Recently Viewed',      'Track and display recently viewed products',                 'product_options', true, 32, NOW(), NOW()),
  ('product_options_sections_qr_codes',              'QR Codes',             'QR codes for individual products',                           'product_options', true, 33, NOW(), NOW()),
  ('product_options_sections_qr_logo',               'QR Logo',              'QR code with embedded logo',                                 'product_options', true, 34, NOW(), NOW()),
  ('product_options_sections_recommended',           'Recommended Products',  'Recommended products section on product page',              'product_options', true, 35, NOW(), NOW()),
  ('product_options_sections_map_display',           'Map Display',          'Map display on product page',                                'product_options', true, 36, NOW(), NOW()),
  ('product_options_sections_location_display',      'Location Display',     'Location information on product page',                       'product_options', true, 37, NOW(), NOW()),
  ('product_options_sections_hours_display',         'Hours Display',        'Business hours on product page',                             'product_options', true, 38, NOW(), NOW()),
  ('product_options_sections_enhanced_seo',          'Enhanced SEO',         'Advanced SEO controls and metadata',                         'product_options', true, 39, NOW(), NOW()),
  ('product_options_sections_reviews',               'Reviews',              'Product reviews section',                                    'product_options', true, 40, NOW(), NOW()),
  ('product_options_sections_fulfillment',           'Fulfillment',          'Fulfillment options display',                                'product_options', true, 41, NOW(), NOW()),
  ('product_options_sections_categories',            'Categories',           'Category badges on product page',                            'product_options', true, 42, NOW(), NOW()),
  ('product_options_sections_location_availability', 'Location Availability', 'Multi-location stock availability',                         'product_options', true, 43, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 6: Create product_types capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'product_types',
  'Product Types',
  'Product type selection including physical, digital, hybrid, and service types.',
  'product_types',
  true,
  4,
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
-- STEP 7: Link product_types features to capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'product_types';
  v_feature_keys         TEXT[] := ARRAY[
    'product_types_enabled',
    'product_types_disabled',
    'product_types_flexible',
    'product_types_physical',
    'product_types_digital',
    'product_types_hybrid',
    'product_types_service'
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
-- STEP 8: Link product_options new features to capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'product_options';
  v_feature_keys         TEXT[] := ARRAY[
    'product_options_enabled',
    'product_options_disabled',
    'product_options_flexible',
    'product_options_creation_enabled',
    'product_options_creation_disabled',
    'product_options_creation_variants',
    'product_options_creation_gallery',
    'product_options_creation_video',
    'product_options_layout_enabled',
    'product_options_layout_disabled',
    'product_options_layout_classic',
    'product_options_layout_editorial',
    'product_options_layout_immersive',
    'product_options_sections_enabled',
    'product_options_sections_disabled',
    'product_options_sections_recently_viewed',
    'product_options_sections_qr_codes',
    'product_options_sections_qr_logo',
    'product_options_sections_recommended',
    'product_options_sections_map_display',
    'product_options_sections_location_display',
    'product_options_sections_hours_display',
    'product_options_sections_enhanced_seo',
    'product_options_sections_reviews',
    'product_options_sections_fulfillment',
    'product_options_sections_categories',
    'product_options_sections_location_availability'
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
    SELECT v_capability_type_id, fl.id, true, i + 100, NOW(), NOW()
    FROM features_list fl
    WHERE fl.key = v_feature_keys[i]
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET is_active = true, sort_order = i + 100;

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
-- STEP 9: Enable product_types features for tiers
-- ============================================================
-- Mirrors the tier matrix from the target architecture document (§8.1)
-- Copied from existing product_options tier assignments for type features

DO $$
DECLARE
  v_tier_id           TEXT;
  v_cap_type_id       TEXT;
  v_tier_key          TEXT;
  v_feature_key       TEXT;
  v_feature_name      TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'product_types' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type product_types not found';
  END IF;

  FOR v_tier_key, v_feature_key, v_feature_name IN
    SELECT * FROM (VALUES
      -- ─── starter: physical + digital ───
      ('starter', 'product_types_enabled',  'Product Types Enabled'),
      ('starter', 'product_types_physical', 'Physical Products'),
      ('starter', 'product_types_digital',  'Digital Products'),

      -- ─── discovery: physical + digital ───
      ('discovery', 'product_types_enabled',  'Product Types Enabled'),
      ('discovery', 'product_types_physical', 'Physical Products'),
      ('discovery', 'product_types_digital',  'Digital Products'),

      -- ─── storefront: physical + digital ───
      ('storefront', 'product_types_enabled',  'Product Types Enabled'),
      ('storefront', 'product_types_physical', 'Physical Products'),
      ('storefront', 'product_types_digital',  'Digital Products'),

      -- ─── commitment: + hybrid ───
      ('commitment', 'product_types_enabled',  'Product Types Enabled'),
      ('commitment', 'product_types_physical', 'Physical Products'),
      ('commitment', 'product_types_digital',  'Digital Products'),
      ('commitment', 'product_types_hybrid',   'Hybrid Products'),

      -- ─── ecommerce: + service ───
      ('ecommerce', 'product_types_enabled',  'Product Types Enabled'),
      ('ecommerce', 'product_types_physical', 'Physical Products'),
      ('ecommerce', 'product_types_digital',  'Digital Products'),
      ('ecommerce', 'product_types_hybrid',   'Hybrid Products'),
      ('ecommerce', 'product_types_service',  'Service Products'),

      -- ─── omnichannel: same as ecommerce ───
      ('omnichannel', 'product_types_enabled',  'Product Types Enabled'),
      ('omnichannel', 'product_types_physical', 'Physical Products'),
      ('omnichannel', 'product_types_digital',  'Digital Products'),
      ('omnichannel', 'product_types_hybrid',   'Hybrid Products'),
      ('omnichannel', 'product_types_service',  'Service Products'),

      -- ─── professional: all + flexible ───
      ('professional', 'product_types_enabled',  'Product Types Enabled'),
      ('professional', 'product_types_physical', 'Physical Products'),
      ('professional', 'product_types_digital',  'Digital Products'),
      ('professional', 'product_types_hybrid',   'Hybrid Products'),
      ('professional', 'product_types_service',  'Service Products'),
      ('professional', 'product_types_flexible', 'Product Types Flexible'),

      -- ─── enterprise: all + flexible ───
      ('enterprise', 'product_types_enabled',  'Product Types Enabled'),
      ('enterprise', 'product_types_physical', 'Physical Products'),
      ('enterprise', 'product_types_digital',  'Digital Products'),
      ('enterprise', 'product_types_hybrid',   'Hybrid Products'),
      ('enterprise', 'product_types_service',  'Service Products'),
      ('enterprise', 'product_types_flexible', 'Product Types Flexible'),

      -- ─── organization: all + flexible ───
      ('organization', 'product_types_enabled',  'Product Types Enabled'),
      ('organization', 'product_types_physical', 'Physical Products'),
      ('organization', 'product_types_digital',  'Digital Products'),
      ('organization', 'product_types_hybrid',   'Hybrid Products'),
      ('organization', 'product_types_service',  'Service Products'),
      ('organization', 'product_types_flexible', 'Product Types Flexible'),

      -- ─── chain_starter: physical + digital ───
      ('chain_starter', 'product_types_enabled',  'Product Types Enabled'),
      ('chain_starter', 'product_types_physical', 'Physical Products'),
      ('chain_starter', 'product_types_digital',  'Digital Products'),

      -- ─── chain_professional: all + flexible ───
      ('chain_professional', 'product_types_enabled',  'Product Types Enabled'),
      ('chain_professional', 'product_types_physical', 'Physical Products'),
      ('chain_professional', 'product_types_digital',  'Digital Products'),
      ('chain_professional', 'product_types_hybrid',   'Hybrid Products'),
      ('chain_professional', 'product_types_service',  'Service Products'),
      ('chain_professional', 'product_types_flexible', 'Product Types Flexible'),

      -- ─── chain_enterprise: all + flexible ───
      ('chain_enterprise', 'product_types_enabled',  'Product Types Enabled'),
      ('chain_enterprise', 'product_types_physical', 'Physical Products'),
      ('chain_enterprise', 'product_types_digital',  'Digital Products'),
      ('chain_enterprise', 'product_types_hybrid',   'Hybrid Products'),
      ('chain_enterprise', 'product_types_service',  'Service Products'),
      ('chain_enterprise', 'product_types_flexible', 'Product Types Flexible'),

      -- ─── trial tiers mirror their base ───
      ('trial_starter', 'product_types_enabled',  'Product Types Enabled'),
      ('trial_starter', 'product_types_physical', 'Physical Products'),
      ('trial_starter', 'product_types_digital',  'Digital Products'),

      ('trial_discovery', 'product_types_enabled',  'Product Types Enabled'),
      ('trial_discovery', 'product_types_physical', 'Physical Products'),
      ('trial_discovery', 'product_types_digital',  'Digital Products'),

      ('trial_storefront', 'product_types_enabled',  'Product Types Enabled'),
      ('trial_storefront', 'product_types_physical', 'Physical Products'),
      ('trial_storefront', 'product_types_digital',  'Digital Products'),

      ('trial_commitment', 'product_types_enabled',  'Product Types Enabled'),
      ('trial_commitment', 'product_types_physical', 'Physical Products'),
      ('trial_commitment', 'product_types_digital',  'Digital Products'),
      ('trial_commitment', 'product_types_hybrid',   'Hybrid Products'),

      ('trial_ecommerce', 'product_types_enabled',  'Product Types Enabled'),
      ('trial_ecommerce', 'product_types_physical', 'Physical Products'),
      ('trial_ecommerce', 'product_types_digital',  'Digital Products'),
      ('trial_ecommerce', 'product_types_hybrid',   'Hybrid Products'),
      ('trial_ecommerce', 'product_types_service',  'Service Products'),

      ('trial_omnichannel', 'product_types_enabled',  'Product Types Enabled'),
      ('trial_omnichannel', 'product_types_physical', 'Physical Products'),
      ('trial_omnichannel', 'product_types_digital',  'Digital Products'),
      ('trial_omnichannel', 'product_types_hybrid',   'Hybrid Products'),
      ('trial_omnichannel', 'product_types_service',  'Service Products'),

      ('trial_professional', 'product_types_enabled',  'Product Types Enabled'),
      ('trial_professional', 'product_types_physical', 'Physical Products'),
      ('trial_professional', 'product_types_digital',  'Digital Products'),
      ('trial_professional', 'product_types_hybrid',   'Hybrid Products'),
      ('trial_professional', 'product_types_service',  'Service Products'),
      ('trial_professional', 'product_types_flexible', 'Product Types Flexible'),

      ('trial_enterprise', 'product_types_enabled',  'Product Types Enabled'),
      ('trial_enterprise', 'product_types_physical', 'Physical Products'),
      ('trial_enterprise', 'product_types_digital',  'Digital Products'),
      ('trial_enterprise', 'product_types_hybrid',   'Hybrid Products'),
      ('trial_enterprise', 'product_types_service',  'Service Products'),
      ('trial_enterprise', 'product_types_flexible', 'Product Types Flexible'),

      ('trial_chain_starter', 'product_types_enabled',  'Product Types Enabled'),
      ('trial_chain_starter', 'product_types_physical', 'Physical Products'),
      ('trial_chain_starter', 'product_types_digital',  'Digital Products'),

      ('trial_chain_professional', 'product_types_enabled',  'Product Types Enabled'),
      ('trial_chain_professional', 'product_types_physical', 'Physical Products'),
      ('trial_chain_professional', 'product_types_digital',  'Digital Products'),
      ('trial_chain_professional', 'product_types_hybrid',   'Hybrid Products'),
      ('trial_chain_professional', 'product_types_service',  'Service Products'),
      ('trial_chain_professional', 'product_types_flexible', 'Product Types Flexible'),

      ('trial_chain_enterprise', 'product_types_enabled',  'Product Types Enabled'),
      ('trial_chain_enterprise', 'product_types_physical', 'Physical Products'),
      ('trial_chain_enterprise', 'product_types_digital',  'Digital Products'),
      ('trial_chain_enterprise', 'product_types_hybrid',   'Hybrid Products'),
      ('trial_chain_enterprise', 'product_types_service',  'Service Products'),
      ('trial_chain_enterprise', 'product_types_flexible', 'Product Types Flexible')
    ) AS t(tier_key, feature_key, feature_name)
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
      '{"capability_type": "product_types"}'
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Product types tier features populated for all active tiers';
END $$;


-- ============================================================
-- STEP 10: Enable product_options new feature keys for tiers
-- ============================================================
-- Copy tier assignments from old keys to new canonical keys
-- This ensures both old and new keys have the same tier assignments

DO $$
DECLARE
  v_tier_id           TEXT;
  v_cap_type_id       TEXT;
  v_tier_key          TEXT;
  v_feature_key       TEXT;
  v_feature_name      TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'product_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type product_options not found';
  END IF;

  FOR v_tier_key, v_feature_key, v_feature_name IN
    SELECT * FROM (VALUES
      -- ─── All tiers get master enabled ───
      ('starter',             'product_options_enabled',  'Product Options Enabled'),
      ('discovery',           'product_options_enabled',  'Product Options Enabled'),
      ('storefront',          'product_options_enabled',  'Product Options Enabled'),
      ('commitment',          'product_options_enabled',  'Product Options Enabled'),
      ('ecommerce',           'product_options_enabled',  'Product Options Enabled'),
      ('omnichannel',         'product_options_enabled',  'Product Options Enabled'),
      ('professional',        'product_options_enabled',  'Product Options Enabled'),
      ('enterprise',          'product_options_enabled',  'Product Options Enabled'),
      ('organization',        'product_options_enabled',  'Product Options Enabled'),
      ('chain_starter',       'product_options_enabled',  'Product Options Enabled'),
      ('chain_professional',  'product_options_enabled',  'Product Options Enabled'),
      ('chain_enterprise',    'product_options_enabled',  'Product Options Enabled'),
      ('trial_starter',       'product_options_enabled',  'Product Options Enabled'),
      ('trial_discovery',     'product_options_enabled',  'Product Options Enabled'),
      ('trial_storefront',    'product_options_enabled',  'Product Options Enabled'),
      ('trial_commitment',    'product_options_enabled',  'Product Options Enabled'),
      ('trial_ecommerce',     'product_options_enabled',  'Product Options Enabled'),
      ('trial_omnichannel',   'product_options_enabled',  'Product Options Enabled'),
      ('trial_professional',  'product_options_enabled',  'Product Options Enabled'),
      ('trial_enterprise',    'product_options_enabled',  'Product Options Enabled'),
      ('trial_chain_starter',       'product_options_enabled',  'Product Options Enabled'),
      ('trial_chain_professional',  'product_options_enabled',  'Product Options Enabled'),
      ('trial_chain_enterprise',    'product_options_enabled',  'Product Options Enabled'),

      -- ─── Creation group: variants + gallery for all, video from commitment+ ───
      ('starter',             'product_options_creation_enabled',  'Creation Group Enabled'),
      ('starter',             'product_options_creation_variants', 'Product Variants'),
      ('starter',             'product_options_creation_gallery',  'Product Gallery'),
      ('discovery',           'product_options_creation_enabled',  'Creation Group Enabled'),
      ('discovery',           'product_options_creation_variants', 'Product Variants'),
      ('discovery',           'product_options_creation_gallery',  'Product Gallery'),
      ('storefront',          'product_options_creation_enabled',  'Creation Group Enabled'),
      ('storefront',          'product_options_creation_variants', 'Product Variants'),
      ('storefront',          'product_options_creation_gallery',  'Product Gallery'),
      ('commitment',          'product_options_creation_enabled',  'Creation Group Enabled'),
      ('commitment',          'product_options_creation_variants', 'Product Variants'),
      ('commitment',          'product_options_creation_gallery',  'Product Gallery'),
      ('commitment',          'product_options_creation_video',    'Product Video'),
      ('ecommerce',           'product_options_creation_enabled',  'Creation Group Enabled'),
      ('ecommerce',           'product_options_creation_variants', 'Product Variants'),
      ('ecommerce',           'product_options_creation_gallery',  'Product Gallery'),
      ('ecommerce',           'product_options_creation_video',    'Product Video'),
      ('omnichannel',         'product_options_creation_enabled',  'Creation Group Enabled'),
      ('omnichannel',         'product_options_creation_variants', 'Product Variants'),
      ('omnichannel',         'product_options_creation_gallery',  'Product Gallery'),
      ('omnichannel',         'product_options_creation_video',    'Product Video'),
      ('professional',        'product_options_creation_enabled',  'Creation Group Enabled'),
      ('professional',        'product_options_creation_variants', 'Product Variants'),
      ('professional',        'product_options_creation_gallery',  'Product Gallery'),
      ('professional',        'product_options_creation_video',    'Product Video'),
      ('enterprise',          'product_options_creation_enabled',  'Creation Group Enabled'),
      ('enterprise',          'product_options_creation_variants', 'Product Variants'),
      ('enterprise',          'product_options_creation_gallery',  'Product Gallery'),
      ('enterprise',          'product_options_creation_video',    'Product Video'),
      ('organization',        'product_options_creation_enabled',  'Creation Group Enabled'),
      ('organization',        'product_options_creation_variants', 'Product Variants'),
      ('organization',        'product_options_creation_gallery',  'Product Gallery'),
      ('organization',        'product_options_creation_video',    'Product Video'),
      ('chain_starter',       'product_options_creation_enabled',  'Creation Group Enabled'),
      ('chain_starter',       'product_options_creation_variants', 'Product Variants'),
      ('chain_starter',       'product_options_creation_gallery',  'Product Gallery'),
      ('chain_professional',  'product_options_creation_enabled',  'Creation Group Enabled'),
      ('chain_professional',  'product_options_creation_variants', 'Product Variants'),
      ('chain_professional',  'product_options_creation_gallery',  'Product Gallery'),
      ('chain_professional',  'product_options_creation_video',    'Product Video'),
      ('chain_enterprise',    'product_options_creation_enabled',  'Creation Group Enabled'),
      ('chain_enterprise',    'product_options_creation_variants', 'Product Variants'),
      ('chain_enterprise',    'product_options_creation_gallery',  'Product Gallery'),
      ('chain_enterprise',    'product_options_creation_video',    'Product Video'),

      -- ─── Layout group: classic for all, editorial from commitment+, immersive from ecommerce+ ───
      ('starter',             'product_options_layout_enabled',  'Layout Group Enabled'),
      ('starter',             'product_options_layout_classic',  'Classic Product Page'),
      ('discovery',           'product_options_layout_enabled',  'Layout Group Enabled'),
      ('discovery',           'product_options_layout_classic',  'Classic Product Page'),
      ('storefront',          'product_options_layout_enabled',  'Layout Group Enabled'),
      ('storefront',          'product_options_layout_classic',  'Classic Product Page'),
      ('commitment',          'product_options_layout_enabled',  'Layout Group Enabled'),
      ('commitment',          'product_options_layout_classic',  'Classic Product Page'),
      ('commitment',          'product_options_layout_editorial', 'Editorial Product Page'),
      ('ecommerce',           'product_options_layout_enabled',  'Layout Group Enabled'),
      ('ecommerce',           'product_options_layout_classic',  'Classic Product Page'),
      ('ecommerce',           'product_options_layout_editorial', 'Editorial Product Page'),
      ('ecommerce',           'product_options_layout_immersive', 'Immersive Product Page'),
      ('omnichannel',         'product_options_layout_enabled',  'Layout Group Enabled'),
      ('omnichannel',         'product_options_layout_classic',  'Classic Product Page'),
      ('omnichannel',         'product_options_layout_editorial', 'Editorial Product Page'),
      ('omnichannel',         'product_options_layout_immersive', 'Immersive Product Page'),
      ('professional',        'product_options_layout_enabled',  'Layout Group Enabled'),
      ('professional',        'product_options_layout_classic',  'Classic Product Page'),
      ('professional',        'product_options_layout_editorial', 'Editorial Product Page'),
      ('professional',        'product_options_layout_immersive', 'Immersive Product Page'),
      ('enterprise',          'product_options_layout_enabled',  'Layout Group Enabled'),
      ('enterprise',          'product_options_layout_classic',  'Classic Product Page'),
      ('enterprise',          'product_options_layout_editorial', 'Editorial Product Page'),
      ('enterprise',          'product_options_layout_immersive', 'Immersive Product Page'),
      ('organization',        'product_options_layout_enabled',  'Layout Group Enabled'),
      ('organization',        'product_options_layout_classic',  'Classic Product Page'),
      ('organization',        'product_options_layout_editorial', 'Editorial Product Page'),
      ('organization',        'product_options_layout_immersive', 'Immersive Product Page'),
      ('chain_starter',       'product_options_layout_enabled',  'Layout Group Enabled'),
      ('chain_starter',       'product_options_layout_classic',  'Classic Product Page'),
      ('chain_professional',  'product_options_layout_enabled',  'Layout Group Enabled'),
      ('chain_professional',  'product_options_layout_classic',  'Classic Product Page'),
      ('chain_professional',  'product_options_layout_editorial', 'Editorial Product Page'),
      ('chain_professional',  'product_options_layout_immersive', 'Immersive Product Page'),
      ('chain_enterprise',    'product_options_layout_enabled',  'Layout Group Enabled'),
      ('chain_enterprise',    'product_options_layout_classic',  'Classic Product Page'),
      ('chain_enterprise',    'product_options_layout_editorial', 'Editorial Product Page'),
      ('chain_enterprise',    'product_options_layout_immersive', 'Immersive Product Page'),

      -- ─── Sections group: all sections for all paid tiers ───
      ('starter',             'product_options_sections_enabled',              'Sections Group Enabled'),
      ('starter',             'product_options_sections_recently_viewed',       'Recently Viewed'),
      ('starter',             'product_options_sections_qr_codes',              'QR Codes'),
      ('starter',             'product_options_sections_qr_logo',               'QR Logo'),
      ('starter',             'product_options_sections_recommended',           'Recommended Products'),
      ('starter',             'product_options_sections_map_display',           'Map Display'),
      ('starter',             'product_options_sections_location_display',      'Location Display'),
      ('starter',             'product_options_sections_hours_display',         'Hours Display'),
      ('starter',             'product_options_sections_enhanced_seo',          'Enhanced SEO'),
      ('starter',             'product_options_sections_reviews',               'Reviews'),
      ('starter',             'product_options_sections_fulfillment',           'Fulfillment'),
      ('starter',             'product_options_sections_categories',            'Categories'),
      ('starter',             'product_options_sections_location_availability', 'Location Availability')
    ) AS t(tier_key, feature_key, feature_name)
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
      '{"capability_type": "product_options"}'
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Product options tier features populated for starter tier sections';
END $$;

-- Repeat sections for all remaining tiers (they all get the same sections)
DO $$
DECLARE
  v_tier_id           TEXT;
  v_cap_type_id       TEXT;
  v_section_keys      TEXT[] := ARRAY[
    'product_options_sections_enabled',
    'product_options_sections_recently_viewed',
    'product_options_sections_qr_codes',
    'product_options_sections_qr_logo',
    'product_options_sections_recommended',
    'product_options_sections_map_display',
    'product_options_sections_location_display',
    'product_options_sections_hours_display',
    'product_options_sections_enhanced_seo',
    'product_options_sections_reviews',
    'product_options_sections_fulfillment',
    'product_options_sections_categories',
    'product_options_sections_location_availability'
  ];
  v_section_names     TEXT[] := ARRAY[
    'Sections Group Enabled',
    'Recently Viewed',
    'QR Codes',
    'QR Logo',
    'Recommended Products',
    'Map Display',
    'Location Display',
    'Hours Display',
    'Enhanced SEO',
    'Reviews',
    'Fulfillment',
    'Categories',
    'Location Availability'
  ];
  v_tier_keys         TEXT[] := ARRAY[
    'discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel',
    'professional', 'enterprise', 'organization',
    'chain_starter', 'chain_professional', 'chain_enterprise',
    'trial_starter', 'trial_discovery', 'trial_storefront', 'trial_commitment',
    'trial_ecommerce', 'trial_omnichannel', 'trial_professional', 'trial_enterprise',
    'trial_chain_starter', 'trial_chain_professional', 'trial_chain_enterprise'
  ];
  v_tier_key TEXT;
  v_fk TEXT;
  v_fn TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'product_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type product_options not found';
  END IF;

  FOREACH v_tier_key IN ARRAY v_tier_keys LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    FOR i IN 1 .. array_length(v_section_keys, 1) LOOP
      v_fk := v_section_keys[i];
      v_fn := v_section_names[i];

      INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
      VALUES (
        gen_random_uuid()::text,
        v_tier_id,
        v_cap_type_id,
        v_fk,
        v_fn,
        true,
        false,
        '{"capability_type": "product_options"}'
      )
      ON CONFLICT (tier_id, feature_key) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Product options sections tier features populated for all remaining tiers';
END $$;

-- Add flexible flag for professional/enterprise/organization/chain_professional/chain_enterprise + trials
DO $$
DECLARE
  v_tier_id           TEXT;
  v_cap_type_id       TEXT;
  v_tier_keys         TEXT[] := ARRAY[
    'professional', 'enterprise', 'organization',
    'chain_professional', 'chain_enterprise',
    'trial_professional', 'trial_enterprise',
    'trial_chain_professional', 'trial_chain_enterprise'
  ];
  v_tier_key TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'product_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type product_options not found';
  END IF;

  FOREACH v_tier_key IN ARRAY v_tier_keys LOOP
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
      'product_options_flexible',
      'Product Options Flexible',
      true,
      false,
      '{"capability_type": "product_options"}'
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Product options flexible flag populated for professional+ tiers';
END $$;


-- ============================================================
-- STEP 11: Link capability types to tiers (for admin UI)
-- ============================================================

UPDATE capability_type_list ct
SET tier_id = 'tier_professional'
WHERE ct.key = 'product_types'
  AND ct.tier_id IS NULL;


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Verify table exists
-- SELECT count(*) FROM tenant_product_types_settings;

-- Verify capability type
-- SELECT * FROM capability_type_list WHERE key = 'product_types';

-- Verify product_types features
-- SELECT key, name, category FROM features_list WHERE category = 'product_types' ORDER BY sort_order;

-- Verify product_options new features
-- SELECT key, name, category FROM features_list WHERE category = 'product_options' AND key LIKE 'product_options_%' ORDER BY sort_order;

-- Verify capability-feature links for product_types
-- SELECT f.key, f.name FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'product_types'
--   ORDER BY cf.sort_order;

-- Verify tier features for Professional (product_types)
-- SELECT tf.feature_key, tf.feature_name FROM tier_features_list tf
--   WHERE tf.tier_id = (SELECT id FROM subscription_tiers_list WHERE tier_key = 'professional')
--   AND tf.feature_key LIKE 'product_types_%'
--   ORDER BY tf.feature_key;

-- Verify tier features for Professional (product_options new keys)
-- SELECT tf.feature_key, tf.feature_name FROM tier_features_list tf
--   WHERE tf.tier_id = (SELECT id FROM subscription_tiers_list WHERE tier_key = 'professional')
--   AND tf.feature_key LIKE 'product_options_%'
--   ORDER BY tf.feature_key;

-- Verify data migration
-- SELECT tpts.tenant_id, tpts.selected_product_type, tpo.product_physical_enabled, tpo.product_digital_enabled
-- FROM tenant_product_types_settings tpts
-- JOIN tenant_product_options_settings tpo ON tpo.tenant_id = tpts.tenant_id
-- LIMIT 10;
