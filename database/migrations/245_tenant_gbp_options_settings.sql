-- Migration 245: Tenant GBP Options Settings (Merchant Gate Toggles)
--
-- Creates the tenant_gbp_options_settings table for merchant gate toggles:
--   gbp_reviews_display — soft gate for surfacing GBP reviews on public pages
--   gbp_content_display — soft gate for surfacing GBP posts + photos on public pages
--
-- Per the canonical two-gate model:
--   Hard gate: features.gbp_directory_reviews / gbp_directory_content (tier/purchase/grant)
--   Soft gate: merchantPreferences.gbp_reviews_display / gbp_content_display
--
-- Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §6.8
-- Sprint: docs/LocalBiz/GBP_SPRINT_PHASE4.md Task 3

CREATE TABLE IF NOT EXISTS tenant_gbp_options_settings (
  id VARCHAR(50) PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  gbp_reviews_display BOOLEAN DEFAULT true,
  gbp_content_display BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill: existing tenants get default true
INSERT INTO tenant_gbp_options_settings (id, tenant_id)
SELECT 'tgos-' || id, id
FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM tenant_gbp_options_settings)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_tenant_gbp_options_settings_tenant
  ON tenant_gbp_options_settings(tenant_id);
