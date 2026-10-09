-- 318_mkt_pb08_claim_invite_step.sql
--
-- Adds a directory claim-invitation step to the PB-08 (Website Acquisition &
-- Build) starter checklist, ahead of the care-plan pitch. The claim invitation
-- is always part of outreach; the website invitation leads when the signals are
-- strong, and both travel together with the positioning preview.
--
-- Data-only. Renumbers the existing pitch step (pbcs-pb08-007) from 7 to 8 so the
-- new step sits at 7. Guarded so a re-run does not renumber twice and does not
-- duplicate the new step.
--
-- Prerequisites: migration 303 (PB-08 playbook and its checklist steps).
-- Apply manually via the Supabase SQL Editor, staging then production, using
-- plain Run (see manual-sql-migration-policy).

BEGIN;

UPDATE mkt_playbook_checklist_steps s
SET step_order = 8,
    updated_at = NOW()
FROM mkt_playbook_catalog p
WHERE s.playbook_id = p.id
  AND p.code = 'PB-08'
  AND s.id = 'pbcs-pb08-007'
  AND s.step_order = 7;

INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, created_at, updated_at)
SELECT 'pbcs-pb08-009', p.id, 7,
       'Send the directory claim invitation with the positioning preview',
       'Send the owner the directory claim invitation for the listing, together with the web-presence report and homepage mockup. The listing is already public, so the claim lets the owner correct details. When the signals are strong, lead with the website invitation and keep the claim invitation alongside it. Record the channel used on the campaign.',
       'manual', '{}'::jsonb, true, true, NOW(), NOW()
FROM mkt_playbook_catalog p
WHERE p.code = 'PB-08'
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verification (run after applying, staging and production):
-- SELECT s.id, s.step_order, s.title
--   FROM mkt_playbook_checklist_steps s
--   JOIN mkt_playbook_catalog p ON p.id = s.playbook_id
--  WHERE p.code = 'PB-08'
--  ORDER BY s.step_order;
--   Expect 8 steps. Step 7 is the claim invitation; step 8 is the care-plan pitch.
