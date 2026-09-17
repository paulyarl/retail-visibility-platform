-- Migration 067: Quickstart ↔ Storefront Type CCL Constraints
-- Adds two 'recommends' constraints linking storefront type to quickstart capabilities.
-- Idempotent: uses ON CONFLICT DO NOTHING.

INSERT INTO capability_constraints_list (constraint_id, type, severity, source_capability, source_field, source_operator, source_value, target_capability, target_field, target_operator, target_value, message, resolution_hint, sort_order)
VALUES
  (
    'storefront_service_recommends_quickstart_service',
    'recommends',
    'warn',
    'storefront',
    'effective_type',
    'equals',
    'service',
    'quickstart',
    'enabled',
    'is_true',
    'true',
    'Service storefront works best with service-oriented quickstart categories',
    'Use the Service Business type in Category Quick Start for optimal category alignment',
    7
  ),
  (
    'storefront_social_recommends_quickstart_category',
    'recommends',
    'warn',
    'storefront',
    'effective_type',
    'equals',
    'social',
    'quickstart',
    'can_use_category_generator',
    'is_true',
    'true',
    'Social storefront benefits from quickstart categories for product discovery',
    'Enable Category Generator in Quickstart Options and generate fashion/beauty categories',
    8
  )
ON CONFLICT (constraint_id) DO NOTHING;
