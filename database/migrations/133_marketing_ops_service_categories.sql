-- ============================================================
-- Migration 133: Marketing Ops — Service Categories
-- ============================================================
-- Description:
--   - Adds mkt_service_categories_list to store service category
--     value/label pairs so new categories can be added from the UI
--     and receipts/payment labels stay in sync with the backend.
-- Prerequisite: 132_marketing_ops_category_tone.sql applied
-- Date: 2026-07-30
-- ============================================================

-- ============================================================
-- STEP 1: Service categories table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_service_categories_list (
  value      VARCHAR(100)  PRIMARY KEY,
  label      VARCHAR(255)  NOT NULL,
  is_active  BOOLEAN       NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_service_categories_active
  ON mkt_service_categories_list(value, is_active);

-- ============================================================
-- STEP 2: updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_mkt_service_categories_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_service_categories_list_updated_at
  ON mkt_service_categories_list;

CREATE TRIGGER trg_mkt_service_categories_list_updated_at
  BEFORE UPDATE ON mkt_service_categories_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_service_categories_list_updated_at();

-- ============================================================
-- STEP 3: Row Level Security
-- ============================================================

ALTER TABLE mkt_service_categories_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_service_categories_admin_all ON mkt_service_categories_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_service_categories_service_write ON mkt_service_categories_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_service_categories_read_all ON mkt_service_categories_list
    FOR SELECT
    USING (current_setting('app.current_role', true) IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 4: Seed the canonical service categories
-- ============================================================

INSERT INTO mkt_service_categories_list (value, label) VALUES
  ('gbp_optimization',   'Google Business Profile Optimization'),
  ('review_management',  'Review Management Setup'),
  ('website_audit',      'Website Audit & Report'),
  ('local_seo',          'Local SEO Package'),
  ('social_media_setup', 'Social Media Setup'),
  ('branding_package',   'Branding Package'),
  ('content_creation',   'Content Creation Package')
ON CONFLICT (value) DO UPDATE SET
  label = EXCLUDED.label,
  is_active = true,
  updated_at = NOW();
