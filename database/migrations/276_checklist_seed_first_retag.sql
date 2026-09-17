-- Migration 276: Checklist Seed-First Wedge — Triage-as-Upgrade Retag
--
-- Strategy change: every business playbook now opens with a free directory
-- place listing seeded from public data, followed by a no-obligation claim
-- invite. Only after that good-faith wedge does the paid pitch land — at
-- preview_built, framed as the upgrade that eases the pain the audit
-- surfaced.
--
-- What this migration does:
--   * Retags the "Review triage signals and scope the engagement" step
--     (pbcs-pbNN-101, migration 175) from 'seek' to 'preview_built' for
--     PB-01..PB-07, so it gates the preview_built -> shown transition
--     instead of seek -> preview_built. Operators can advance to
--     preview_built once the seed/claim work is done; the review and the
--     pitch happen while building the preview.
--   * Rewords each step's instructions to the upgrade-pitch framing.
--
-- The seed/invite steps themselves are NOT in this migration — they are
-- code-defined permanent checklist steps (PERMANENT_SEED_STEPS in
-- PlaybookChecklistService.ts) because they must render before a playbook
-- is assigned (pre-triage) and apply to every business-scope campaign.
--
-- Idempotent: each UPDATE is guarded by stage_tag = 'seek' so an operator
-- who already retagged or rewrote a step is never overwritten, and re-runs
-- are no-ops.
--
-- Data-only migration. No schema changes, no prisma db pull required.
-- Apply to local and prd: psql $DATABASE_URL -f database/migrations/276_checklist_seed_first_retag.sql
-- Date: 2026-09-11

UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'preview_built',
    instructions = 'Read the triage rationale and triggered signals (NAP name/address/phone drift, URL mismatch, outdated hours, claimed status). Confirm PB-01 is the right playbook. The seeded place listing and claim invite already demonstrated good faith — frame the Citation & Profile Alignment Package as the paid upgrade that eases the pain the drift signals surfaced.',
    updated_at = NOW()
WHERE id = 'pbcs-pb01-101' AND stage_tag = 'seek';

UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'preview_built',
    instructions = 'Read the triage rationale and triggered signals (review drought, low review volume, unaddressed positive backlog). Confirm PB-02 is the right playbook. The seeded place listing and claim invite already demonstrated good faith — frame the Review Acceleration & Response Pack as the paid upgrade that eases the pain the review signals surfaced.',
    updated_at = NOW()
WHERE id = 'pbcs-pb02-101' AND stage_tag = 'seek';

UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'preview_built',
    instructions = 'Read the triage rationale and triggered signals (missing CTA, missing service pages, missing service menu, or fallback conversion gap). Confirm PB-03 is the right playbook. The seeded place listing and claim invite already demonstrated good faith — frame the Website & Surface Conversion Fix as the paid upgrade that eases the pain the friction signals surfaced.',
    updated_at = NOW()
WHERE id = 'pbcs-pb03-101' AND stage_tag = 'seek';

UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'preview_built',
    instructions = 'Read the triage rationale and triggered signals (BBB grade suppression, unanswered complaints, unaddressed negative backlog). Confirm PB-04 is the right playbook, gauge urgency with the owner. The seeded place listing and claim invite already demonstrated good faith — frame the BBB Settlement & Dispute Package as the paid upgrade that eases the pain the complaint signals surfaced.',
    updated_at = NOW()
WHERE id = 'pbcs-pb04-101' AND stage_tag = 'seek';

UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'preview_built',
    instructions = 'Read the triage rationale and triggered signals (repair signals plus review signals firing together). Confirm PB-05 is the right playbook. The seeded place listing and claim invite already demonstrated good faith — frame the Complete Digital Footprint Audit & Repair as the paid upgrade that eases the pain the combined signals surfaced.',
    updated_at = NOW()
WHERE id = 'pbcs-pb05-101' AND stage_tag = 'seek';

UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'preview_built',
    instructions = 'Read the triage rationale and triggered signals (missing project photos, stale social activity, photo deficit). Confirm PB-06 is the right playbook. The seeded place listing and claim invite already demonstrated good faith — frame the GBP Media & Project Asset Optimization as the paid upgrade that eases the pain the visual-gap signals surfaced.',
    updated_at = NOW()
WHERE id = 'pbcs-pb06-101' AND stage_tag = 'seek';

UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'preview_built',
    instructions = 'Read the triage rationale and triggered signals (no product catalog browsing, no availability inquiry, no pickup/delivery pathway, photo gaps). Confirm PB-07 is the right playbook. The seeded place listing and claim invite already demonstrated good faith — frame the Mobile Catalog + GBP Photo Optimization Preview as the paid upgrade that eases the pain the product-visibility signals surfaced.',
    updated_at = NOW()
WHERE id = 'pbcs-pb07-101' AND stage_tag = 'seek';

-- --- Verification (run manually after applying) ---
--
-- Expect zero 'seek'-tagged required steps across PB-01..PB-07 (the soft
-- gate no longer blocks seek -> preview_built on triage review):
--   SELECT c.code, s.id, s.stage_tag, s.is_required
--   FROM mkt_playbook_checklist_steps s
--   JOIN mkt_playbook_catalog c ON c.id = s.playbook_id
--   WHERE s.id LIKE 'pbcs-pb__-101';
--
-- Expect 7 rows all with stage_tag = 'preview_built'.
