-- ============================================================
-- Migration 134: Marketing Ops — Campaign Scope
-- ============================================================
-- Description:
--   - Adds `scope` to mkt_campaigns_list to distinguish
--     business-, category-, and city-scoped campaigns.
--   - Makes business_name nullable so aggregate (category/city)
--     campaigns do not require a specific business.
-- Prerequisite: 133_marketing_ops_service_categories.sql applied
-- Date: 2026-07-30
-- ============================================================

-- ============================================================
-- STEP 1: Add scope column with a sensible default
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'business';

-- ============================================================
-- STEP 2: Make business_name nullable for aggregate scopes
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ALTER COLUMN business_name DROP NOT NULL;

-- ============================================================
-- STEP 3: Index for scope filtering
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_scope
  ON mkt_campaigns_list(scope);
