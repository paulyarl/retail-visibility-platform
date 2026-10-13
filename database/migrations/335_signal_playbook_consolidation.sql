-- Migration 335: Consolidate wasted signals into their cohesive playbooks
--
-- Four active signal codes were emitted by the extractor/discovery lane but
-- appeared in NO playbook's any/all/dual rules and had no registry prefs —
-- they fired, scored, and routed nowhere (same failure class the PB-09
-- family had before migration 334). Each has an obvious family home:
--
--   DS_OUTDATED_HOURS / DS_OUTDATED_HOLIDAY_HOURS → PB-01
--     Hours drift is the same stale-listing class as CP_NAP_*_DRIFT.
--     Also joins PB-05 dual.groupA (drift-class evidence beside the NAP
--     codes already there — matches the PB-09 presence-code treatment).
--
--   VP_MISSING_PRODUCT_PHOTOS / VP_MISSING_STOREFRONT_PHOTOS → PB-06
--     Same visual-presence family as VP_MISSING_PROJECT_PHOTOS /
--     DS_PHOTO_DEFICIT which already live in PB-06's `any`.
--
-- Wiring follows the migration-308/334 pattern: hard `any` rules AND the
-- declared primary_playbook pref (which also feeds the discovery-verdict
-- archetype tilt — both targets are A3/doubt, consistent with drift
-- semantics: a seed doesn't fix stale hours or missing photos).
--
-- Data-only, additive, idempotent (guards check membership before append;
-- prefs overwrite deterministically). Deliberately NOT wiring:
--   Most INT_* — the partial lane consumes raw INT_* codes for seed tilt,
--           but the identity/corroboration codes (MULTISOURCE_IDENTITY,
--           SINGLE_SOURCE, ACTIVE_OPERATIONAL_EVIDENCE,
--           RECENT_BUSINESS_EVIDENCE, POSSIBLE_CATEGORY_MISALIGNMENT) carry
--           canonical +10/-10 terms and doubt markers a generic +/-5
--           archetype tilt would suppress and degrade. Context codes
--           (HIDDEN_TRUST, UNDEREXPOSED_CREDENTIAL, CATEGORY_SPECIALIZATION,
--           VERTICAL_SOURCE_DISCOVERY) are enrichment facts, not gaps.
--   OX_*  — outreach lifecycle events, not diagnostic evidence.
--   CP_MISSING_CONTACT_INFO — covered as secondary_playbook=PB-09 (334).
--
-- Apply against local + prd (SOP). No activation step needed — PB-01/PB-06
-- are already live.

BEGIN;

-- ─── 1. Registry prefs ───────────────────────────────────────────────────
UPDATE mkt_signal_registry
SET primary_playbook = 'PB-01'
WHERE code IN ('DS_OUTDATED_HOURS', 'DS_OUTDATED_HOLIDAY_HOURS');

UPDATE mkt_signal_registry
SET primary_playbook = 'PB-06'
WHERE code IN ('VP_MISSING_PRODUCT_PHOTOS', 'VP_MISSING_STOREFRONT_PHOTOS');

-- ─── 2. Hard `any` rules ─────────────────────────────────────────────────
UPDATE mkt_playbook_catalog
SET matching_rules = jsonb_set(
      matching_rules, '{any}',
      (matching_rules->'any')::jsonb
        || '["DS_OUTDATED_HOURS","DS_OUTDATED_HOLIDAY_HOURS"]'::jsonb
    ),
    updated_at = NOW()
WHERE code = 'PB-01'
  AND NOT (matching_rules->'any' ? 'DS_OUTDATED_HOURS');

UPDATE mkt_playbook_catalog
SET matching_rules = jsonb_set(
      matching_rules, '{any}',
      (matching_rules->'any')::jsonb
        || '["VP_MISSING_PRODUCT_PHOTOS","VP_MISSING_STOREFRONT_PHOTOS"]'::jsonb
    ),
    updated_at = NOW()
WHERE code = 'PB-06'
  AND NOT (matching_rules->'any' ? 'VP_MISSING_PRODUCT_PHOTOS');

-- ─── 2b. Discovery-lane prefs (partial-lane seed tilt) ───────────────────
-- These three INT_* codes have NO canonical seed-confidence term and no
-- doubt flag — they score 0 today despite carrying clear routing meaning.
-- A declared preference is the only way the partial lane scores them.
UPDATE mkt_signal_registry
SET primary_playbook = 'PB-09'
WHERE code IN ('INT_LOW_VISIBILITY', 'INT_WEAK_MAINSTREAM_INDEXING');

-- Divergent platform signals = drift-class identity doubt. A PB-01 route
-- gives -5 in seed confidence plus a route_ marker in discoveryDoubtMarkers,
-- capping 'guaranteed' at 'earned' — conservative and semantically honest.
UPDATE mkt_signal_registry
SET primary_playbook = 'PB-01'
WHERE code = 'INT_PLATFORM_SIGNAL_DIVERGENCE';

-- ─── 3. PB-05 dual.groupA += the two hours-drift codes ───────────────────
UPDATE mkt_playbook_catalog
SET matching_rules = jsonb_set(
      matching_rules, '{dual,groupA}',
      (matching_rules->'dual'->'groupA')::jsonb
        || '["DS_OUTDATED_HOURS","DS_OUTDATED_HOLIDAY_HOURS"]'::jsonb
    ),
    updated_at = NOW()
WHERE code = 'PB-05'
  AND NOT (matching_rules->'dual'->'groupA' ? 'DS_OUTDATED_HOURS');

COMMIT;

-- ─── Verification (run manually after applying) ──────────────────────────
-- SELECT code, primary_playbook FROM mkt_signal_registry
--   WHERE code IN ('DS_OUTDATED_HOURS','DS_OUTDATED_HOLIDAY_HOURS',
--                  'VP_MISSING_PRODUCT_PHOTOS','VP_MISSING_STOREFRONT_PHOTOS');
--   Expect PB-01 / PB-01 / PB-06 / PB-06.
-- SELECT matching_rules->'any' FROM mkt_playbook_catalog WHERE code='PB-01';
--   Expect the two DS hours codes appended.
-- SELECT matching_rules->'any' FROM mkt_playbook_catalog WHERE code='PB-06';
--   Expect the two VP photo codes appended.
-- SELECT matching_rules->'dual'->'groupA' FROM mkt_playbook_catalog WHERE code='PB-05';
--   Expect DS_OUTDATED_HOURS + DS_OUTDATED_HOLIDAY_HOURS appended.
