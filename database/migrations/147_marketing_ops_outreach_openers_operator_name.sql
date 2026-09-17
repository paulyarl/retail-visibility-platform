-- ============================================================
-- Migration 147: Marketing Ops — Outreach Openers Operator Name
-- ============================================================
-- Description:
--   Adds an operator_name column to mkt_outreach_openers_list so the
--   campaign can later see which operator handled its opener. The opener
--   anatomy ends with the signoff "— [your name]"; the workspace now
--   accepts an operator name (prefilled from the active
--   MarketingBrandingConfig) and substitutes it into the resolved prompt
--   and persisted opener text at generate/import time.
--
--   Nullable: legacy openers (generated before this column existed)
--   remain NULL. New openers record the operator name used so the
--   campaign has provenance of who handled the opener.
--
--   Additive only — no data loss, no backfill needed.
-- Prerequisite: 146_marketing_ops_outreach_openers_close_variant.sql applied
-- Date: 2026-07-31
-- ============================================================

ALTER TABLE mkt_outreach_openers_list
  ADD COLUMN IF NOT EXISTS operator_name VARCHAR(120);

-- Index supports per-operator reporting (who handled which openers).
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_openers_operator_name
  ON mkt_outreach_openers_list(operator_name);

-- ============================================================
-- VERIFICATION (run manually after applying)
-- ============================================================
-- \d mkt_outreach_openers_list
--   -- confirm operator_name column is present, type varchar, nullable
--
-- SELECT operator_name, COUNT(*) AS opener_count
--   FROM mkt_outreach_openers_list
--   GROUP BY operator_name
--   ORDER BY opener_count DESC;
--   -- expect NULL cohort (legacy) + named operators once openers are
--   -- generated with the operator-name substitution enabled
--
-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP INDEX IF EXISTS idx_mkt_outreach_openers_operator_name;
-- ALTER TABLE mkt_outreach_openers_list DROP COLUMN IF EXISTS operator_name;
