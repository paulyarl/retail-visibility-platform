-- ============================================================
-- Product Options Legacy Key Cleanup
--
-- Unlinks 23 legacy feature keys from the product_options capability
-- type and removes their tier_features_list rows. The new canonical
-- keys (product_options_*) have been seeded with identical tier
-- assignments by migration 057, so this is a safe removal.
--
-- Legacy keys being unlinked from product_options:
--   product_enabled, product_disabled, product_flexible,
--   product_variant, product_gallery, product_video,
--   product_layout_enabled, product_layout_classic,
--   product_layout_editorial, product_layout_immersive,
--   product_opt_recently_viewed, product_opt_qr_codes,
--   product_opt_qr_logo, product_opt_recommended,
--   product_opt_map_display, product_opt_location_display,
--   product_opt_hours_display, product_opt_enhanced_seo,
--   product_opt_reviews, product_opt_fulfillment,
--   product_opt_categories, product_opt_location_availability,
--   product_opt_supplier_catalog
--
-- Also unlinks legacy type keys (product_physical, product_digital,
-- product_hybrid, product_service) from product_options. These were
-- superseded by product_types_* keys in migration 057 and are no
-- longer referenced by any resolver or service code.
--
-- Prerequisites: 057_product_types_capability_split.sql
-- Date: 2026-07-05
-- ============================================================

-- ============================================================
-- STEP 1: Unlink legacy feature keys from product_options capability type
-- ============================================================

DELETE FROM capability_features_list
WHERE capability_type_id = (
  SELECT id FROM capability_type_list WHERE key = 'product_options' LIMIT 1
)
AND feature_id IN (
  SELECT id FROM features_list WHERE key IN (
    'product_enabled',
    'product_disabled',
    'product_flexible',
    'product_variant',
    'product_gallery',
    'product_video',
    'product_layout_enabled',
    'product_layout_classic',
    'product_layout_editorial',
    'product_layout_immersive',
    'product_opt_recently_viewed',
    'product_opt_qr_codes',
    'product_opt_qr_logo',
    'product_opt_recommended',
    'product_opt_map_display',
    'product_opt_location_display',
    'product_opt_hours_display',
    'product_opt_enhanced_seo',
    'product_opt_reviews',
    'product_opt_fulfillment',
    'product_opt_categories',
    'product_opt_location_availability',
    'product_opt_supplier_catalog',
    -- Legacy type keys (superseded by product_types_* in 057)
    'product_physical',
    'product_digital',
    'product_hybrid',
    'product_service'
  )
);


-- ============================================================
-- STEP 2: Remove legacy tier_features_list rows for product_options
-- ============================================================
-- Removes all legacy feature key rows linked to the product_options
-- capability type, including legacy type keys (product_physical, etc.)

DELETE FROM tier_features_list
WHERE capability_type_id = (
  SELECT id FROM capability_type_list WHERE key = 'product_options' LIMIT 1
)
AND feature_key IN (
  'product_enabled',
  'product_disabled',
  'product_flexible',
  'product_variant',
  'product_gallery',
  'product_video',
  'product_layout_enabled',
  'product_layout_classic',
  'product_layout_editorial',
  'product_layout_immersive',
  'product_opt_recently_viewed',
  'product_opt_qr_codes',
  'product_opt_qr_logo',
  'product_opt_recommended',
  'product_opt_map_display',
  'product_opt_location_display',
  'product_opt_hours_display',
  'product_opt_enhanced_seo',
  'product_opt_reviews',
  'product_opt_fulfillment',
  'product_opt_categories',
  'product_opt_location_availability',
  'product_opt_supplier_catalog',
  -- Legacy type keys
  'product_physical',
  'product_digital',
  'product_hybrid',
  'product_service'
);


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Verify: should return only product_options_* keys (28 rows)
-- SELECT f.key, f.name FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'product_options'
--   ORDER BY cf.sort_order;

-- Verify: no legacy keys in tier_features_list for product_options
-- SELECT count(*) FROM tier_features_list tf
--   JOIN capability_type_list ct ON ct.id = tf.capability_type_id
--   WHERE ct.key = 'product_options'
--   AND (tf.feature_key LIKE 'product\_opt\_%' OR tf.feature_key IN ('product_physical','product_digital','product_hybrid','product_service'));
-- (should be 0 — all legacy keys removed)

-- Verify: product_types has its canonical keys (not legacy ones)
-- SELECT count(*) FROM tier_features_list tf
--   JOIN capability_type_list ct ON ct.id = tf.capability_type_id
--   WHERE ct.key = 'product_types'
--   AND tf.feature_key IN ('product_types_physical','product_types_digital','product_types_hybrid','product_types_service');
-- (should be > 0)
