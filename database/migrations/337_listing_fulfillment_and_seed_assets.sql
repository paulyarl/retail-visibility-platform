-- Migration 337: Listing fulfillment columns + seed observed_assets
--
-- OQ1 (decided 2026-10-13): delivery/pickup facts become first-class listing
-- columns and public filters, mirroring the migration-207 SNAP/EBT contract.
-- OQ5 (decided 2026-10-13): underexposed observed_assets flow onto the seed
-- as operator-visible internal metadata — never public.
--
-- Tri-state semantics (the audit's verified-negative contract, spec §5):
--   NULL  = never observed / unaddressed
--   false = explicit rendered negative ("pickup only", "no shipping")
--   true  = observed on a verified public surface, or owner-confirmed
--
-- Public filters only ever match `= true`. false and NULL both mean "do not
-- show the badge / do not match the filter" — the distinction is kept so an
-- explicit negative is never conflated with "we never looked".
--
-- fulfillment_source allowed values:
--   - audit_channel_scan  (channel-scan audit observed it on a rendered surface)
--   - owner_confirmed     (claimed owner confirmed — outranks audit writes)
--   - ops_review          (ops-entered correction)
-- Never inferred from category labels or audience signals.
--
-- No features_list / tier wiring: these are public-filter columns on
-- directory-seed listings, not a claimed-merchant badge (the 207 tier
-- machinery gated the owner-facing SNAP badge toggle — no equivalent here).
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- =============================================================
-- 1. OQ1 — fulfillment columns on directory_listings_list
-- =============================================================
ALTER TABLE directory_listings_list
  ADD COLUMN IF NOT EXISTS delivery_offered        BOOLEAN     NULL,
  ADD COLUMN IF NOT EXISTS pickup_offered          BOOLEAN     NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_as_of       DATE        NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_source      VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_source_name TEXT        NULL;

-- Public-filter indexes (partial — only rows that can match a filter)
CREATE INDEX IF NOT EXISTS idx_directory_listings_delivery
  ON directory_listings_list (delivery_offered)
  WHERE delivery_offered = true;

CREATE INDEX IF NOT EXISTS idx_directory_listings_pickup
  ON directory_listings_list (pickup_offered)
  WHERE pickup_offered = true;

-- =============================================================
-- 2. OQ5 — observed_assets on directory_presence_seeds
-- =============================================================
-- Internal metadata only: the audit's verified_on_surface observed_assets[]
-- land here at seed birth (createFromCampaign) and refresh on audit import
-- (syncFulfillmentForCampaign). Operators read them on the seed detail page;
-- underexposed/underexposure_note/confidence stay internal — nothing in this
-- column reaches public output.
ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS observed_assets JSONB NULL;

COMMIT;
