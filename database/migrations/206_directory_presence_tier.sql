-- Migration 206: Directory Presence Light Tier
--
-- Adds a new lightweight subscription tier `directory_presence` for emerging
-- local businesses (initial use case: African grocery stores in Indianapolis)
-- that need a public directory listing without a full storefront/catalog/
-- checkout subscription.
--
-- This tier sits BELOW `discovery` in the hierarchy. It is visibility-only:
--   - Directory entry (classic layout only)
--   - Retail storefront presence (one-page, no catalog)
--   - Basic sections: hours, map, contact, QR
--   - No catalog, checkout, coupons, editorial/immersive/premium layouts
--
-- The tier is invite-only (metadata.invite_only = true, price_monthly = 0).
-- Seed tenants use org_standing_mode = 'directory_seed' (added in migration 208).
--
-- All inserts are idempotent (INSERT ... WHERE NOT EXISTS) so this migration
-- is safe to re-run.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- =============================================================
-- 1. Insert the directory_presence tier row
-- =============================================================
INSERT INTO subscription_tiers_list (
  id,
  tier_key,
  name,
  display_name,
  description,
  price_monthly,
  max_skus,
  max_locations,
  tier_type,
  is_active,
  sort_order,
  metadata,
  max_users
)
SELECT
  'tier_directory_presence',
  'directory_presence',
  'Directory Presence',
  'Directory Presence',
  'Lightweight directory listing for emerging local businesses. Visibility-only — no catalog, checkout, or advanced storefront.',
  0.00,
  0,
  1,
  'individual',
  true,
  0,   -- sort_order: below discovery (which is 1)
  '{"invite_only": true, "upgrade_path": ["discovery", "storefront", "commitment"]}'::jsonb,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_tiers_list WHERE tier_key = 'directory_presence'
);

-- =============================================================
-- 2. Insert feature keys into features_list
-- =============================================================
-- These are the feature keys the directory_presence tier enables.
-- Some already exist (directory_entry_*, storefront_enabled, storefront_retail)
-- and are skipped by the WHERE NOT EXISTS guard.
-- We only insert features that are NEW to this migration or missing.

-- 2a. Ensure directory_entry feature keys exist (most already do from prior seeds)
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order)
SELECT
  'feat_' || key,
  key,
  name,
  description,
  'directory_entry',
  true,
  sort_order
FROM (VALUES
  ('directory_entry_enabled',            'Directory Entry Enabled',            'Master toggle for directory entry capability',                 10),
  ('directory_entry_layout_classic',     'Directory Entry Layout: Classic',    'Classic directory entry layout',                               20),
  ('directory_entry_hours_on',           'Directory Entry Hours Section',      'Hours section available on directory entry',                   30),
  ('directory_entry_map_on',             'Directory Entry Map Section',        'Map section available on directory entry',                     40),
  ('directory_entry_contact_on',         'Directory Entry Contact Section',    'Contact section available on directory entry',                 50),
  ('directory_entry_qr_on',              'Directory Entry QR Section',         'QR code section available on directory entry',                 60),
  ('storefront_enabled',                 'Storefront Enabled',                 'Master toggle for storefront capability',                      70),
  ('storefront_retail',                  'Storefront Retail Type',             'Retail storefront type (one-page presence, no catalog)',       80)
) AS t(key, name, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM features_list WHERE key = t.key);

-- =============================================================
-- 3. Ensure capability_features_list links exist for directory_entry
-- =============================================================
-- Link directory_entry_* features to the directory_entry capability type.
-- storefront_* features link to the storefront capability type.
-- These links may already exist from prior seeds; skip if so.

-- 3a. directory_entry capability type
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order)
SELECT ct.id, fl.id, true, fl.sort_order
FROM features_list fl
CROSS JOIN capability_type_list ct
WHERE ct.key = 'directory_entry'
  AND fl.key IN (
    'directory_entry_enabled',
    'directory_entry_layout_classic',
    'directory_entry_hours_on',
    'directory_entry_map_on',
    'directory_entry_contact_on',
    'directory_entry_qr_on'
  )
  AND NOT EXISTS (
    SELECT 1 FROM capability_features_list cfl
    WHERE cfl.capability_type_id = ct.id AND cfl.feature_id = fl.id
  );

-- 3b. storefront capability type
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order)
SELECT ct.id, fl.id, true, fl.sort_order
FROM features_list fl
CROSS JOIN capability_type_list ct
WHERE ct.key = 'storefront'
  AND fl.key IN ('storefront_enabled', 'storefront_retail')
  AND NOT EXISTS (
    SELECT 1 FROM capability_features_list cfl
    WHERE cfl.capability_type_id = ct.id AND cfl.feature_id = fl.id
  );

-- =============================================================
-- 4. Insert tier_features_list rows for directory_presence
-- =============================================================
-- Each row links the tier to a feature key with the capability type.
-- is_inherited = false for all (these are the tier's own features).

INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  'tf_dirpres_' || fl.key,
  t.id,
  fl.key,
  fl.name,
  true,
  false,
  ct.id
FROM subscription_tiers_list t
CROSS JOIN features_list fl
LEFT JOIN capability_type_list ct ON ct.key = CASE
  WHEN fl.key LIKE 'directory_entry_%' THEN 'directory_entry'
  WHEN fl.key LIKE 'storefront_%' THEN 'storefront'
  ELSE NULL
END
WHERE t.tier_key = 'directory_presence'
  AND fl.key IN (
    'directory_entry_enabled',
    'directory_entry_layout_classic',
    'directory_entry_hours_on',
    'directory_entry_map_on',
    'directory_entry_contact_on',
    'directory_entry_qr_on',
    'storefront_enabled',
    'storefront_retail'
  )
  AND NOT EXISTS (
    SELECT 1 FROM tier_features_list tfl
    WHERE tfl.tier_id = t.id AND tfl.feature_key = fl.key
  );

COMMIT;
