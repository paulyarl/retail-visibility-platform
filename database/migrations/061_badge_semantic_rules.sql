-- ============================================================
-- Migration 061: Badge Semantic Rules
-- Phase 1: Add auto_assign_rule, auto_remove_rule, conflict_with
-- to existing featured_type_registry entries.
-- ============================================================

-- 1. Update 'sale' badge with auto-assign/remove rules
UPDATE featured_type_registry
SET
  auto_assign_rule = '{"condition":"and","rules":[{"field":"sale_price_cents","op":"isNotNull"},{"field":"sale_price_cents","op":"lt","fieldRef":"price_cents"}]}'::jsonb,
  auto_remove_rule = '{"condition":"or","rules":[{"field":"sale_price_cents","op":"isNull"},{"field":"sale_price_cents","op":"gte","fieldRef":"price_cents"}]}'::jsonb,
  conflict_with = ARRAY['clearance']::text[],
  updated_at = now()
WHERE key = 'sale' AND tenant_id IS NULL;

-- 2. Update 'new_arrival' badge with auto-assign/remove rules
UPDATE featured_type_registry
SET
  auto_assign_rule = '{"condition":"and","rules":[{"field":"created_at","op":"gte","value":{"daysAgo":14}}]}'::jsonb,
  auto_remove_rule = '{"condition":"and","rules":[{"field":"created_at","op":"lt","value":{"daysAgo":30}}]}'::jsonb,
  conflict_with = ARRAY['clearance']::text[],
  updated_at = now()
WHERE key = 'new_arrival' AND tenant_id IS NULL;

-- 3. Update 'clearance' badge with auto-assign/remove rules
UPDATE featured_type_registry
SET
  auto_assign_rule = '{"condition":"or","rules":[{"field":"sale_price_cents","op":"isNotNull"},{"field":"sale_price_cents","op":"lt","fieldRef":"price_cents","factor":0.5},{"field":"stock","op":"lte","value":3}]}'::jsonb,
  auto_remove_rule = '{"condition":"and","rules":[{"field":"stock","op":"eq","value":0}]}'::jsonb,
  conflict_with = ARRAY['sale','new_arrival','seasonal']::text[],
  updated_at = now()
WHERE key = 'clearance' AND tenant_id IS NULL;

-- 4. Update 'seasonal' badge with auto-assign rule (manual remove only)
UPDATE featured_type_registry
SET
  auto_assign_rule = '{"condition":"manual","note":"Seasonal badges are manually assigned with optional date window via featured_expires_at"}'::jsonb,
  auto_remove_rule = null,
  conflict_with = ARRAY[]::text[],
  updated_at = now()
WHERE key = 'seasonal' AND tenant_id IS NULL;

-- 5. Update 'staff_pick' — manual only, no auto rules, no conflicts
UPDATE featured_type_registry
SET
  auto_assign_rule = null,
  auto_remove_rule = null,
  conflict_with = ARRAY[]::text[],
  updated_at = now()
WHERE key = 'staff_pick' AND tenant_id IS NULL;

-- 6. Update 'store_selection' — manual only, no conflicts
UPDATE featured_type_registry
SET
  auto_assign_rule = null,
  auto_remove_rule = null,
  conflict_with = ARRAY[]::text[],
  updated_at = now()
WHERE key = 'store_selection' AND tenant_id IS NULL;

-- 7. Update 'featured' — manual only, no conflicts
UPDATE featured_type_registry
SET
  auto_assign_rule = null,
  auto_remove_rule = null,
  conflict_with = ARRAY[]::text[],
  updated_at = now()
WHERE key = 'featured' AND tenant_id IS NULL;

-- 8. Platform-controlled types — no auto-assign rules (handled by syncPlatformTypes job)
UPDATE featured_type_registry
SET
  auto_assign_rule = null,
  auto_remove_rule = null,
  conflict_with = ARRAY[]::text[],
  updated_at = now()
WHERE key IN ('bestseller','trending','recommended','random_featured') AND tenant_id IS NULL;
