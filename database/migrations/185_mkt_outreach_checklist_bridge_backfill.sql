-- Migration 185: Outreach Checklist Bridge Backfill
--
-- Enriches the existing outreach starter steps (from migration 174) with
-- `outreach_kind` + `auto_complete` in action_config so the checklist bridge
-- service can detect artifacts and auto-complete steps. Also adds two new
-- starter steps (opener + follow-up) to the review-pipeline playbooks that
-- are missing them.
--
-- See docs/LocalBiz/marketing_ops_outreach_checklist_bridge_sprint_plan.md §4 + §8
--
-- Data-only migration. No schema changes, no prisma db pull required.
--
-- Conventions:
--   * action_config is JSONB — we merge the new keys into the existing
--     object rather than replacing it (preserves any admin-added keys).
--   * Idempotent: uses WHERE conditions that are no-ops on re-run.
--   * New steps use deterministic IDs (pbcs-pbNN-NNN) so re-runs are safe.
--
-- Date: 2026-08-09

-- ─── Part 1: Backfill outreach_kind on existing outreach steps ───────────
--
-- Mapping (from plan §8):
--   pbcs-pb01-007 → contact_log, auto_complete=true
--   pbcs-pb02-004 → contact_log, auto_complete=true
--   pbcs-pb02-006 → contact_log, auto_complete=false
--   pbcs-pb03-006 → pitch, auto_complete=false
--   pbcs-pb04-002 → contact_log, auto_complete=true
--   pbcs-pb04-006 → pitch, auto_complete=false
--   pbcs-pb05-006 → pitch, auto_complete=false
--   pbcs-pb06-002 → contact_log, auto_complete=true
--   pbcs-pb06-006 → pitch, auto_complete=false
--   pbcs-pb07-002 → contact_log, auto_complete=true
--   pbcs-pb07-007 → pitch, auto_complete=false

UPDATE mkt_playbook_checklist_steps
  SET action_config = action_config::jsonb || '{"outreach_kind":"contact_log","auto_complete":true}'::jsonb,
      updated_at = NOW()
  WHERE id = 'pbcs-pb01-007'
    AND (action_config->>'outreach_kind') IS NULL;

UPDATE mkt_playbook_checklist_steps
  SET action_config = action_config::jsonb || '{"outreach_kind":"contact_log","auto_complete":true}'::jsonb,
      updated_at = NOW()
  WHERE id = 'pbcs-pb02-004'
    AND (action_config->>'outreach_kind') IS NULL;

UPDATE mkt_playbook_checklist_steps
  SET action_config = action_config::jsonb || '{"outreach_kind":"contact_log","auto_complete":false}'::jsonb,
      updated_at = NOW()
  WHERE id = 'pbcs-pb02-006'
    AND (action_config->>'outreach_kind') IS NULL;

UPDATE mkt_playbook_checklist_steps
  SET action_config = action_config::jsonb || '{"outreach_kind":"pitch","auto_complete":false}'::jsonb,
      updated_at = NOW()
  WHERE id = 'pbcs-pb03-006'
    AND (action_config->>'outreach_kind') IS NULL;

UPDATE mkt_playbook_checklist_steps
  SET action_config = action_config::jsonb || '{"outreach_kind":"contact_log","auto_complete":true}'::jsonb,
      updated_at = NOW()
  WHERE id = 'pbcs-pb04-002'
    AND (action_config->>'outreach_kind') IS NULL;

UPDATE mkt_playbook_checklist_steps
  SET action_config = action_config::jsonb || '{"outreach_kind":"pitch","auto_complete":false}'::jsonb,
      updated_at = NOW()
  WHERE id = 'pbcs-pb04-006'
    AND (action_config->>'outreach_kind') IS NULL;

UPDATE mkt_playbook_checklist_steps
  SET action_config = action_config::jsonb || '{"outreach_kind":"pitch","auto_complete":false}'::jsonb,
      updated_at = NOW()
  WHERE id = 'pbcs-pb05-006'
    AND (action_config->>'outreach_kind') IS NULL;

UPDATE mkt_playbook_checklist_steps
  SET action_config = action_config::jsonb || '{"outreach_kind":"contact_log","auto_complete":true}'::jsonb,
      updated_at = NOW()
  WHERE id = 'pbcs-pb06-002'
    AND (action_config->>'outreach_kind') IS NULL;

UPDATE mkt_playbook_checklist_steps
  SET action_config = action_config::jsonb || '{"outreach_kind":"pitch","auto_complete":false}'::jsonb,
      updated_at = NOW()
  WHERE id = 'pbcs-pb06-006'
    AND (action_config->>'outreach_kind') IS NULL;

UPDATE mkt_playbook_checklist_steps
  SET action_config = action_config::jsonb || '{"outreach_kind":"contact_log","auto_complete":true}'::jsonb,
      updated_at = NOW()
  WHERE id = 'pbcs-pb07-002'
    AND (action_config->>'outreach_kind') IS NULL;

UPDATE mkt_playbook_checklist_steps
  SET action_config = action_config::jsonb || '{"outreach_kind":"pitch","auto_complete":false}'::jsonb,
      updated_at = NOW()
  WHERE id = 'pbcs-pb07-007'
    AND (action_config->>'outreach_kind') IS NULL;

-- ─── Part 2: Add internal_link steps for key workflow destinations ───────
--
-- Add internal_link steps that deep-link operators to the right workspace
-- at the right stage. These are non-required (advisory) — they guide the
-- operator to the right place rather than gating transitions.

-- PB-02: Link to Openers workspace at the 'shown' stage
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT 'pbcs-pb02-000', p.id, 0, 'Open the Outreach Workspace',
  'Generate and send the personalized opener to the business owner. The Outreach Workspace assembles the full pitch (opener + header + preview + closer + contact) from the campaign audit data.',
  'internal_link', '{"target":"openers_workspace","params":{"tab":"pitch"}}'::jsonb, false, true, 'shown', NOW(), NOW()
FROM mkt_playbook_catalog p
WHERE p.code = 'PB-02'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.id = 'pbcs-pb02-000')
ON CONFLICT (id) DO NOTHING;

-- PB-04: Link to Openers workspace at the 'shown' stage
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT 'pbcs-pb04-000', p.id, 0, 'Open the Outreach Workspace',
  'Generate and send the personalized opener to the business owner. The Outreach Workspace assembles the full pitch (opener + header + preview + closer + contact) from the campaign audit data.',
  'internal_link', '{"target":"openers_workspace","params":{"tab":"pitch"}}'::jsonb, false, true, 'shown', NOW(), NOW()
FROM mkt_playbook_catalog p
WHERE p.code = 'PB-04'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.id = 'pbcs-pb04-000')
ON CONFLICT (id) DO NOTHING;

-- PB-05: Link to Openers workspace at the 'shown' stage
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT 'pbcs-pb05-000', p.id, 0, 'Open the Outreach Workspace',
  'Generate and send the personalized opener to the business owner. The Outreach Workspace assembles the full pitch (opener + header + preview + closer + contact) from the campaign audit data.',
  'internal_link', '{"target":"openers_workspace","params":{"tab":"pitch"}}'::jsonb, false, true, 'shown', NOW(), NOW()
FROM mkt_playbook_catalog p
WHERE p.code = 'PB-05'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.id = 'pbcs-pb05-000')
ON CONFLICT (id) DO NOTHING;

-- PB-01: Link to Deliverables at the 'paid' stage
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT 'pbcs-pb01-008', p.id, 8, 'Open Deliverable Construction',
  'Once the campaign is paid, open the Deliverable Construction workspace to build the profile alignment summary deliverable.',
  'internal_link', '{"target":"deliverables"}'::jsonb, false, true, 'paid', NOW(), NOW()
FROM mkt_playbook_catalog p
WHERE p.code = 'PB-01'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.id = 'pbcs-pb01-008')
ON CONFLICT (id) DO NOTHING;

-- PB-02: Link to Deliverables at the 'paid' stage
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT 'pbcs-pb02-007', p.id, 7, 'Open Deliverable Construction',
  'Once the campaign is paid, open the Deliverable Construction workspace to build the Review Acceleration & Response Pack deliverable.',
  'internal_link', '{"target":"deliverables"}'::jsonb, false, true, 'paid', NOW(), NOW()
FROM mkt_playbook_catalog p
WHERE p.code = 'PB-02'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.id = 'pbcs-pb02-007')
ON CONFLICT (id) DO NOTHING;

-- PB-03: Link to Deliverables at the 'paid' stage
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT 'pbcs-pb03-007', p.id, 7, 'Open Deliverable Construction',
  'Once the campaign is paid, open the Deliverable Construction workspace to build the Website & Surface Conversion Fix deliverable.',
  'internal_link', '{"target":"deliverables"}'::jsonb, false, true, 'paid', NOW(), NOW()
FROM mkt_playbook_catalog p
WHERE p.code = 'PB-03'
  AND NOT EXISTS (SELECT 1 FROM mkt_playbook_checklist_steps s WHERE s.id = 'pbcs-pb03-007')
ON CONFLICT (id) DO NOTHING;

-- ─── Verification (run manually after applying) ──────────────────────────
--
-- Confirm outreach_kind backfill:
--   SELECT id, step_type, action_config->>'outreach_kind' AS kind,
--          action_config->>'auto_complete' AS auto
--   FROM mkt_playbook_checklist_steps
--   WHERE step_type = 'outreach' ORDER BY id;
--
-- Confirm internal_link steps:
--   SELECT id, title, action_config->>'target' AS target, stage_tag
--   FROM mkt_playbook_checklist_steps
--   WHERE step_type = 'internal_link' ORDER BY id;
