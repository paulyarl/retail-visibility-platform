-- Create tenant_fulfillment_settings table
CREATE TABLE IF NOT EXISTS tenant_fulfillment_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  
  -- Pickup settings
  pickup_enabled BOOLEAN DEFAULT true,
  pickup_instructions TEXT,
  pickup_ready_time_minutes INTEGER DEFAULT 120, -- 2 hours default
  
  -- Local delivery settings
  delivery_enabled BOOLEAN DEFAULT false,
  delivery_radius_miles DECIMAL(10, 2),
  delivery_fee_cents INTEGER DEFAULT 0,
  delivery_min_free_cents INTEGER, -- Minimum order for free delivery
  delivery_time_hours INTEGER DEFAULT 24,
  delivery_instructions TEXT,
  
  -- Shipping settings
  shipping_enabled BOOLEAN DEFAULT false,
  shipping_flat_rate_cents INTEGER,
  shipping_zones JSONB DEFAULT '[]'::jsonb,
  shipping_handling_days INTEGER DEFAULT 2,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Foreign key
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fulfillment_tenant ON tenant_fulfillment_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_pickup ON tenant_fulfillment_settings(pickup_enabled);
CREATE INDEX IF NOT EXISTS idx_fulfillment_delivery ON tenant_fulfillment_settings(delivery_enabled);
CREATE INDEX IF NOT EXISTS idx_fulfillment_shipping ON tenant_fulfillment_settings(shipping_enabled);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_fulfillment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fulfillment_settings_updated_at
  BEFORE UPDATE ON tenant_fulfillment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_fulfillment_settings_updated_at();
