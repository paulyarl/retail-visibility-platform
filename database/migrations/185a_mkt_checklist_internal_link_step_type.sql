-- Migration 185a: Add 'internal_link' to checklist step_type check constraint
--
-- Adds a new step type 'internal_link' to the allowed values on
-- mkt_playbook_checklist_steps.step_type. Internal-link steps deep-link to
-- an internal app page/tab (e.g. Openers workspace, Deliverables tab,
-- Diagnostic Gallery) via a named target registry resolved at render time
-- with the current campaign ID. This complements 'url_check' which only
-- opens external URLs.
--
-- See docs/LocalBiz/marketing_ops_outreach_checklist_bridge_sprint_plan.md §4.0
--
-- Data-only DDL: drops + re-adds the check constraint with the new value.
-- No prisma db pull required (step_type is already VARCHAR(30) in schema).
--
-- Date: 2026-08-09

ALTER TABLE mkt_playbook_checklist_steps
  DROP CONSTRAINT IF EXISTS chk_checklist_step_type;

ALTER TABLE mkt_playbook_checklist_steps
  ADD CONSTRAINT chk_checklist_step_type
  CHECK (step_type IN (
    'manual', 'url_check', 'internal_link', 'ai_prompt',
    'deliverable', 'outreach', 'credentials'
  ));
