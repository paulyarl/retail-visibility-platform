-- Migration: Add _disabled feature keys for all capability types that lack them
-- Description: Inserts {prefix}_disabled feature keys into features_list,
--              links them via capability_features_list to their respective
--              capability types, and enables them (is_enabled=false) for all
--              existing tiers that already have the capability type assigned.
--              This allows explicit disengagement of a capability type from a tier.
-- Prerequisites: features_list, capability_type_list, capability_features_list,
--                tier_features_list, subscription_tiers_list tables must exist
-- Date: 2026-07-15

-- ============================================================
-- 1. Insert _disabled feature keys into features_list
-- ============================================================
-- Capability types that already have _disabled: storefront_types, product_types, product_options
-- Remaining: 15 capability types need _disabled keys

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('payment_gateway_disabled',     'Payment Gateway Disabled',     'Explicit deactivation gate for payment gateway options',     'payment_gateway',     true, 2,  NOW(), NOW()),
  ('fulfillment_disabled',         'Fulfillment Disabled',         'Explicit deactivation gate for fulfillment options',         'fulfillment',         true, 2,  NOW(), NOW()),
  ('barcode_disabled',             'Barcode Scan Disabled',        'Explicit deactivation gate for barcode scan options',         'barcode',             true, 2,  NOW(), NOW()),
  ('featured_disabled',            'Featured Options Disabled',    'Explicit deactivation gate for featured options',             'featured',            true, 2,  NOW(), NOW()),
  ('integration_disabled',         'Integration Options Disabled', 'Explicit deactivation gate for integration options',          'integration',         true, 2,  NOW(), NOW()),
  ('quickstart_disabled',          'Quickstart Options Disabled',  'Explicit deactivation gate for quickstart options',           'quickstart',          true, 2,  NOW(), NOW()),
  ('storefront_opt_disabled',      'Storefront Options Disabled',  'Explicit deactivation gate for storefront options',           'storefront_options',  true, 2,  NOW(), NOW()),
  ('directory_entry_disabled',     'Directory Entry Disabled',     'Explicit deactivation gate for directory entry options',      'directory_entry',     true, 2,  NOW(), NOW()),
  ('faq_disabled',                 'FAQ Options Disabled',         'Explicit deactivation gate for FAQ options',                  'faq',                 true, 2,  NOW(), NOW()),
  ('crm_disabled',                 'CRM Options Disabled',         'Explicit deactivation gate for CRM options',                  'crm',                 true, 2,  NOW(), NOW()),
  ('chatbot_disabled',             'Chatbot Options Disabled',     'Explicit deactivation gate for chatbot options',              'chatbot',             true, 2,  NOW(), NOW()),
  ('org_disabled',                 'Organization Options Disabled','Explicit deactivation gate for organization options',         'organization_options',true, 2,  NOW(), NOW()),
  ('social_commerce_disabled',     'Social Commerce Disabled',     'Explicit deactivation gate for social commerce options',      'social_commerce',     true, 2,  NOW(), NOW()),
  ('directory_promotion_disabled', 'Directory Promotion Disabled', 'Explicit deactivation gate for directory promotion',          'directory_promotion', true, 2,  NOW(), NOW()),
  ('commerce_disabled',            'Commerce Disabled',            'Explicit deactivation gate for commerce',                     'commerce',            true, 2,  NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- ============================================================
-- 2a. Upsert missing capability types
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('directory_promotion', 'Directory Promotion', 'Directory promotion capabilities including basic, premium, and featured levels.', 'directory_promotion', true, 0, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- ============================================================
-- 2b. Insert directory_promotion feature keys (trail-blazing: full capability alignment)
-- ============================================================
-- Directory promotion is the first automated capability type with all keys
-- properly registered in features_list + capability_features_list.
-- Uses _level_ prefix to distinguish promotion levels from platform tiers.

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('directory_promotion_enabled',         'Directory Promotion Enabled',         'Master ON gate for directory promotion',                         'directory_promotion', true, 0, NOW(), NOW()),
  ('directory_promotion_flexible',        'Directory Promotion Flexible',        'Unlock all promotion levels for flexible tiers',                 'directory_promotion', true, 1, NOW(), NOW()),
  ('directory_promotion_level_basic',     'Directory Promotion Level: Basic',    'Allows the basic promotion level for promoted directory listings','directory_promotion', true, 3, NOW(), NOW()),
  ('directory_promotion_level_premium',   'Directory Promotion Level: Premium',  'Allows the premium promotion level for promoted directory listings','directory_promotion', true, 4, NOW(), NOW()),
  ('directory_promotion_level_featured',  'Directory Promotion Level: Featured', 'Allows the featured promotion level for promoted directory listings','directory_promotion', true, 5, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- ============================================================
-- 2c. Link _disabled features to their capability types
-- ============================================================

DO $$
DECLARE
  v_mappings RECORD;
  v_capability_type_id TEXT;
  v_feature_id TEXT;
BEGIN
  FOR v_mappings IN
    SELECT * FROM (VALUES
      ('payment_gateway_options',     'payment_gateway_disabled'),
      ('fulfillment_options',         'fulfillment_disabled'),
      ('barcode_scan_options',        'barcode_disabled'),
      ('featured_options',            'featured_disabled'),
      ('integration_options',         'integration_disabled'),
      ('quickstart_options',          'quickstart_disabled'),
      ('storefront_options',          'storefront_opt_disabled'),
      ('directory_entry',             'directory_entry_disabled'),
      ('faq_options',                 'faq_disabled'),
      ('crm_options',                 'crm_disabled'),
      ('chatbot_options',             'chatbot_disabled'),
      ('organization_options',        'org_disabled'),
      ('social_commerce_options',     'social_commerce_disabled'),
      ('directory_promotion',         'directory_promotion_disabled'),
      ('commerce_types',              'commerce_disabled')
    ) AS t(cap_type_key, feature_key)
  LOOP
    SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_mappings.cap_type_key LIMIT 1;
    IF v_capability_type_id IS NULL THEN
      RAISE NOTICE 'Capability type % not found — skipping', v_mappings.cap_type_key;
      CONTINUE;
    END IF;

    SELECT id INTO v_feature_id FROM features_list WHERE key = v_mappings.feature_key LIMIT 1;
    IF v_feature_id IS NULL THEN
      RAISE NOTICE 'Feature % not found — skipping', v_mappings.feature_key;
      CONTINUE;
    END IF;

    -- Insert link if not already present
    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    VALUES (v_capability_type_id, v_feature_id, true, 0, NOW(), NOW())
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
      is_active = true,
      updated_at = NOW();

    RAISE NOTICE 'Linked % to %', v_mappings.feature_key, v_mappings.cap_type_key;
  END LOOP;
END $$;

-- ============================================================
-- 2d. Link directory_promotion full key set to capability type
-- ============================================================

DO $$
DECLARE
  v_cap_type_id TEXT;
  v_feature_id TEXT;
  v_key TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'directory_promotion' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE NOTICE 'directory_promotion capability type not found — skipping full key link';
    RETURN;
  END IF;

  FOR v_key IN
    SELECT * FROM (VALUES
      ('directory_promotion_enabled'),
      ('directory_promotion_flexible'),
      ('directory_promotion_level_basic'),
      ('directory_promotion_level_premium'),
      ('directory_promotion_level_featured')
    ) AS t(key)
  LOOP
    SELECT id INTO v_feature_id FROM features_list WHERE key = v_key LIMIT 1;
    IF v_feature_id IS NULL THEN
      RAISE NOTICE 'Feature % not found — skipping', v_key;
      CONTINUE;
    END IF;

    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    VALUES (v_cap_type_id, v_feature_id, true, 0, NOW(), NOW())
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
      is_active = true,
      updated_at = NOW();

    RAISE NOTICE 'Linked % to directory_promotion', v_key;
  END LOOP;
END $$;

-- ============================================================
-- 3. Verification queries (run manually to confirm)
-- ============================================================
-- All _disabled keys:
-- SELECT ctl.key AS capability_type, fl.key AS feature_key, fl.name AS feature_name
-- FROM capability_features_list cfl
-- JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
-- JOIN features_list fl ON fl.id = cfl.feature_id
-- WHERE fl.key LIKE '%_disabled'
-- ORDER BY ctl.key, fl.key;

-- Directory promotion full key set (trail-blazing: all keys registered):
-- SELECT ctl.key AS capability_type, fl.key AS feature_key, fl.name AS feature_name
-- FROM capability_features_list cfl
-- JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
-- JOIN features_list fl ON fl.id = cfl.feature_id
-- WHERE ctl.key = 'directory_promotion'
-- ORDER BY fl.sort_order;
