-- Migration 267: Directory Visibility Attributes Display
--
-- Adds sourced attribute chips to directory listings (payments accepted,
-- accessibility, ownership, service options). This is a VISIBILITY feature
-- only — it does NOT represent payment processing or any checkout capability.
--
-- Sources allowed for attribute entries:
--   - platform_scan   (gold-standard / audit platform evaluations: Apple Maps
--                      card payment attributes, Google profile attributes,
--                      Yelp attributes — each carries source_url + as_of)
--   - owner_confirmed (after claim, owner confirms via enrich flow)
--   - ops_reviewed    (operator verified from public listing surfaces)
--
-- Never inferred from category labels ("African grocery", "halal",
-- "international"). An attribute must carry its own evidence row.
--
-- SNAP/EBT stays in its own lane (migration 207): it has regulatory
-- sensitivity and its own stricter contract. Do NOT store snap_ebt as a
-- generic attribute — use the dedicated snap_ebt_* columns.
--
-- All ALTER TABLE statements use IF NOT EXISTS for idempotency.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- =============================================================
-- 1. Add attributes column to directory_listings_list
-- =============================================================
-- JSONB array of sourced attribute entries:
--   [{ "key": "accepts_apple_pay", "label": "Apple Pay",
--      "source_platform": "apple_maps", "source_url": "https://maps.apple.com/...",
--      "as_of": "2026-09-08" }]
ALTER TABLE directory_listings_list
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Index for listings that carry sourced attributes (badge display queries)
CREATE INDEX IF NOT EXISTS idx_directory_listings_attributes
  ON directory_listings_list (tenant_id)
  WHERE attributes <> '[]'::jsonb;

-- =============================================================
-- 2. Add attributes_display column to tenant_directory_entry_settings
-- =============================================================
-- Allows a claimed owner to hide the attributes row even if sourced.
-- Default NULL = show (visible if sourced). Set to false to suppress.
ALTER TABLE tenant_directory_entry_settings
  ADD COLUMN IF NOT EXISTS attributes_display BOOLEAN NULL DEFAULT NULL;

-- =============================================================
-- 3. Insert directory_visibility_attributes feature into features_list
-- =============================================================
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order)
SELECT
  'feat_directory_visibility_attributes',
  'directory_visibility_attributes',
  'Sourced Attributes Display',
  'Sourced attribute chips on directory listing (payments, accessibility, ownership). Visibility only — each attribute carries its own evidence.',
  'directory_entry',
  true,
  95
WHERE NOT EXISTS (
  SELECT 1 FROM features_list WHERE key = 'directory_visibility_attributes'
);

-- =============================================================
-- 4. Link directory_visibility_attributes to directory_entry capability type
-- =============================================================
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order)
SELECT ct.id, fl.id, true, 95
FROM features_list fl
CROSS JOIN capability_type_list ct
WHERE ct.key = 'directory_entry'
  AND fl.key = 'directory_visibility_attributes'
  AND NOT EXISTS (
    SELECT 1 FROM capability_features_list cfl
    WHERE cfl.capability_type_id = ct.id AND cfl.feature_id = fl.id
  );

-- =============================================================
-- 5. Enable directory_visibility_attributes on directory_presence tier
-- =============================================================
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  'tf_dirpres_directory_visibility_attributes',
  t.id,
  'directory_visibility_attributes',
  'Sourced Attributes Display',
  true,
  false,
  ct.id
FROM subscription_tiers_list t
CROSS JOIN capability_type_list ct
WHERE t.tier_key = 'directory_presence'
  AND ct.key = 'directory_entry'
  AND NOT EXISTS (
    SELECT 1 FROM tier_features_list tfl
    WHERE tfl.tier_id = t.id AND tfl.feature_key = 'directory_visibility_attributes'
  );

-- =============================================================
-- 6. Enable directory_visibility_attributes on higher tiers that have
--    directory_entry enabled (additive — only inserts if the tier already
--    has directory_entry_enabled in tier_features_list).
-- =============================================================
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  'tf_' || t.tier_key || '_directory_visibility_attributes',
  t.id,
  'directory_visibility_attributes',
  'Sourced Attributes Display',
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
    WHERE tfl.tier_id = t.id AND tfl.feature_key = 'directory_visibility_attributes'
  );

-- =============================================================
-- 7. MV refresh note
-- =============================================================
-- If directory_listings_list is materialized into a MV (e.g. mv_directory_listings),
-- the new column (attributes) must be added to the MV SELECT list and the MV
-- refreshed:
--   REFRESH MATERIALIZED VIEW mv_directory_listings;
-- The directory-mv.ts route should be updated to select the attributes column.

COMMIT;
