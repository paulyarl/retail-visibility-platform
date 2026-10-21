-- 349a_checklist_stage_tag_seed.sql
--
-- Adds 'seed' to chk_checklist_step_stage_tag on mkt_playbook_checklist_steps.
--
-- The seed pipeline stage was inserted into STAGE_PIPELINE_ORDER
-- (seek -> seed -> preview_built) when the seed-first wedge shipped, and the
-- app layer already accepts 'seed' as a stage tag everywhere:
--   * checklistStageTagEnum (apps/api/src/routes/marketing-ops.ts)
--   * CHECKLIST_STAGE_TAGS / ChecklistStageTag (MarketingOpsService.ts)
--   * stageTag: 'seed' on the code-defined PERMANENT_SEED_STEPS
--     (PlaybookChecklistService.ts)
-- but the DB CHECK constraint (migration 175) was never updated, so no
-- DB-backed step could be tagged 'seed'. The PB-08/PB-09 playbooks (migrations
-- 303, 318, 334) shipped with every step untagged as a result — and
-- stage_tag NULL means "always gates transitions", so PB-08/PB-09 required
-- steps gate even the seek -> seed transition they have nothing to do with.
--
-- 'seed' sorts between 'seek' and 'preview_built' in STAGE_PIPELINE_ORDER, so
-- seed-tagged required steps gate the seed -> preview_built transition only:
-- entering seed signifies seed presence, not completed engagement work.
--
-- DDL only. Apply BEFORE 349_pb08_pb09_checklist_stage_tags.sql (letter-suffix
-- convention — constraint must admit 'seed' before the retag writes it).
-- Apply manually via the Supabase SQL Editor, staging then production, using
-- plain Run (see manual-sql-migration-policy).

BEGIN;

ALTER TABLE mkt_playbook_checklist_steps
  DROP CONSTRAINT IF EXISTS chk_checklist_step_stage_tag;

ALTER TABLE mkt_playbook_checklist_steps
  ADD CONSTRAINT chk_checklist_step_stage_tag
  CHECK (stage_tag IS NULL OR stage_tag IN (
    'seek', 'seed', 'preview_built', 'shown', 'paid', 'delivered',
    'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded'
  ));

COMMIT;

-- Verification (run after applying, staging and production):
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'chk_checklist_step_stage_tag';
--   Expect 'seed' in the value list, between 'seek' and 'preview_built'.
