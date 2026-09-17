-- ============================================================
-- Migration 140: Marketing Ops — Sync Report Persistence
-- ============================================================
-- Description:
--   Stores the latest City Pain Scan sync report on the execution
--   record so the UI can retrieve it without re-running the sync.
--   The report includes matched/unmatched/skippedChains/hotProspectsMarked
--   arrays + a syncedAt timestamp.
-- Prerequisite: 139_marketing_ops_hot_prospect.sql applied
-- Date: 2026-07-30
-- ============================================================

ALTER TABLE mkt_prompt_executions_list
  ADD COLUMN IF NOT EXISTS sync_report JSONB;

-- Index for fast lookup by campaign_id (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_mkt_executions_sync_report
  ON mkt_prompt_executions_list(campaign_id)
  WHERE sync_report IS NOT NULL;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- ALTER TABLE mkt_prompt_executions_list
--   DROP COLUMN IF EXISTS sync_report;
-- DROP INDEX IF EXISTS idx_mkt_executions_sync_report;
