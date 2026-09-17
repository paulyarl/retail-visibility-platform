-- Migration: 095_migrate_group_gates_to_on_off
-- Purpose: Migrate ambiguous *_enabled group-gate feature keys to canonical *_on
--          and *_disabled group-gate feature keys to canonical *_off (product
--          options groups only), while leaving old keys in place for backward
--          compatibility.  Adds corresponding *_on merchant-preference columns
--          to tables that currently store group-gate toggles.
--
-- Phase: Phase 5 resolver migration data layer.  Must run after resolvers have
--        been updated to read *_on with *_enabled fallback.
--
-- Idempotency: Safe to re-run; uses ON CONFLICT / ALTER TABLE IF NOT EXISTS /
--              DO NOTHING patterns and copies values only when new column is null.

BEGIN;

-- Disable RLS and user triggers for deterministic migration semantics.
SET LOCAL row_security = off;
SET LOCAL session_replication_role = 'replica';

-- ============================================================================
-- 1. CONFIGURATION: old_key -> new_key mappings
-- ============================================================================
CREATE TEMP TABLE feature_key_migration (
  old_key             TEXT PRIMARY KEY,
  new_key             TEXT NOT NULL,
  -- Which capability type key (from capability_type_list) owns this feature, when known.
  capability_type_key TEXT
) ON COMMIT DROP;

INSERT INTO feature_key_migration (old_key, new_key, capability_type_key) VALUES
  -- product_options group-control pairs: *_enabled -> *_on, *_disabled -> *_off
  ('product_options_creation_enabled',  'product_options_creation_on',  'product_options'),
  ('product_options_creation_disabled', 'product_options_creation_off', 'product_options'),
  ('product_options_layout_enabled',    'product_options_layout_on',    'product_options'),
  ('product_options_layout_disabled',   'product_options_layout_off',   'product_options'),
  ('product_options_sections_enabled',  'product_options_sections_on',  'product_options'),
  ('product_options_sections_disabled', 'product_options_sections_off', 'product_options'),

  -- chatbot_options single _enabled group gates
  ('chatbot_static_enabled',  'chatbot_static_on',  'chatbot_options'),
  ('chatbot_dynamic_enabled', 'chatbot_dynamic_on', 'chatbot_options'),
  ('chatbot_skills_enabled',  'chatbot_skills_on',  'chatbot_options'),
  ('chatbot_kb_enabled',      'chatbot_kb_on',      'chatbot_options'),
  ('chatbot_widget_enabled',  'chatbot_widget_on',  'chatbot_options'),

  -- social_commerce_options single _enabled group gates
  ('social_commerce_meta_enabled',   'social_commerce_meta_on',   'social_commerce_options'),
  ('social_commerce_tiktok_enabled', 'social_commerce_tiktok_on', 'social_commerce_options'),

  -- storefront_options single _enabled group gates
  ('storefront_opt_hours_enabled',    'storefront_opt_hours_on',    'storefront_options'),
  ('storefront_opt_category_enabled', 'storefront_opt_category_on', 'storefront_options'),
  ('storefront_opt_recommend_enabled','storefront_opt_recommend_on','storefront_options'),
  ('storefront_opt_info_enabled',     'storefront_opt_info_on',     'storefront_options'),
  ('storefront_opt_qr_enabled',       'storefront_opt_qr_on',       'storefront_options'),
  ('storefront_opt_gallery_enabled',  'storefront_opt_gallery_on',  'storefront_options'),
  ('storefront_opt_advanced_enabled', 'storefront_opt_advanced_on', 'storefront_options'),
  ('storefront_opt_layout_enabled',   'storefront_opt_layout_on',   'storefront_options'),

  -- faq_options single _enabled group gates
  ('faq_storefront_enabled',  'faq_storefront_on',  'faq_options'),
  ('faq_product_enabled',    'faq_product_on',    'faq_options'),
  ('faq_templates_enabled',  'faq_templates_on',  'faq_options'),
  ('faq_management_enabled',   'faq_management_on',   'faq_options'),
  ('faq_preview_enabled',     'faq_preview_on',     'faq_options'),
  ('faq_display_enabled',     'faq_display_on',     'faq_options'),
  ('faq_kb_enabled',          'faq_kb_on',          'faq_options'),

  -- directory_entry single _enabled group gates
  ('directory_entry_hours_enabled',   'directory_entry_hours_on',   'directory_entry'),
  ('directory_entry_map_enabled',     'directory_entry_map_on',     'directory_entry'),
  ('directory_entry_contact_enabled', 'directory_entry_contact_on', 'directory_entry'),
  ('directory_entry_gallery_enabled', 'directory_entry_gallery_on', 'directory_entry'),
  ('directory_entry_qr_enabled',     'directory_entry_qr_on',     'directory_entry'),
  ('directory_entry_social_enabled',  'directory_entry_social_on',  'directory_entry'),
  ('directory_entry_seo_enabled',     'directory_entry_seo_on',     'directory_entry'),
  ('directory_entry_layout_enabled',  'directory_entry_layout_on',  'directory_entry'),

  -- quickstart_options single _enabled group gates
  ('quickstart_product_enabled',  'quickstart_product_on',  'quickstart_options'),
  ('quickstart_category_enabled', 'quickstart_category_on', 'quickstart_options'),
  ('quickstart_ai_enabled',       'quickstart_ai_on',       'quickstart_options'),

  -- crm_options single _enabled group gates
  ('crm_inquiry_product_enabled',   'crm_inquiry_product_on',   'crm_options'),
  ('crm_inquiry_storefront_enabled','crm_inquiry_storefront_on','crm_options'),
  ('crm_inquiry_directory_enabled', 'crm_inquiry_directory_on', 'crm_options'),

  -- integration_options single _enabled group gates
  ('integration_pos_enabled',    'integration_pos_on',    'integration_options'),
  ('integration_google_enabled', 'integration_google_on', 'integration_options'),

  -- featured_options single _enabled group gates
  ('featured_tenant_enabled',  'featured_tenant_on',  'featured_options'),
  ('featured_platform_enabled','featured_platform_on','featured_options')
;

-- ============================================================================
-- 2. MIGRATE features_list: create new *_on / *_off canonical feature keys
-- ============================================================================
INSERT INTO features_list (
  id,
  key,
  name,
  description,
  category,
  is_active,
  sort_order,
  marketing_name,
  marketing_description,
  icon_name,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::text,
  m.new_key,
  CASE
    WHEN old.name ~ '\sEnabled$' THEN regexp_replace(old.name, '\sEnabled$', ' On')
    WHEN old.name ~ '\sDisabled$' THEN regexp_replace(old.name, '\sDisabled$', ' Off')
    WHEN old.name ~ 'Enabled$' THEN regexp_replace(old.name, 'Enabled$', 'On')
    WHEN old.name ~ 'Disabled$' THEN regexp_replace(old.name, 'Disabled$', 'Off')
    ELSE old.name || ' On'
  END,
  old.description,
  old.category,
  COALESCE(old.is_active, true),
  old.sort_order,
  old.marketing_name,
  old.marketing_description,
  old.icon_name,
  NOW(),
  NOW()
FROM feature_key_migration m
JOIN features_list old ON old.key = m.old_key
WHERE old.is_active IS NOT FALSE
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  marketing_name = EXCLUDED.marketing_name,
  marketing_description = EXCLUDED.marketing_description,
  icon_name = EXCLUDED.icon_name,
  updated_at = NOW();

-- ============================================================================
-- 3. MIGRATE capability_features_list: wire canonical feature keys to capability types
-- ============================================================================
INSERT INTO capability_features_list (
  id,
  capability_type_id,
  feature_id,
  restrictions,
  is_active,
  sort_order,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::text,
  cfl.capability_type_id,
  new_f.id,
  cfl.restrictions,
  COALESCE(cfl.is_active, true),
  cfl.sort_order,
  NOW(),
  NOW()
FROM feature_key_migration m
JOIN features_list old_f ON old_f.key = m.old_key
JOIN capability_features_list cfl ON cfl.feature_id = old_f.id
JOIN features_list new_f ON new_f.key = m.new_key
ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
  restrictions = EXCLUDED.restrictions,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- ============================================================================
-- 4. MIGRATE tier_features_list: add canonical rows alongside legacy rows
-- ============================================================================
INSERT INTO tier_features_list (
  id,
  tier_id,
  capability_type_id,
  feature_key,
  feature_name,
  is_enabled,
  is_inherited,
  metadata,
  created_at,
  updated_at,
  is_highlighted,
  highlight_order,
  highlight_description,
  marketing_name,
  tier_specific_restrictions,
  created_by,
  updated_by
)
SELECT
  ('tfl-' || gen_random_uuid()::text),
  tfl.tier_id,
  tfl.capability_type_id,
  m.new_key,
  CASE
    WHEN tfl.feature_name ~ '\sEnabled$' THEN regexp_replace(tfl.feature_name, '\sEnabled$', ' On')
    WHEN tfl.feature_name ~ '\sDisabled$' THEN regexp_replace(tfl.feature_name, '\sDisabled$', ' Off')
    WHEN tfl.feature_name ~ 'Enabled$' THEN regexp_replace(tfl.feature_name, 'Enabled$', 'On')
    WHEN tfl.feature_name ~ 'Disabled$' THEN regexp_replace(tfl.feature_name, 'Disabled$', 'Off')
    ELSE tfl.feature_name || ' On'
  END,
  tfl.is_enabled,
  tfl.is_inherited,
  tfl.metadata,
  tfl.created_at,
  NOW(),
  tfl.is_highlighted,
  tfl.highlight_order,
  tfl.highlight_description,
  tfl.marketing_name,
  tfl.tier_specific_restrictions,
  tfl.created_by,
  'migration_095'
FROM feature_key_migration m
JOIN tier_features_list tfl ON tfl.feature_key = m.old_key
ON CONFLICT (tier_id, feature_key) DO UPDATE SET
  capability_type_id = EXCLUDED.capability_type_id,
  feature_name = EXCLUDED.feature_name,
  is_enabled = EXCLUDED.is_enabled,
  is_inherited = EXCLUDED.is_inherited,
  metadata = EXCLUDED.metadata,
  is_highlighted = EXCLUDED.is_highlighted,
  highlight_order = EXCLUDED.highlight_order,
  highlight_description = EXCLUDED.highlight_description,
  marketing_name = EXCLUDED.marketing_name,
  tier_specific_restrictions = EXCLUDED.tier_specific_restrictions,
  created_by = EXCLUDED.created_by,
  updated_by = EXCLUDED.updated_by,
  updated_at = NOW();

-- ============================================================================
-- 5. MIGRATE tenant_feature_purchases: mirror legacy purchases with canonical keys
-- ============================================================================
INSERT INTO tenant_feature_purchases (
  id,
  tenant_id,
  feature_key,
  source,
  status,
  purchased_at,
  expires_at,
  metadata,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  tfp.tenant_id,
  m.new_key,
  tfp.source,
  tfp.status,
  tfp.purchased_at,
  tfp.expires_at,
  tfp.metadata,
  NOW(),
  NOW()
FROM feature_key_migration m
JOIN tenant_feature_purchases tfp ON tfp.feature_key = m.old_key
WHERE tfp.status IN ('active','past_due','trial')
  AND (tfp.expires_at IS NULL OR tfp.expires_at > NOW())
ON CONFLICT (tenant_id, feature_key) DO NOTHING;

-- ============================================================================
-- 6. MIGRATE tenant_feature_overrides_list: mirror legacy overrides with canonical keys
-- ============================================================================
INSERT INTO tenant_feature_overrides_list (
  id,
  tenant_id,
  feature,
  granted,
  reason,
  expires_at,
  granted_by,
  created_at,
  updated_at
)
SELECT
  ('tfol-' || gen_random_uuid()::text),
  tfo.tenant_id,
  m.new_key,
  tfo.granted,
  tfo.reason,
  tfo.expires_at,
  tfo.granted_by,
  tfo.created_at,
  NOW()
FROM feature_key_migration m
JOIN tenant_feature_overrides_list tfo ON tfo.feature = m.old_key
WHERE tfo.granted = true
  AND (tfo.expires_at IS NULL OR tfo.expires_at > NOW())
ON CONFLICT (tenant_id, feature) DO NOTHING;

-- ============================================================================
-- 7. ADD *_on MERCHANT-PREFERENCE COLUMNS AND BACKFILL (group-gate tables only)
--    Tables and column pairs are limited to those that currently store
--    group-gate toggles in merchant settings.
-- ============================================================================
CREATE TEMP TABLE merchant_settings_col_migration (
  table_name   TEXT,
  old_col      TEXT,
  new_col      TEXT,
  default_expr TEXT
) ON COMMIT DROP;

INSERT INTO merchant_settings_col_migration (table_name, old_col, new_col, default_expr) VALUES
  ('tenant_chatbot_options_settings', 'chatbot_static_enabled',  'chatbot_static_on',  'true'),
  ('tenant_chatbot_options_settings', 'chatbot_dynamic_enabled', 'chatbot_dynamic_on', 'false'),
  ('tenant_chatbot_options_settings', 'chatbot_skills_enabled',  'chatbot_skills_on',  'false'),
  ('tenant_chatbot_options_settings', 'chatbot_kb_enabled',      'chatbot_kb_on',      'false'),
  ('tenant_chatbot_options_settings', 'chatbot_widget_enabled',  'chatbot_widget_on',  'true'),
  ('tenant_social_commerce_options_settings', 'social_commerce_meta_enabled',   'social_commerce_meta_on',   'false'),
  ('tenant_social_commerce_options_settings', 'social_commerce_tiktok_enabled', 'social_commerce_tiktok_on', 'false');

DO $$
DECLARE
  r RECORD;
  table_exists BOOLEAN;
  old_col_exists BOOLEAN;
BEGIN
  FOR r IN SELECT * FROM merchant_settings_col_migration LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = r.table_name
    ) INTO table_exists;

    IF table_exists THEN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = r.table_name AND column_name = r.old_col
      ) INTO old_col_exists;

      IF old_col_exists THEN
        EXECUTE format(
          'ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I BOOLEAN DEFAULT %s;',
          r.table_name,
          r.new_col,
          r.default_expr
        );

        EXECUTE format(
          'UPDATE %I SET %I = COALESCE(%I, %I), updated_at = NOW() WHERE %I IS NULL;',
          r.table_name,
          r.new_col,
          r.new_col,
          r.old_col,
          r.new_col
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 8. REFRESH EFFECTIVE CAPABILITY MATERIALIZED VIEW (if present)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname = 'mv_tenant_effective_capabilities'
  ) THEN
    REFRESH MATERIALIZED VIEW mv_tenant_effective_capabilities;
  END IF;
END $$;

-- ============================================================================
-- 9. VERIFICATION
-- ============================================================================
SELECT capability_type_key,
       COUNT(*) AS canonical_features_inserted
FROM feature_key_migration m
JOIN features_list f ON f.key = m.new_key
GROUP BY capability_type_key
ORDER BY capability_type_key;

SELECT 'tier_features_list rows created' AS source, COUNT(*) AS total
FROM tier_features_list tfl
JOIN feature_key_migration m ON tfl.feature_key = m.new_key;

SELECT 'tenant_feature_purchases rows created' AS source, COUNT(*) AS total
FROM tenant_feature_purchases tfp
JOIN feature_key_migration m ON tfp.feature_key = m.new_key;

SELECT 'tenant_feature_overrides_list rows created' AS source, COUNT(*) AS total
FROM tenant_feature_overrides_list tfo
JOIN feature_key_migration m ON tfo.feature = m.new_key;

SELECT m.table_name, m.new_col, 'merchant_on_column_present' AS status
FROM merchant_settings_col_migration m
JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = m.table_name AND c.column_name = m.new_col
JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = m.table_name;

COMMIT;
