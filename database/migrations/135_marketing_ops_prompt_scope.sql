-- ============================================================
-- Migration 135: Marketing Ops — Prompt Template Scope
-- ============================================================
-- Description:
--   - Adds `scope` to mkt_prompt_templates_list to indicate
--     which campaign scope a prompt template is designed for
--     (business, category, or city).
--   - Seeds existing category_analysis / city_analysis templates
--     with their natural scope.
-- Prerequisite: 134_marketing_ops_campaign_scope.sql applied
-- Date: 2026-07-30
-- ============================================================

-- ============================================================
-- STEP 1: Add scope column
-- ============================================================

ALTER TABLE mkt_prompt_templates_list
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'business';

-- ============================================================
-- STEP 2: Seed scope for existing analysis templates
-- ============================================================

UPDATE mkt_prompt_templates_list
  SET scope = 'category'
  WHERE prompt_type = 'category_analysis';

UPDATE mkt_prompt_templates_list
  SET scope = 'city'
  WHERE prompt_type = 'city_analysis';

-- ============================================================
-- STEP 3: Index for scope filtering
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_mkt_prompt_templates_scope
  ON mkt_prompt_templates_list(scope);
