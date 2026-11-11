-- 379 — Rename the `discovery` tier display name from "SWIS" to "Nearby".
--
-- The spec renamed the Google-surface tier: "SWIS" is the legacy label,
-- "Nearby" is canonical. `shared/tier-contract.json` `display_names` and
-- `apps/web/src/lib/tiers/tier-features.ts` `TIER_DISPLAY_NAMES` already
-- carry "Nearby"; this migration makes the DB witness agree (Capability
-- Management renders `name` from `subscription_tiers_list`).
--
-- trial_discovery's label follows its parent tier's display name, matching
-- the "Trial: <display name>" convention used by the other trial rows.
--
-- After applying, re-dump the witness so `tier-db-witness.test.ts` sees it:
--   cd apps/api && doppler run --config prd -- node scripts/dump-tier-contract.cjs
--   → shared/tier-contract-db-witness.json

BEGIN;

UPDATE subscription_tiers_list
   SET display_name = 'Nearby',
       name         = 'Nearby'
 WHERE tier_key = 'discovery';

UPDATE subscription_tiers_list
   SET display_name = 'Trial: Nearby',
       name         = 'Trial: Nearby'
 WHERE tier_key = 'trial_discovery';

COMMIT;
