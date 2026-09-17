-- =============================================================
-- 286 — Directory Entry WhatsApp CTA (WHATSAPP_CHANNEL_INTEGRATION_SPEC §15, flavor A)
--
-- Seeds the directory_entry_whatsapp_on feature key (+ legacy _enabled alias),
-- links it to the directory_entry capability type, grants it to the tiers that
-- already carry directory_entry_contact_on (presence + directory_presence —
-- per D5: explicit grant only; directory_entry_flexible does NOT unlock it),
-- and adds the merchant preference columns to tenant_directory_entry_settings.
--
-- Plain DDL only (no DO blocks) — idempotent via WHERE NOT EXISTS guards.
-- =============================================================

BEGIN;

-- 1. Feature keys
INSERT INTO features_list (id, key, name, description, category, is_active, sort_order, created_at, updated_at)
SELECT
  'feat_' || key,
  key,
  name,
  description,
  'directory_entry',
  true,
  sort_order,
  NOW(),
  NOW()
FROM (VALUES
  ('directory_entry_whatsapp_on',      'Directory Entry WhatsApp CTA',        'WhatsApp click-to-chat action on the claimed directory listing', 55),
  ('directory_entry_whatsapp_enabled', 'Directory Entry WhatsApp CTA (On)',   'Legacy alias for directory_entry_whatsapp_on',                     56)
) AS t(key, name, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM features_list WHERE key = t.key);

-- 2. Link to the directory_entry capability type
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order)
SELECT ct.id, fl.id, true, fl.sort_order
FROM features_list fl
CROSS JOIN capability_type_list ct
WHERE ct.key = 'directory_entry'
  AND fl.key IN ('directory_entry_whatsapp_on', 'directory_entry_whatsapp_enabled')
  AND NOT EXISTS (
    SELECT 1 FROM capability_features_list cfl
    WHERE cfl.capability_type_id = ct.id AND cfl.feature_id = fl.id
  );

-- 3. Tier grants — same tiers that carry directory_entry_contact_on.
--    Explicit grant only: directory_entry_flexible does NOT imply this key (D5).
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled, is_inherited, capability_type_id)
SELECT
  'tf_de_whatsapp_' || t.tier_key || '_' || fl.key,
  t.id,
  fl.key,
  fl.name,
  true,
  false,
  ct.id
FROM subscription_tiers_list t
CROSS JOIN features_list fl
LEFT JOIN capability_type_list ct ON ct.key = 'directory_entry'
WHERE t.tier_key IN ('presence', 'directory_presence')
  AND fl.key IN ('directory_entry_whatsapp_on')
  AND NOT EXISTS (
    SELECT 1 FROM tier_features_list tfl
    WHERE tfl.tier_id = t.id AND tfl.feature_key = fl.key
  );

-- 4. Merchant preference columns (claimed listings only)
--    whatsapp_display: merchant kill-switch for the CTA (null = default on)
--    whatsapp_number:  merchant-provided WhatsApp number, E.164 digits (no '+').
--                      Never derived from the listing's NAP phone (§15 provenance).
ALTER TABLE tenant_directory_entry_settings
  ADD COLUMN IF NOT EXISTS whatsapp_display boolean,
  ADD COLUMN IF NOT EXISTS whatsapp_number varchar(32);

-- 5. CHECK-constraint sync (migration 275 shipped ('active','inactive') but the
--    app enum is 'active' | 'disabled' | 'revoked' — writes would fail 23514).
--    'inactive' kept in the set so existing rows remain valid on update.
ALTER TABLE whatsapp_channels DROP CONSTRAINT IF EXISTS chk_whatsapp_channels_status;
ALTER TABLE whatsapp_channels
  ADD CONSTRAINT chk_whatsapp_channels_status
  CHECK (status IN ('active', 'inactive', 'disabled', 'revoked'));

COMMIT;

-- =============================================================
-- Verification queries (run manually after applying)
-- =============================================================
-- SELECT key, name FROM features_list WHERE key LIKE 'directory_entry_whatsapp%';
-- SELECT stl.tier_key, tfl.feature_key FROM tier_features_list tfl
--   JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
--   WHERE tfl.feature_key = 'directory_entry_whatsapp_on';
-- \d tenant_directory_entry_settings
