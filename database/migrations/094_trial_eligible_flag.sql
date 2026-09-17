-- 094_trial_eligible_flag.sql
-- Adds trial_eligible and demo_eligible boolean columns to bsaas_catalog and bsaas_bundles.
--
-- trial_eligible (opt-in, default false):
--   An item must have trial_eligible=true AND trial_days > 0 for the trial
--   branch to activate during purchase. Existing items with trial_days > 0
--   are grandfathered to trial_eligible=true.
--
-- demo_eligible (opt-out, default true):
--   Demo tenants (tenants.is_demo = true) can only purchase features/bundles
--   where demo_eligible=true. Admins can opt out individual items to prevent
--   demo tenants from purchasing them. All existing items default to true.

-- ───────────────────────────────────────────────────────────
-- 1. bsaas_catalog: add trial_eligible + demo_eligible
-- ───────────────────────────────────────────────────────────
ALTER TABLE bsaas_catalog
  ADD COLUMN IF NOT EXISTS trial_eligible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_eligible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bsaas_catalog_is_private ON bsaas_catalog (is_private);

-- Grandfather existing entries that already have trial_days > 0
UPDATE bsaas_catalog
SET trial_eligible = true, updated_at = NOW()
WHERE trial_days > 0 AND trial_eligible = false;

-- ───────────────────────────────────────────────────────────
-- 2. bsaas_bundles: add trial_eligible + demo_eligible
-- ───────────────────────────────────────────────────────────
ALTER TABLE bsaas_bundles
  ADD COLUMN IF NOT EXISTS trial_eligible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_eligible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bsaas_bundles_is_private ON bsaas_bundles (is_private);

-- Grandfather existing bundles that already have trial_days > 0
UPDATE bsaas_bundles
SET trial_eligible = true, updated_at = NOW()
WHERE trial_days > 0 AND trial_eligible = false;
