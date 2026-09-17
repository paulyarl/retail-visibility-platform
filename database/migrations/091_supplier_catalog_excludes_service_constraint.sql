-- Migration 091: Supplier Catalog excludes Service Product Type constraint
-- Adds a cross-capability constraint that blocks supplier catalog import
-- when service product type is enabled (and vice versa).
-- Supplier catalog items are physical goods; service products are intangible.
-- Combining them is illogical.
-- Idempotent: uses ON CONFLICT DO NOTHING.

INSERT INTO capability_constraints_list (constraint_id, type, severity, source_capability, source_field, source_operator, source_value, target_capability, target_field, target_operator, target_value, message, resolution_hint, sort_order)
VALUES
  (
    'supplier_catalog_excludes_service_product',
    'excludes',
    'block',
    'product_options',
    'effective_shows_supplier_catalog',
    'is_true',
    'true',
    'product_types',
    'effective_types',
    'includes',
    'service',
    'Supplier catalog import is not available when service product type is enabled',
    'Disable service product type in your product types settings to use supplier catalog import, or disable supplier catalog import to use service products',
    9
  )
ON CONFLICT (constraint_id) DO NOTHING;
