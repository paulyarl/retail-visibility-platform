-- ============================================================
-- Migration 132: Marketing Ops — Category / Tone / Attributes Alignment
-- ============================================================
-- Description:
--   - Adds mkt_category_tone_presets_list for category→tone presets.
--   - Adds tone, retainer, and attributes to mkt_campaigns_list.
--   - Adds tone to mkt_prompt_templates_list.
-- Prerequisite: 131_marketing_ops_payment_collection.sql applied
-- Date: 2026-07-29
-- Design doc: docs/LocalBiz/marketing_ops_category_tone_alignment_sprint_plan.md
-- ============================================================

-- ============================================================
-- STEP 1: Category-tone presets table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_category_tone_presets_list (
  id          VARCHAR(255) PRIMARY KEY,
  category    VARCHAR(100) NOT NULL,
  tone        VARCHAR(50)  NOT NULL,
  description TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_by  TEXT         REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(category, tone)
);

CREATE INDEX IF NOT EXISTS idx_mkt_category_tone_category
  ON mkt_category_tone_presets_list(category, is_active);

CREATE INDEX IF NOT EXISTS idx_mkt_category_tone_tone
  ON mkt_category_tone_presets_list(tone);

-- ============================================================
-- STEP 2: Add tone, retainer, and attributes to mkt_campaigns_list
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS tone       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS retainer   VARCHAR(20) CHECK (retainer IN ('Fast', 'Medium', 'Slow')),
  ADD COLUMN IF NOT EXISTS attributes JSONB       DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_tone
  ON mkt_campaigns_list(tone);

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_retainer
  ON mkt_campaigns_list(retainer);

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_attributes
  ON mkt_campaigns_list USING GIN (attributes);

-- ============================================================
-- STEP 3: Add tone to mkt_prompt_templates_list
-- ============================================================

ALTER TABLE mkt_prompt_templates_list
  ADD COLUMN IF NOT EXISTS tone VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_mkt_prompt_templates_tone
  ON mkt_prompt_templates_list(prompt_type, category, tone, is_active);

-- ============================================================
-- STEP 4: updated_at trigger for mkt_category_tone_presets_list
-- ============================================================

CREATE OR REPLACE FUNCTION update_mkt_category_tone_presets_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_category_tone_presets_list_updated_at
  ON mkt_category_tone_presets_list;

CREATE TRIGGER trg_mkt_category_tone_presets_list_updated_at
  BEFORE UPDATE ON mkt_category_tone_presets_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_category_tone_presets_list_updated_at();

-- ============================================================
-- STEP 5: Row Level Security
-- ============================================================

ALTER TABLE mkt_category_tone_presets_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_category_tone_presets_admin_all ON mkt_category_tone_presets_list
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_category_tone_presets_service_write ON mkt_category_tone_presets_list
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_category_tone_presets_read_all ON mkt_category_tone_presets_list
    FOR SELECT
    USING (current_setting('app.current_role', true) IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 6: Seed starter presets
-- ============================================================

INSERT INTO mkt_category_tone_presets_list (id, category, tone, description)
VALUES
  ('mctp-' || substr(md5(random()::text), 1, 12), 'dental',      'Empathetic',  'Gentle, patient-focused tone for dental practices.'),
  ('mctp-' || substr(md5(random()::text), 1, 12), 'legal',       'Professional', 'Formal, authoritative tone for attorneys and law firms.'),
  ('mctp-' || substr(md5(random()::text), 1, 12), 'restaurant',  'Friendly',    'Warm, inviting tone for local restaurants.'),
  ('mctp-' || substr(md5(random()::text), 1, 12), 'real estate', 'Upscale',     'Polished, aspirational tone for real estate services.')
ON CONFLICT (category, tone) DO NOTHING;
