-- Migration 197: Prospect Queue Intelligence Columns
--
-- Adds intelligence-scope discovery columns to mkt_prospect_queue so
-- discovered businesses from Intelligence Seek runs can carry their
-- discovery context into the queue and onward to Business Seek campaigns.
--
-- Columns:
--   category_fit            — verified / probable / insufficient (§O1)
--   identity_confidence     — high / medium / low (§O1)
--   location_status         — inside_city / adjacent_city / metro_area / outside_market
--   discovery_provenance    — JSONB array of { source, role, evidence_types[] } (§E2)
--   discovery_signals       — JSONB array of INT_* signal codes (§S1)
--   business_seek_priority  — high / medium / low / hold (§O1)
--   intelligence_run_id     — FK to mkt_intelligence_runs (§E1 lineage)
--
-- All nullable so legacy queue entries are unaffected. No RLS, no triggers.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate
--
-- See docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md §4 (Migration 197)

BEGIN;

ALTER TABLE mkt_prospect_queue
  ADD COLUMN IF NOT EXISTS category_fit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS identity_confidence VARCHAR(20),
  ADD COLUMN IF NOT EXISTS location_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS discovery_provenance JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discovery_signals JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS business_seek_priority VARCHAR(20),
  ADD COLUMN IF NOT EXISTS intelligence_run_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_mkt_prospect_queue_intel_run
  ON mkt_prospect_queue (intelligence_run_id)
  WHERE intelligence_run_id IS NOT NULL;

-- Verification query (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'mkt_prospect_queue'
--   AND column_name IN ('category_fit', 'identity_confidence', 'location_status',
--                       'discovery_provenance', 'discovery_signals',
--                       'business_seek_priority', 'intelligence_run_id');

COMMIT;
