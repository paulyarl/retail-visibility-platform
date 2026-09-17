-- Migration 175: Checklist Step Stage Tags + Full-Funnel Step Coverage
--
-- 1. Adds stage_tag to mkt_playbook_checklist_steps so every step is tagged
--    with the campaign stage it belongs to (seek, preview_built, shown, paid,
--    delivered, retainer_pitched, retainer_won, lost, dead, tenant_onboarded).
--    The checklist remains visible at every stage; the tag makes clear what
--    each stage expects from the playbook.
-- 2. Retags the 44 starter steps from migration 174 (fulfillment work ->
--    'paid', client summary / retainer pitch prep -> 'delivered') and shifts
--    their step_order +3 to make room for pre-sale steps.
-- 3. Inserts 7 new steps per playbook (pbcs-pbNN-101..107) so every pipeline
--    stage has at least one step:
--      seek             - review triage signals and scope the engagement (required)
--      preview_built    - build preview deliverable + approach kit (required)
--      shown            - present preview, log engagement, follow-ups (required)
--      retainer_pitched - follow up on the retainer pitch (optional)
--      retainer_won     - kick off the retainer cadence (optional)
--      lost             - close the book with a future angle (optional)
--      dead             - close the book with a cooldown note (optional)
--
-- Companion code changes (same release):
--   * PlaybookChecklistService exposes stageTag and the transition soft gate
--     becomes stage-aware: only steps tagged at or before the campaign's
--     CURRENT stage gate the transition (untagged steps always gate, matching
--     legacy behavior; unknown stages e.g. recovery-track gate everything).
--
-- Conventions:
--   * stage_tag is nullable. NULL = untagged (shown without a stage badge and
--     always gates transitions). App-layer create/update validate the value.
--   * Backfill guarded by stage_tag IS NULL so re-runs never double-shift
--     step_order. New inserts use ON CONFLICT (id) DO NOTHING.
--   * No NOT EXISTS guard on inserts this time: these steps are ADDED to the
--     existing checklists by design.
--   * ASCII-only, no semicolons outside statement terminators.
--
-- After running: cd apps/api && npx prisma db pull && npx prisma generate.
-- Date: 2026-08-06

-- --- 1. Column + constraint ---

ALTER TABLE mkt_playbook_checklist_steps
  ADD COLUMN IF NOT EXISTS stage_tag VARCHAR(30);

ALTER TABLE mkt_playbook_checklist_steps
  DROP CONSTRAINT IF EXISTS chk_checklist_step_stage_tag;

ALTER TABLE mkt_playbook_checklist_steps
  ADD CONSTRAINT chk_checklist_step_stage_tag
  CHECK (stage_tag IS NULL OR stage_tag IN (
    'seek', 'preview_built', 'shown', 'paid', 'delivered',
    'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded'
  ));

COMMENT ON COLUMN mkt_playbook_checklist_steps.stage_tag IS 'Campaign stage this step belongs to (review-track pipeline stages). NULL = untagged, always gates transitions. Stage-aware soft gate: only steps tagged at or before the campaign current stage gate the transition';

-- --- 2. Retag + shift migration 174 starter steps (idempotent via stage_tag IS NULL) ---

-- Fulfillment work -> paid (prepare and deliver the paid deliverables)
UPDATE mkt_playbook_checklist_steps
SET step_order = step_order + 3, stage_tag = 'paid', updated_at = NOW()
WHERE stage_tag IS NULL AND id IN (
  'pbcs-pb01-001','pbcs-pb01-002','pbcs-pb01-003','pbcs-pb01-004','pbcs-pb01-005','pbcs-pb01-006',
  'pbcs-pb02-001','pbcs-pb02-002','pbcs-pb02-003','pbcs-pb02-004','pbcs-pb02-005',
  'pbcs-pb03-001','pbcs-pb03-002','pbcs-pb03-003','pbcs-pb03-004','pbcs-pb03-005',
  'pbcs-pb04-001','pbcs-pb04-002','pbcs-pb04-003','pbcs-pb04-004','pbcs-pb04-005',
  'pbcs-pb05-001','pbcs-pb05-002','pbcs-pb05-003','pbcs-pb05-004','pbcs-pb05-005',
  'pbcs-pb06-001','pbcs-pb06-002','pbcs-pb06-003','pbcs-pb06-004','pbcs-pb06-005',
  'pbcs-pb07-001','pbcs-pb07-002','pbcs-pb07-003','pbcs-pb07-004','pbcs-pb07-005','pbcs-pb07-006'
);

-- Client summary / retainer pitch preparation -> delivered
UPDATE mkt_playbook_checklist_steps
SET step_order = step_order + 3, stage_tag = 'delivered', updated_at = NOW()
WHERE stage_tag IS NULL AND id IN (
  'pbcs-pb01-007','pbcs-pb02-006','pbcs-pb03-006','pbcs-pb04-006',
  'pbcs-pb05-006','pbcs-pb06-006','pbcs-pb07-007'
);

-- --- 3. New steps: pre-sale (seek / preview_built / shown) + post-sale tail ---

-- PB-01 Profile Repair & Listing Drift (14 steps total)
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, v.stage_tag, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb01-101', 1, 'Review triage signals and scope the engagement', 'Read the triage rationale and triggered signals (NAP name/address/phone drift, URL mismatch, outdated hours, claimed status). Confirm PB-01 is the right playbook, list the specific drifts to fix, and frame the Citation & Profile Alignment Package pitch around them.', 'manual', '{}', true, 'seek'),
  ('pbcs-pb01-102', 2, 'Build the preview deliverable and approach kit', 'Generate the preview deliverable for this campaign and assemble the approach materials before any outreach: screenshots of each drift finding, the opener draft, and follow-up message drafts.', 'deliverable', '{}', true, 'preview_built'),
  ('pbcs-pb01-103', 3, 'Present the preview and log the engagement', 'Present the preview to the decision maker on the campaign channel, log the outreach, and record the outcome. If no decision, schedule the next follow-up touch before leaving this stage.', 'outreach', '{}', true, 'shown'),
  ('pbcs-pb01-104', 11, 'Follow up on the retainer pitch', 'Follow up on the Listing Synchronization & Search Defense pitch: answer objections, share a one-page summary of what the monthly retainer covers, and re-ask if the objection was timing rather than value.', 'outreach', '{"channel":"email"}', false, 'retainer_pitched'),
  ('pbcs-pb01-105', 12, 'Kick off the retainer cadence', 'Set up the recurring listing-synchronization cadence: first-month task schedule, monthly drift-check date, reporting touchpoint, and confirm billing is active.', 'manual', '{}', false, 'retainer_won'),
  ('pbcs-pb01-106', 13, 'Close the book with a future angle', 'Record why the deal was lost (price, timing, no trust, went silent) in the notes, thank the contact, and set a re-engagement reminder. Lost today is not lost forever.', 'manual', '{}', false, 'lost'),
  ('pbcs-pb01-107', 14, 'Close the book with a cooldown note', 'Record what was tried and why the campaign went dead. Note a cooldown date for possible resurrection - dead campaigns can re-enter the pipeline after a cooldown.', 'manual', '{}', false, 'dead')
) AS v(id, step_order, title, instructions, step_type, action_config, is_required, stage_tag)
WHERE p.code = 'PB-01'
ON CONFLICT (id) DO NOTHING;

-- PB-02 Review Gap & Stagnation (13 steps total)
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, v.stage_tag, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb02-101', 1, 'Review triage signals and scope the engagement', 'Read the triage rationale and triggered signals (review drought, low review volume, unaddressed positive backlog). Confirm PB-02 is the right playbook and frame the Review Acceleration & Response Pack pitch around the numbers.', 'manual', '{}', true, 'seek'),
  ('pbcs-pb02-102', 2, 'Build the preview deliverable and approach kit', 'Generate the preview deliverable and assemble the approach materials before any outreach: review-count and last-review-date screenshots, the opener draft, and follow-up message drafts.', 'deliverable', '{}', true, 'preview_built'),
  ('pbcs-pb02-103', 3, 'Present the preview and log the engagement', 'Present the preview to the decision maker on the campaign channel, log the outreach, and record the outcome. If no decision, schedule the next follow-up touch before leaving this stage.', 'outreach', '{}', true, 'shown'),
  ('pbcs-pb02-104', 10, 'Follow up on the retainer pitch', 'Follow up on the Automated Review Acquisition Engine pitch: answer objections, share early review-velocity results from the FITD work as proof, and re-ask if the objection was timing rather than value.', 'outreach', '{"channel":"email"}', false, 'retainer_pitched'),
  ('pbcs-pb02-105', 11, 'Kick off the retainer cadence', 'Set up the review-acquisition cadence: monthly request batches, response SLA for new reviews, reporting touchpoint, and confirm billing is active.', 'manual', '{}', false, 'retainer_won'),
  ('pbcs-pb02-106', 12, 'Close the book with a future angle', 'Record why the deal was lost (price, timing, no trust, went silent) in the notes, thank the contact, and set a re-engagement reminder. Lost today is not lost forever.', 'manual', '{}', false, 'lost'),
  ('pbcs-pb02-107', 13, 'Close the book with a cooldown note', 'Record what was tried and why the campaign went dead. Note a cooldown date for possible resurrection - dead campaigns can re-enter the pipeline after a cooldown.', 'manual', '{}', false, 'dead')
) AS v(id, step_order, title, instructions, step_type, action_config, is_required, stage_tag)
WHERE p.code = 'PB-02'
ON CONFLICT (id) DO NOTHING;

-- PB-03 Conversion & Surface Friction (13 steps total)
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, v.stage_tag, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb03-101', 1, 'Review triage signals and scope the engagement', 'Read the triage rationale and triggered signals (missing CTA, missing service pages, missing service menu, or fallback conversion gap). Confirm PB-03 is the right playbook and frame the Website & Surface Conversion Fix pitch around the friction found.', 'manual', '{}', true, 'seek'),
  ('pbcs-pb03-102', 2, 'Build the preview deliverable and approach kit', 'Generate the preview deliverable and assemble the approach materials before any outreach: annotated screenshots of each friction point, the opener draft, and follow-up message drafts.', 'deliverable', '{}', true, 'preview_built'),
  ('pbcs-pb03-103', 3, 'Present the preview and log the engagement', 'Present the preview to the decision maker on the campaign channel, log the outreach, and record the outcome. If no decision, schedule the next follow-up touch before leaving this stage.', 'outreach', '{}', true, 'shown'),
  ('pbcs-pb03-104', 10, 'Follow up on the retainer pitch', 'Follow up on the Conversion & Local SEO Retainer pitch: answer objections, share before/after conversion-path screenshots as proof, and re-ask if the objection was timing rather than value.', 'outreach', '{"channel":"email"}', false, 'retainer_pitched'),
  ('pbcs-pb03-105', 11, 'Kick off the retainer cadence', 'Set up the conversion and local SEO cadence: monthly journey re-walk, content/keyword tasks, reporting touchpoint, and confirm billing is active.', 'manual', '{}', false, 'retainer_won'),
  ('pbcs-pb03-106', 12, 'Close the book with a future angle', 'Record why the deal was lost (price, timing, no trust, went silent) in the notes, thank the contact, and set a re-engagement reminder. Lost today is not lost forever.', 'manual', '{}', false, 'lost'),
  ('pbcs-pb03-107', 13, 'Close the book with a cooldown note', 'Record what was tried and why the campaign went dead. Note a cooldown date for possible resurrection - dead campaigns can re-enter the pipeline after a cooldown.', 'manual', '{}', false, 'dead')
) AS v(id, step_order, title, instructions, step_type, action_config, is_required, stage_tag)
WHERE p.code = 'PB-03'
ON CONFLICT (id) DO NOTHING;

-- PB-04 Admin Neglect / BBB Recovery (13 steps total)
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, v.stage_tag, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb04-101', 1, 'Review triage signals and scope the engagement', 'Read the triage rationale and triggered signals (BBB grade suppression, unanswered complaints, unaddressed negative backlog). Confirm PB-04 is the right playbook, gauge urgency with the owner, and frame the BBB Settlement & Dispute Package pitch.', 'manual', '{}', true, 'seek'),
  ('pbcs-pb04-102', 2, 'Build the preview deliverable and approach kit', 'Generate the preview deliverable and assemble the approach materials before any outreach: BBB grade and complaint screenshots, the opener draft, and follow-up message drafts.', 'deliverable', '{}', true, 'preview_built'),
  ('pbcs-pb04-103', 3, 'Present the preview and log the engagement', 'Present the preview to the decision maker on the campaign channel, log the outreach, and record the outcome. If no decision, schedule the next follow-up touch before leaving this stage.', 'outreach', '{}', true, 'shown'),
  ('pbcs-pb04-104', 10, 'Follow up on the retainer pitch', 'Follow up on the Reputation Defense & Risk Shield pitch: answer objections, share complaint-resolution progress as proof, and re-ask if the objection was timing rather than value.', 'outreach', '{"channel":"email"}', false, 'retainer_pitched'),
  ('pbcs-pb04-105', 11, 'Kick off the retainer cadence', 'Set up the reputation-defense cadence: monthly BBB and review-platform monitoring, response SLA for new complaints, reporting touchpoint, and confirm billing is active.', 'manual', '{}', false, 'retainer_won'),
  ('pbcs-pb04-106', 12, 'Close the book with a future angle', 'Record why the deal was lost (price, timing, no trust, went silent) in the notes, thank the contact, and set a re-engagement reminder. Lost today is not lost forever.', 'manual', '{}', false, 'lost'),
  ('pbcs-pb04-107', 13, 'Close the book with a cooldown note', 'Record what was tried and why the campaign went dead. Note a cooldown date for possible resurrection - dead campaigns can re-enter the pipeline after a cooldown.', 'manual', '{}', false, 'dead')
) AS v(id, step_order, title, instructions, step_type, action_config, is_required, stage_tag)
WHERE p.code = 'PB-04'
ON CONFLICT (id) DO NOTHING;

-- PB-05 Multi-Signal Footprint Triage (13 steps total)
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, v.stage_tag, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb05-101', 1, 'Review triage signals and scope the engagement', 'Read the triage rationale and triggered signals (repair signals plus review signals firing together). Confirm PB-05 is the right playbook and frame the Complete Digital Footprint Audit & Repair pitch around the combined findings.', 'manual', '{}', true, 'seek'),
  ('pbcs-pb05-102', 2, 'Build the preview deliverable and approach kit', 'Generate the preview deliverable and assemble the approach materials before any outreach: a one-page footprint summary with screenshots per finding, the opener draft, and follow-up message drafts.', 'deliverable', '{}', true, 'preview_built'),
  ('pbcs-pb05-103', 3, 'Present the preview and log the engagement', 'Present the preview to the decision maker on the campaign channel, log the outreach, and record the outcome. If no decision, schedule the next follow-up touch before leaving this stage.', 'outreach', '{}', true, 'shown'),
  ('pbcs-pb05-104', 10, 'Follow up on the retainer pitch', 'Follow up on the Full Local Reputation & Listing Retainer pitch: answer objections, share repaired-surface results as proof, and re-ask if the objection was timing rather than value.', 'outreach', '{"channel":"email"}', false, 'retainer_pitched'),
  ('pbcs-pb05-105', 11, 'Kick off the retainer cadence', 'Set up the full reputation and listing cadence: monthly listing sync plus review acquisition schedule, reporting touchpoint, and confirm billing is active.', 'manual', '{}', false, 'retainer_won'),
  ('pbcs-pb05-106', 12, 'Close the book with a future angle', 'Record why the deal was lost (price, timing, no trust, went silent) in the notes, thank the contact, and set a re-engagement reminder. Lost today is not lost forever.', 'manual', '{}', false, 'lost'),
  ('pbcs-pb05-107', 13, 'Close the book with a cooldown note', 'Record what was tried and why the campaign went dead. Note a cooldown date for possible resurrection - dead campaigns can re-enter the pipeline after a cooldown.', 'manual', '{}', false, 'dead')
) AS v(id, step_order, title, instructions, step_type, action_config, is_required, stage_tag)
WHERE p.code = 'PB-05'
ON CONFLICT (id) DO NOTHING;

-- PB-06 Visual & Asset Refresh (13 steps total)
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, v.stage_tag, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb06-101', 1, 'Review triage signals and scope the engagement', 'Read the triage rationale and triggered signals (missing project photos, stale social activity, photo deficit). Confirm PB-06 is the right playbook and frame the GBP Media & Project Asset Optimization pitch around the visual gaps.', 'manual', '{}', true, 'seek'),
  ('pbcs-pb06-102', 2, 'Build the preview deliverable and approach kit', 'Generate the preview deliverable and assemble the approach materials before any outreach: side-by-side screenshots of sparse vs competitor-rich profiles, the opener draft, and follow-up message drafts.', 'deliverable', '{}', true, 'preview_built'),
  ('pbcs-pb06-103', 3, 'Present the preview and log the engagement', 'Present the preview to the decision maker on the campaign channel, log the outreach, and record the outcome. If no decision, schedule the next follow-up touch before leaving this stage.', 'outreach', '{}', true, 'shown'),
  ('pbcs-pb06-104', 10, 'Follow up on the retainer pitch', 'Follow up on the Ongoing Local Content & Photo Refresh pitch: answer objections, share profile-view movement since the media refresh as proof, and re-ask if the objection was timing rather than value.', 'outreach', '{"channel":"email"}', false, 'retainer_pitched'),
  ('pbcs-pb06-105', 11, 'Kick off the retainer cadence', 'Set up the content and photo cadence: monthly photo refresh and social post schedule, asset request rhythm with the owner, reporting touchpoint, and confirm billing is active.', 'manual', '{}', false, 'retainer_won'),
  ('pbcs-pb06-106', 12, 'Close the book with a future angle', 'Record why the deal was lost (price, timing, no trust, went silent) in the notes, thank the contact, and set a re-engagement reminder. Lost today is not lost forever.', 'manual', '{}', false, 'lost'),
  ('pbcs-pb06-107', 13, 'Close the book with a cooldown note', 'Record what was tried and why the campaign went dead. Note a cooldown date for possible resurrection - dead campaigns can re-enter the pipeline after a cooldown.', 'manual', '{}', false, 'dead')
) AS v(id, step_order, title, instructions, step_type, action_config, is_required, stage_tag)
WHERE p.code = 'PB-06'
ON CONFLICT (id) DO NOTHING;

-- PB-07 Product Visibility & Catalog Refresh (14 steps total)
INSERT INTO mkt_playbook_checklist_steps
  (id, playbook_id, step_order, title, instructions, step_type, action_config, is_required, is_active, stage_tag, created_at, updated_at)
SELECT v.id, p.id, v.step_order, v.title, v.instructions, v.step_type, v.action_config::jsonb, v.is_required, true, v.stage_tag, NOW(), NOW()
FROM mkt_playbook_catalog p
CROSS JOIN (VALUES
  ('pbcs-pb07-101', 1, 'Review triage signals and scope the engagement', 'Read the triage rationale and triggered signals (no product catalog browsing, no availability inquiry, no pickup/delivery pathway, photo gaps). Confirm PB-07 is the right playbook and frame the Mobile Catalog + GBP Photo Optimization Preview pitch around them.', 'manual', '{}', true, 'seek'),
  ('pbcs-pb07-102', 2, 'Build the preview deliverable and approach kit', 'Generate the product visibility preview deliverable and assemble the approach materials before any outreach: screenshots of the missing catalog/inquiry/pickup gaps, the opener draft, and follow-up message drafts.', 'deliverable', '{"deliverable_type":"product_visibility_preview"}', true, 'preview_built'),
  ('pbcs-pb07-103', 3, 'Present the preview and log the engagement', 'Present the preview to the decision maker on the campaign channel, log the outreach, and record the outcome. If no decision, schedule the next follow-up touch before leaving this stage.', 'outreach', '{}', true, 'shown'),
  ('pbcs-pb07-104', 11, 'Follow up on the retainer pitch', 'Follow up on the Monthly Product Visibility & Local Discovery Retainer pitch: answer objections, share catalog preview engagement as proof, and re-ask if the objection was timing rather than value.', 'outreach', '{"channel":"email"}', false, 'retainer_pitched'),
  ('pbcs-pb07-105', 12, 'Kick off the retainer cadence', 'Set up the product visibility cadence: monthly catalog refresh, seasonal hours and holiday-hours updates, photo refresh schedule, reporting touchpoint, and confirm billing is active.', 'manual', '{}', false, 'retainer_won'),
  ('pbcs-pb07-106', 13, 'Close the book with a future angle', 'Record why the deal was lost (price, timing, no trust, went silent) in the notes, thank the contact, and set a re-engagement reminder. Lost today is not lost forever.', 'manual', '{}', false, 'lost'),
  ('pbcs-pb07-107', 14, 'Close the book with a cooldown note', 'Record what was tried and why the campaign went dead. Note a cooldown date for possible resurrection - dead campaigns can re-enter the pipeline after a cooldown.', 'manual', '{}', false, 'dead')
) AS v(id, step_order, title, instructions, step_type, action_config, is_required, stage_tag)
WHERE p.code = 'PB-07'
ON CONFLICT (id) DO NOTHING;

-- --- Verification (run manually after applying) ---
--
-- Every step tagged, ordered per pipeline stage:
--   SELECT c.code, s.step_order, s.stage_tag, s.title, s.is_required
--   FROM mkt_playbook_checklist_steps s
--   JOIN mkt_playbook_catalog c ON c.id = s.playbook_id
--   ORDER BY c.code, s.step_order;
--
-- Expected totals: PB-01 = 14, PB-02..PB-06 = 13, PB-07 = 14.
--   SELECT c.code, COUNT(*), COUNT(*) FILTER (WHERE s.stage_tag IS NULL) AS untagged
--   FROM mkt_playbook_checklist_steps s
--   JOIN mkt_playbook_catalog c ON c.id = s.playbook_id
--   GROUP BY c.code ORDER BY c.code;
--
-- Stage coverage per playbook (expect one row per stage per playbook):
--   SELECT c.code, s.stage_tag, COUNT(*)
--   FROM mkt_playbook_checklist_steps s
--   JOIN mkt_playbook_catalog c ON c.id = s.playbook_id
--   GROUP BY c.code, s.stage_tag ORDER BY c.code, s.stage_tag;
