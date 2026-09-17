-- Link features to a capability type (plain SQL, no psql variables)
-- Edit the three constants at the top, then run the entire script in one transaction.

-- ============================================================
-- CONFIGURATION (edit these three values)
-- ============================================================
DO $$
DECLARE
  v_capability_type_key  TEXT := 'product_options';
  v_capability_type_name TEXT := 'Product Options';
  -- Array of feature keys in desired display order:
  v_feature_keys         TEXT[] := ARRAY[
    'product_digital',
    'product_physical',
    'product_hybrid',
    'product_flexible',
    'product_enabled',
    'product_disabled',
    'product_variant',
    'product_gallery',
    'product_video',
    'product_layout_classic',
    'product_layout_immersive',
    'product_layout_editorial',
    'product_opt_categories',
    'product_opt_enhanced_seo',
    'product_opt_fulfillment',
    'product_opt_hours_display',
    'product_opt_location_availability',
    'product_opt_location_display',
    'product_opt_map_display',
    'product_opt_qr_codes',
    'product_opt_qr_logo',
    'product_opt_recently_viewed',
    'product_opt_recommended',
    'product_opt_reviews'
  ];

  v_capability_type_id TEXT;
  v_feature_id TEXT;
  v_sort INT;
BEGIN
  -- ============================================================
  -- STEP 1: Upsert capability_type_list
  -- ============================================================
  INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
  VALUES (
    v_capability_type_key,
    v_capability_type_name,
    NULL,
    v_capability_type_key,
    true,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (key) DO UPDATE SET
    name       = EXCLUDED.name,
    updated_at = NOW()
  RETURNING id INTO v_capability_type_id;

  -- If it already existed, grab the id
  IF v_capability_type_id IS NULL THEN
    SELECT id INTO v_capability_type_id
    FROM capability_type_list
    WHERE key = v_capability_type_key;
  END IF;

  -- ============================================================
  -- STEP 2: Delete old capability → feature links
  -- ============================================================
  DELETE FROM capability_features_list
  WHERE capability_type_id = v_capability_type_id;

  -- ============================================================
  -- STEP 3: Re-create links with sort_order
  -- ============================================================
  FOR v_sort IN 1 .. array_length(v_feature_keys, 1) LOOP
    SELECT id INTO v_feature_id
    FROM features_list
    WHERE key = v_feature_keys[v_sort];

    IF v_feature_id IS NOT NULL THEN
      INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
      VALUES (v_capability_type_id, v_feature_id, true, v_sort, NOW(), NOW());
    ELSE
      RAISE NOTICE 'Feature key % not found in features_list — skipped.', v_feature_keys[v_sort];
    END IF;
  END LOOP;

END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT
  ctl.key   AS capability_type,
  fl.key    AS feature_key,
  fl.name   AS feature_name,
  cfl.sort_order
FROM capability_features_list cfl
JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
JOIN features_list fl ON fl.id = cfl.feature_id
WHERE ctl.key = 'product_options'
ORDER BY cfl.sort_order;
