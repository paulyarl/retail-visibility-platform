-- ============================================================
-- Migration 189: Marketing Ops — Outreach Openers Hook Angle
-- ============================================================
-- Description:
--   Adds a hook_angle column to mkt_outreach_openers_list to support
--   hook-angle attribution. When an opener is imported from the
--   HookSuggestionService catalog (the "Use this hook" flow in the
--   pitch construction panel), the selected angle key is persisted so
--   getSplitTestStats() can rank which angles convert.
--
--   Nullable: legacy openers and AI-generated openers (executeOpener)
--   remain NULL — only importOpener with an explicit hookAngle sets
--   the value. Unknown angles are rejected at the route layer (Zod
--   validates against HOOK_LIBRARY keys).
--
--   Additive only — no data loss, no backfill needed.
-- Prerequisite: 142_marketing_ops_outreach_openers.sql applied
-- Date: 2026-08-11
-- ============================================================

ALTER TABLE mkt_outreach_openers_list
  ADD COLUMN IF NOT EXISTS hook_angle VARCHAR(40);

-- Partial index: only rows with a hook_angle benefit from the index.
-- Supports the byHookAngle grouping in getSplitTestStats().
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_openers_hook_angle
  ON mkt_outreach_openers_list(hook_angle)
  WHERE hook_angle IS NOT NULL;

-- ============================================================
-- VERIFICATION (run manually after applying)
-- ============================================================
-- \d mkt_outreach_openers_list
--   -- confirm hook_angle column is present, type varchar(40), nullable
--
-- SELECT hook_angle, COUNT(*) AS opener_count
--   FROM mkt_outreach_openers_list
--   WHERE hook_angle IS NOT NULL
--   GROUP BY hook_angle
--   ORDER BY opener_count DESC;
--   -- expect 0 rows until hooks are imported via the picker
--
-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP INDEX IF EXISTS idx_mkt_outreach_openers_hook_angle;
-- ALTER TABLE mkt_outreach_openers_list DROP COLUMN IF EXISTS hook_angle;
