-- Migration 194: Prompt Execution Provenance Snapshot
--
-- Snapshots template version + body hash (+ optional full body) onto
-- mkt_prompt_executions_list at execution/import time so historical runs
-- can be attributed to the prompt text that produced them.
--
-- This is a pre-existing defect the Intelligence spec (§42) exposes: today,
-- updating a template mutates the row in place and executions store only
-- template_id — so historical executions cannot be faithfully attributed to
-- the prompt text that produced them. This fix benefits ALL scopes, not just
-- intelligence.
--
-- All columns are nullable so legacy executions are unaffected.
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate
--
-- See docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md §4 (Migration 194)

BEGIN;

ALTER TABLE mkt_prompt_executions_list
  ADD COLUMN IF NOT EXISTS template_version INT,
  ADD COLUMN IF NOT EXISTS template_body_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS template_body_snapshot TEXT;

-- Verification query (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'mkt_prompt_executions_list'
--   AND column_name IN ('template_version', 'template_body_hash', 'template_body_snapshot');

COMMIT;
