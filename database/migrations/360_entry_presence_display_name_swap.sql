-- 360 — Swap the Entry Presence triad display names.
--
-- The "+" marks the ENHANCED storefront rung, so it belongs to the $59
-- `storefront` tier, not the $39 `presence` tier. Before this, `presence`
-- rendered "Storefront+" at $39 while the $59 rung rendered plain
-- "Storefront" — the plus sat on the cheaper tier.
--
-- Contract-first: `shared/tier-contract.json` `display_names` and
-- `apps/web/src/lib/tiers/tier-features.ts` `TIER_DISPLAY_NAMES` already
-- carry the swapped pair; this migration makes the DB witness agree.
-- After applying, re-dump the witness so `tier-db-witness.test.ts` sees it:
--   cd apps/api && doppler run --config prd -- node scripts/dump-tier-contract.cjs
--   → shared/tier-contract-db-witness.json

BEGIN;

UPDATE subscription_tiers_list
   SET display_name = 'Storefront',
       name         = 'Storefront'
 WHERE tier_key = 'presence';

UPDATE subscription_tiers_list
   SET display_name = 'Storefront+',
       name         = 'Storefront+'
 WHERE tier_key = 'storefront';

COMMIT;
