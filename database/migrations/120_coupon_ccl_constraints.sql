-- Migration 120: Coupon CCL Constraints
-- Sprint 8.2 — Cross-Capability Constraint Language (CCL) rules for coupon_options
-- Seeds constraint rows into capability_constraints_list table

-- Constraint 1: coupon_options.can_use_free_shipping REQUIRES fulfillment.shows_shipping
-- If a tenant enables free-shipping coupons, they must have shipping as a fulfillment option.
INSERT INTO capability_constraints_list (
  constraint_id,
  type,
  severity,
  source_capability,
  source_field,
  source_operator,
  source_value,
  target_capability,
  target_field,
  target_operator,
  target_value,
  message,
  created_at,
  updated_at,
  resolution_hint
)
SELECT
  'ccl_coupon_free_shipping_requires_shipping',
  'requires',
  'block',
  'coupon_options',
  'can_use_free_shipping',
  'is_true',
  'true',
  'fulfillment',
  'shows_shipping',
  'is_true',
  'true',
  'Free shipping coupons require shipping to be enabled as a fulfillment option.',
  NOW(),
  NOW(),
  'Enable shipping as a fulfillment option, or disable free-shipping coupons.'
WHERE NOT EXISTS (
  SELECT 1 FROM capability_constraints_list WHERE constraint_id = 'ccl_coupon_free_shipping_requires_shipping'
);

-- Constraint 2: coupon_options.can_use_bogo RECOMMENDS product_options.shows_variants
-- BOGO coupons work best when product variants are enabled (to distinguish buy/get items).
INSERT INTO capability_constraints_list (
  constraint_id,
  type,
  severity,
  source_capability,
  source_field,
  source_operator,
  source_value,
  target_capability,
  target_field,
  target_operator,
  target_value,
  message,
  created_at,
  updated_at,
  resolution_hint
)
SELECT
  'ccl_coupon_bogo_recommends_variants',
  'recommends',
  'warn',
  'coupon_options',
  'can_use_bogo',
  'is_true',
  'true',
  'product_options',
  'shows_variants',
  'is_true',
  'true',
  'BOGO coupons work best when product variants are enabled to distinguish buy/get items.',
  NOW(),
  NOW(),
  'Enable product variants so BOGO buy/get pairs can be configured.'
WHERE NOT EXISTS (
  SELECT 1 FROM capability_constraints_list WHERE constraint_id = 'ccl_coupon_bogo_recommends_variants'
);

-- Constraint 3: coupon_options.can_target_products REQUIRES product_options.enabled
-- Targeted coupons need products to exist, which requires product options to be enabled.
INSERT INTO capability_constraints_list (
  constraint_id,
  type,
  severity,
  source_capability,
  source_field,
  source_operator,
  source_value,
  target_capability,
  target_field,
  target_operator,
  target_value,
  message,
  created_at,
  updated_at,
  resolution_hint
)
SELECT
  'ccl_coupon_targeted_requires_products',
  'requires',
  'block',
  'coupon_options',
  'can_target_products',
  'is_true',
  'true',
  'product_options',
  'enabled',
  'is_true',
  'true',
  'Targeted coupons require product options to be enabled so that products exist to target.',
  NOW(),
  NOW(),
  'Enable product options so products can be selected as coupon targets.'
WHERE NOT EXISTS (
  SELECT 1 FROM capability_constraints_list WHERE constraint_id = 'ccl_coupon_targeted_requires_products'
);
