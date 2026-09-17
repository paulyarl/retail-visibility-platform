-- ============================================================
-- Seed Built-in Supplier Records
--
-- Seeds all 6 built-in supplier records into the supplier table
-- so they appear immediately in the Admin UI at /settings/admin/suppliers.
--
-- Without this migration, suppliers are only created at runtime via
-- ensureSupplierExists() in the sync jobs, which means:
--   - Open-source suppliers appear 10 min after server start
--   - Commercial suppliers appear 30 min after start AND only if API keys are set
--   - UPC Database and Go-UPC are never seeded (no sync job calls ensureSupplierExists)
--
-- This migration ensures all suppliers are visible immediately.
--
-- Prerequisites: supplier table must exist
-- Date: 2026-07-13
-- ============================================================

INSERT INTO supplier (id, name, connection_type, api_url, api_key_env, active, is_builtin, metadata, created_at, updated_at)
VALUES
  -- Open-source suppliers (always active, no API key needed)
  ('supplier-off-open-food-facts',  'Open Food Facts',    'API', 'https://world.openfoodfacts.org/api/v2',  NULL,                    true, true,  '{"type": "open-source", "category": "food"}',      NOW(), NOW()),
  ('supplier-off-open-beauty-facts','Open Beauty Facts',  'API', 'https://world.openbeautyfacts.org/api/v2', NULL,                    true, true,  '{"type": "open-source", "category": "beauty"}',    NOW(), NOW()),
  ('supplier-off-upc-database',     'UPC Database',       'API', 'https://api.upcdatabase.org/product',      'UPC_DATABASE_API_KEY',  true, true,  '{"type": "open-source", "category": "general"}',   NOW(), NOW()),

  -- Commercial suppliers (active flag set, but API key env vars must be configured for actual lookups)
  ('supplier-off-barcodelookup',    'BarcodeLookup.com',  'API', 'https://api.barcodelookup.com/v3',         'BARCODELOOKUP_API_KEY', false, true, '{"type": "commercial", "category": "general", "note": "Requires paid subscription ($99/mo minimum)"}',    NOW(), NOW()),
  ('supplier-off-goupc',            'Go-UPC',             'API', 'https://go-upc.com/api/v1',                'GOUPC_API_KEY',         true, true,  '{"type": "commercial", "category": "general"}',    NOW(), NOW()),
  ('supplier-off-kroger',           'Kroger Developer API','API', 'https://api.kroger.com/v1',               'KROGER_CLIENT_ID',      true, true,  '{"type": "commercial", "category": "grocery"}',    NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name            = EXCLUDED.name,
  connection_type = EXCLUDED.connection_type,
  api_url         = EXCLUDED.api_url,
  api_key_env     = EXCLUDED.api_key_env,
  is_builtin      = EXCLUDED.is_builtin,
  metadata        = EXCLUDED.metadata,
  updated_at      = NOW();


-- ============================================================
-- VERIFICATION QUERIES (run manually to confirm)
-- ============================================================
-- SELECT id, name, connection_type, api_url, api_key_env, active, is_builtin
-- FROM supplier
-- WHERE is_builtin = true
-- ORDER BY name;
