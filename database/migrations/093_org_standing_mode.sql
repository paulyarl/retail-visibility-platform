-- Migration 093: Organization Standing Mode
--
-- Adds org_standing_mode column to tenants table to control whether
-- a tenant inherits good standing from its parent organization or
-- remains independently billed.
--
-- Modes:
--   'independent' (default) — tenant's own subscription_status is the gate
--   'inherited'              — org's good standing lifts the tenant;
--                              org bad standing does NOT drag the tenant down
--                              (asymmetric: only upward cascade)
--
-- Inherited mode still respects org-level capability resolution
-- (org_options, propagation, etc). The switch only affects
-- subscription-status gating (frozen/canceled/expired overrides).

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS org_standing_mode VARCHAR(20) DEFAULT 'independent';

-- Add check constraint for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_org_standing_mode'
  ) THEN
    ALTER TABLE tenants
    ADD CONSTRAINT chk_org_standing_mode
    CHECK (org_standing_mode IN ('independent', 'inherited'));
  END IF;
END $$;

-- Add grace period timestamp: set when org goes bad, cleared when org recovers
-- Batch job checks this to auto-flip inherited → independent after ORG_STANDING_GRACE_DAYS
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS standing_mode_grace_until TIMESTAMP;

-- Add index for filtering inherited tenants within an org
CREATE INDEX IF NOT EXISTS idx_tenants_org_standing_mode
  ON tenants (org_standing_mode)
  WHERE org_standing_mode = 'inherited';

-- Index for batch job: find inherited tenants with expired grace period
CREATE INDEX IF NOT EXISTS idx_tenants_standing_grace_expired
  ON tenants (org_standing_mode, standing_mode_grace_until)
  WHERE org_standing_mode = 'inherited' AND standing_mode_grace_until IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN tenants.org_standing_mode IS
  'Controls whether tenant inherits good standing from org (inherited) or is independently billed (independent). Asymmetric: inherited mode lifts tenant up when org is healthy but does NOT drag tenant down when org is unhealthy.';

COMMENT ON COLUMN tenants.standing_mode_grace_until IS
  'When org falls out of good standing, this is set to now() + grace period. If org does not recover by this date, batch job flips tenant to independent. Cleared when org recovers.';
