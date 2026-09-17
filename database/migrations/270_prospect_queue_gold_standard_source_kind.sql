-- Migration 270: Prospect Queue — sync source_kind CHECK with the app-layer enum.
--
-- Follow-up to migration 264. 'gold_standard_candidate' was added to the
-- app-layer enum (MarketingProspectQueueService.ProspectSourceKind +
-- prospectQueueAddSchema in marketing-ops.ts) for the discovery-campaign
-- "Queue" action (gold-standard candidates promoted from intelligence
-- profiles), but no migration extended chk_prospect_queue_source_kind.
--
-- Symptom: POST /prospect-queue with source_kind=gold_standard_candidate
-- fails with:
--   ERROR 23514: new row violates check constraint
--   "chk_prospect_queue_source_kind"
--
-- Idempotent (DROP CONSTRAINT IF EXISTS before ADD).

BEGIN;

ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_source_kind;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_source_kind
  CHECK (source_kind IN (
    'category_analysis', 'city_category_audit', 'scan_unmatched', 'manual',
    'intelligence_seek', 'directory_lead_gen', 'category_identification',
    'public_suggestion', 'gold_standard_candidate'
  ));

COMMIT;
