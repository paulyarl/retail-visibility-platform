-- Create tenant_storefront_type_settings table
CREATE TABLE IF NOT EXISTS tenant_storefront_type_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,

  -- Master toggle
  storefront_type_enabled BOOLEAN DEFAULT true,

  -- Merchant-selected storefront type when tier allows multiple
  selected_storefront_type VARCHAR(20),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_storefront_type_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_storefront_type_tenant ON tenant_storefront_type_settings(tenant_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_storefront_type_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_storefront_type_settings_updated_at
  BEFORE UPDATE ON tenant_storefront_type_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_storefront_type_settings_updated_at();
