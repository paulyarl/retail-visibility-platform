-- Migration 250: Directory Presence Gateway Trial Backfill
--
-- Gateway tenants (subscription_tier = 'directory_presence') are free forever
-- by design and must never sit in subscription_status = 'trial'. The trial
-- machinery (TenantService.getTenantById auto-set + TrialManagementService
-- background jobs) treats 'trial' as a paid-trial clock: it stamps
-- trial_ends_at = now + 14 days on first load and then auto-expires the
-- tenant onto a paid tier.
--
-- Affected rows: directory presence seeds (created with 'trial' before this
-- fix) and claimed gateway tenants (claim flow did not flip the status).
--
-- Code fixes shipped alongside this migration:
--   - DirectoryPresenceSeedService.createSeed creates seeds as 'active'
--   - DirectoryClaimService.acceptClaim / approveClaimRequest set 'active'
--   - TenantService exempts directory_presence from trial auto-set/auto-expire
--   - Trial expiry revert target corrected 'presence' -> 'directory_presence'
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

UPDATE tenants
SET subscription_status = 'active',
    updated_at = now()
WHERE subscription_tier = 'directory_presence'
  AND subscription_status = 'trial';

COMMIT;
