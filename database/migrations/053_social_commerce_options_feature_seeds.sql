-- Migration: Seed social_commerce_options capability group with feature keys
-- Description: Inserts social commerce feature keys into features_list,
--              ensures the social_commerce_options capability type exists,
--              links features via capability_features_list,
--              and enables them per tier.
-- Prerequisites: features_list, capability_type_list, capability_features_list,
--                tier_features_list, subscription_tiers_list tables must exist
-- Date: 2026-06-23

-- ============================================================
-- 1. Insert social commerce feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  -- Master gate
  ('social_commerce_enabled',        'Social Commerce Enabled',        'Master toggle for social commerce options capability',          'social_commerce', true, 0,  NOW(), NOW()),

  -- Flexible gate (unlocks all sub-features for org/enterprise tiers)
  ('social_commerce_flexible',       'Social Commerce Flexible',       'Unlock all social commerce sub-features without individual gates', 'social_commerce', true, 1,  NOW(), NOW()),

  -- Meta Commerce group
  ('social_commerce_meta_enabled',   'Meta Commerce',                  'Enable Meta commerce integrations (Instagram Shopping, Facebook Shop)', 'social_commerce', true, 10, NOW(), NOW()),
  ('social_commerce_meta_catalog',   'Meta Catalog Sync',              'Sync product catalog to Meta Commerce Manager',                 'social_commerce', true, 11, NOW(), NOW()),
  ('social_commerce_meta_shop',      'Meta Shop Setup',                'Configure Facebook Shop and Instagram Shopping storefront',     'social_commerce', true, 12, NOW(), NOW()),
  ('social_commerce_meta_pixel',     'Meta Pixel Tracking',            'Track conversions with Meta Pixel',                             'social_commerce', true, 13, NOW(), NOW()),

  -- TikTok Commerce group
  ('social_commerce_tiktok_enabled', 'TikTok Commerce',                'Enable TikTok commerce integrations (TikTok Shop)',             'social_commerce', true, 20, NOW(), NOW()),
  ('social_commerce_tiktok_catalog', 'TikTok Catalog Sync',            'Sync product catalog to TikTok Shop',                           'social_commerce', true, 21, NOW(), NOW()),
  ('social_commerce_tiktok_shop',    'TikTok Shop Setup',              'Configure TikTok Shop storefront',                              'social_commerce', true, 22, NOW(), NOW()),
  ('social_commerce_tiktok_pixel',   'TikTok Pixel Tracking',          'Track conversions with TikTok Pixel',                           'social_commerce', true, 23, NOW(), NOW()),

  -- Social Experience group
  ('social_commerce_share_buttons',  'Social Share Buttons',           'Display share buttons on product and storefront pages',         'social_commerce', true, 30, NOW(), NOW()),
  ('social_commerce_social_proof',   'Social Proof / UGC',             'Show user-generated content and social proof on storefront',    'social_commerce', true, 31, NOW(), NOW()),
  ('social_commerce_abandoned_cart', 'Abandoned Cart Recovery',        'Send recovery messages via social platforms for abandoned carts', 'social_commerce', true, 32, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- ============================================================
-- 2. Upsert social_commerce_options capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'social_commerce_options',
  'Social Commerce Options',
  'Social commerce integrations including Meta (Instagram/Facebook) and TikTok Shop, social pixels, share buttons, and abandoned cart recovery.',
  'social_commerce_options',
  true,
  14,
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
-- 3. Link features to social_commerce_options capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'social_commerce_options';
  v_feature_keys         TEXT[] := ARRAY[
    'social_commerce_enabled',
    'social_commerce_flexible',
    'social_commerce_meta_enabled',
    'social_commerce_meta_catalog',
    'social_commerce_meta_shop',
    'social_commerce_meta_pixel',
    'social_commerce_tiktok_enabled',
    'social_commerce_tiktok_catalog',
    'social_commerce_tiktok_shop',
    'social_commerce_tiktok_pixel',
    'social_commerce_share_buttons',
    'social_commerce_social_proof',
    'social_commerce_abandoned_cart'
  ];
  v_capability_type_id TEXT;
  v_missing_keys       TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  IF v_capability_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type % not found', v_capability_type_key;
  END IF;

  DELETE FROM capability_features_list WHERE capability_type_id = v_capability_type_id;

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
-- 4. Enable social commerce features for tiers
-- ============================================================
-- Social commerce is available from ecommerce tier and above.
-- Lower tiers (discovery, storefront, commitment) do NOT get social commerce.
-- Org/enterprise tiers get the flexible gate to unlock everything.

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
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'social_commerce_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type social_commerce_options not found';
  END IF;

  FOR v_tier_key, v_feature_key, v_feature_name, v_marketing_name, v_highlight, v_highlight_order IN
    SELECT * FROM (VALUES
      -- ─── ecommerce: social commerce base ───
      ('ecommerce', 'social_commerce_enabled',        'Social Commerce Enabled',        'Social Commerce',    true,  1),
      ('ecommerce', 'social_commerce_meta_enabled',   'Meta Commerce',                  NULL,                 false, 0),
      ('ecommerce', 'social_commerce_meta_catalog',   'Meta Catalog Sync',              NULL,                 false, 0),
      ('ecommerce', 'social_commerce_meta_shop',      'Meta Shop Setup',                NULL,                 false, 0),
      ('ecommerce', 'social_commerce_tiktok_enabled', 'TikTok Commerce',                NULL,                 false, 0),
      ('ecommerce', 'social_commerce_tiktok_catalog', 'TikTok Catalog Sync',            NULL,                 false, 0),
      ('ecommerce', 'social_commerce_tiktok_shop',    'TikTok Shop Setup',              NULL,                 false, 0),
      ('ecommerce', 'social_commerce_share_buttons',  'Social Share Buttons',           NULL,                 false, 0),

      -- ─── omnichannel: + meta pixel, tiktok pixel ───
      ('omnichannel', 'social_commerce_enabled',        'Social Commerce Enabled',        'Social Commerce',    true,  1),
      ('omnichannel', 'social_commerce_meta_enabled',   'Meta Commerce',                  NULL,                 false, 0),
      ('omnichannel', 'social_commerce_meta_catalog',   'Meta Catalog Sync',              NULL,                 false, 0),
      ('omnichannel', 'social_commerce_meta_shop',      'Meta Shop Setup',                NULL,                 false, 0),
      ('omnichannel', 'social_commerce_meta_pixel',     'Meta Pixel Tracking',            NULL,                 false, 0),
      ('omnichannel', 'social_commerce_tiktok_enabled', 'TikTok Commerce',                NULL,                 false, 0),
      ('omnichannel', 'social_commerce_tiktok_catalog', 'TikTok Catalog Sync',            NULL,                 false, 0),
      ('omnichannel', 'social_commerce_tiktok_shop',    'TikTok Shop Setup',              NULL,                 false, 0),
      ('omnichannel', 'social_commerce_tiktok_pixel',   'TikTok Pixel Tracking',          NULL,                 false, 0),
      ('omnichannel', 'social_commerce_share_buttons',  'Social Share Buttons',           NULL,                 false, 0),

      -- ─── professional: same as omnichannel ───
      ('professional', 'social_commerce_enabled',        'Social Commerce Enabled',        'Social Commerce',    true,  1),
      ('professional', 'social_commerce_meta_enabled',   'Meta Commerce',                  NULL,                 false, 0),
      ('professional', 'social_commerce_meta_catalog',   'Meta Catalog Sync',              NULL,                 false, 0),
      ('professional', 'social_commerce_meta_shop',      'Meta Shop Setup',                NULL,                 false, 0),
      ('professional', 'social_commerce_meta_pixel',     'Meta Pixel Tracking',            NULL,                 false, 0),
      ('professional', 'social_commerce_tiktok_enabled', 'TikTok Commerce',                NULL,                 false, 0),
      ('professional', 'social_commerce_tiktok_catalog', 'TikTok Catalog Sync',            NULL,                 false, 0),
      ('professional', 'social_commerce_tiktok_shop',    'TikTok Shop Setup',              NULL,                 false, 0),
      ('professional', 'social_commerce_tiktok_pixel',   'TikTok Pixel Tracking',          NULL,                 false, 0),
      ('professional', 'social_commerce_share_buttons',  'Social Share Buttons',           NULL,                 false, 0),

      -- ─── chain_starter: + social proof ───
      ('chain_starter', 'social_commerce_enabled',        'Social Commerce Enabled',        'Social Commerce',    true,  1),
      ('chain_starter', 'social_commerce_meta_enabled',   'Meta Commerce',                  NULL,                 false, 0),
      ('chain_starter', 'social_commerce_meta_catalog',   'Meta Catalog Sync',              NULL,                 false, 0),
      ('chain_starter', 'social_commerce_meta_shop',      'Meta Shop Setup',                NULL,                 false, 0),
      ('chain_starter', 'social_commerce_meta_pixel',     'Meta Pixel Tracking',            NULL,                 false, 0),
      ('chain_starter', 'social_commerce_tiktok_enabled', 'TikTok Commerce',                NULL,                 false, 0),
      ('chain_starter', 'social_commerce_tiktok_catalog', 'TikTok Catalog Sync',            NULL,                 false, 0),
      ('chain_starter', 'social_commerce_tiktok_shop',    'TikTok Shop Setup',              NULL,                 false, 0),
      ('chain_starter', 'social_commerce_tiktok_pixel',   'TikTok Pixel Tracking',          NULL,                 false, 0),
      ('chain_starter', 'social_commerce_share_buttons',  'Social Share Buttons',           NULL,                 false, 0),
      ('chain_starter', 'social_commerce_social_proof',   'Social Proof / UGC',             NULL,                 false, 0),

      -- ─── chain_professional: + abandoned cart ───
      ('chain_professional', 'social_commerce_enabled',        'Social Commerce Enabled',        'Social Commerce',    true,  1),
      ('chain_professional', 'social_commerce_meta_enabled',   'Meta Commerce',                  NULL,                 false, 0),
      ('chain_professional', 'social_commerce_meta_catalog',   'Meta Catalog Sync',              NULL,                 false, 0),
      ('chain_professional', 'social_commerce_meta_shop',      'Meta Shop Setup',                NULL,                 false, 0),
      ('chain_professional', 'social_commerce_meta_pixel',     'Meta Pixel Tracking',            NULL,                 false, 0),
      ('chain_professional', 'social_commerce_tiktok_enabled', 'TikTok Commerce',                NULL,                 false, 0),
      ('chain_professional', 'social_commerce_tiktok_catalog', 'TikTok Catalog Sync',            NULL,                 false, 0),
      ('chain_professional', 'social_commerce_tiktok_shop',    'TikTok Shop Setup',              NULL,                 false, 0),
      ('chain_professional', 'social_commerce_tiktok_pixel',   'TikTok Pixel Tracking',          NULL,                 false, 0),
      ('chain_professional', 'social_commerce_share_buttons',  'Social Share Buttons',           NULL,                 false, 0),
      ('chain_professional', 'social_commerce_social_proof',   'Social Proof / UGC',             NULL,                 false, 0),
      ('chain_professional', 'social_commerce_abandoned_cart', 'Abandoned Cart Recovery',        NULL,                 false, 0),

      -- ─── organization: same as chain_professional ───
      ('organization', 'social_commerce_enabled',        'Social Commerce Enabled',        'Social Commerce',    true,  1),
      ('organization', 'social_commerce_meta_enabled',   'Meta Commerce',                  NULL,                 false, 0),
      ('organization', 'social_commerce_meta_catalog',   'Meta Catalog Sync',              NULL,                 false, 0),
      ('organization', 'social_commerce_meta_shop',      'Meta Shop Setup',                NULL,                 false, 0),
      ('organization', 'social_commerce_meta_pixel',     'Meta Pixel Tracking',            NULL,                 false, 0),
      ('organization', 'social_commerce_tiktok_enabled', 'TikTok Commerce',                NULL,                 false, 0),
      ('organization', 'social_commerce_tiktok_catalog', 'TikTok Catalog Sync',            NULL,                 false, 0),
      ('organization', 'social_commerce_tiktok_shop',    'TikTok Shop Setup',              NULL,                 false, 0),
      ('organization', 'social_commerce_tiktok_pixel',   'TikTok Pixel Tracking',          NULL,                 false, 0),
      ('organization', 'social_commerce_share_buttons',  'Social Share Buttons',           NULL,                 false, 0),
      ('organization', 'social_commerce_social_proof',   'Social Proof / UGC',             NULL,                 false, 0),
      ('organization', 'social_commerce_abandoned_cart', 'Abandoned Cart Recovery',        NULL,                 false, 0),

      -- ─── enterprise: Everything (flexible) ───
      ('enterprise', 'social_commerce_enabled',        'Social Commerce Enabled',        'Social Commerce',    true,  1),
      ('enterprise', 'social_commerce_flexible',       'Social Commerce Flexible',       NULL,                 false, 0),
      ('enterprise', 'social_commerce_meta_enabled',   'Meta Commerce',                  NULL,                 false, 0),
      ('enterprise', 'social_commerce_meta_catalog',   'Meta Catalog Sync',              NULL,                 false, 0),
      ('enterprise', 'social_commerce_meta_shop',      'Meta Shop Setup',                NULL,                 false, 0),
      ('enterprise', 'social_commerce_meta_pixel',     'Meta Pixel Tracking',            NULL,                 false, 0),
      ('enterprise', 'social_commerce_tiktok_enabled', 'TikTok Commerce',                NULL,                 false, 0),
      ('enterprise', 'social_commerce_tiktok_catalog', 'TikTok Catalog Sync',            NULL,                 false, 0),
      ('enterprise', 'social_commerce_tiktok_shop',    'TikTok Shop Setup',              NULL,                 false, 0),
      ('enterprise', 'social_commerce_tiktok_pixel',   'TikTok Pixel Tracking',          NULL,                 false, 0),
      ('enterprise', 'social_commerce_share_buttons',  'Social Share Buttons',           NULL,                 false, 0),
      ('enterprise', 'social_commerce_social_proof',   'Social Proof / UGC',             NULL,                 false, 0),
      ('enterprise', 'social_commerce_abandoned_cart', 'Abandoned Cart Recovery',        NULL,                 false, 0)
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
      '{"capability_type": "social_commerce_options"}',
      v_highlight,
      v_highlight_order,
      v_marketing_name
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Social commerce options tier features populated for all active tiers';
END $$;

-- ============================================================
-- 5. Create merchant settings table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_social_commerce_options_settings (
  id                                    VARCHAR(255) PRIMARY KEY,
  tenant_id                             VARCHAR(255) NOT NULL UNIQUE,
  social_commerce_enabled               BOOLEAN DEFAULT true,
  social_commerce_meta_enabled          BOOLEAN DEFAULT false,
  social_commerce_meta_catalog          BOOLEAN DEFAULT false,
  social_commerce_meta_shop             BOOLEAN DEFAULT false,
  social_commerce_meta_pixel            BOOLEAN DEFAULT false,
  social_commerce_tiktok_enabled        BOOLEAN DEFAULT false,
  social_commerce_tiktok_catalog        BOOLEAN DEFAULT false,
  social_commerce_tiktok_shop           BOOLEAN DEFAULT false,
  social_commerce_tiktok_pixel          BOOLEAN DEFAULT false,
  social_commerce_share_buttons         BOOLEAN DEFAULT false,
  social_commerce_social_proof          BOOLEAN DEFAULT false,
  social_commerce_abandoned_cart        BOOLEAN DEFAULT false,
  created_at                            TIMESTAMPTZ DEFAULT NOW(),
  updated_at                            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_social_commerce_options_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_social_commerce_options_tenant ON tenant_social_commerce_options_settings(tenant_id);

-- ============================================================
-- 6. Verification queries (run manually to confirm)
-- ============================================================
-- SELECT ctl.key AS capability_type, fl.key AS feature_key, fl.name AS feature_name, cfl.sort_order
-- FROM capability_features_list cfl
-- JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
-- JOIN features_list fl ON fl.id = cfl.feature_id
-- WHERE ctl.key = 'social_commerce_options'
-- ORDER BY cfl.sort_order;

-- SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
-- FROM tier_features_list tfl
-- JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
-- WHERE tfl.feature_key LIKE 'social_commerce_%'
-- ORDER BY stl.sort_order, tfl.feature_key;
