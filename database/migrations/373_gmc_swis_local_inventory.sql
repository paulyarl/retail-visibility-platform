-- Migration 373: GMC / SWIS local inventory — store codes, selection flags,
-- and durable per-destination sync state
--
-- Spec: docs/LocalBiz/GMC_MERCHANT_API_SWIS_SPEC.md §9
--
-- What lands:
--   1. store_code on google_merchant_links_list (v1: exactly one per tenant)
--      and gbp_locations_list (Merchant Center store code derived from GBP
--      location_name/title; default vs-{tenant slug} on setup).
--   2. swis_enabled on the merchant link — the merchant's explicit opt-in for
--      broadcasting live in-store stock (spec §6.4, deny-by-default).
--   3. free_listings_enabled + gbp_account_url on the merchant link —
--      console-observed enrollment bookkeeping for the readiness checklist
--      until an API-side enrollment check exists.
--   4. swis_listed on inventory_items — per-product selection for the local
--      surface (§6.4 deny-by-default; new products never inherit it).
--   5. google_online_excluded on inventory_items — per-product online opt-out
--      (the ProductsTab "Shopping" checkbox, stored inverted).
--   6. gmc_item_sync_state — durable per-destination sync state replacing the
--      overloaded inventory_items.sync_status for Google write attempts
--      (spec §6.5): fixes the phantom retry fields and gives the status table
--      real pending/error/exhausted states per destination.
--
-- Backfill (§9): set swis_enabled=false (nothing auto-enables);
-- sync_status='success' rows get gmc_item_sync_state(destination='online',
-- status='synced') so the status table doesn't regress on cutover.

-- ============================================================
-- 1. Merchant link columns
-- ============================================================

ALTER TABLE public.google_merchant_links_list
  ADD COLUMN IF NOT EXISTS store_code            text,
  ADD COLUMN IF NOT EXISTS free_listings_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gbp_account_url       text,
  ADD COLUMN IF NOT EXISTS swis_enabled          boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. GBP location store code
-- ============================================================

ALTER TABLE public.gbp_locations_list
  ADD COLUMN IF NOT EXISTS store_code text;

-- ============================================================
-- 3. Inventory item surface flags
-- ============================================================

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS swis_listed            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_online_excluded boolean NOT NULL DEFAULT false;

-- ============================================================
-- 4. Per-destination sync state (spec §6.5)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gmc_item_sync_state (
  id                  text PRIMARY KEY,
  inventory_item_id   text NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  product_variant_id  text REFERENCES public.product_variants(id) ON DELETE CASCADE,
  destination         text NOT NULL CHECK (destination IN ('online', 'local')),
  google_id           text,                          -- processed product/inventory resource name
  status              text NOT NULL CHECK (status IN ('pending','synced','error','exhausted','excluded')),
  last_error          text,
  last_error_at       timestamptz,
  retry_count         integer NOT NULL DEFAULT 0,
  last_attempt_at     timestamptz,
  last_synced_at      timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- One row per (item, variant, destination); variant-less rows dedupe on the
-- item+destination pair via COALESCE.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gmc_item_sync_state_unresolved
  ON public.gmc_item_sync_state (inventory_item_id, COALESCE(product_variant_id, ''), destination);

-- Retry job sweep: error rows ordered by oldest attempt first.
CREATE INDEX IF NOT EXISTS idx_gmc_item_sync_state_retryable
  ON public.gmc_item_sync_state (status, last_attempt_at)
  WHERE status = 'error';

-- ============================================================
-- 5. Backfill — don't regress the status table on cutover
-- ============================================================

INSERT INTO public.gmc_item_sync_state
  (id, inventory_item_id, destination, google_id, status, last_synced_at, created_at, updated_at)
SELECT
  'sync_' || ii.id || '_online',
  ii.id,
  'online',
  ii.metadata->>'gmc_item_id',
  'synced',
  ii.synced_at,
  now(),
  now()
FROM public.inventory_items ii
WHERE ii.sync_status = 'success'
  AND ii.synced_at IS NOT NULL
ON CONFLICT DO NOTHING;
