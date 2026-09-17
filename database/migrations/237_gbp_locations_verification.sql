-- Migration 237: GBP Locations Verification + Voice of Merchant + Cached Rating
--
-- Extends gbp_locations_list with:
--   1. tenant_id — denormalized from google_oauth_accounts_list.tenant_id for
--      direct tenant-scoped queries without joining through the OAuth account.
--   2. business_name — cached display name for the location (distinct from
--      location_name which is the Google-provided title).
--   3. verification_state — UNVERIFIED | PENDING | COMPLETED | FAILED
--      (driven by GBPVerificationService, Phase 1).
--   4. voice_of_merchant — cached getVoiceOfMerchantState payload (JSONB).
--   5. cached_average_rating — Google aggregate averageRating (e.g. 4.5).
--   6. cached_review_count — Google aggregate totalReviewCount.
--   7. rating_cache_updated — last refresh timestamp.
--
-- Backfill: tenant_id is populated from google_oauth_accounts_list.tenant_id
-- for all existing rows. Orphaned rows (no matching OAuth account) remain NULL.

ALTER TABLE gbp_locations_list
  ADD COLUMN IF NOT EXISTS tenant_id           VARCHAR,
  ADD COLUMN IF NOT EXISTS business_name       VARCHAR,
  ADD COLUMN IF NOT EXISTS verification_state  VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS voice_of_merchant   JSONB,
  ADD COLUMN IF NOT EXISTS cached_average_rating DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS cached_review_count INTEGER,
  ADD COLUMN IF NOT EXISTS rating_cache_updated TIMESTAMPTZ;

-- Backfill tenant_id from the linked OAuth account.
UPDATE gbp_locations_list l
SET tenant_id = a.tenant_id
FROM google_oauth_accounts_list a
WHERE l.account_id = a.id
  AND l.tenant_id IS NULL;

-- Index for tenant-scoped location lookups (CustomerGBPAccessService.resolveLocations).
CREATE INDEX IF NOT EXISTS idx_gbp_locations_tenant
  ON gbp_locations_list (tenant_id);

-- Index for verification-state queries (Phase 1 dashboard status).
CREATE INDEX IF NOT EXISTS idx_gbp_locations_verification_state
  ON gbp_locations_list (verification_state)
  WHERE verification_state <> 'COMPLETED';
