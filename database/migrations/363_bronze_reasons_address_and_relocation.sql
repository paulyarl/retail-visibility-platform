-- Migration 363: Bronze reason catalog — address-normalization + relocation reasons
--
-- Source: the Milwaukee, WI African Grocery Store establishment scan
-- (audits/african_grocery_store_milwaukee_wi_proposal_expansion_2026-10-28.json).
-- Two operator-reviewed additions and one revision:
--
--   1. intersection_only_address          — NEW (universal, priority 3)
--      A storefront whose only published address is a corner cannot be
--      geocoded, so licensing joins, parcel-keyed registry matches and
--      corridor clustering all miss it. Exemplar: RAYKINS-AFRICFOOD.
--
--   2. premises_relocation_splits_the_trace — NEW (universal, priority 2)
--      The business moved but the old address keeps circulating in mirrors,
--      BID rosters and SNAP records while the platform carries only the new
--      one. Inverse of alternate_identity (one name/two addresses vs two
--      names/one address) and distinct from rename_residue (name change at a
--      fixed address). Exemplar: Abobo African Market.
--
--   3. rename_residue_splits_the_discovery_trace — REVISED
--      The Milwaukee sweep found the platform-side form of the same mechanic:
--      the profile itself is titled with the predecessor name while the live
--      name has no profile. Recorded as a signal bullet + definition note
--      rather than a new reason key (same mechanic family; adding a
--      near-duplicate would fragment coverage of the same storefront).
--
-- Catalog invariants honoured (BronzeReasonCatalogService / spec §3.5):
--   - reason_key is immutable; nothing is deleted, only added or revised.
--   - Every write stamps a revision AND bumps mkt_bronze_catalog_meta in the
--     same transaction, so profiles stamped at the previous revision go stale
--     and the uncovered-reason query reports the two new keys.
--   - Scope literals are stored pre-normalized. Both new reasons are
--     universal: every scope column NULL.
--   - Idempotent: re-running is a no-op (gated on the first new key) and does
--     NOT double-bump the revision.
--
-- Apply with: psql "$DATABASE_URL" -f database/migrations/363_bronze_reasons_address_and_relocation.sql
-- After applying: existing bronze profiles stamped at revision 8 become
-- "revised_since_authored" — intended detection, not an error. The next
-- establishment/slot-fill scan covers the two new reasons and re-stamps.

BEGIN;

DO $$
DECLARE
  v_rev int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM mkt_bronze_reason_catalog WHERE reason_key = 'intersection_only_address'
  ) THEN
    RAISE NOTICE 'migration 363: already applied (catalog revision %), skipping', (SELECT catalog_revision FROM mkt_bronze_catalog_meta WHERE id = 'catalog');
    RETURN;
  END IF;

  SELECT catalog_revision + 1 INTO v_rev FROM mkt_bronze_catalog_meta WHERE id = 'catalog';
  IF v_rev IS NULL THEN
    RAISE EXCEPTION 'mkt_bronze_catalog_meta row (id = ''catalog'') is missing — cannot stamp a revision';
  END IF;

  -- ─── 1 + 2. New reasons ────────────────────────────────────────────────
  INSERT INTO mkt_bronze_reason_catalog
    (reason_key, label, definition, signals, expected_vectors, priority,
     scope_category_key, scope_city, scope_state, scope_platform,
     provenance, introduced_in_revision, created_by)
  VALUES
    ('intersection_only_address',
     'Intersection-only address',
     'The storefront publishes only an intersection — no street number — so it cannot be geocoded to a parcel. Address normalization treats the corner as a neighborhood rather than a place: licensing joins, parcel-keyed registry matches and corridor clustering all miss it, and the listing cannot be deduplicated against a numbered-address record for the same unit. Discovery depends on name-token search or a label sweep. Milwaukee instance: RAYKINS-AFRICFOOD at "South 12th and W Holt Ave" — current hours and a working phone, Street-View-only imagery, and a wa.me click-to-chat link standing in for a website.',
     '["platform address field reads as an intersection or corner, with no street number", "no parcel or suite identifier exists in any public record for the business", "the storefront appears in no address-keyed dataset (SNAP, registry, permit) under that address", "phone and hours are current, so the listing is live but ungeocodable"]'::jsonb,
     '["address-normalization sweep for intersection-only and corner-description variants", "Street View geolocation to recover the parcel number", "phone-keyed cross-join to numbered-address records on the same block"]'::jsonb,
     3, NULL, NULL, NULL, NULL, 'derived', v_rev, 'migration:363'),

    ('premises_relocation_splits_the_trace',
     'Premises relocation splits the discovery trace',
     'An operating grocery moves to a new storefront but the old address keeps circulating in mirrors, business-improvement-district rosters, SNAP records and community lists while the platform profile carries only the new address. The same business becomes two half-entities keyed on address: review equity sits on one, current hours and phone on the other, and address-keyed joins never reconcile them. Searchers for the name return both, so no single surface looks authoritative. Milwaukee instance: Abobo African Market — Google and Atly carry 3714 N 92nd St with (414) 231-3372 and 17 reviews, while Birdeye (20 reviews), Yahoo Local (3.0/3, phone (414) 429-6204), MapQuest and the Uptown Crossing BID roster all carry 5707 W North Ave, 53208.',
     '["same business name appears at two addresses across sources with different phone numbers", "a business-improvement-district or community roster lists the superseded address as current", "the platform profile carries the new address while mirrors and SNAP-style datasets carry the old one", "review aggregates differ between the two address variants for one store"]'::jsonb,
     '["address-variant cross-join keyed on business name and phone across platform, BID rosters and registry datasets", "business-improvement-district / neighborhood association tenant rosters", "SNAP retailer registry address diff against the platform address"]'::jsonb,
     2, NULL, NULL, NULL, NULL, 'derived', v_rev, 'migration:363');

  -- ─── 3. Revise rename_residue with the platform-side form ──────────────
  UPDATE mkt_bronze_reason_catalog
     SET definition = definition
           || ' Milwaukee also showed the platform-side form of the same mechanic: the profile itself is still titled with the predecessor name while the live trading name has no profile at all (Al-Asalah Food Pantry / Samah, 851-869 W Layton Ave; Hamada Market / Rayan Market, 4563 S 13th St).',
         signals = signals || '["the platform profile itself is titled with the predecessor name while the live trading name has no profile on that platform"]'::jsonb,
         revised_in_revision = v_rev,
         updated_at = now()
   WHERE reason_key = 'rename_residue_splits_the_discovery_trace'
     AND NOT signals @> '["the platform profile itself is titled with the predecessor name while the live trading name has no profile on that platform"]'::jsonb;

  -- ─── 4. Bump the catalog revision (same transaction) ───────────────────
  UPDATE mkt_bronze_catalog_meta
     SET catalog_revision = v_rev,
         updated_at = now()
   WHERE id = 'catalog';

  RAISE NOTICE 'migration 363: catalog revision % — 2 reasons added, 1 revised', v_rev;
END $$;

COMMIT;

-- ─── Verification (manual) ────────────────────────────────────────────────
-- SELECT catalog_revision FROM mkt_bronze_catalog_meta WHERE id = 'catalog';            -- previous + 1
-- SELECT reason_key, priority, introduced_in_revision, revised_in_revision
--   FROM mkt_bronze_reason_catalog
--  WHERE reason_key IN ('intersection_only_address',
--                       'premises_relocation_splits_the_trace',
--                       'rename_residue_splits_the_discovery_trace')
--  ORDER BY reason_key;                                                                  -- 2 new at the new rev, 1 revised at the new rev
-- SELECT jsonb_array_length(signals) FROM mkt_bronze_reason_catalog
--  WHERE reason_key = 'rename_residue_splits_the_discovery_trace';                       -- 5
--
-- Coverage impact for the Milwaukee board (mip-elctso1n v2): the two new
-- universal reasons open 2 slots each. RAYKINS-AFRICFOOD is a ready
-- intersection_only_address occupant; Abobo African Market is a ready
-- premises_relocation occupant. The next slot-fill scan re-stamps the profile
-- and reports both.
