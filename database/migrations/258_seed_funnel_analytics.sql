-- 258_seed_funnel_analytics.sql
-- Seed Funnel Benchmark Gates & Tracking Analytics
-- (docs/LocalBiz/seed_funnel_benchmark_gates_and_analytics_spec.md §7 gaps 1-2)
--
-- Adds the funnel-tracking columns to directory_presence_seeds and the NAP
-- verification event table:
--   contact_status        — 'contactable' | 'contact_unverified', derived at
--                           seed creation from phone presence (identity
--                           confidence is already clamped to high/medium at
--                           seed level). Absence of a phone is recorded as
--                           contact_unverified, NEVER as unreachable.
--   nap_verified_at       — stamped at claim accept: the claim itself is the
--                           owner's confirmation of the filed NAP (OTP-verified
--                           when the token is bound).
--   nap_owner_corrected   — set when a claimed seed's NAP fields are later
--                           changed, with a diff row in
--                           directory_seed_nap_verifications (the
--                           "owner corrected NAP" leading indicator).
--
-- Additive only; backfills contact_status from existing phone sources.

-- ─── Seed funnel columns ────────────────────────────────────────────────
ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS contact_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS contact_status_derived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS nap_verified_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS nap_owner_corrected BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_dps_contact_status
  ON directory_presence_seeds (contact_status);

-- ─── NAP verification events ────────────────────────────────────────────
-- One row per observed NAP confirmation/change on a claimed seed.
--   source = 'claim_accept_baseline'  → the claim itself (no diff)
--   source = 'owner_update'           → post-claim NAP change (carries diff)
CREATE TABLE IF NOT EXISTS directory_seed_nap_verifications (
  id              TEXT PRIMARY KEY,
  seed_id         TEXT NOT NULL REFERENCES directory_presence_seeds(id) ON DELETE CASCADE,
  tenant_id       TEXT NOT NULL,
  source          TEXT NOT NULL,
  changed_fields  JSONB DEFAULT NULL,
  owner_corrected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dsnv_seed
  ON directory_seed_nap_verifications (seed_id);

-- ─── Backfill contact_status for existing seeds ─────────────────────────
-- Contactable when ANY outreach route exists: seed owner_phone, listing
-- phone, or the linked campaign's phone.
UPDATE directory_presence_seeds dps
SET contact_status = CASE
      WHEN dps.owner_phone IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM directory_listings_list dl
          WHERE dl.id = dps.listing_id AND dl.phone IS NOT NULL
        )
        OR EXISTS (
          SELECT 1
          FROM directory_seed_campaign_links dscl
          JOIN mkt_campaigns_list mc ON mc.id = dscl.campaign_id
          WHERE dscl.seed_id = dps.id AND mc.phone IS NOT NULL
        )
      THEN 'contactable'
      ELSE 'contact_unverified'
    END,
    contact_status_derived_at = now()
WHERE contact_status = 'unverified';
