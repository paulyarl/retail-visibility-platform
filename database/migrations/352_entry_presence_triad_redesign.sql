-- Migration 352: Entry Presence triad redesign (docs/ENTRY_PRESENCE_TRIAD_REDESIGN_SPEC.md)
--
-- The triad becomes three surface modes at SKU parity (maxSkus 200):
--   discovery  -> "SWIS"        products -> Google surfaces, no commerce
--   storefront -> "Storefront"  browsable hosted catalog, no commerce
--   presence   -> "Storefront+" all-purpose visibility surface + DEPOSIT commerce ($39, Stripe)
--
-- Semantics: silent module = off-but-purchasable (deny-by-veto), *_disabled =
-- deliberate upgrade gate. Six modules stay vetoed on the whole triad
-- (tier-pull to the ladder above): wholesale_matching, chatbot, funnel_options,
-- social_commerce, organization, coupon. Commerce + fulfillment stay OPEN.
-- All modes grant storefront_domains_platform_subdomain; custom_domain stays
-- a flexible purchase.
--
-- DOWNGRADE NOTE: chatbot_options and social_commerce_options currently have
-- LIVE positive keys on discovery/storefront — this migration gates them
-- (adds *_disabled + deletes positives). Existing discovery/storefront tenants
-- lose chatbot + social commerce. Intentional per spec §3.
--
-- Idempotent. Apply via:
--   cd apps/api && doppler run --config <env> -- node scripts/apply-sql-file.cjs ../../database/migrations/352_entry_presence_triad_redesign.sql

-- ============================================================================
-- 1. subscription_tiers_list — names, prices, SKU parity
-- ============================================================================

UPDATE subscription_tiers_list
SET name = 'Storefront+', display_name = 'Storefront+',
    price_monthly = 39.00, max_skus = 200,
    description = 'Storefront + selling — full directory chrome, hosted storefront on your platform subdomain, deposit checkout via Stripe. Full payment and more gateways available à la carte.',
    updated_at = now()
WHERE tier_key = 'presence';

UPDATE subscription_tiers_list
SET name = 'SWIS', display_name = 'SWIS',
    max_skus = 200,
    description = 'Your products on Google — Merchant Center feed, Shopping and local inventory visibility, hosted on your platform subdomain.',
    updated_at = now()
WHERE tier_key = 'discovery';

UPDATE subscription_tiers_list
SET description = 'Browsable hosted storefront — your full catalog on your platform subdomain. Add checkout anytime as an à-la-carte add-on.',
    updated_at = now()
WHERE tier_key = 'storefront';
-- storefront: display/price/max_skus already correct (200 SKUs, $59).

-- ============================================================================
-- 2. presence (tier_presence) — commerce surface
-- ============================================================================

-- 2a. Silent-open cleanup: delete every row (veto + dead positives) for modules
-- that become purchasable-not-granted: barcode, faq, product_options group,
-- directory_promotion.
DELETE FROM tier_features_list
WHERE tier_id = 'tier_presence'
  AND feature_key ~ '^(barcode_|faq_|product_options_|directory_promotion_)';

-- 2b. Un-veto natively granted modules — delete ONLY the veto, positives go live:
--     directory_entry chrome (19 keys already in bag), storefront_domains.
--     Also drop commerce_disabled if present — the commerce surface cannot
--     carry its own veto (row existed in DB though absent from the witness).
DELETE FROM tier_features_list
WHERE tier_id = 'tier_presence'
  AND feature_key IN ('directory_entry_disabled', 'storefront_domains_disabled', 'commerce_disabled');

-- 2c. custom_domain + domains flexible are à-la-carte only — never tier keys.
DELETE FROM tier_features_list
WHERE tier_id = 'tier_presence'
  AND feature_key IN ('storefront_domains_custom_domain', 'storefront_domains_flexible');

-- 2d. Upgrade-gated vetoes (the six) — absent today, add them.
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled)
SELECT gen_random_uuid()::text, 'tier_presence', k, COALESCE(fl.name, k), true
FROM (VALUES
  ('chatbot_disabled'),
  ('coupon_disabled'),
  ('funnel_options_disabled'),
  ('org_disabled'),
  ('social_commerce_disabled'),
  ('wholesale_matching_disabled')
) AS v(k)
LEFT JOIN features_list fl ON fl.key = v.k
ON CONFLICT (tier_id, feature_key) DO UPDATE SET is_enabled = true, updated_at = now();

-- 2e. Signature grants: deposit commerce + Stripe + hosted subdomain +
--     storefront surface (all-purpose visibility for store and products) +
--     commerce-relevant integrations (square + GBP propagation).
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled)
SELECT gen_random_uuid()::text, 'tier_presence', k, COALESCE(fl.name, k), true
FROM (VALUES
  -- deposit commerce (full payment via commerce_flexible purchase)
  ('commerce_enabled'),
  ('commerce_deposit_only'),
  -- stripe only natively; other three via payment_gateway_flexible
  ('payment_gateway_enabled'),
  ('payment_gateway_stripe'),
  -- hosted product surface
  ('storefront_domains_enabled'),
  ('storefront_domains_platform_subdomain'),
  -- storefront surface — same native type set storefront carries
  ('storefront_enabled'),
  ('storefront'),
  ('storefront_online'),
  ('storefront_retail'),
  ('storefront_service'),
  -- integrations (per-mode split; GBP propagation included)
  ('integration_enabled'),
  ('integration_square'),
  ('integration_gbp'),
  ('integration_propagation_gbp')
) AS v(k)
LEFT JOIN features_list fl ON fl.key = v.k
ON CONFLICT (tier_id, feature_key) DO UPDATE SET is_enabled = true, updated_at = now();

-- ============================================================================
-- 3. discovery (tid-scqk) — SWIS mode
-- ============================================================================

-- 3a. Silent-open cleanup — purchasable-not-granted sibling surfaces:
--     storefront surface (types/options/gallery/hours/layouts/maps/qr),
--     commerce, payment_gateway, fulfillment, marketing_ops, platform_services,
--     directory_promotion, storefront_domains (re-granted below).
DELETE FROM tier_features_list
WHERE tier_id = 'tid-scqk'
  AND (
    feature_key ~ '^(commerce_|payment_gateway_|fulfillment_|marketing_ops_|platform_services_|directory_promotion_|storefront_opt_|storefront_gallery|storefront_hours|storefront_layouts|storefront_maps|storefront_qr|storefront_domains)'
    OR feature_key IN (
      'storefront', 'storefront_enabled', 'storefront_disabled', 'storefront_flexible',
      'storefront_online', 'storefront_retail', 'storefront_service', 'storefront_social'
    )
  );

-- 3b. Upgrade-gated module cleanup: delete dead positives, keep/add veto.
DELETE FROM tier_features_list
WHERE tier_id = 'tid-scqk'
  AND feature_key ~ '^(social_commerce_|funnel_options_|chatbot_)'
  AND feature_key NOT IN ('social_commerce_disabled', 'funnel_options_disabled');

-- 3c. Un-veto directory_entry — chrome goes live (mode parity in listing chrome).
DELETE FROM tier_features_list
WHERE tier_id = 'tid-scqk' AND feature_key = 'directory_entry_disabled';

-- 3d. All six gated vetoes + native SWIS/domain keys. Every veto is listed
--     explicitly (not just "missing" ones): DO UPDATE flips stale dormant
--     rows — e.g. prd carried wholesale_matching_disabled is_enabled=false.
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled)
SELECT gen_random_uuid()::text, 'tid-scqk', k, COALESCE(fl.name, k), true
FROM (VALUES
  ('chatbot_disabled'),
  ('coupon_disabled'),
  ('funnel_options_disabled'),
  ('org_disabled'),
  ('social_commerce_disabled'),
  ('wholesale_matching_disabled'),
  -- native SWIS keys (google_only bag already partially present)
  ('integration_enabled'),
  ('integration_google_enabled'),
  ('integration_gmc_sync'),
  -- hosted product surface
  ('storefront_domains_enabled'),
  ('storefront_domains_platform_subdomain')
) AS v(k)
LEFT JOIN features_list fl ON fl.key = v.k
ON CONFLICT (tier_id, feature_key) DO UPDATE SET is_enabled = true, updated_at = now();

-- ============================================================================
-- 4. storefront (tid-snks) — browsable storefront
-- ============================================================================

-- 4a. Silent-open cleanup: commerce, payment_gateway, fulfillment,
--     marketing_ops, platform_services, directory_promotion stay off but
--     purchasable. Google feed becomes integration_flexible purchase
--     (SWIS is discovery's signature) — delete google integration positives.
DELETE FROM tier_features_list
WHERE tier_id = 'tid-snks'
  AND (
    feature_key ~ '^(commerce_|payment_gateway_|fulfillment_|marketing_ops_|platform_services_|directory_promotion_|integration_google|social_commerce_|funnel_options_|chatbot_|storefront_domains)'
    OR feature_key = 'google_sync'
  )
  AND feature_key NOT IN ('social_commerce_disabled', 'funnel_options_disabled');

-- 4b. Re-grant hosted subdomain (deleted in the sweep above) + native
--     POS/catalog-sync integrations; add missing gated vetoes.
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled)
SELECT gen_random_uuid()::text, 'tid-snks', k, COALESCE(fl.name, k), true
FROM (VALUES
  ('storefront_domains_enabled'),
  ('storefront_domains_platform_subdomain'),
  ('integration_enabled'),
  ('integration_pos_enabled'),
  ('integration_pos_on'),
  ('integration_square'),
  ('integration_clover'),
  -- all six gated vetoes, listed explicitly (DO UPDATE flips stale dormant rows)
  ('chatbot_disabled'),
  ('coupon_disabled'),
  ('funnel_options_disabled'),
  ('org_disabled'),
  ('social_commerce_disabled'),
  ('wholesale_matching_disabled')
) AS v(k)
LEFT JOIN features_list fl ON fl.key = v.k
ON CONFLICT (tier_id, feature_key) DO UPDATE SET is_enabled = true, updated_at = now();
