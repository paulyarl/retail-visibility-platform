-- 380 — Separated integration limits: ingress vs egress SKU caps.
--
-- The tier cost curve now tracks the integration footprint (decision
-- 2026-11-12): POS ingress is flat across the Entry Presence triad, while
-- each egress surface carries API cost proportional to the volume it pushes.
-- max_skus stays the overall catalog cap consumed by the platform
-- storefront; the two new columns meter the directional pipes:
--
--   pos_ingress_max_skus  — cap on POS-synced (imported/mapped) items.
--                           NULL = inherit max_skus (flat ingress — current
--                           behavior everywhere).
--   gmc_egress_max_skus   — cap on items pushed to the Google feed
--                           (MerchantProductSync batch). NULL = uncapped,
--                           0 = no egress, N = top-N of the eligible catalog.
--
-- Trio values (presence = platform surface, no API egress → cheapest):
--   presence    gmc 0     (no Google egress — belt-and-suspenders on top of
--                          its missing google keys)
--   discovery   gmc 50    (Nearby pushes top-50 of its 200-SKU catalog)
--   storefront  gmc 100   (Storefront+ pushes top-100)
-- Higher tiers stay NULL (uncapped) until the cost curve says otherwise.
-- pos_ingress stays NULL everywhere — enforcement is a follow-up; today
-- POS-mapped items are already bounded by max_skus at import time.

BEGIN;

ALTER TABLE subscription_tiers_list
  ADD COLUMN IF NOT EXISTS pos_ingress_max_skus integer,
  ADD COLUMN IF NOT EXISTS gmc_egress_max_skus  integer;

UPDATE subscription_tiers_list SET gmc_egress_max_skus = 0   WHERE tier_key = 'presence';
UPDATE subscription_tiers_list SET gmc_egress_max_skus = 50  WHERE tier_key = 'discovery';
UPDATE subscription_tiers_list SET gmc_egress_max_skus = 100 WHERE tier_key = 'storefront';

COMMIT;
