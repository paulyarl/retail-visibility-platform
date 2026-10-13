-- Migration 336: DS_PROFILE_NOT_PUBLIC — exists-but-invisible is a
-- visibility pain, not an evidence caveat
--
-- For a business, a profile the public cannot see (private/unpublished,
-- login-gated basic listing data, search-suppressed) is a visibility
-- defect in its own right — businesses are expected to be publicly
-- discoverable. Previously the only verdicts were absent
-- (business_specific_failure → DS_MISSING_PROFILE) or unable_to_verify
-- (existence indeterminate → no signal), so a verified-but-hidden profile
-- produced nothing actionable.
--
-- The new verdict `restricted` sits between the two: existence verified,
-- public render denied. The audit emits DS_PROFILE_NOT_PUBLIC with
-- platform data_status 'restricted'; the extractor also derives the code
-- deterministically (belt-and-suspenders, same as DS_CLAIMED_STATUS).
-- The operator-evidence directive (v4) treats an authenticated-only
-- capture as restricted evidence — hidden, not missing.
--
-- Wiring follows the 334/335 pattern:
--   registry row + primary_playbook='PB-09' pref (presence/integrity
--   family — repair, not creation)
--   PB-09 `any` append
--   PB-05 dual.groupA append (repair-class, same as the rest of the PB-09
--   family)
--
-- Data-only, additive, idempotent. Apply against local + prd (SOP).

BEGIN;

-- ─── 1. Registry row ─────────────────────────────────────────────────────
INSERT INTO mkt_signal_registry (id, code, family, label, description, detection_source, derived_rule, is_active) VALUES
  ('sig-ds-profile-not-public', 'DS_PROFILE_NOT_PUBLIC', 'DS', 'Profile Not Publicly Visible',
   'Profile exists but the public cannot see it — private/unpublished, login-gated, or search-suppressed',
   'model_emitted', NULL, true)
ON CONFLICT (code) DO NOTHING;

-- ─── 2. Primary pref ─────────────────────────────────────────────────────
UPDATE mkt_signal_registry
SET primary_playbook = 'PB-09'
WHERE code = 'DS_PROFILE_NOT_PUBLIC';

-- ─── 3. PB-09 `any` rule ─────────────────────────────────────────────────
UPDATE mkt_playbook_catalog
SET matching_rules = jsonb_set(
      matching_rules, '{any}',
      (matching_rules->'any')::jsonb
        || '["DS_PROFILE_NOT_PUBLIC"]'::jsonb
    ),
    updated_at = NOW()
WHERE code = 'PB-09'
  AND NOT (matching_rules->'any' ? 'DS_PROFILE_NOT_PUBLIC');

-- ─── 4. PB-05 dual.groupA (repair-class family membership) ──────────────
UPDATE mkt_playbook_catalog
SET matching_rules = jsonb_set(
      matching_rules, '{dual,groupA}',
      (matching_rules->'dual'->'groupA')::jsonb
        || '["DS_PROFILE_NOT_PUBLIC"]'::jsonb
    ),
    updated_at = NOW()
WHERE code = 'PB-05'
  AND NOT (matching_rules->'dual'->'groupA' ? 'DS_PROFILE_NOT_PUBLIC');

COMMIT;

-- ─── Verification (run manually after applying) ──────────────────────────
-- SELECT code, primary_playbook, is_active FROM mkt_signal_registry
--   WHERE code = 'DS_PROFILE_NOT_PUBLIC';
--   Expect primary_playbook='PB-09', is_active=true.
-- SELECT matching_rules->'any' FROM mkt_playbook_catalog WHERE code='PB-09';
--   Expect DS_PROFILE_NOT_PUBLIC appended.
-- SELECT matching_rules->'dual'->'groupA' FROM mkt_playbook_catalog WHERE code='PB-05';
--   Expect DS_PROFILE_NOT_PUBLIC appended.
