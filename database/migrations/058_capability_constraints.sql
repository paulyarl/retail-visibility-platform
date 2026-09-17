-- Migration 058: capability_constraints_list table
-- Cross-Capability Constraint Layer (CCL) Phase 4: DB-driven constraints
-- Replaces hardcoded CAPABILITY_CONSTRAINTS array with DB-driven registry

CREATE TABLE IF NOT EXISTS capability_constraints_list (
  id              TEXT PRIMARY KEY DEFAULT ('ccl-' || gen_random_uuid()::text),
  constraint_id   TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL CHECK (type IN ('requires', 'recommends', 'excludes', 'implies')),
  severity        TEXT NOT NULL CHECK (severity IN ('block', 'warn', 'info')),

  -- Source target
  source_capability  TEXT NOT NULL,
  source_field       TEXT NOT NULL,
  source_operator    TEXT NOT NULL CHECK (source_operator IN ('equals', 'includes', 'not_includes', 'is_true', 'is_false')),
  source_value       TEXT NOT NULL,

  -- Target to check
  target_capability  TEXT NOT NULL,
  target_field       TEXT NOT NULL,
  target_operator    TEXT NOT NULL CHECK (target_operator IN ('equals', 'includes', 'not_includes', 'is_true', 'is_false')),
  target_value       TEXT NOT NULL,

  message         TEXT NOT NULL,
  resolution_hint TEXT NOT NULL,

  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_capability_constraints_active ON capability_constraints_list (is_active);
CREATE INDEX idx_capability_constraints_source ON capability_constraints_list (source_capability);
CREATE INDEX idx_capability_constraints_target ON capability_constraints_list (target_capability);

-- Seed initial constraints (matching the static registry)
INSERT INTO capability_constraints_list (constraint_id, type, severity, source_capability, source_field, source_operator, source_value, target_capability, target_field, target_operator, target_value, message, resolution_hint, sort_order)
VALUES
  (
    'storefront_service_requires_product_service',
    'requires', 'block',
    'storefront', 'effective_type', 'equals', 'service',
    'product_types', 'allowed_types', 'includes', 'service',
    'Service storefront requires Service product type',
    'Enable service product type in your tier or select a different storefront type',
    1
  ),
  (
    'storefront_social_requires_social_commerce',
    'requires', 'block',
    'storefront', 'effective_type', 'equals', 'social',
    'social_commerce_options', 'enabled', 'is_true', 'true',
    'Social storefront requires Social Commerce to be enabled',
    'Enable Social Commerce in your plan or select a different storefront type',
    2
  ),
  (
    'storefront_retail_recommends_product_physical',
    'recommends', 'warn',
    'storefront', 'effective_type', 'equals', 'retail',
    'product_types', 'allowed_types', 'includes', 'physical',
    'Retail storefront works best with Physical products',
    'Consider enabling physical product type for optimal retail storefront functionality',
    3
  ),
  (
    'storefront_online_recommends_product_digital',
    'recommends', 'warn',
    'storefront', 'effective_type', 'equals', 'online',
    'product_types', 'allowed_types', 'includes', 'digital',
    'Online storefront works best with Digital products',
    'Consider enabling digital product type for optimal online storefront functionality',
    4
  ),
  (
    'product_service_recommends_fulfillment_service',
    'recommends', 'warn',
    'product_types', 'effective_type', 'equals', 'service',
    'fulfillment', 'shows_service', 'is_true', 'true',
    'Service products work best with service fulfillment',
    'Consider enabling service fulfillment for optimal service product experience',
    5
  ),
  (
    'product_digital_excludes_fulfillment_shipping',
    'excludes', 'warn',
    'product_types', 'effective_type', 'equals', 'digital',
    'fulfillment', 'shows_shipping', 'is_true', 'true',
    'Digital products typically do not need shipping fulfillment',
    'Consider disabling shipping fulfillment if you only sell digital products',
    6
  )
ON CONFLICT (constraint_id) DO NOTHING;
