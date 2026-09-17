-- Migration 196: Prompt Template Fragment Support
--
-- Adds a fragment_kind column to mkt_prompt_templates_list for runtime
-- prompt composition (Option A — GAP-P1).
--
-- Fragments are templates with prompt_type = 'fragment' and a fragment_kind
-- that identifies their role in the composition assembly:
--   - seek_category_base              — canonical Category Seek framework
--   - seek_intelligence_extension     — Intelligence amplification extension
--   - seek_intelligence_focus_emerging    — emerging focus modifier
--   - seek_intelligence_focus_competitive — competitive focus modifier
--
-- Fragments are composition inputs, not directly executable. The composer
-- service assembles body = base + extension + rendered-profile-block + focus,
-- then runs existing variable substitution on the assembled string.
--
-- Nullable so legacy templates are unaffected. No RLS, no triggers.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate
--
-- See docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md §4 (Migration 196)

BEGIN;

ALTER TABLE mkt_prompt_templates_list
  ADD COLUMN IF NOT EXISTS fragment_kind VARCHAR(60);

CREATE INDEX IF NOT EXISTS idx_mkt_prompt_templates_fragment_kind
  ON mkt_prompt_templates_list (fragment_kind)
  WHERE fragment_kind IS NOT NULL;

-- Verification query (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'mkt_prompt_templates_list' AND column_name = 'fragment_kind';

COMMIT;
