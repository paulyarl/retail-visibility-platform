-- 082_supplier_catalog_capability.sql
-- Migrates supplier catalog import from FF_SUPPLIER_CATALOG_IMPORT feature flag
-- to the product_options capability system (creation group).
--
-- Feature key: product_options_creation_supplier_catalog
-- Merchant gate column: product_opt_supplier_catalog (in tenant_product_options_settings)
-- Enabled for: all tiers (matching previous FF state: enabled=true, allow_tenant_override=true)

-- ───────────────────────────────────────────────────────────
-- 1. Insert feature into features_list
-- ───────────────────────────────────────────────────────────
INSERT INTO features_list (key, name, description, is_active, sort_order, created_at, updated_at)
VALUES (
  'product_options_creation_supplier_catalog',
  'Supplier Catalog Import',
  'Search and import from supplier catalogs during product creation',
  true,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ───────────────────────────────────────────────────────────
-- 2. Link feature to product_options capability type
-- ───────────────────────────────────────────────────────────
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order)
SELECT
  ctl.id,
  fl.id,
  true,
  (SELECT COALESCE(MAX(sort_order), 0) + 1
     FROM capability_features_list
    WHERE capability_type_id = ctl.id)
FROM capability_type_list ctl
CROSS JOIN features_list fl
WHERE ctl.key = 'product_options'
  AND fl.key = 'product_options_creation_supplier_catalog'
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- 3. Enable feature for all tiers
--    (matches FF_SUPPLIER_CATALOG_IMPORT DB state: enabled=true, allow_tenant_override=true)
-- ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cap_type_id TEXT;
  v_tier_id     TEXT;
  v_tier_key    TEXT;
  v_tier_keys   TEXT[] := ARRAY[
    'discovery', 'starter', 'storefront', 'commitment', 'ecommerce', 'omnichannel',
    'professional', 'enterprise', 'organization',
    'chain_starter', 'chain_professional', 'chain_enterprise',
    'trial_starter', 'trial_discovery', 'trial_storefront', 'trial_commitment',
    'trial_ecommerce', 'trial_omnichannel', 'trial_professional', 'trial_enterprise',
    'trial_chain_starter', 'trial_chain_professional', 'trial_chain_enterprise'
  ];
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'product_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type product_options not found';
  END IF;

  FOREACH v_tier_key IN ARRAY v_tier_keys LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES (
      gen_random_uuid()::text,
      v_tier_id,
      v_cap_type_id,
      'product_options_creation_supplier_catalog',
      'Supplier Catalog Import',
      true,
      false,
      '{"capability_type": "product_options", "group": "creation"}'
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Supplier catalog feature enabled for all tiers';
END $$;

-- ───────────────────────────────────────────────────────────
-- 4. Add merchant gate column to tenant_product_options_settings
-- ───────────────────────────────────────────────────────────
ALTER TABLE tenant_product_options_settings
  ADD COLUMN IF NOT EXISTS product_opt_supplier_catalog Boolean DEFAULT true;

-- ───────────────────────────────────────────────────────────
-- Verification queries (run manually after migration)
-- ───────────────────────────────────────────────────────────
-- SELECT key, name, is_active FROM features_list WHERE key = 'product_options_creation_supplier_catalog';
-- SELECT ctl.key AS cap_type, fl.key AS feature_key FROM capability_features_list cfl JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id JOIN features_list fl ON fl.id = cfl.feature_id WHERE fl.key = 'product_options_creation_supplier_catalog';
-- SELECT tier_key, feature_key, is_enabled FROM tier_features_list tfl JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id WHERE feature_key = 'product_options_creation_supplier_catalog' ORDER BY tier_key;
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'tenant_product_options_settings' AND column_name = 'product_opt_supplier_catalog';
