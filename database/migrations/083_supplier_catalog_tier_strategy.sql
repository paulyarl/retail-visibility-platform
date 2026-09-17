-- 083_supplier_catalog_tier_strategy.sql
-- Applies the three-tier gating pattern to supplier catalog:
--   1. Flexible tiers → automatic (resolver handles via isFlexible)
--   2. Non-flexible mid tiers → explicit assignment (kept from migration 082)
--   3. Non-flexible lower tiers → BSaaS purchasable (remove assignment, add catalog entry)
--
-- Lower tiers being removed (must purchase via BSaaS store):
--   discovery, storefront + their trials
--
-- Mid tiers kept (explicit assignment from migration 082):
--   commitment, ecommerce, omnichannel, chain_starter + their trials
--
-- Flexible tiers (automatic, no assignment needed):
--   professional, chain_professional, organization, enterprise + trial_professional

-- ───────────────────────────────────────────────────────────
-- 1. Remove explicit assignment from lower tiers
-- ───────────────────────────────────────────────────────────
DELETE FROM tier_features_list
WHERE feature_key = 'product_options_creation_supplier_catalog'
  AND tier_id IN (
    SELECT id FROM subscription_tiers_list
    WHERE tier_key IN (
      'discovery', 'storefront',
      'trial_discovery', 'trial_storefront'
    )
  );

-- ───────────────────────────────────────────────────────────
-- 2. Add supplier catalog to BSaaS catalog for self-service purchase
-- ───────────────────────────────────────────────────────────
INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES (
  'product_options_creation_supplier_catalog',
  'Supplier Catalog Import',
  'Search and import products from supplier catalogs during product creation. Skip manual entry by pulling product details, images, and pricing directly from your suppliers.',
  1500,
  'monthly',
  14,
  true,
  5
)
ON CONFLICT (feature_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  billing_cycle = EXCLUDED.billing_cycle,
  trial_days = EXCLUDED.trial_days,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- ───────────────────────────────────────────────────────────
-- Verification queries (run manually after migration)
-- ───────────────────────────────────────────────────────────
-- Verify lower tiers no longer have the feature:
-- SELECT stl.tier_key, tfl.is_enabled FROM tier_features_list tfl
--   JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
--   WHERE tfl.feature_key = 'product_options_creation_supplier_catalog'
--   ORDER BY stl.sort_order;
--
-- Verify BSaaS catalog entry:
-- SELECT feature_key, marketing_name, price_cents, billing_cycle, trial_days, is_active FROM bsaas_catalog WHERE feature_key = 'product_options_creation_supplier_catalog';
