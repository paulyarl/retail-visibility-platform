-- ============================================================
-- Storefront Options Feature Optimization (38→18)
--
-- Adds 6 new consolidated feature keys to features_list,
-- re-links storefront_options capability type with the 18 optimized keys,
-- and copies tier assignments from old keys to new keys.
--
-- Strategy: ADDITIVE and NON-BREAKING. Old feature keys remain in
--           features_list and tier_features_list. Resolvers check new
--           keys first, then fall back to old keys.
--
-- Prerequisites: features_list, capability_type_list, capability_features_list,
--                tier_features_list, subscription_tiers_list tables must exist
-- Date: 2026-07-15
-- ============================================================


-- ============================================================
-- STEP 1: Insert new consolidated feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('storefront_opt_info',         'Store Information',     'Consolidated: social media, contact, interactive maps, map & location display', 'storefront_options', true, 30, NOW(), NOW()),
  ('storefront_opt_qr',           'QR Code Display',       'QR code group gate — enables all QR resolution and content features',           'storefront_options', true, 40, NOW(), NOW()),
  ('storefront_opt_qr_resolution','QR Resolution',         'Consolidated: QR code resolution (512/1024/2048 via merchant pref)',           'storefront_options', true, 41, NOW(), NOW()),
  ('storefront_opt_qr_content',   'QR Content Types',      'Consolidated: QR content types (product/store/logo/directory via merchant prefs)', 'storefront_options', true, 42, NOW(), NOW()),
  ('storefront_opt_gallery',      'Gallery Display',       'Consolidated: gallery image limit (5/10/15 via merchant pref)',                'storefront_options', true, 50, NOW(), NOW()),
  ('storefront_opt_layout',       'Storefront Layout',     'Consolidated: storefront layout (classic/editorial/immersive via merchant pref)', 'storefront_options', true, 60, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 2: Re-link storefront_options capability type with 18 optimized features
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'storefront_options';
  v_feature_keys         TEXT[] := ARRAY[
    -- Master gates
    'storefront_opt_enabled',
    'storefront_opt_flexible',
    -- Hours
    'storefront_opt_hours_display',
    'storefront_opt_hours_animated',
    'storefront_opt_hours_status',
    -- Category
    'storefront_opt_category_store',
    'storefront_opt_category_product',
    -- Recommend
    'storefront_opt_recommend_store',
    'storefront_opt_recommend_products',
    -- Behavior
    'storefront_opt_recently_viewed',
    -- Info (consolidated)
    'storefront_opt_info',
    -- QR (consolidated)
    'storefront_opt_qr',
    'storefront_opt_qr_resolution',
    'storefront_opt_qr_content',
    -- Gallery (consolidated)
    'storefront_opt_gallery',
    -- Advanced
    'storefront_opt_enhanced_seo',
    'storefront_opt_storefront_actions',
    -- Layout (consolidated)
    'storefront_opt_layout'
  ];
  v_capability_type_id TEXT;
  v_missing_keys       TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  IF v_capability_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type % not found', v_capability_type_key;
  END IF;

  -- Remove old feature links that are not in the new 18-key set
  DELETE FROM capability_features_list
  WHERE capability_type_id = v_capability_type_id
    AND feature_id NOT IN (
      SELECT id FROM features_list WHERE key = ANY(v_feature_keys)
    );

  -- Insert/update links for the 18 optimized features
  FOR i IN 1 .. array_length(v_feature_keys, 1) LOOP
    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    SELECT v_capability_type_id, fl.id, true, i, NOW(), NOW()
    FROM features_list fl
    WHERE fl.key = v_feature_keys[i]
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET is_active = true, sort_order = i;

    IF NOT FOUND THEN
      v_missing_keys := array_append(v_missing_keys, v_feature_keys[i]);
      RAISE NOTICE 'Feature key not found in features_list: %', v_feature_keys[i];
    END IF;
  END LOOP;

  IF array_length(v_missing_keys, 1) > 0 THEN
    RAISE NOTICE 'Missing feature keys (skipped): %', v_missing_keys;
  END IF;

  RAISE NOTICE 'Linked % features to capability type %', array_length(v_feature_keys, 1) - COALESCE(array_length(v_missing_keys, 1), 0), v_capability_type_key;
END $$;


-- ============================================================
-- STEP 3: Copy tier assignments from old keys to new consolidated keys
-- ============================================================
-- For each new key, if a tier has ANY of the old source keys enabled,
-- enable the new key for that tier.

DO $$
DECLARE
  v_cap_type_id TEXT;
  v_tier_id     TEXT;
  v_tier_key    TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'storefront_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type storefront_options not found';
  END IF;

  -- ── storefront_opt_info ← info_enabled, storefront_social_media, storefront_contact, interactive_maps, map_display, location_display ──
  FOR v_tier_id IN
    SELECT DISTINCT tfl.tier_id
    FROM tier_features_list tfl
    WHERE tfl.feature_key IN (
      'storefront_opt_info_enabled',
      'storefront_opt_storefront_social_media',
      'storefront_opt_storefront_contact',
      'storefront_opt_interactive_maps',
      'storefront_opt_map_display',
      'storefront_opt_location_display'
    ) AND tfl.is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_opt_info', 'Store Information', true, false, '{"capability_type": "storefront_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- ── storefront_opt_qr ← qr_enabled ──
  FOR v_tier_id IN
    SELECT DISTINCT tfl.tier_id
    FROM tier_features_list tfl
    WHERE tfl.feature_key = 'storefront_opt_qr_enabled' AND tfl.is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_opt_qr', 'QR Code Display', true, false, '{"capability_type": "storefront_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- ── storefront_opt_qr_resolution ← qr_codes_512, qr_codes_1024, qr_codes_2048 ──
  FOR v_tier_id IN
    SELECT DISTINCT tfl.tier_id
    FROM tier_features_list tfl
    WHERE tfl.feature_key IN ('storefront_opt_qr_codes_512', 'storefront_opt_qr_codes_1024', 'storefront_opt_qr_codes_2048')
      AND tfl.is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_opt_qr_resolution', 'QR Resolution', true, false, '{"capability_type": "storefront_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- ── storefront_opt_qr_content ← qr_product, qr_store, qr_logo, qr_directory ──
  FOR v_tier_id IN
    SELECT DISTINCT tfl.tier_id
    FROM tier_features_list tfl
    WHERE tfl.feature_key IN ('storefront_opt_qr_product', 'storefront_opt_qr_store', 'storefront_opt_qr_logo', 'storefront_opt_qr_directory')
      AND tfl.is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_opt_qr_content', 'QR Content Types', true, false, '{"capability_type": "storefront_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- ── storefront_opt_gallery ← gallery_enabled, image_gallery_5, image_gallery_10, image_gallery_15 ──
  FOR v_tier_id IN
    SELECT DISTINCT tfl.tier_id
    FROM tier_features_list tfl
    WHERE tfl.feature_key IN ('storefront_opt_gallery_enabled', 'storefront_opt_image_gallery_5', 'storefront_opt_image_gallery_10', 'storefront_opt_image_gallery_15')
      AND tfl.is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_opt_gallery', 'Gallery Display', true, false, '{"capability_type": "storefront_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- ── storefront_opt_layout ← layout_enabled, layout_classic, layout_editorial, layout_immersive ──
  FOR v_tier_id IN
    SELECT DISTINCT tfl.tier_id
    FROM tier_features_list tfl
    WHERE tfl.feature_key IN ('storefront_opt_layout_enabled', 'storefront_opt_layout_classic', 'storefront_opt_layout_editorial', 'storefront_opt_layout_immersive')
      AND tfl.is_enabled = true
  LOOP
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'storefront_opt_layout', 'Storefront Layout', true, false, '{"capability_type": "storefront_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Tier assignments copied from old keys to new consolidated keys';
END $$;


-- ============================================================
-- STEP 4: Verification queries (run manually to confirm)
-- ============================================================
-- SELECT ctl.key AS capability_type, fl.key AS feature_key, fl.name AS feature_name, cfl.sort_order
-- FROM capability_features_list cfl
-- JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
-- JOIN features_list fl ON fl.id = cfl.feature_id
-- WHERE ctl.key = 'storefront_options'
-- ORDER BY cfl.sort_order;

-- SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
-- FROM tier_features_list tfl
-- JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
-- WHERE tfl.feature_key LIKE 'storefront_opt_%'
--   AND tfl.feature_key IN ('storefront_opt_info','storefront_opt_qr','storefront_opt_qr_resolution','storefront_opt_qr_content','storefront_opt_gallery','storefront_opt_layout')
-- ORDER BY stl.sort_order, tfl.feature_key;
