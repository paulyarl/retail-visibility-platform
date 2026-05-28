-- Create tenant_barcode_scan_settings table
CREATE TABLE IF NOT EXISTS tenant_barcode_scan_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,

  -- Master toggle
  barcode_enabled BOOLEAN DEFAULT true,

  -- Scan modes
  barcode_scan_enabled BOOLEAN DEFAULT true,
  barcode_manual_enabled BOOLEAN DEFAULT true,
  barcode_usb_enabled BOOLEAN DEFAULT false,
  barcode_camera_enabled BOOLEAN DEFAULT false,

  -- Default mode preference
  default_scan_mode VARCHAR(20) DEFAULT 'scan',

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_barcode_scan_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_barcode_scan_tenant ON tenant_barcode_scan_settings(tenant_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_barcode_scan_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_barcode_scan_settings_updated_at
  BEFORE UPDATE ON tenant_barcode_scan_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_barcode_scan_settings_updated_at();
