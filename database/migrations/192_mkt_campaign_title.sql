-- Migration 192: Campaign + Prospect Queue Title (scope-neutral descriptive label)
--
-- Adds an optional `title` column to mkt_campaigns_list and mkt_prospect_queue
-- so operators can attach a freeform, scope-neutral descriptive title to a
-- campaign or queue entry — independent of the business_name / category / city
-- identity fields.
--
-- The title is meant to capture the campaign objective, goal, or any freeform
-- context (e.g. "Q3 Austin restaurant review-gap test", "Category scan pilot —
-- plumbers in Dallas"). When present it is shown as the primary heading in the
-- campaign list / detail header; the underlying business_name / category / city
-- remain as-is and continue to render in the secondary subtitle line.
--
-- Nullable so legacy rows are unaffected (they fall back to the existing
-- business_name ?? category ?? city derived name). No RLS, no triggers —
-- matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS title VARCHAR(255);

ALTER TABLE mkt_prospect_queue
  ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- Verification queries (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mkt_campaigns_list' AND column_name = 'title';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mkt_prospect_queue' AND column_name = 'title';

COMMIT;
