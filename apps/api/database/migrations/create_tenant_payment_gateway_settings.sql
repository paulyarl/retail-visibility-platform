-- Migration: Create tenant_payment_gateway_settings table
-- Stores per-tenant payment gateway merchant preferences (enable/disable per gateway type)
-- Tier capability is the hard gate; merchant preference is the soft toggle on top

CREATE TABLE IF NOT EXISTS tenant_payment_gateway_settings (
  id                VARCHAR(255) PRIMARY KEY,
  tenant_id         VARCHAR(255) NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  gateway_enabled   BOOLEAN DEFAULT true,       -- Master switch for payment gateway capability
  stripe_enabled    BOOLEAN DEFAULT true,       -- Merchant can disable Stripe even if tier allows
  paypal_enabled    BOOLEAN DEFAULT true,       -- Merchant can disable PayPal even if tier allows
  square_enabled    BOOLEAN DEFAULT true,       -- Merchant can disable Square even if tier allows
  clover_enabled    BOOLEAN DEFAULT true,       -- Merchant can disable Clover even if tier allows
  created_at        TIMESTAMP(6) DEFAULT now(),
  updated_at        TIMESTAMP(6) DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_gateway_settings_tenant ON tenant_payment_gateway_settings(tenant_id);

-- Enable RLS
ALTER TABLE tenant_payment_gateway_settings ENABLE ROW LEVEL SECURITY;

-- Tenant can read/write their own settings
CREATE POLICY "Tenant can read own payment gateway settings"
  ON tenant_payment_gateway_settings FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY "Tenant can insert own payment gateway settings"
  ON tenant_payment_gateway_settings FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY "Tenant can update own payment gateway settings"
  ON tenant_payment_gateway_settings FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY "Service role full access to payment gateway settings"
  ON tenant_payment_gateway_settings FOR ALL
  USING (current_setting('app.current_role', true) IN ('service_role', 'admin'));
