-- ============================================================
-- Migration 148: Marketing Ops — Scorecards Scope & Stage Focus
-- ============================================================
-- Description:
--   Adds scope_focus and stage_focus columns to mkt_scorecards_list
--   so daily scorecard entries can be tagged with the campaign scope
--   (business | category | city) and pipeline stage (seek,
--   preview_built, shown, paid, delivered, retainer_pitched,
--   retainer_won, lost, dead, tenant_onboarded) the operator was
--   working on that day. Previously scorecards were only category or
--   neighborhood focused, which made it impossible to slice operator
--   productivity by scope or stage.
--
--   Nullable: legacy scorecards (created before this migration) keep
--   NULL scope_focus/stage_focus and remain valid. New entries record
--   the scope/stage the operator was focused on so reporting can group
--   productivity by scope and stage alongside category/neighborhood.
--
--   Additive only — no data loss, no backfill needed.
-- Prerequisite: 147_marketing_ops_outreach_followups.sql applied
-- Date: 2026-08-01
-- ============================================================

ALTER TABLE mkt_scorecards_list
  ADD COLUMN IF NOT EXISTS scope_focus VARCHAR(20),
  ADD COLUMN IF NOT EXISTS stage_focus VARCHAR(50);

-- Index supports per-scope reporting and filtering.
CREATE INDEX IF NOT EXISTS idx_mkt_scorecards_scope
  ON mkt_scorecards_list(scope_focus);

-- Index supports per-stage reporting and filtering.
CREATE INDEX IF NOT EXISTS idx_mkt_scorecards_stage
  ON mkt_scorecards_list(stage_focus);

-- ============================================================
-- VERIFICATION (run manually after applying)
-- ============================================================
-- \d mkt_scorecards_list
--   -- confirm scope_focus (varchar 20, nullable) and stage_focus
--   -- (varchar 50, nullable) columns are present
--
-- SELECT scope_focus, stage_focus, COUNT(*) AS entries
--   FROM mkt_scorecards_list
--   GROUP BY scope_focus, stage_focus
--   ORDER BY entries DESC;
--   -- expect NULL cohort (legacy) + tagged scope/stage combos once
--   -- new scorecards are recorded with scope/stage focus
--
-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP INDEX IF EXISTS idx_mkt_scorecards_stage;
-- DROP INDEX IF EXISTS idx_mkt_scorecards_scope;
-- ALTER TABLE mkt_scorecards_list DROP COLUMN IF EXISTS stage_focus;
-- ALTER TABLE mkt_scorecards_list DROP COLUMN IF EXISTS scope_focus;
