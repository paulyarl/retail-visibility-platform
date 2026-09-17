-- Migration 264: Prospect Queue — sync source_kind CHECK with the app-layer enum.
--
-- Migration 256's CHECK predates several source kinds the codebase already
-- accepts (MarketingProspectQueueService.ProspectSourceKind + route schema):
--   - 'category_identification' — Category Identification act endpoint
--     (marketing-ops.ts) writes it via the route enum
--   - 'directory_lead_gen' — public "Get listed" CTA
--     (directory-enrichment-public.ts) writes it via `as any`
--   - 'public_suggestion' — NEW: public directory suggestions pushed to the
--     prospect queue / verify-then-outreach (suggestions queue actions)
--
-- Without this, inserts carrying those kinds violate
-- chk_prospect_queue_source_kind.
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
    'public_suggestion'
  ));

COMMIT;
