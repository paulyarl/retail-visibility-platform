-- Migration: Create tenant_featured_options_settings table
-- Stores per-tenant featured options toggle settings (like product-options pattern)

CREATE TABLE IF NOT EXISTS tenant_featured_options_settings (
  id                       VARCHAR(255) PRIMARY KEY,
  tenant_id                VARCHAR(255) NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  featured_enabled         BOOLEAN DEFAULT true,
  featured_store_selection BOOLEAN DEFAULT true,
  featured_new_arrival     BOOLEAN DEFAULT true,
  featured_seasonal        BOOLEAN DEFAULT true,
  featured_sale            BOOLEAN DEFAULT true,
  featured_staff_pick      BOOLEAN DEFAULT true,
  featured_clearance       BOOLEAN DEFAULT true,
  featured_featured        BOOLEAN DEFAULT true,
  featured_bestseller      BOOLEAN DEFAULT false,
  featured_trending        BOOLEAN DEFAULT false,
  featured_recommended     BOOLEAN DEFAULT false,
  featured_random_featured BOOLEAN DEFAULT false,
  created_at               TIMESTAMP(6) DEFAULT now(),
  updated_at               TIMESTAMP(6) DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_featured_options_tenant ON tenant_featured_options_settings(tenant_id);

-- Enable RLS
ALTER TABLE tenant_featured_options_settings ENABLE ROW LEVEL SECURITY;

-- Tenant can read/write their own settings
CREATE POLICY "Tenant can read own featured options settings"
  ON tenant_featured_options_settings FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY "Tenant can insert own featured options settings"
  ON tenant_featured_options_settings FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY "Tenant can update own featured options settings"
  ON tenant_featured_options_settings FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY "Service role full access to featured options settings"
  ON tenant_featured_options_settings FOR ALL
  USING (current_setting('app.current_role', true) IN ('service_role', 'admin'));
