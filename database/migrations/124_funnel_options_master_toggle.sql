-- Migration 124: Add master toggles to tenant_funnel_options_settings
-- The merchant master switch lets a tenant enable/disable the funnel capability
-- independently of the tier hard gate.

ALTER TABLE tenant_funnel_options_settings
  ADD COLUMN IF NOT EXISTS funnel_options_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS builder_enabled BOOLEAN NOT NULL DEFAULT true;

-- Ensure all existing rows have the new columns populated.
UPDATE tenant_funnel_options_settings
SET funnel_options_enabled = COALESCE(funnel_options_enabled, true),
    builder_enabled = COALESCE(builder_enabled, true);
