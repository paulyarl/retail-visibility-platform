-- ============================================================
-- Product Types Multi-Select Migration
--
-- Changes product type selection from single-select (radio) to
-- multi-select (checkboxes). A tenant can now offer multiple
-- product types simultaneously (e.g., both physical and digital).
--
-- Storefront type remains single-select (only one storefront displayed).
--
-- Strategy: ADDITIVE and NON-BREAKING.
--   - New column selected_product_types (TEXT[]) added alongside
--     existing selected_product_type (VARCHAR) for backward compat.
--   - CCL constraints updated to check effective_types (array) with
--     'includes' operator instead of effective_type (scalar) with 'equals'.
--
-- Prerequisites: 057_product_types_capability_split.sql, 058_capability_constraints.sql
-- Date: 2026-06-26
-- ============================================================


-- ============================================================
-- STEP 1: Add selected_product_types array column
-- ============================================================

ALTER TABLE tenant_product_types_settings
  ADD COLUMN IF NOT EXISTS selected_product_types TEXT[] DEFAULT ARRAY['physical']::TEXT[];


-- ============================================================
-- STEP 2: Migrate existing selected_product_type into array
-- ============================================================

UPDATE tenant_product_types_settings
SET selected_product_types = ARRAY[selected_product_type]
WHERE selected_product_type IS NOT NULL
  AND selected_product_type <> 'none'
  AND selected_product_types IS NULL;


-- ============================================================
-- STEP 3: Update CCL constraints to use effective_types/includes
-- ============================================================
-- The two constraints that referenced product_types.effective_type
-- with 'equals' operator now use effective_types with 'includes'
-- so they fire when the selected set includes the relevant type.

UPDATE capability_constraints_list
SET source_field = 'effective_types',
    source_operator = 'includes'
WHERE constraint_id = 'product_service_recommends_fulfillment_service'
  AND source_field = 'effective_type'
  AND source_operator = 'equals';

UPDATE capability_constraints_list
SET source_field = 'effective_types',
    source_operator = 'includes'
WHERE constraint_id = 'product_digital_excludes_fulfillment_shipping'
  AND source_field = 'effective_type'
  AND source_operator = 'equals';
