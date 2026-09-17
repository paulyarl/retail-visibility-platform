-- Migration 178: Repair Playbook Re-Categorization
--
-- Re-categorizes PB-01, PB-03, PB-06, PB-07 from 'review_management' to
-- 'profile_repair'. These playbooks match on repair signals (NAP drift, URL
-- mismatch, missing photos, missing CTA, product visibility) — not review
-- signals. The triage engine can now assign 'profile_repair' as a
-- PlaybookCategory, enabling triage-driven profile_repair campaigns.
--
-- IMPORTANT: Apply AFTER the code deploy that adds 'profile_repair' to
-- PLAYBOOK_CATEGORIES (triage/types.ts) and playbookCategoryEnum
-- (marketing-ops.ts). If the migration runs first, the playbook catalog
-- will have rows with a category that the type system and route validation
-- reject — causing runtime errors.
--
-- Existing campaigns that already accepted these playbooks keep
-- 'review_management' (no automatic re-categorization — that would change
-- pipeline behavior). New campaigns accepting these playbooks after the
-- migration get 'profile_repair' + 'standard' track.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- 1. Update the check constraint to include 'profile_repair' as a valid
--    category. Must happen BEFORE the UPDATE — otherwise the UPDATE fails
--    with chk_playbook_category violation.
ALTER TABLE mkt_playbook_catalog
  DROP CONSTRAINT IF EXISTS chk_playbook_category;

ALTER TABLE mkt_playbook_catalog
  ADD CONSTRAINT chk_playbook_category
  CHECK (category IN ('review_management', 'recovery_management', 'profile_repair', 'triage_management'));

-- 2. Re-categorize repair playbooks from review_management to profile_repair.
-- These playbooks match on DS + CP + VP + WC signals (repair domain), not
-- RA signals (review domain).
UPDATE mkt_playbook_catalog
  SET category = 'profile_repair', updated_at = NOW()
  WHERE code IN ('PB-01', 'PB-03', 'PB-06', 'PB-07')
    AND category = 'review_management';

-- Verification queries (run manually after applying):
-- SELECT code, name, category, archetype FROM mkt_playbook_catalog WHERE code IN ('PB-01','PB-02','PB-03','PB-04','PB-05','PB-06','PB-07') ORDER BY priority_rank;
-- Expected:
--   PB-04 | recovery_management | A2
--   PB-05 | triage_management   | A5
--   PB-01 | profile_repair      | A3
--   PB-02 | review_management   | A1
--   PB-07 | profile_repair      | A6
--   PB-06 | profile_repair      | A3
--   PB-03 | profile_repair      | A4

COMMIT;
