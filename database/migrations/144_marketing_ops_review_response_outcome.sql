-- ============================================================
-- Migration 144: Marketing Ops — Review Response Follow-Up Outcome Tracking
-- ============================================================
-- Description:
--   Adds an `outcome` column to mkt_review_response_log so that when
--   a scheduled follow-up is completed or skipped, the operator can
--   record WHY — most importantly, whether the customer converted to
--   a paid engagement.
--
--   Outcome values (application-enforced, not a DB enum for flexibility):
--     - 'converted_paid'    — customer became a paid tenant
--     - 'customer_responded' — customer replied, no conversion yet
--     - 'no_response'       — customer never responded after follow-up(s)
--     - 'duplicate'         — duplicate review/thread, no action needed
--     - 'out_of_scope'      — review is out of scope (e.g., different business)
--     - 'other'             — misc reason (use notes for detail)
--
--   When outcome='converted_paid', the service layer can optionally
--   advance the parent campaign's stage to 'paid' or 'tenant_onboarded'.
--
-- Prerequisite: 141_marketing_ops_review_response_pipeline.sql
-- Date: 2026-07-31
-- ============================================================

ALTER TABLE mkt_review_response_log
  ADD COLUMN IF NOT EXISTS outcome VARCHAR(30);

-- Index for reporting: conversion outcomes per pipeline
CREATE INDEX IF NOT EXISTS idx_mkt_review_log_outcome
  ON mkt_review_response_log(pipeline_id, outcome)
  WHERE outcome IS NOT NULL;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- ALTER TABLE mkt_review_response_log DROP COLUMN IF EXISTS outcome;
-- DROP INDEX IF EXISTS idx_mkt_review_log_outcome;
