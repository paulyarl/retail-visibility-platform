-- Migration 231: Entry Presence Tier (presence)
--
-- Adds the new clean `presence` tier (display: "Starter") as the directory-mode
-- Entry Presence peer alongside `discovery` and `storefront`.
--
-- V3.1 decisions:
--   - Tier key: `presence` (NOT reviving legacy `starter`)
--   - Display name: "Starter"
--   - Price: $19/mo
--   - Sort order: 10 (between directory_presence=0 and discovery=20)
--   - Legacy `starter` stays inactive — no purge
--   - `google_only` stays inactive
--   - All Entry Presence paid modes use subscription billing
--
-- Also adds `billing_type` column to `subscription_tiers_list` so the gateway
-- can distinguish free (`none`) from subscription-billed tiers.
--
-- Idempotent: safe to re-run.
--
-- After applying: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- =============================================================
-- 1. Add billing_type column to subscription_tiers_list
-- =============================================================
-- Distinguishes free gateway (none) from subscription-billed tiers.
-- Defaults to 'subscription' for backward compatibility with existing paid tiers.
DO $$ BEGIN
  ALTER TABLE subscription_tiers_list
    ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) NOT NULL DEFAULT 'subscription';
EXCEPTION WHEN OTHERS THEN END $$;

-- Set directory_presence to 'none' (free gateway, no payment method required)
UPDATE subscription_tiers_list
SET billing_type = 'none', updated_at = NOW()
WHERE tier_key = 'directory_presence' AND billing_type <> 'none';

-- =============================================================
-- 2. Renumber active V3 tiers to spaced integer sort_order
-- =============================================================
-- Spaced ordering leaves room for future inserts:
--   0  directory_presence  (gateway)
--  10  presence            (new — Entry Presence directory mode)
--  20  discovery           (Entry Presence google mode)
--  30  storefront          (Entry Presence platform mode)
--  40  commitment          (Commerce)
--  50  ecommerce           (Commerce)
--  60  omnichannel         (Commerce)
--  70  professional        (Scale)
--  80  organization        (Scale)
--  90  enterprise          (Scale)
-- Legacy/inactive tiers (google_only, starter, chain_starter) keep their
-- existing sort_order values — they are not part of the active V3 hierarchy.

UPDATE subscription_tiers_list SET sort_order = 0,  updated_at = NOW() WHERE tier_key = 'directory_presence';
UPDATE subscription_tiers_list SET sort_order = 20, updated_at = NOW() WHERE tier_key = 'discovery';
UPDATE subscription_tiers_list SET sort_order = 30, updated_at = NOW() WHERE tier_key = 'storefront';
UPDATE subscription_tiers_list SET sort_order = 40, updated_at = NOW() WHERE tier_key = 'commitment';
UPDATE subscription_tiers_list SET sort_order = 50, updated_at = NOW() WHERE tier_key = 'ecommerce';
UPDATE subscription_tiers_list SET sort_order = 60, updated_at = NOW() WHERE tier_key = 'omnichannel';
UPDATE subscription_tiers_list SET sort_order = 70, updated_at = NOW() WHERE tier_key = 'professional';
UPDATE subscription_tiers_list SET sort_order = 80, updated_at = NOW() WHERE tier_key = 'organization';
UPDATE subscription_tiers_list SET sort_order = 90, updated_at = NOW() WHERE tier_key = 'enterprise';

-- =============================================================
-- 3. Insert the presence tier row
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
  billing_type,
  metadata,
  max_users
)
SELECT
  'tier_presence',
  'presence',
  'Starter',
  'Starter',
  'Paid directory presence — enriched in-house directory listing (logo, about, gallery, layouts, social). No Google or platform marketplace capabilities.',
  19.00,
  0,
  1,
  'individual',
  true,
  10,
  'subscription',
  '{"layer": "entry_presence", "surface": "directory", "mode": "directory"}'::jsonb,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_tiers_list WHERE tier_key = 'presence'
);

-- =============================================================
-- 4. Insert new feature keys into features_list
-- =============================================================
-- directory_entry_logo_on and directory_entry_about_on are NEW.
-- The other 4 (gallery_on, social_on, layout_editorial, layout_immersive)
-- already exist in the resolver but may not have features_list rows yet.

INSERT INTO features_list (id, key, name, description, category, is_active, sort_order, created_at, updated_at)
SELECT
  'feat_' || t.key,
  t.key,
  t.name,
  t.description,
  'directory_entry',
  true,
  t.sort_order,
  NOW(),
  NOW()
FROM (VALUES
  ('directory_entry_logo_on',           'Directory Entry Logo Section',     'Logo display on public directory entry',                      70),
  ('directory_entry_about_on',          'Directory Entry About Section',    'About/description section on public directory entry',         80),
  ('directory_entry_gallery_on',        'Directory Entry Gallery Section',  'Image gallery section on public directory entry',             90),
  ('directory_entry_social_on',         'Directory Entry Social Section',   'Social media links on public directory entry',              100),
  ('directory_entry_layout_editorial',  'Directory Entry Layout: Editorial','Editorial layout for directory entry',                      110),
  ('directory_entry_layout_immersive',  'Directory Entry Layout: Immersive','Immersive layout for directory entry',                      120)
) AS t(key, name, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM features_list fl WHERE fl.key = t.key);

-- =============================================================
-- 5. Link new feature keys to directory_entry capability type
-- =============================================================
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order)
SELECT ct.id, fl.id, true, fl.sort_order
FROM features_list fl
CROSS JOIN capability_type_list ct
WHERE ct.key = 'directory_entry'
  AND fl.key IN (
    'directory_entry_logo_on',
    'directory_entry_about_on',
    'directory_entry_gallery_on',
    'directory_entry_social_on',
    'directory_entry_layout_editorial',
    'directory_entry_layout_immersive'
  )
  AND NOT EXISTS (
    SELECT 1 FROM capability_features_list cfl
    WHERE cfl.capability_type_id = ct.id AND cfl.feature_id = fl.id
  );

-- =============================================================
-- 6. Insert tier_features_list rows for presence tier
-- =============================================================
-- Presence tier gets directory enrichment features only.
-- It does NOT get Google capabilities or platform product browse.
-- It inherits directory_presence features via the hierarchy, but we
-- also link the enrichment features directly here so the resolver
-- sees them on the presence tier.

INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  'tf_presence_' || fl.key,
  t.id,
  fl.key,
  fl.name,
  true,
  false,
  ct.id
FROM subscription_tiers_list t
CROSS JOIN features_list fl
LEFT JOIN capability_type_list ct ON ct.key = 'directory_entry'
WHERE t.tier_key = 'presence'
  AND fl.key IN (
    'directory_entry_enabled',
    'directory_entry_layout_classic',
    'directory_entry_layout_editorial',
    'directory_entry_layout_immersive',
    'directory_entry_logo_on',
    'directory_entry_about_on',
    'directory_entry_gallery_on',
    'directory_entry_social_on',
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

-- =============================================================
-- Verification queries (run manually after applying)
-- =============================================================
-- SELECT tier_key, display_name, price_monthly, sort_order, billing_type, is_active
-- FROM subscription_tiers_list
-- WHERE tier_key IN ('directory_presence','presence','discovery','storefront','commitment','ecommerce','omnichannel','professional','organization','enterprise')
-- ORDER BY sort_order;
--
-- SELECT tfl.feature_key, tfl.is_enabled
-- FROM tier_features_list tfl
-- JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
-- WHERE stl.tier_key = 'presence'
-- ORDER BY tfl.feature_key;
