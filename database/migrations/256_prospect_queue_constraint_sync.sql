-- Migration 256: Prospect Queue — sync CHECK constraints with app-layer enums.
--
-- The original constraints (migration 160) predate:
--   - intelligence_seek source_kind + intelligence/business source_scope
--     (migration 197 added the columns but never relaxed the constraints)
--   - verify_then_outreach status (migration 255 added the column + status
--     value but never relaxed the status constraint)
--
-- Symptom: POST /prospect-queue with source_kind=intelligence_seek or
-- initial_status=verify_then_outreach fails with:
--   ERROR 23514: new row violates check constraint
--   "chk_prospect_queue_source_kind" / "chk_prospect_queue_status"
--
-- This migration drops + re-adds the three affected constraints with the
-- full enum set the application already accepts (see
-- MarketingProspectQueueService.ts + marketing-ops.ts route schema).
--
-- Idempotent (DROP CONSTRAINT IF EXISTS before each ADD).

BEGIN;

-- status: queued | verify_then_outreach | campaign_created | dismissed
ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_status;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_status
  CHECK (status IN ('queued', 'verify_then_outreach', 'campaign_created', 'dismissed'));

-- source_kind: + intelligence_seek
ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_source_kind;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_source_kind
  CHECK (source_kind IN ('category_analysis', 'city_category_audit', 'scan_unmatched', 'manual', 'intelligence_seek'));

-- source_scope: + business + intelligence (business-scope + intelligence-scope
-- campaigns now flow through the queue)
ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_source_scope;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_source_scope
  CHECK (source_scope IS NULL OR source_scope IN ('category', 'city', 'business', 'intelligence'));

COMMIT;
