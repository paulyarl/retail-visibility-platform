-- Migration 310: Prospect Queue — 'intake' status + 'owner_submission' source kind.
--
-- Public-surface intake (directory suggestions + owner-submitted draft seeds)
-- now lands in mkt_prospect_queue automatically as a DRAFT record instead of
-- only filing a Requests-Hub ticket:
--
--   - 'intake' status — the unvetted staging lane. An intake entry is either
--     dismissed (→ 'dismissed', linked suggestion → 'rejected') or graduated
--     by the operator (→ 'queued' or 'verify_then_outreach') after validation.
--     Intake entries cannot create campaigns — they must graduate first.
--
--   - 'owner_submission' source kind — owner-driven "Add my business" draft
--     seeds (seed_batch='owner-submitted') mirror into the queue so operators
--     have one intake inbox for all public-sourced prospects.
--
-- Idempotent (DROP CONSTRAINT IF EXISTS before ADD).

BEGIN;

ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_status;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_status
  CHECK (status IN (
    'intake', 'queued', 'verify_then_outreach', 'campaign_created',
    'dismissed', 'hold', 'in_thread'
  ));

ALTER TABLE mkt_prospect_queue
  DROP CONSTRAINT IF EXISTS chk_prospect_queue_source_kind;
ALTER TABLE mkt_prospect_queue
  ADD CONSTRAINT chk_prospect_queue_source_kind
  CHECK (source_kind IN (
    'category_analysis', 'city_category_audit', 'scan_unmatched', 'manual',
    'intelligence_seek', 'directory_lead_gen', 'category_identification',
    'public_suggestion', 'gold_standard_candidate', 'owner_submission'
  ));

COMMIT;
