-- Migration 088: Add 'weekly' billing cycle to BSaaS catalog and bundles
-- Adds 'weekly' to the CHECK constraint on billing_cycle columns in bsaas_catalog and bsaas_bundles

-- 1. Alter bsaas_catalog CHECK constraint
ALTER TABLE bsaas_catalog DROP CONSTRAINT IF EXISTS bsaas_catalog_billing_cycle_check;
ALTER TABLE bsaas_catalog ADD CONSTRAINT bsaas_catalog_billing_cycle_check
  CHECK (billing_cycle IN ('one_time', 'weekly', 'monthly', 'annual'));

-- 2. Alter bsaas_bundles CHECK constraint
ALTER TABLE bsaas_bundles DROP CONSTRAINT IF EXISTS bsaas_bundles_billing_cycle_check;
ALTER TABLE bsaas_bundles ADD CONSTRAINT bsaas_bundles_billing_cycle_check
  CHECK (billing_cycle IN ('one_time', 'weekly', 'monthly', 'annual'));
