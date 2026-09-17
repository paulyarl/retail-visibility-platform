-- ============================================================
-- Storefront Options: QR Style Feature Keys
--
-- Seeds feature keys for the QR Style group within the
-- storefront_options capability type. The resolver logic in
-- StorefrontOptionsResolver.ts and CapabilityResolutionService.ts
-- already reference these keys — this migration makes them
-- visible in the Admin UI and available for tier assignment.
--
-- Prerequisites: features_list, capability_type_list,
--                capability_features_list must exist
-- Date: 2026-07-12
-- ============================================================


-- ============================================================
-- STEP 1: Insert QR Style feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  -- Group gate (styled QR master switch)
  ('storefront_opt_qr_styled',            'QR Styled Renderer',        'Group gate — enables styled QR code rendering with custom dot/corner styles and colors', 'storefront_options', true, 43, NOW(), NOW()),
  ('storefront_opt_qr_styled_on',         'QR Styled (On)',            'Group ON gate for QR styled renderer',                                                  'storefront_options', true, 43, NOW(), NOW()),
  ('storefront_opt_qr_styled_off',        'QR Styled (Off)',           'Group OFF gate for QR styled renderer',                                                 'storefront_options', true, 43, NOW(), NOW()),
  ('storefront_opt_qr_styled_enabled',    'QR Styled (Legacy Enabled)','Legacy enabled gate for QR styled renderer (alias for _on)',                            'storefront_options', true, 43, NOW(), NOW()),
  ('storefront_opt_qr_styled_disabled',   'QR Styled (Disabled)',      'Master disabled gate for QR styled renderer',                                           'storefront_options', true, 43, NOW(), NOW()),

  -- Dot styles subgroup
  ('storefront_opt_qr_dot_styles',        'QR Dot Styles (All)',       'Subgroup gate — unlocks all QR dot styles',                                             'storefront_options', true, 44, NOW(), NOW()),
  ('storefront_opt_qr_dot_styles_on',     'QR Dot Styles (On)',        'Subgroup ON gate for QR dot styles',                                                    'storefront_options', true, 44, NOW(), NOW()),
  ('storefront_opt_qr_dot_rounded',       'QR Dot: Rounded',           'Rounded dot style for QR codes',                                                        'storefront_options', true, 45, NOW(), NOW()),
  ('storefront_opt_qr_dot_dots',          'QR Dot: Dots',              'Dots dot style for QR codes',                                                           'storefront_options', true, 45, NOW(), NOW()),
  ('storefront_opt_qr_dot_classy',        'QR Dot: Classy',            'Classy dot style for QR codes',                                                         'storefront_options', true, 45, NOW(), NOW()),
  ('storefront_opt_qr_dot_classy_rounded','QR Dot: Classy Rounded',    'Classy-rounded dot style for QR codes',                                                 'storefront_options', true, 45, NOW(), NOW()),
  ('storefront_opt_qr_dot_extra_rounded', 'QR Dot: Extra Rounded',     'Extra-rounded dot style for QR codes',                                                  'storefront_options', true, 45, NOW(), NOW()),

  -- Corner styles subgroup
  ('storefront_opt_qr_corner_styles',         'QR Corner Styles (All)',     'Subgroup gate — unlocks all QR corner square styles',                          'storefront_options', true, 46, NOW(), NOW()),
  ('storefront_opt_qr_corner_styles_on',      'QR Corner Styles (On)',      'Subgroup ON gate for QR corner styles',                                        'storefront_options', true, 46, NOW(), NOW()),
  ('storefront_opt_qr_corner_dot',            'QR Corner: Dot',             'Dot corner square style for QR codes',                                         'storefront_options', true, 47, NOW(), NOW()),
  ('storefront_opt_qr_corner_extra_rounded',  'QR Corner: Extra Rounded',   'Extra-rounded corner square style for QR codes',                               'storefront_options', true, 47, NOW(), NOW()),
  ('storefront_opt_qr_corner_rounded',        'QR Corner: Rounded',         'Rounded corner square style for QR codes',                                     'storefront_options', true, 47, NOW(), NOW()),

  -- Additional style features
  ('storefront_opt_qr_custom_colors',     'QR Custom Colors',           'Allow custom foreground/background colors for QR codes',                                 'storefront_options', true, 48, NOW(), NOW()),
  ('storefront_opt_qr_gradients',         'QR Gradients',               'Allow gradient fills for QR code dots and corners',                                      'storefront_options', true, 48, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 2: Link feature keys to storefront_options capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'storefront_options';
  v_feature_keys         TEXT[] := ARRAY[
    'storefront_opt_qr_styled',
    'storefront_opt_qr_styled_on',
    'storefront_opt_qr_styled_off',
    'storefront_opt_qr_styled_enabled',
    'storefront_opt_qr_styled_disabled',
    'storefront_opt_qr_dot_styles',
    'storefront_opt_qr_dot_styles_on',
    'storefront_opt_qr_dot_rounded',
    'storefront_opt_qr_dot_dots',
    'storefront_opt_qr_dot_classy',
    'storefront_opt_qr_dot_classy_rounded',
    'storefront_opt_qr_dot_extra_rounded',
    'storefront_opt_qr_corner_styles',
    'storefront_opt_qr_corner_styles_on',
    'storefront_opt_qr_corner_dot',
    'storefront_opt_qr_corner_extra_rounded',
    'storefront_opt_qr_corner_rounded',
    'storefront_opt_qr_custom_colors',
    'storefront_opt_qr_gradients'
  ];
  v_capability_type_id TEXT;
  v_key                TEXT;
  v_feature_id         TEXT;
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  IF v_capability_type_id IS NULL THEN
    RAISE NOTICE 'Capability type % not found — skipping capability_features_list linkage', v_capability_type_key;
    RETURN;
  END IF;

  FOREACH v_key IN ARRAY v_feature_keys LOOP
    SELECT id INTO v_feature_id FROM features_list WHERE key = v_key;
    IF v_feature_id IS NOT NULL THEN
      INSERT INTO capability_features_list (capability_type_id, feature_id)
      VALUES (v_capability_type_id, v_feature_id)
      ON CONFLICT (capability_type_id, feature_id) DO NOTHING;
    ELSE
      RAISE NOTICE 'Feature key % not found in features_list — skipped', v_key;
    END IF;
  END LOOP;

  RAISE NOTICE 'Linked % feature keys to capability type %', array_length(v_feature_keys, 1), v_capability_type_key;
END $$;


-- ============================================================
-- VERIFICATION QUERIES (run manually to confirm)
-- ============================================================
-- SELECT key, name, sort_order FROM features_list
-- WHERE key LIKE 'storefront_opt_qr_styled%' OR key LIKE 'storefront_opt_qr_dot%' OR key LIKE 'storefront_opt_qr_corner%' OR key IN ('storefront_opt_qr_custom_colors','storefront_opt_qr_gradients')
-- ORDER BY sort_order, key;
--
-- SELECT ctl.key AS capability_type, fl.key AS feature
-- FROM capability_features_list cfl
-- JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
-- JOIN features_list fl ON fl.id = cfl.feature_id
-- WHERE ctl.key = 'storefront_options' AND fl.key LIKE 'storefront_opt_qr_%'
-- ORDER BY fl.sort_order;
