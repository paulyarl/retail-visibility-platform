-- 065_featured_registry_promotional_flags.sql
-- Phase 1: Registry Elevation — Move featured-specific flags into featured_type_registry
-- Eliminates hardcoded type.id === 'featured' checks. All special behavior is data-driven.

-- ============================================================
-- 1. Add 4 promotional columns to featured_type_registry
-- ============================================================

ALTER TABLE featured_type_registry
  ADD COLUMN IF NOT EXISTS requires_tenant_access  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_admin_approval BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_promotional          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotional_priority    INT     NOT NULL DEFAULT 0;

-- ============================================================
-- 2. Seed the 'featured' badge type with promotional flags
-- ============================================================

UPDATE featured_type_registry
  SET requires_tenant_access  = true,
      requires_admin_approval = true,
      is_promotional          = true,
      promotional_priority    = 100,
      updated_at              = now()
  WHERE key = 'featured' AND tenant_id IS NULL;

-- All other system badge types default to false/0 (no change needed).

-- ============================================================
-- 3. Index for querying promotional badge types
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_featured_type_registry_promotional
  ON featured_type_registry (is_promotional, is_active)
  WHERE is_promotional = true AND tenant_id IS NULL;

-- ============================================================
-- 4. Index for ordering by promotional priority
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_featured_type_registry_promo_priority
  ON featured_type_registry (promotional_priority DESC)
  WHERE is_promotional = true AND tenant_id IS NULL;
