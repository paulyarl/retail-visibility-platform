-- Migration 280: Campaign "seed" stage (review track)
--
-- Inserts a `seed` stage between `seek` and `preview_built` in the
-- review-track campaign pipeline, formalizing the seed-first wedge
-- (create place listing → QC → publish → mint claim token → invite owner
-- to claim) as a first-class stage instead of permanent checklist steps
-- parked on `seek`. Spec: docs/LocalBiz/CAMPAIGN_SEED_STAGE_SPRINT_PLAN.md
--
-- The `mkt_campaigns_list.stage` column is VARCHAR(50) with DEFAULT 'seek'
-- and NO CHECK constraint (verified), so the 'seed' literal needs no
-- constraint migration — only this additive timestamp column.
--
-- After running: cd apps/api && npx prisma db pull && npx prisma generate
-- (schema.prisma gains date_seed on mkt_campaigns_list via db pull).
--
-- Idempotent (IF NOT EXISTS).

BEGIN;

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS date_seed TIMESTAMPTZ(6);

COMMIT;
