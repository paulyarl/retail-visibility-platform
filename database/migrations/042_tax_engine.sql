-- Migration 042: Tax Engine - Add tax configuration to tenant_commerce_settings
-- Phase 1A: Sales Tax Engine for Social Commerce Integration

ALTER TABLE tenant_commerce_settings
  ADD COLUMN IF NOT EXISTS tax_enabled          BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_provider         VARCHAR(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manual_tax_rate_percent DECIMAL(5,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_shipping         BOOLEAN      DEFAULT false;

COMMENT ON COLUMN tenant_commerce_settings.tax_enabled IS 'Whether automatic tax calculation is enabled for this tenant';
COMMENT ON COLUMN tenant_commerce_settings.tax_provider IS 'Tax calculation provider: stripe_tax | manual | null';
COMMENT ON COLUMN tenant_commerce_settings.manual_tax_rate_percent IS 'Manual tax rate as decimal (e.g., 0.0825 for 8.25%). Used when tax_provider = manual';
COMMENT ON COLUMN tenant_commerce_settings.tax_shipping IS 'Whether to apply tax to shipping charges';
