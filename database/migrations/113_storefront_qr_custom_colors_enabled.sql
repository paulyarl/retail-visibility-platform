-- 113_storefront_qr_custom_colors_enabled.sql
-- Add qr_custom_colors_enabled boolean to tenant_storefront_qr_settings
-- Mirrors the qr_gradient_enabled pattern: an explicit on/off toggle for custom colors

ALTER TABLE tenant_storefront_qr_settings
  ADD COLUMN IF NOT EXISTS qr_custom_colors_enabled BOOLEAN DEFAULT false;

-- Backfill: set to true for any tenant that already has non-default colors
UPDATE tenant_storefront_qr_settings
  SET qr_custom_colors_enabled = true
  WHERE qr_dot_color IS NOT NULL AND qr_dot_color != '#1a56db'
     OR qr_corner_color IS NOT NULL AND qr_corner_color != '#1a56db'
     OR qr_bg_color IS NOT NULL AND qr_bg_color != '#ffffff';
