-- Migration 070: Demo Tenant Columns
-- Adds is_demo, demo_expires_at, demo_source_tenant_id, demo_template to tenants table
-- for demo tenant infrastructure (Sprint 3.1)
--
-- Design doc: docs/GOOGLE_READINESS_SPRINT_PLAN.md (Sprint 3.1)

-- ============================================================
-- 1. Add demo columns to tenants table
-- ============================================================
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS demo_source_tenant_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS demo_template VARCHAR(50);

-- Index for quickly finding demo tenants that have expired
CREATE INDEX IF NOT EXISTS idx_tenants_demo_expires_at
  ON tenants (demo_expires_at)
  WHERE is_demo = true AND demo_expires_at IS NOT NULL;

-- Index for filtering demo tenants
CREATE INDEX IF NOT EXISTS idx_tenants_is_demo
  ON tenants (is_demo)
  WHERE is_demo = true;

-- ============================================================
-- 2. RLS policies for demo columns (existing tenants RLS applies)
-- ============================================================
-- No new table — columns are on existing tenants table which already has RLS.

COMMENT ON COLUMN tenants.is_demo IS 'Whether this is a demo tenant with pre-populated data and expiration';
COMMENT ON COLUMN tenants.demo_expires_at IS 'When the demo tenant expires (NULL = no expiration)';
COMMENT ON COLUMN tenants.demo_source_tenant_id IS 'If cloned, the source tenant ID';
COMMENT ON COLUMN tenants.demo_template IS 'Template used to create the demo (grocery, convenience, specialty_retail)';
