-- ============================================================
-- Migration 077: Cleanup duplicate supplier records
--
-- The sync job (supplier-opensource-sync.ts) used IDs without the
-- 'off-' prefix (e.g. 'supplier-open-food-facts') while migration 070
-- seeded with 'supplier-off-open-food-facts'. This caused the
-- ensureSupplierExists() upsert to create duplicate supplier rows.
--
-- This migration:
-- 1. Moves catalog items, mappings, and quarantine rows from the
--    duplicate (wrong-ID) suppliers to the correct (migration 070) suppliers.
-- 2. Deletes the duplicate supplier rows.
--
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Open Food Facts: move from 'supplier-open-food-facts' → 'supplier-off-open-food-facts'
DO $$
BEGIN
  -- Move supplier_catalog_item rows
  UPDATE supplier_catalog_item
  SET supplier_id = 'supplier-off-open-food-facts'
  WHERE supplier_id = 'supplier-open-food-facts'
    AND EXISTS (SELECT 1 FROM supplier WHERE id = 'supplier-off-open-food-facts');

  -- Move supplier_mapping rows (skip any that would violate the unique constraint)
  DELETE FROM supplier_mapping
  WHERE supplier_id = 'supplier-open-food-facts'
    AND EXISTS (
      SELECT 1 FROM supplier_mapping m2
      WHERE m2.tenant_id = supplier_mapping.tenant_id
        AND m2.supplier_id = 'supplier-off-open-food-facts'
        AND m2.supplier_sku = supplier_mapping.supplier_sku
    );

  UPDATE supplier_mapping
  SET supplier_id = 'supplier-off-open-food-facts'
  WHERE supplier_id = 'supplier-open-food-facts'
    AND EXISTS (SELECT 1 FROM supplier WHERE id = 'supplier-off-open-food-facts');

  -- Move catalog_quarantine rows
  UPDATE catalog_quarantine
  SET supplier_id = 'supplier-off-open-food-facts'
  WHERE supplier_id = 'supplier-open-food-facts'
    AND EXISTS (SELECT 1 FROM supplier WHERE id = 'supplier-off-open-food-facts');

  -- Delete the duplicate supplier
  DELETE FROM supplier WHERE id = 'supplier-open-food-facts';
END $$;

-- Open Beauty Facts: move from 'supplier-open-beauty-facts' → 'supplier-off-open-beauty-facts'
DO $$
BEGIN
  -- Move supplier_catalog_item rows
  UPDATE supplier_catalog_item
  SET supplier_id = 'supplier-off-open-beauty-facts'
  WHERE supplier_id = 'supplier-open-beauty-facts'
    AND EXISTS (SELECT 1 FROM supplier WHERE id = 'supplier-off-open-beauty-facts');

  -- Move supplier_mapping rows (skip any that would violate the unique constraint)
  DELETE FROM supplier_mapping
  WHERE supplier_id = 'supplier-open-beauty-facts'
    AND EXISTS (
      SELECT 1 FROM supplier_mapping m2
      WHERE m2.tenant_id = supplier_mapping.tenant_id
        AND m2.supplier_id = 'supplier-off-open-beauty-facts'
        AND m2.supplier_sku = supplier_mapping.supplier_sku
    );

  UPDATE supplier_mapping
  SET supplier_id = 'supplier-off-open-beauty-facts'
  WHERE supplier_id = 'supplier-open-beauty-facts'
    AND EXISTS (SELECT 1 FROM supplier WHERE id = 'supplier-off-open-beauty-facts');

  -- Move catalog_quarantine rows
  UPDATE catalog_quarantine
  SET supplier_id = 'supplier-off-open-beauty-facts'
  WHERE supplier_id = 'supplier-open-beauty-facts'
    AND EXISTS (SELECT 1 FROM supplier WHERE id = 'supplier-off-open-beauty-facts');

  -- Delete the duplicate supplier
  DELETE FROM supplier WHERE id = 'supplier-open-beauty-facts';
END $$;

-- Also clean up 'supplier-upc-database' if it was ever created by mistake
DO $$
BEGIN
  UPDATE supplier_catalog_item
  SET supplier_id = 'supplier-off-upc-database'
  WHERE supplier_id = 'supplier-upc-database'
    AND EXISTS (SELECT 1 FROM supplier WHERE id = 'supplier-off-upc-database');

  UPDATE supplier_mapping
  SET supplier_id = 'supplier-off-upc-database'
  WHERE supplier_id = 'supplier-upc-database'
    AND EXISTS (SELECT 1 FROM supplier WHERE id = 'supplier-off-upc-database');

  UPDATE catalog_quarantine
  SET supplier_id = 'supplier-off-upc-database'
  WHERE supplier_id = 'supplier-upc-database'
    AND EXISTS (SELECT 1 FROM supplier WHERE id = 'supplier-off-upc-database');

  DELETE FROM supplier WHERE id = 'supplier-upc-database';
END $$;

-- ============================================================
-- Done
-- ============================================================
