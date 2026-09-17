-- ============================================================
-- Directory Entry Merchant Gate Split Migration
--
-- Creates a dedicated tenant_directory_entry_settings table for
-- directory entry merchant preferences, decoupling from
-- tenant_storefront_options_settings (which used page_type='directory_entry').
--
-- Strategy: ADDITIVE and NON-BREAKING. Old rows in
--           tenant_storefront_options_settings with page_type='directory_entry'
--           are preserved for backward compatibility / rollback.
--           Data is copied (not moved) to the new table.
--           Code is cut over to query the new table with fallback.
--
-- Prerequisites: tenant_storefront_options_settings table must exist
-- Date: 2026-07-14
-- ============================================================


-- ============================================================
-- STEP 1: Create tenant_directory_entry_settings table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_directory_entry_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,

  -- Master toggle
  directory_entry_opt_enabled BOOLEAN DEFAULT true,

  -- Layout choice
  directory_entry_layout VARCHAR(20) DEFAULT 'classic',

  -- Section display toggles (merchant soft gates)
  hours_display BOOLEAN DEFAULT true,
  map_display BOOLEAN DEFAULT true,
  location_display BOOLEAN DEFAULT true,
  storefront_social_media BOOLEAN DEFAULT true,
  storefront_contact BOOLEAN DEFAULT true,
  interactive_maps BOOLEAN DEFAULT true,
  enhanced_seo BOOLEAN DEFAULT false,
  external_link_enabled BOOLEAN DEFAULT false,

  -- Gallery display mode (per-surface merchant pref)
  gallery_display_mode VARCHAR(20) DEFAULT 'carousel',

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_directory_entry_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Index
CREATE INDEX IF NOT EXISTS idx_directory_entry_settings_tenant ON tenant_directory_entry_settings(tenant_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_directory_entry_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_directory_entry_settings_updated_at ON tenant_directory_entry_settings;
CREATE TRIGGER trigger_directory_entry_settings_updated_at
  BEFORE UPDATE ON tenant_directory_entry_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_directory_entry_settings_updated_at();

-- Enable RLS
ALTER TABLE tenant_directory_entry_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenants can only see their own row
DROP POLICY IF EXISTS tenant_directory_entry_isolation ON tenant_directory_entry_settings;
CREATE POLICY tenant_directory_entry_isolation ON tenant_directory_entry_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ============================================================
-- STEP 2: Migrate existing directory entry merchant prefs
--         from tenant_storefront_options_settings
-- ============================================================

INSERT INTO tenant_directory_entry_settings (
  id, tenant_id,
  directory_entry_opt_enabled,
  directory_entry_layout,
  hours_display,
  map_display,
  location_display,
  storefront_social_media,
  storefront_contact,
  interactive_maps,
  enhanced_seo,
  external_link_enabled,
  gallery_display_mode,
  created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  tso.tenant_id,
  COALESCE(tso.storefront_opt_enabled, true),
  COALESCE(tso.directory_entry_layout, 'classic'),
  COALESCE(tso.hours_display, true),
  COALESCE(tso.map_display, true),
  COALESCE(tso.location_display, true),
  COALESCE(tso.storefront_social_media, true),
  COALESCE(tso.storefront_contact, true),
  COALESCE(tso.interactive_maps, true),
  COALESCE(tso.enhanced_seo, false),
  COALESCE(tso.external_link_enabled, false),
  COALESCE(tso.gallery_display_mode, 'carousel'),
  tso.created_at,
  tso.updated_at
FROM tenant_storefront_options_settings tso
WHERE tso.page_type = 'directory_entry'
ON CONFLICT (tenant_id) DO NOTHING;

-- NOTE: Old rows in tenant_storefront_options_settings with page_type='directory_entry'
-- are intentionally preserved for backward compatibility and rollback safety.
-- They can be cleaned up in a future migration once the new table is confirmed stable.


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Verify table exists
-- SELECT count(*) FROM tenant_directory_entry_settings;

-- Verify data migration
-- SELECT des.tenant_id, des.directory_entry_opt_enabled, des.directory_entry_layout,
--        des.hours_display, des.map_display, des.external_link_enabled, des.gallery_display_mode
-- FROM tenant_directory_entry_settings des
-- LIMIT 10;

-- Verify row count matches old table
-- SELECT
--   (SELECT count(*) FROM tenant_directory_entry_settings) AS new_table_count,
--   (SELECT count(*) FROM tenant_storefront_options_settings WHERE page_type = 'directory_entry') AS old_table_count;
