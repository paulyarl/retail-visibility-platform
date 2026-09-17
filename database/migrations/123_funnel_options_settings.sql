-- Migration 123: tenant_funnel_options_settings
-- Merchant preferences for funnel step types (merchant gate).
-- Each toggle controls whether a step type is available in the funnel builder.

CREATE TABLE IF NOT EXISTS tenant_funnel_options_settings (
  id                    VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id             VARCHAR(255) NOT NULL UNIQUE,
  order_bump_enabled    BOOLEAN NOT NULL DEFAULT true,
  upsell_enabled        BOOLEAN NOT NULL DEFAULT true,
  downsell_enabled      BOOLEAN NOT NULL DEFAULT true,
  oto_enabled           BOOLEAN NOT NULL DEFAULT true,
  coupon_offer_enabled  BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_funnel_options_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_funnel_options_tenant ON tenant_funnel_options_settings(tenant_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION trg_funnel_options_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_funnel_options ON tenant_funnel_options_settings;
CREATE TRIGGER set_updated_at_funnel_options
  BEFORE UPDATE ON tenant_funnel_options_settings
  FOR EACH ROW EXECUTE FUNCTION trg_funnel_options_set_updated_at();

-- Row Level Security
ALTER TABLE tenant_funnel_options_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_funnel_options_isolation ON tenant_funnel_options_settings;
CREATE POLICY tenant_funnel_options_isolation ON tenant_funnel_options_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Insert default row for all existing tenants
INSERT INTO tenant_funnel_options_settings (tenant_id)
SELECT id FROM tenants
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_funnel_options_settings WHERE tenant_id = tenants.id
)
ON CONFLICT DO NOTHING;
