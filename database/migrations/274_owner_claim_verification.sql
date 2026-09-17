-- Migration 274: Owner claim-time verification (contract of consent)
--
-- When a business owner claims a directory-presence seed, the claim page now
-- requires the owner to review + confirm their categories and attributes
-- before the claim submits. The confirmation is minted on the seed as the
-- consent-of-record and flows to the listing:
--
--   owner_verified_at          — consent timestamp (the "contract" moment)
--   owner_verification         — JSONB snapshot of what the owner confirmed:
--                                { primaryCategory, secondaryCategories,
--                                  confirmedAttributes[], rejectedAttributes[],
--                                  addedAttributes[], proposedCategories[] }
--   owner_proposed_categories  — JSONB array of owner-typed category labels that
--                                are NOT in the platform/vocab category set.
--                                These are an abuse gate: they stay
--                                status='pending' until an operator accepts
--                                (vocab registration + listing write) or
--                                rejects them on the seed detail page.
--                                Shape: [{ label, role: 'primary'|'secondary',
--                                status: 'pending'|'accepted'|'rejected',
--                                proposed_at, decided_at, decided_by }]
--
-- Confirmed fields are written to directory_listings_list with provenance
-- source_name='owner_claim' (confidence 'high', show_on_public=true) and the
-- seed's category_fit flips to 'verified'. Applied at claim submit
-- (POST /claim/:token/initiate) so the mint is identical for the OTP path
-- and the operator-approval path.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS owner_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_verification JSONB,
  ADD COLUMN IF NOT EXISTS owner_proposed_categories JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Fast lookup for seeds with owner-proposed categories awaiting review.
CREATE INDEX IF NOT EXISTS idx_dps_owner_proposed_categories
  ON directory_presence_seeds USING gin (owner_proposed_categories)
  WHERE owner_proposed_categories <> '[]'::jsonb;

COMMIT;
