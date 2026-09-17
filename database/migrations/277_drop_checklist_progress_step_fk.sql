-- Migration 277: Drop fk_checklist_progress_step foreign key
--
-- The mkt_campaign_checklist_progress.step_id column carried a foreign key
-- to mkt_playbook_checklist_steps(id). This blocked check-offs of the
-- code-defined "permanent" checklist steps (IDs prefixed with
-- '_permanent_') because those steps are intentionally NOT stored in
-- mkt_playbook_checklist_steps — they are defined in code
-- (PERMANENT_SEED_STEPS / PERMANENT_STEPS in PlaybookChecklistService.ts)
-- and injected into the campaign checklist view at render time.
--
-- PlaybookChecklistService.setStepProgress already has a dedicated branch
-- for permanent steps (isPermanentStepId) that bypasses playbook
-- validation, and a separate branch for DB steps that validates the step
-- belongs to the campaign's current effective playbook (stale_step guard).
-- The app-level validation is the real integrity gate; the DB FK is
-- redundant for DB steps and actively breaks the intended permanent-step
-- toggle.
--
-- Dropping this FK:
--   * Lets permanent step progress rows persist (step_id = '_permanent_*').
--   * Removes no app-level protection — setStepProgress validates DB steps
--     against the effective playbook before upserting.
--   * Loses ON DELETE CASCADE for step deletes. deleteStep() already
--     blocks deletion when completed progress exists, and incomplete
--     progress rows (completed_at NULL) are harmless orphans.
--
-- After running: cd apps/api && npx prisma db pull && npx prisma generate
-- (schema.prisma is updated in the same commit to stay in sync).
--
-- Date: 2026-09-11

ALTER TABLE mkt_campaign_checklist_progress
  DROP CONSTRAINT IF EXISTS fk_checklist_progress_step;

-- Verification (run manually after applying):
-- SELECT conname FROM pg_constraint WHERE conrelid = 'mkt_campaign_checklist_progress'::regclass;
--   -- expect: fk_checklist_progress_campaign, uq_checklist_progress_campaign_step
--   -- must NOT contain: fk_checklist_progress_step
