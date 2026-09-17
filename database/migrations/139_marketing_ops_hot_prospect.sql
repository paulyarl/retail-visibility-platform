-- ============================================================
-- Migration 139: Marketing Ops — Hot-Prospect + State Column
-- ============================================================
-- Description:
--   - Adds `state` column to mkt_campaigns_list (was missing — fixes
--     dead campaign.state reference; needed for City Pain Scan matching
--     to disambiguate same-name cities across states).
--   - Adds hot-prospect + auto-follow-up columns:
--       is_hot_prospect, hot_prospect_reason, hot_prospect_set_at,
--       hot_prospect_deprioritized, auto_followup_count
--   - Backfills hotness from existing pain_score >= 7 (fallback path).
-- Prerequisite: 138_marketing_ops_outreach_log.sql applied
-- Date: 2026-07-30
-- ============================================================

-- ============================================================
-- STEP 1: state column (was missing — fixes dead campaign.state ref)
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS state VARCHAR(50);

-- ============================================================
-- STEP 2: Hot-prospect + auto-follow-up columns
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS is_hot_prospect            BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hot_prospect_reason       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS hot_prospect_set_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hot_prospect_deprioritized BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_followup_count       INT          NOT NULL DEFAULT 0;

-- Backfill hotness from existing pain_score (fallback path)
UPDATE mkt_campaigns_list
  SET is_hot_prospect = true,
      hot_prospect_reason = 'pain_score >= 7 (backfill)',
      hot_prospect_set_at = NOW()
  WHERE pain_score >= 7 AND is_hot_prospect = false;

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_hot_prospect
  ON mkt_campaigns_list(is_hot_prospect, stage)
  WHERE is_hot_prospect = true AND hot_prospect_deprioritized = false;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- ALTER TABLE mkt_campaigns_list
--   DROP COLUMN IF EXISTS is_hot_prospect,
--   DROP COLUMN IF EXISTS hot_prospect_reason,
--   DROP COLUMN IF EXISTS hot_prospect_set_at,
--   DROP COLUMN IF EXISTS hot_prospect_deprioritized,
--   DROP COLUMN IF EXISTS auto_followup_count,
--   DROP COLUMN IF EXISTS state;
-- DROP INDEX IF EXISTS idx_mkt_campaigns_hot_prospect;
