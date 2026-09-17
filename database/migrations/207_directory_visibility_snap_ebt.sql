-- Migration 207: Directory Visibility SNAP/EBT Badge + Listing Origin Columns
--
-- Adds sourced SNAP/EBT visibility to directory listings. This is a VISIBILITY
-- BADGE only — it does NOT represent payment processing, EBT acceptance through
-- the platform, or any checkout capability.
--
-- Sources allowed for snap_ebt_reported = true:
--   - snap_retailer_list (USDA SNAP retailer list)
--   - owner_confirmed  (after claim, owner confirms)
--   - ops_photo        (in-store photo reviewed by ops)
--
-- Never inferred from category labels ("African grocery", "halal", "international").
--
-- Also adds listing_origin and public_disclaimer columns to distinguish
-- platform-seeded directory presence listings from claimed merchant listings.
--
-- All ALTER TABLE statements use IF NOT EXISTS for idempotency.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- =============================================================
-- 1. Add SNAP/EBT + origin columns to directory_listings_list
-- =============================================================
ALTER TABLE directory_listings_list
  ADD COLUMN IF NOT EXISTS snap_ebt_reported    BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS snap_ebt_as_of       DATE        NULL,
  ADD COLUMN IF NOT EXISTS snap_ebt_source      VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS snap_ebt_source_name TEXT        NULL,
  ADD COLUMN IF NOT EXISTS listing_origin       VARCHAR(32) DEFAULT 'claimed',
  ADD COLUMN IF NOT EXISTS public_disclaimer    TEXT        NULL;

-- Index for filtering by origin (directory_seed listings for admin views)
CREATE INDEX IF NOT EXISTS idx_directory_listings_origin
  ON directory_listings_list (listing_origin)
  WHERE listing_origin = 'directory_seed';

-- Index for SNAP-reported listings (badge display queries)
CREATE INDEX IF NOT EXISTS idx_directory_listings_snap_ebt
  ON directory_listings_list (snap_ebt_reported)
  WHERE snap_ebt_reported = true;

-- =============================================================
-- 2. Add snap_ebt_display column to tenant_directory_entry_settings
-- =============================================================
-- This allows a claimed owner to hide the SNAP badge even if sourced.
-- Default NULL = show (badge visible if sourced). Set to false to suppress.
ALTER TABLE tenant_directory_entry_settings
  ADD COLUMN IF NOT EXISTS snap_ebt_display BOOLEAN NULL DEFAULT NULL;

-- =============================================================
-- 3. Insert directory_visibility_snap_ebt feature into features_list
-- =============================================================
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order)
SELECT
  'feat_directory_visibility_snap_ebt',
  'directory_visibility_snap_ebt',
  'SNAP/EBT Visibility Badge',
  'Sourced SNAP/EBT badge on directory listing. Visibility only — not a payment capability.',
  'directory_entry',
  true,
  90
WHERE NOT EXISTS (
  SELECT 1 FROM features_list WHERE key = 'directory_visibility_snap_ebt'
);

-- =============================================================
-- 4. Link directory_visibility_snap_ebt to directory_entry capability type
-- =============================================================
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order)
SELECT ct.id, fl.id, true, 90
FROM features_list fl
CROSS JOIN capability_type_list ct
WHERE ct.key = 'directory_entry'
  AND fl.key = 'directory_visibility_snap_ebt'
  AND NOT EXISTS (
    SELECT 1 FROM capability_features_list cfl
    WHERE cfl.capability_type_id = ct.id AND cfl.feature_id = fl.id
  );

-- =============================================================
-- 5. Enable directory_visibility_snap_ebt on directory_presence tier
-- =============================================================
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  'tf_dirpres_directory_visibility_snap_ebt',
  t.id,
  'directory_visibility_snap_ebt',
  'SNAP/EBT Visibility Badge',
  true,
  false,
  ct.id
FROM subscription_tiers_list t
CROSS JOIN capability_type_list ct
WHERE t.tier_key = 'directory_presence'
  AND ct.key = 'directory_entry'
  AND NOT EXISTS (
    SELECT 1 FROM tier_features_list tfl
    WHERE tfl.tier_id = t.id AND tfl.feature_key = 'directory_visibility_snap_ebt'
  );

-- =============================================================
-- 6. Enable directory_visibility_snap_ebt on higher tiers that have
--    directory_entry enabled (so claimed merchants also get the badge
--    if they source SNAP data). This is additive — only inserts if the
--    tier already has directory_entry_enabled in tier_features_list.
-- =============================================================
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  'tf_' || t.tier_key || '_directory_visibility_snap_ebt',
  t.id,
  'directory_visibility_snap_ebt',
  'SNAP/EBT Visibility Badge',
  true,
  false,
  ct.id
FROM subscription_tiers_list t
CROSS JOIN capability_type_list ct
WHERE ct.key = 'directory_entry'
  AND t.tier_key IN ('discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'professional', 'enterprise', 'organization')
  AND EXISTS (
    SELECT 1 FROM tier_features_list tfl
    WHERE tfl.tier_id = t.id
      AND tfl.feature_key = 'directory_entry_enabled'
      AND tfl.is_enabled = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM tier_features_list tfl
    WHERE tfl.tier_id = t.id AND tfl.feature_key = 'directory_visibility_snap_ebt'
  );

-- =============================================================
-- 7. MV refresh note
-- =============================================================
-- If directory_listings_list is materialized into a MV (e.g. mv_directory_listings),
-- the new columns (snap_ebt_reported, snap_ebt_as_of, snap_ebt_source,
-- snap_ebt_source_name, listing_origin, public_disclaimer) must be added
-- to the MV SELECT list and the MV refreshed:
--   REFRESH MATERIALIZED VIEW mv_directory_listings;
-- The directory-mv.ts route should be updated to select these columns.

COMMIT;
