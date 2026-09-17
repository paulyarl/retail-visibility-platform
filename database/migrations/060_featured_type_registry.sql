-- 060_featured_type_registry.sql
-- Phase 0: Badge Registry — Data-driven badge type definitions
-- Replaces hardcoded arrays/switch statements across 12+ files with a single registry table.

-- ============================================================
-- 1. featured_type_registry table
-- ============================================================

CREATE TABLE IF NOT EXISTS featured_type_registry (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = system/global badge
  key               VARCHAR(50) NOT NULL,
  label             VARCHAR(100) NOT NULL,
  description       TEXT,
  group_type        VARCHAR(20) NOT NULL DEFAULT 'tenant',   -- 'tenant' | 'platform'
  icon              VARCHAR(50),
  color             VARCHAR(20),
  priority          INT NOT NULL DEFAULT 50,
  sort_order        INT NOT NULL DEFAULT 0,
  is_system         BOOLEAN NOT NULL DEFAULT true,           -- true for built-in, false for custom
  is_active         BOOLEAN NOT NULL DEFAULT true,
  auto_assign_rule  JSONB,                                   -- nullable, declarative rule for auto-assignment
  auto_remove_rule  JSONB,                                   -- nullable, declarative rule for auto-removal
  conflict_with     TEXT[],                                  -- nullable, keys of conflicting badges
  created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, key)  -- system badges have tenant_id NULL; custom badges have tenant_id set
);

-- Index for querying system badges (tenant_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_featured_type_registry_system
  ON featured_type_registry (is_active, sort_order)
  WHERE tenant_id IS NULL;

-- Index for querying tenant badges (system + custom for a specific tenant)
CREATE INDEX IF NOT EXISTS idx_featured_type_registry_tenant
  ON featured_type_registry (tenant_id, is_active, sort_order);

-- Index for looking up by key
CREATE INDEX IF NOT EXISTS idx_featured_type_registry_key
  ON featured_type_registry (key);

-- ============================================================
-- 2. Seed 11 system badge types
-- ============================================================

INSERT INTO featured_type_registry (tenant_id, key, label, description, group_type, icon, color, priority, sort_order, is_system, is_active)
VALUES
  -- Tenant-controlled (sort_order 1-7)
  (NULL, 'store_selection', 'Store Selection', 'Hand-picked by the store owner', 'tenant', '🏪', 'blue',    50, 1, true, true),
  (NULL, 'new_arrival',     'New Arrival',     'Recently added products',         'tenant', '🆕', 'green',   50, 2, true, true),
  (NULL, 'seasonal',        'Seasonal',        'Seasonal or holiday products',     'tenant', '🎄', 'orange',  50, 3, true, true),
  (NULL, 'sale',            'Sale',            'Products currently on sale',       'tenant', '🏷️', 'red',     50, 4, true, true),
  (NULL, 'staff_pick',      'Staff Pick',      'Recommended by store staff',       'tenant', '👍', 'purple',  50, 5, true, true),
  (NULL, 'clearance',       'Clearance',       'Final sale, while supplies last',  'tenant', '🧹', 'amber',   50, 6, true, true),
  (NULL, 'featured',        'Featured',        'General featured products',        'tenant', '⭐', 'yellow',  50, 7, true, true),
  -- Platform-controlled (sort_order 8-11)
  (NULL, 'bestseller',      'Bestseller',      'Top-selling products across the platform', 'platform', '🏆', 'gold',    50, 8,  true, true),
  (NULL, 'trending',        'Trending',        'Gaining popularity right now',             'platform', '📈', 'teal',    50, 9,  true, true),
  (NULL, 'recommended',     'Recommended',     'Personalized recommendations',             'platform', '💡', 'indigo',  50, 10, true, true),
  (NULL, 'random_featured', 'Random Featured', 'Randomly selected featured products',       'platform', '🎲', 'pink',    50, 11, true, true)
ON CONFLICT (tenant_id, key) DO NOTHING;

-- ============================================================
-- 3. Extend featured_products table
-- ============================================================

ALTER TABLE featured_products
  ADD COLUMN IF NOT EXISTS assignment_source VARCHAR(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS rule_evaluated_at TIMESTAMPTZ(6);

-- Index for filtering auto-assigned badges that need re-evaluation
CREATE INDEX IF NOT EXISTS idx_featured_products_assignment_source
  ON featured_products (tenant_id, assignment_source, is_active)
  WHERE assignment_source = 'auto';

-- Add check constraint for assignment_source values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_featured_products_assignment_source'
  ) THEN
    ALTER TABLE featured_products
      ADD CONSTRAINT chk_featured_products_assignment_source
      CHECK (assignment_source IN ('auto', 'manual', 'system'));
  END IF;
END $$;
