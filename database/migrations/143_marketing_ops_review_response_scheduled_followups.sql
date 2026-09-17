-- ============================================================
-- Migration 143: Marketing Ops — Review Response Scheduled Follow-Ups
-- ============================================================
-- Description:
--   Extends mkt_review_response_log to support predetermined-time
--   follow-up scheduling (e.g., 48h, 1 week) and multiple queued
--   follow-ups per pipeline. A log row can now represent a FUTURE
--   scheduled follow-up (status='scheduled') rather than only a
--   past completed response.
--
--   - Adds `scheduled_for TIMESTAMPTZ` — when the follow-up should fire
--   - Adds `status VARCHAR(20) DEFAULT 'completed'` — 'scheduled' | 'completed' | 'skipped'
--   - Adds index on (pipeline_id, status, scheduled_for) for the
--     scheduler to find due scheduled follow-ups efficiently.
--
--   The pipeline's `next_follow_up_at` rollup becomes
--   MIN(scheduled_for) WHERE status='scheduled' (computed by the
--   service on every log write), replacing the previous
--   `now + cadenceDays` single-value approach.
-- Prerequisite: 141_marketing_ops_review_response_pipeline.sql applied
-- Date: 2026-07-31
-- ============================================================

-- ============================================================
-- STEP 1: Add scheduled_for + status columns to the log
-- ============================================================

ALTER TABLE mkt_review_response_log
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status         VARCHAR(20) NOT NULL DEFAULT 'completed';

-- Index for the scheduler: find scheduled follow-ups due within a window
CREATE INDEX IF NOT EXISTS idx_mkt_review_log_scheduled
  ON mkt_review_response_log(pipeline_id, status, scheduled_for)
  WHERE status = 'scheduled';

-- Index for rollup computation: MIN(scheduled_for) WHERE status='scheduled' per pipeline
CREATE INDEX IF NOT EXISTS idx_mkt_review_log_scheduled_min
  ON mkt_review_response_log(pipeline_id, scheduled_for)
  WHERE status = 'scheduled';

-- ============================================================
-- STEP 2: Backfill — existing log rows are all completed responses
-- ============================================================
-- No backfill needed; the column defaults to 'completed' and
-- scheduled_for is NULL for all pre-existing rows.

-- ============================================================
-- ROLLBACK
-- ============================================================
-- ALTER TABLE mkt_review_response_log
--   DROP COLUMN IF EXISTS scheduled_for,
--   DROP COLUMN IF EXISTS status;
-- DROP INDEX IF EXISTS idx_mkt_review_log_scheduled;
-- DROP INDEX IF EXISTS idx_mkt_review_log_scheduled_min;
