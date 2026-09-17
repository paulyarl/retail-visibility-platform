-- ============================================================
-- 115: Fix tfp_source_check and tfp_status_check constraints
--
-- The original constraints (migration 043) only allowed:
--   source: bsaas, promo, addon, comp, tier_overage
--   status: active, suspended, expired, cancelled
--
-- But the codebase also uses:
--   source: admin_grant (grant-complimentary + redeem-grant endpoints)
--           bsaas_bundle (bundle purchases + renewal job)
--   status: past_due, trial (bundle purchases, renewal job, Zod schema)
--
-- This migration drops and recreates both constraints with the
-- complete set of allowed values.
-- ============================================================

ALTER TABLE tenant_feature_purchases DROP CONSTRAINT IF EXISTS tfp_source_check;

ALTER TABLE tenant_feature_purchases ADD CONSTRAINT tfp_source_check
    CHECK (source IN ('bsaas', 'promo', 'addon', 'comp', 'tier_overage', 'admin_grant', 'bsaas_bundle'));

ALTER TABLE tenant_feature_purchases DROP CONSTRAINT IF EXISTS tfp_status_check;

ALTER TABLE tenant_feature_purchases ADD CONSTRAINT tfp_status_check
    CHECK (status IN ('active', 'suspended', 'expired', 'cancelled', 'past_due', 'trial'));
