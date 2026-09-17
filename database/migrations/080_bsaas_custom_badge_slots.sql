-- 080_bsaas_custom_badge_slots.sql
-- Adds featured_custom_badge_slots to the bsaas_catalog so tenants on any tier
-- can purchase custom badge slots à la carte, independent of tier inclusion.
--
-- The feature key already exists in features_list (added by 062_custom_badge_slots_capability.sql)
-- and is linked to the featured_options capability type via capability_features_list.
-- The EffectiveCapabilityResolver auto-merges active tenant_feature_purchases into
-- the mergedFeatures map, so no resolver changes are needed.
--
-- Tier-bundled tiers (professional, enterprise, organization, chain_professional,
-- chain_enterprise) already have this feature enabled via tier_features_list.
-- This catalog entry makes it purchasable for all other tiers.

INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES (
  'featured_custom_badge_slots',
  'Custom Badge Slots',
  'Create up to 10 custom badges to highlight products in your storefront — beyond the built-in system badges. Perfect for highlighting eco-friendly, award-winning, or locally-made products.',
  500,
  'monthly',
  14,
  true,
  10
)
ON CONFLICT (feature_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();
