-- Migration 184: playbook_code on campaigns + sibling uniqueness by playbook
--
-- Widens the prospect-sibling uniqueness key from (campaign_category,
-- repair_track) to (playbook_code) so that two profile_repair siblings
-- differentiated by playbook (e.g. PB-01 vs PB-03) can coexist for the same
-- business prospect. The multi-archetype model treats siblings as independent
-- pipelines; playbook independence aligns with that goal.
--
-- Before: one (category, repair_track) per prospect — PB-01 and PB-03 both
-- collapsed to (profile_repair, standard) and collided on accept.
-- After:  one playbook_code per prospect — PB-01 and PB-03 coexist; only
-- concurrent duplicates of the SAME playbook are blocked (PB-01 vs PB-01).
--
-- Manually-created siblings with no playbook_code (playbook_code IS NULL) are
-- exempt from the uniqueness constraint — the operator did not pick a
-- playbook, so there is nothing to deduplicate.
--
-- Schema change + data backfill. Run `prisma db pull && prisma generate`
-- after applying.
--
-- Date: 2026-08-09

BEGIN;

-- ─── Step 1: Add playbook_code column ───────────────────────────────────
ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS playbook_code VARCHAR(20);

-- Index for lookups (e.g. resolving the effective playbook without joining
-- triage results).
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_playbook_code
  ON mkt_campaigns_list (playbook_code)
  WHERE playbook_code IS NOT NULL;

-- ─── Step 2: Backfill playbook_code from accepted triage results ────────
-- For each campaign with an accepted triage result, set playbook_code to the
-- effective playbook (override if present, else recommendation). This captures
-- the operator's explicit decision for both primary and sibling campaigns.
UPDATE mkt_campaigns_list c
SET playbook_code = pb.code,
    updated_at = NOW()
FROM mkt_campaign_triage_results t
JOIN mkt_playbook_catalog pb
  ON pb.id = COALESCE(t.overridden_playbook_id, t.recommended_playbook_id)
WHERE t.campaign_id = c.id
  AND t.is_operator_accepted = true
  AND c.playbook_code IS NULL;

-- ─── Step 3: Swap the sibling uniqueness index ──────────────────────────
-- Drop the old (category, repair_track) index and replace it with a
-- (playbook_code) index. Same partial predicate scope (business-scope
-- campaigns with a prospect id), plus playbook_code IS NOT NULL so manual
-- siblings are exempt.
DROP INDEX IF EXISTS idx_mkt_campaigns_prospect_sibling_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_campaigns_prospect_sibling_playbook_unique
  ON mkt_campaigns_list (business_prospect_id, playbook_code)
  WHERE business_prospect_id IS NOT NULL
    AND scope = 'business'
    AND playbook_code IS NOT NULL;

-- ─── Verification ───────────────────────────────────────────────────────
-- Run manually after applying:
--   SELECT scope, COUNT(*), COUNT(playbook_code) FROM mkt_campaigns_list GROUP BY scope;
--   SELECT business_prospect_id, playbook_code, COUNT(*)
--   FROM mkt_campaigns_list
--   WHERE business_prospect_id IS NOT NULL AND scope = 'business' AND playbook_code IS NOT NULL
--   GROUP BY business_prospect_id, playbook_code HAVING COUNT(*) > 1;
-- Expected: second query returns 0 rows (no prospect has duplicate playbooks).

COMMIT;
