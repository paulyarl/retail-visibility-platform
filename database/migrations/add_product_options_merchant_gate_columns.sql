-- Add missing merchant gate columns to tenant_product_options_settings
-- These columns store per-tenant toggles for section features under product_options.
-- The backend route references them but the CREATE TABLE never included them.

ALTER TABLE tenant_product_options_settings
  ADD COLUMN IF NOT EXISTS product_layout character varying(20) DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS product_opt_recently_viewed boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_opt_qr_codes boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_opt_qr_logo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_opt_recommended boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_opt_map_display boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_opt_location_display boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_opt_hours_display boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_opt_enhanced_seo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_opt_reviews boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_opt_fulfillment boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_opt_categories boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_opt_location_availability boolean DEFAULT true;
