-- 349_pb08_pb09_checklist_stage_tags.sql
--
-- Retags the PB-08 (Website Acquisition & Build) and PB-09 (Profile Presence
-- Build) checklist steps, which shipped untagged in migrations 303 / 318 / 334
-- — before 'seed' was a permissible stage_tag (added in 349a). stage_tag NULL
-- means "always gates transitions", so every required PB-08/PB-09 step gated
-- even the seek -> seed transition, forcing operators to acknowledge-and-
-- proceed past fulfillment work like "Build or hand off the site".
--
-- Tagging follows the migration 175/276 conventions and the seed-first wedge
-- semantics (entering `seed` signifies seed presence only):
--   * seed          — engagement work done during the wedge stage (presence
--                     state, signal evidence, owner interview, claim invite)
--   * preview_built — build the FITD deliverable (mirrors the -102 steps)
--   * paid          — fulfillment work (mirrors the original -00x retag)
--   * delivered     — wrap-up deliverable / retainer pitch (mirrors 175's
--                     delivered retag of pitch-prep steps)
--
-- Idempotent: each UPDATE is guarded by stage_tag IS NULL so an operator who
-- already retagged a step is never overwritten and re-runs are no-ops.
--
-- Data-only migration. No schema changes, no prisma db pull required.
-- Apply AFTER 349a_checklist_stage_tag_seed.sql ('seed' must be a valid tag).
-- Apply manually via the Supabase SQL Editor, staging then production, using
-- plain Run (see manual-sql-migration-policy).
-- Date: 2026-10-21

BEGIN;

-- ─── PB-08 Website Acquisition & Build ───────────────────────────────────
-- Seed-stage engagement: presence state, signal evidence, owner interview,
-- and the claim invitation all happen during `seed` — they must not gate
-- progression INTO seed.
UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'seed', updated_at = NOW()
WHERE id IN ('pbcs-pb08-001', 'pbcs-pb08-002', 'pbcs-pb08-003', 'pbcs-pb08-009')
  AND stage_tag IS NULL;

-- The positioning report + homepage mockup IS the FITD deliverable — built at
-- preview_built, presented at shown (mirrors the -102 convention).
UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'preview_built', updated_at = NOW()
WHERE id = 'pbcs-pb08-004'
  AND stage_tag IS NULL;

-- Post-sale fulfillment: build/hand off the site, then point every profile at
-- the canonical domain (mirrors PB-01's paid-tagged citation fixes).
UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'paid', updated_at = NOW()
WHERE id IN ('pbcs-pb08-005', 'pbcs-pb08-006')
  AND stage_tag IS NULL;

-- Care-plan retainer pitch after the site is live (mirrors 175's delivered
-- retag of pitch-prep steps).
UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'delivered', updated_at = NOW()
WHERE id = 'pbcs-pb08-007'
  AND stage_tag IS NULL;

-- ─── PB-09 Profile Presence Build ────────────────────────────────────────
-- Seed-stage engagement: presence inventory, per-platform evidence, and the
-- canonical-record interview with the owner.
UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'seed', updated_at = NOW()
WHERE id IN ('pbcs-pb09-001', 'pbcs-pb09-002', 'pbcs-pb09-003')
  AND stage_tag IS NULL;

-- Post-sale fulfillment: claim/create GBP, build the missing profiles,
-- resolve duplicates and integrity issues.
UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'paid', updated_at = NOW()
WHERE id IN ('pbcs-pb09-004', 'pbcs-pb09-005', 'pbcs-pb09-006')
  AND stage_tag IS NULL;

-- Wrap-up: deliver the Presence Plan deliverable, then pitch the Presence &
-- Sync retainer.
UPDATE mkt_playbook_checklist_steps
SET stage_tag = 'delivered', updated_at = NOW()
WHERE id IN ('pbcs-pb09-007', 'pbcs-pb09-008')
  AND stage_tag IS NULL;

COMMIT;

-- Verification (run after applying, staging and production):
--   SELECT c.code, s.id, s.stage_tag, s.is_required
--     FROM mkt_playbook_checklist_steps s
--     JOIN mkt_playbook_catalog c ON c.id = s.playbook_id
--    WHERE c.code IN ('PB-08', 'PB-09')
--    ORDER BY c.code, s.step_order;
--   Expect zero NULL stage_tag rows: PB-08 = 4 seed / 1 preview_built /
--   2 paid / 1 delivered; PB-09 = 3 seed / 3 paid / 2 delivered.
--
-- Gate check for a seek-stage PB-08 campaign (mcamp-ib8k5r2g):
--   incomplete required steps with tag order <= seek = none, so
--   POST /transition {to_stage:'seed'} no longer 409s.
