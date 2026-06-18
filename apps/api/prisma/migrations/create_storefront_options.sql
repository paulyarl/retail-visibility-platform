-- ============================================================
-- Storefront Options Capability Migration
-- Creates: tenant_storefront_options_settings table
-- Seeds:   capability_type_list, features_list, capability_features_list, tier_features_list
-- ============================================================

-- ====================
-- STEP 1: Create the settings table
-- ====================

CREATE TABLE IF NOT EXISTS tenant_storefront_options_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL UNIQUE,

  -- Master switch
  storefront_opt_enabled BOOLEAN DEFAULT true,

  -- Store Hours group
  hours_animated           BOOLEAN DEFAULT true,
  hours_status             BOOLEAN DEFAULT true,

  -- Category Display group
  category_store           BOOLEAN DEFAULT true,
  category_product         BOOLEAN DEFAULT true,

  -- Recommendation Display group
  recommend_store          BOOLEAN DEFAULT true,
  recommend_products       BOOLEAN DEFAULT true,

  -- User Behavior group
  recently_viewed          BOOLEAN DEFAULT true,

  -- Store Information group
  storefront_social_media  BOOLEAN DEFAULT true,
  storefront_contact       BOOLEAN DEFAULT true,
  interactive_maps         BOOLEAN DEFAULT true,

  -- QR Code Display group — Resolution (multi select)
  qr_codes_512             BOOLEAN DEFAULT false,
  qr_codes_1024            BOOLEAN DEFAULT true,
  qr_codes_2048            BOOLEAN DEFAULT false,

  -- QR Code Display group — Content (toggle)
  qr_product               BOOLEAN DEFAULT true,
  qr_store                 BOOLEAN DEFAULT true,
  qr_logo                  BOOLEAN DEFAULT false,
  qr_directory             BOOLEAN DEFAULT false,

  -- Gallery Display group (radio: only one active)
  image_gallery_5          BOOLEAN DEFAULT true,
  image_gallery_10         BOOLEAN DEFAULT false,
  image_gallery_15         BOOLEAN DEFAULT false,

  -- Advanced group
  enhanced_seo             BOOLEAN DEFAULT false,
  storefront_actions       BOOLEAN DEFAULT false,

  -- Default preferences
  default_qr_resolution    VARCHAR(10) DEFAULT '1024',
  default_gallery_limit    INTEGER DEFAULT 5,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_storefront_options_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storefront_options_tenant ON tenant_storefront_options_settings(tenant_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_storefront_options_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_storefront_options_settings_updated_at ON tenant_storefront_options_settings;
CREATE TRIGGER trigger_storefront_options_settings_updated_at
  BEFORE UPDATE ON tenant_storefront_options_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_storefront_options_settings_updated_at();

-- Enable RLS
ALTER TABLE tenant_storefront_options_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenants can only see their own row
DROP POLICY IF EXISTS tenant_storefront_options_isolation ON tenant_storefront_options_settings;
CREATE POLICY tenant_storefront_options_isolation ON tenant_storefront_options_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ====================
-- STEP 2: Add capability type
-- ====================

INSERT INTO capability_type_list (id, key, name, description, category, is_active, sort_order)
VALUES (
  gen_random_uuid()::text,
  'storefront_options',
  'Storefront Options',
  'Customize storefront appearance and behavior including hours display, categories, recommendations, QR codes, gallery limits, and advanced features',
  'storefront',
  true,
  55
) ON CONFLICT (key) DO NOTHING;


-- ====================
-- STEP 3: Add features to features_list
-- ====================

-- Main gates
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order) VALUES
  (gen_random_uuid()::text, 'storefront_opt_enabled',  'Storefront Options Enabled',  'Main gate — enables storefront options capability',      'storefront_options', true, 1),
  (gen_random_uuid()::text, 'storefront_opt_flexible', 'Storefront Options Flexible', 'Flexible tier — unlocks all feature gates',                'storefront_options', true, 3)
ON CONFLICT (key) DO NOTHING;

-- Store Hours group gates
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order) VALUES
  (gen_random_uuid()::text, 'storefront_opt_hours_enabled',  'Hours Group Enabled',  'Enables all hours feature types',   'storefront_options', true, 10),
  (gen_random_uuid()::text, 'storefront_opt_hours_animated', 'Animated Hours',        'Animated store hours display',      'storefront_options', true, 12),
  (gen_random_uuid()::text, 'storefront_opt_hours_status',   'Hours Status',          'Open/closed status indicator',      'storefront_options', true, 13)
ON CONFLICT (key) DO NOTHING;

-- Category Display group gates
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order) VALUES
  (gen_random_uuid()::text, 'storefront_opt_category_enabled',  'Category Group Enabled',  'Enables all category feature types',  'storefront_options', true, 20),
  (gen_random_uuid()::text, 'storefront_opt_category_store',    'Store Categories',        'Category navigation on storefront',  'storefront_options', true, 22),
  (gen_random_uuid()::text, 'storefront_opt_category_product',  'Product Categories',       'Category badges on product cards',   'storefront_options', true, 23)
ON CONFLICT (key) DO NOTHING;

-- Recommendation Display group gates
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order) VALUES
  (gen_random_uuid()::text, 'storefront_opt_recommend_enabled',  'Recommend Group Enabled',  'Enables all recommendation types',     'storefront_options', true, 30),
  (gen_random_uuid()::text, 'storefront_opt_recommend_store',    'Store Recommendations',    'Recommended stores section',            'storefront_options', true, 32),
  (gen_random_uuid()::text, 'storefront_opt_recommend_products', 'Product Recommendations',  'Recommended products section',         'storefront_options', true, 33)
ON CONFLICT (key) DO NOTHING;

-- User Behavior (standalone, no group gate)
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order) VALUES
  (gen_random_uuid()::text, 'storefront_opt_recently_viewed', 'Recently Viewed', 'Track and display recently viewed products', 'storefront_options', true, 40)
ON CONFLICT (key) DO NOTHING;

-- Store Information group gates
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order) VALUES
  (gen_random_uuid()::text, 'storefront_opt_info_enabled',            'Info Group Enabled',  'Enables all store info types',       'storefront_options', true, 50),
  (gen_random_uuid()::text, 'storefront_opt_storefront_social_media', 'Social Media Links',  'Social media links on storefront',    'storefront_options', true, 52),
  (gen_random_uuid()::text, 'storefront_opt_storefront_contact',      'Contact Info',        'Contact information on storefront',  'storefront_options', true, 53),
  (gen_random_uuid()::text, 'storefront_opt_interactive_maps',         'Interactive Maps',    'Embedded interactive map',            'storefront_options', true, 54)
ON CONFLICT (key) DO NOTHING;

-- QR Code Display group gates
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order) VALUES
  (gen_random_uuid()::text, 'storefront_opt_qr_enabled',    'QR Group Enabled',      'Enables all QR feature types',       'storefront_options', true, 60),
  (gen_random_uuid()::text, 'storefront_opt_qr_codes_512',  'QR 512px Resolution',    'Standard 512px QR codes',             'storefront_options', true, 62),
  (gen_random_uuid()::text, 'storefront_opt_qr_codes_1024', 'QR 1024px Resolution',   'High 1024px QR codes',                'storefront_options', true, 63),
  (gen_random_uuid()::text, 'storefront_opt_qr_codes_2048', 'QR 2048px Resolution',  'HD 2048px QR codes for print',        'storefront_options', true, 64),
  (gen_random_uuid()::text, 'storefront_opt_qr_product',   'Product QR',             'QR codes for individual products',     'storefront_options', true, 65),
  (gen_random_uuid()::text, 'storefront_opt_qr_store',      'Store QR',               'QR code for store page',               'storefront_options', true, 66),
  (gen_random_uuid()::text, 'storefront_opt_qr_logo',       'Logo QR',                'QR code with embedded logo',           'storefront_options', true, 67),
  (gen_random_uuid()::text, 'storefront_opt_qr_directory',  'Directory QR',           'QR code for directory listing',        'storefront_options', true, 68)
ON CONFLICT (key) DO NOTHING;

-- Gallery Display group gates (radio)
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order) VALUES
  (gen_random_uuid()::text, 'storefront_opt_gallery_enabled',  'Gallery Group Enabled',  'Enables gallery feature type selection', 'storefront_options', true, 70),
  (gen_random_uuid()::text, 'storefront_opt_image_gallery_5',  '5 Image Gallery',       'Gallery limit of 5 images',              'storefront_options', true, 72),
  (gen_random_uuid()::text, 'storefront_opt_image_gallery_10', '10 Image Gallery',      'Gallery limit of 10 images',             'storefront_options', true, 73),
  (gen_random_uuid()::text, 'storefront_opt_image_gallery_15', '15 Image Gallery',     'Gallery limit of 15 images',              'storefront_options', true, 74)
ON CONFLICT (key) DO NOTHING;

-- Advanced group gates
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order) VALUES
  (gen_random_uuid()::text, 'storefront_opt_advanced_enabled',    'Advanced Group Enabled',  'Enables all advanced feature types',    'storefront_options', true, 80),
  (gen_random_uuid()::text, 'storefront_opt_enhanced_seo',        'Enhanced SEO',           'Advanced SEO controls and metadata',    'storefront_options', true, 82),
  (gen_random_uuid()::text, 'storefront_opt_storefront_actions',  'Storefront Actions',     'Custom call-to-action buttons',         'storefront_options', true, 83)
ON CONFLICT (key) DO NOTHING;


-- ====================
-- STEP 4: Link features to capability type
-- ====================

INSERT INTO capability_features_list (id, capability_type_id, feature_id, is_active, sort_order)
SELECT
  gen_random_uuid()::text,
  ct.id,
  f.id,
  true,
  f.sort_order
FROM capability_type_list ct
CROSS JOIN features_list f
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key LIKE 'storefront_opt_%'
ON CONFLICT (capability_type_id, feature_id) DO NOTHING;


-- ====================
-- STEP 5: Add tier features
-- ====================
-- Tier assignments:
--   Storefront tier:     base hours + category + info + gallery_5
--   Starter tier:        base hours + category + recommend + info + gallery_5
--   Commitment tier:     hours + category + recommend + recently_viewed + info + QR basic + gallery_5
--   Professional tier:   hours + category + recommend + recently_viewed + info + QR (512+1024, product+store) + gallery_10 + enhanced_seo
--   E-commerce tier:     same as Professional + gallery_15 + storefront_actions + QR 1024
--   Omnichannel tier:    same as E-commerce + QR 2048 + qr_logo + qr_directory
--   Enterprise tier:     FLEXIBLE (all features unlocked)
--   Organization tier:   FLEXIBLE (all features unlocked)
--   Chain tiers:         same as their individual counterparts
--   Trial tiers:         same as their paid counterparts
--   Discovery/Google-Only/Expired: NO storefront_options

-- Helper: get the capability type ID
-- We'll use a CTE pattern for each tier batch

-- ----------------------
-- Storefront tier (tid-snks): basic options
-- ----------------------
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tid-snks',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- ----------------------
-- Starter tier (tier_starter): adds recommend
-- ----------------------
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_starter',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- ----------------------
-- Commitment tier (tid-k1t8): adds recently_viewed + QR basic
-- ----------------------
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tid-k1t8',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_recently_viewed',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_interactive_maps',
    'storefront_opt_qr_enabled',
    'storefront_opt_qr_codes_512',
    'storefront_opt_qr_codes_1024',
    'storefront_opt_qr_product',
    'storefront_opt_qr_store',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- ----------------------
-- Professional tier (tier_professional): adds QR 1024, gallery_10, enhanced_seo
-- ----------------------
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_professional',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_recently_viewed',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_interactive_maps',
    'storefront_opt_qr_enabled',
    'storefront_opt_qr_codes_1024',
    'storefront_opt_qr_product',
    'storefront_opt_qr_store',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5',
    'storefront_opt_image_gallery_10',
    'storefront_opt_advanced_enabled',
    'storefront_opt_enhanced_seo'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- ----------------------
-- E-commerce tier (tier_ecommerce_v2): adds gallery_15, storefront_actions, QR logo
-- ----------------------
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_ecommerce_v2',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_recently_viewed',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_interactive_maps',
    'storefront_opt_qr_enabled',
    'storefront_opt_qr_codes_1024',
    'storefront_opt_qr_product',
    'storefront_opt_qr_store',
    'storefront_opt_qr_logo',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5',
    'storefront_opt_image_gallery_10',
    'storefront_opt_image_gallery_15',
    'storefront_opt_advanced_enabled',
    'storefront_opt_enhanced_seo',
    'storefront_opt_storefront_actions'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- ----------------------
-- Omnichannel tier (tier_omnichannel_v2): adds QR 2048, QR directory
-- ----------------------
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_omnichannel_v2',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_recently_viewed',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_interactive_maps',
    'storefront_opt_qr_enabled',
    'storefront_opt_qr_codes_1024',
    'storefront_opt_qr_codes_2048',
    'storefront_opt_qr_product',
    'storefront_opt_qr_store',
    'storefront_opt_qr_logo',
    'storefront_opt_qr_directory',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5',
    'storefront_opt_image_gallery_10',
    'storefront_opt_image_gallery_15',
    'storefront_opt_advanced_enabled',
    'storefront_opt_enhanced_seo',
    'storefront_opt_storefront_actions'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- ----------------------
-- Enterprise tier (tier_enterprise): FLEXIBLE — all features
-- ----------------------
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_enterprise',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key LIKE 'storefront_opt_%'
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- ----------------------
-- Organization tier (tier_organization): FLEXIBLE — all features
-- ----------------------
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_organization',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key LIKE 'storefront_opt_%'
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- ----------------------
-- Chain tiers
-- ----------------------

-- Chain Starter (tier_chain_starter): same as Starter
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_chain_starter',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- Chain Professional (tier_chain_professional): same as Professional
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_chain_professional',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_recently_viewed',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_interactive_maps',
    'storefront_opt_qr_enabled',
    'storefront_opt_qr_codes_1024',
    'storefront_opt_qr_product',
    'storefront_opt_qr_store',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5',
    'storefront_opt_image_gallery_10',
    'storefront_opt_advanced_enabled',
    'storefront_opt_enhanced_seo'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- Chain Enterprise (tier_chain_enterprise): FLEXIBLE — all features
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_chain_enterprise',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key LIKE 'storefront_opt_%'
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- ----------------------
-- Trial tiers (mirror their paid counterparts)
-- ----------------------

-- Trial Storefront (tid-oepx): same as Storefront
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tid-oepx',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- Trial Starter (tier_trial_starter): same as Starter
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_trial_starter',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- Trial Professional (tier_trial_professional): same as Professional
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_trial_professional',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_recently_viewed',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_interactive_maps',
    'storefront_opt_qr_enabled',
    'storefront_opt_qr_codes_1024',
    'storefront_opt_qr_product',
    'storefront_opt_qr_store',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5',
    'storefront_opt_image_gallery_10',
    'storefront_opt_advanced_enabled',
    'storefront_opt_enhanced_seo'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- Trial E-commerce (tier_trial_ecommerce_v2): same as E-commerce
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_trial_ecommerce_v2',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_recently_viewed',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_interactive_maps',
    'storefront_opt_qr_enabled',
    'storefront_opt_qr_codes_1024',
    'storefront_opt_qr_product',
    'storefront_opt_qr_store',
    'storefront_opt_qr_logo',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5',
    'storefront_opt_image_gallery_10',
    'storefront_opt_image_gallery_15',
    'storefront_opt_advanced_enabled',
    'storefront_opt_enhanced_seo',
    'storefront_opt_storefront_actions'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- Trial Omnichannel (tier_trial_omnichannel_v2): same as Omnichannel
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_trial_omnichannel_v2',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_recently_viewed',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_interactive_maps',
    'storefront_opt_qr_enabled',
    'storefront_opt_qr_codes_1024',
    'storefront_opt_qr_codes_2048',
    'storefront_opt_qr_product',
    'storefront_opt_qr_store',
    'storefront_opt_qr_logo',
    'storefront_opt_qr_directory',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5',
    'storefront_opt_image_gallery_10',
    'storefront_opt_image_gallery_15',
    'storefront_opt_advanced_enabled',
    'storefront_opt_enhanced_seo',
    'storefront_opt_storefront_actions'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;

-- Trial Chain Starter (tier_trial_chain_starter): same as Chain Starter
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  gen_random_uuid()::text,
  'tier_trial_chain_starter',
  f.key,
  f.name,
  true,
  false,
  ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront_options'
  AND f.category = 'storefront_options'
  AND f.key IN (
    'storefront_opt_enabled',
    'storefront_opt_hours_enabled',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    'storefront_opt_category_enabled',
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    'storefront_opt_recommend_enabled',
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    'storefront_opt_info_enabled',
    'storefront_opt_storefront_social_media',
    'storefront_opt_storefront_contact',
    'storefront_opt_gallery_enabled',
    'storefront_opt_image_gallery_5'
  )
ON CONFLICT (tier_id, feature_key) DO NOTHING;


-- ====================
-- STEP 6: Link capability type to tiers (for admin UI)
-- ====================
-- This links the capability_type_list to subscription_tiers_list so the admin
-- panel can show which tiers have this capability

UPDATE capability_type_list ct
SET tier_id = 'tier_professional'
WHERE ct.key = 'storefront_options'
  AND ct.tier_id IS NULL;


-- ====================
-- VERIFICATION QUERIES (run after migration)
-- ====================

-- Verify table exists
-- SELECT count(*) FROM tenant_storefront_options_settings;

-- Verify capability type
-- SELECT * FROM capability_type_list WHERE key = 'storefront_options';

-- Verify features
-- SELECT key, name, category FROM features_list WHERE category = 'storefront_options' ORDER BY sort_order;

-- Verify capability-feature links
-- SELECT f.key, f.name FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'storefront_options'
--   ORDER BY f.sort_order;

-- Verify tier features for Professional
-- SELECT tf.feature_key, tf.feature_name FROM tier_features_list tf
--   WHERE tf.tier_id = 'tier_professional'
--   AND tf.feature_key LIKE 'storefront_opt_%'
--   ORDER BY tf.feature_key;

-- Verify tier features for Enterprise (should have all + flexible)
-- SELECT tf.feature_key, tf.feature_name FROM tier_features_list tf
--   WHERE tf.tier_id = 'tier_enterprise'
--   AND tf.feature_key LIKE 'storefront_opt_%'
--   ORDER BY tf.feature_key;
