-- Migration 364: DS_CATEGORY_MISMATCH — platform category mislabel as its own signal
--
-- Why a new code instead of re-homing WC_CATEGORY_MISMATCH:
--
--   WC_CATEGORY_MISMATCH is registered as *Website Content Category Mismatch*
--   ("Site content does not match the business's actual category - template
--   leftovers, wrong-industry copy"). It describes the OWNED WEBSITE, and its
--   only playbook home is PB-08 / A7_WEBSITE_GAP (priority_rank 8).
--
--   The discovery finding it was being used for is different: the PLATFORM
--   profile's primary category is generic or wrong for the assortment
--   (Milwaukee: Abobo filed "Store", Nasib "Convenience store", Al-Ansar
--   "Asian grocery store", Zafor's plain "Grocery store").
--
--   Adding WC_CATEGORY_MISMATCH to PB-01 would have fixed the routing for the
--   mislabel case but hijacked PB-08's real population: PB-01 outranks PB-08
--   (4 vs 8), so every genuine website-template-leftover case would have moved
--   to listing repair as well. Splitting the code keeps both populations on
--   the right archetype.
--
-- What this migration does:
--   1. Registers DS_CATEGORY_MISMATCH (family DS — Digital Surface & Profile,
--      where profile taxonomy lives, not WC).
--   2. Adds it to PB-01 (Profile Repair & Listing Drift, A3) `any` pool —
--      a wrong category label is listing drift, not a website gap.
--   3. Adds it to PB-05 (Multi-Signal Footprint Triage, A5) `dual.groupA` so
--      mislabel + review gap escalates to the dual-triage package.
--
-- Idempotent: ON CONFLICT for the registry row, `NOT (... ? code)` guards on
-- both jsonb edits. Re-running is a no-op.
--
-- Companion code change (deploy with or before this migration):
--   - signal-taxonomy.ts: DS_CATEGORY_MISMATCH added to KNOWN_SIGNAL_CODES.
--   - discovery-verdict.ts: BRONZE_REASON_SIGNAL_MAP maps
--     misaligned_platform_category -> DS_CATEGORY_MISMATCH (was
--     WC_CATEGORY_MISMATCH).
--   The engine ignores unknown codes in rules with a warning, so the migration
--   is safe to apply before the deploy; the mapping simply starts producing the
--   new code once the code lands.

BEGIN;

-- ─── 1. Register the signal ──────────────────────────────────────────────
INSERT INTO mkt_signal_registry (id, code, family, label, description, detection_source, derived_rule, is_active) VALUES
  ('sig-ds-category-mismatch', 'DS_CATEGORY_MISMATCH', 'DS', 'Platform Category Mismatch',
   'The platform profile primary category is generic or wrong for the assortment — a specialty retailer filed under Grocery store, Convenience store, Store, or another industry''s bucket — so category-filtered discovery misses it',
   'model_emitted', NULL, true)
ON CONFLICT (code) DO NOTHING;

-- ─── 2. PB-01 any += DS_CATEGORY_MISMATCH ────────────────────────────────
UPDATE mkt_playbook_catalog
   SET matching_rules = jsonb_set(
         matching_rules, '{any}',
         (matching_rules->'any')::jsonb || '["DS_CATEGORY_MISMATCH"]'::jsonb),
       updated_at = NOW()
 WHERE code = 'PB-01'
   AND NOT (matching_rules->'any' ? 'DS_CATEGORY_MISMATCH');

-- ─── 3. PB-05 dual.groupA += DS_CATEGORY_MISMATCH ────────────────────────
UPDATE mkt_playbook_catalog
   SET matching_rules = jsonb_set(
         matching_rules, '{dual,groupA}',
         (matching_rules->'dual'->'groupA')::jsonb || '["DS_CATEGORY_MISMATCH"]'::jsonb),
       updated_at = NOW()
 WHERE code = 'PB-05'
   AND matching_rules->'dual'->'groupA' IS NOT NULL
   AND NOT (matching_rules->'dual'->'groupA' ? 'DS_CATEGORY_MISMATCH');

COMMIT;

-- ─── Verification (manual) ────────────────────────────────────────────────
-- SELECT code, family, label, is_active FROM mkt_signal_registry WHERE code = 'DS_CATEGORY_MISMATCH';
-- SELECT code, matching_rules->'any' AS any_pool FROM mkt_playbook_catalog WHERE code = 'PB-01';      -- includes DS_CATEGORY_MISMATCH
-- SELECT code, matching_rules->'dual'->'groupA' AS dual_a FROM mkt_playbook_catalog WHERE code = 'PB-05'; -- includes DS_CATEGORY_MISMATCH
-- SELECT code, matching_rules->'any' AS any_pool FROM mkt_playbook_catalog WHERE code = 'PB-08';      -- unchanged: WC_CATEGORY_MISMATCH stays
--
-- Expected routing after deploy, for the Milwaukee mislabel cohort:
--   Nasib Halal Meat & Groceries   DS_CATEGORY_MISMATCH -> PB-01 (was PB-08)
--   Al-Ansar SuperMarket           DS_CATEGORY_MISMATCH -> PB-01 (was PB-08)
--   Zafor's Fresh Market           DS_CATEGORY_MISMATCH -> PB-01 (was PB-08)
--   Abobo African Market           DS_CATEGORY_MISMATCH + CP_NAP_NAME_DRIFT -> PB-01
-- A website-template-leftover case (WC_CATEGORY_MISMATCH alone) still routes to PB-08.
