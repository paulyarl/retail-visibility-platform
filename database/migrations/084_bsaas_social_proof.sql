-- 084_bsaas_social_proof.sql
-- Adds social_commerce_social_proof to the bsaas_catalog so tenants on any tier
-- can purchase Social Proof / UGC à la carte, independent of tier inclusion.
--
-- The feature key already exists in features_list (added by 053_social_commerce_options_feature_seeds.sql)
-- and is linked to the social_commerce_options capability type via capability_features_list.
--
-- Companion purchase logic in bsaas-purchases.ts will auto-create a zero-cost
-- companion purchase for social_commerce_enabled (the parent gate) when a tenant
-- purchases this feature and their tier does not already include it.
-- This ensures the SocialCommerceOptionsResolver sees the master gate as enabled.
--
-- Tier-bundled tiers (chain_starter, chain_professional, organization, enterprise)
-- already have this feature enabled via tier_features_list.
-- This catalog entry makes it purchasable for all other tiers.

INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES (
  'social_commerce_social_proof',
  'Social Proof & UGC',
  'Display user-generated content, customer reviews, and social proof widgets on your storefront to build trust and increase conversions. Show real-time purchase activity, testimonials, and social mentions.',
  1500,
  'monthly',
  14,
  true,
  11
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
