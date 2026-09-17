-- Migration 094: Rename *_both_options feature keys to *_flexible
-- Standardizes commerce_types and storefront_types flexible keys to match
-- the *_flexible naming convention used by all other capability types.

BEGIN;

-- 0. features_list: rename feature keys
UPDATE features_list
SET key = 'commerce_flexible'
WHERE key = 'commerce_both_options';

UPDATE features_list
SET key = 'storefront_flexible'
WHERE key = 'storefront_both_options';

-- 1. capability_features_list: no key column — uses feature_id FK to features_list.
--    Updating features_list.key above is sufficient; capability_features_list
--    references features by feature_id, not by key.

-- 2. tier_features_list: rename feature keys
UPDATE tier_features_list
SET feature_key = 'commerce_flexible'
WHERE feature_key = 'commerce_both_options';

UPDATE tier_features_list
SET feature_key = 'storefront_flexible'
WHERE feature_key = 'storefront_both_options';

-- 3. bsaas_catalog: rename feature keys
UPDATE bsaas_catalog
SET feature_key = 'commerce_flexible'
WHERE feature_key = 'commerce_both_options';

UPDATE bsaas_catalog
SET feature_key = 'storefront_flexible'
WHERE feature_key = 'storefront_both_options';

-- 4. bsaas_bundle_items: rename feature keys (if any bundles reference these)
UPDATE bsaas_bundle_items
SET feature_key = 'commerce_flexible'
WHERE feature_key = 'commerce_both_options';

UPDATE bsaas_bundle_items
SET feature_key = 'storefront_flexible'
WHERE feature_key = 'storefront_both_options';

COMMIT;
