-- Migration 347: Flyer SEO keywords
--
-- Merchant-authored search keywords on the flyer — same pattern as
-- directory_listings_list.keywords / inventory_items.seo_keywords
-- (String[] + GIN). Per-flyer granularity: keywords cannot live on the
-- shared "Specials" parent item (they'd leak across every flyer the
-- tenant runs), so they sit on the container row that owns the window.
-- Consumed by the standalone /flyer/[code] page (meta keywords,
-- description fallback, JSON-LD keywords). Max 10 enforced in the
-- route schema — mirrors the directory SEO cap.
--
-- Idempotent: IF NOT EXISTS guards throughout.

BEGIN;

ALTER TABLE tenant_flyers
  ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tenant_flyers_keywords
  ON tenant_flyers USING GIN (keywords);

COMMIT;
