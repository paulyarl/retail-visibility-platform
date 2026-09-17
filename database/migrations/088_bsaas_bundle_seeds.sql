-- 088_bsaas_bundle_seeds.sql
-- Seeds 4 new cross-domain bundles and adds remaining flexible toggle keys
-- to bsaas_catalog for individual sale.
--
-- Bundles:
--   1. Commerce Power Pack — social_commerce + storefront_opt + product_options — $69/mo
--   2. Operations Bundle — integration + fulfillment + payment_gateway — $49/mo
--   3. Growth Bundle — featured + directory_entry + quickstart — $39/mo
--   4. Everything Pack — all 17 flexible toggles — $299/mo

-- ───────────────────────────────────────────────────────────
-- 1. Add remaining flexible toggle keys to bsaas_catalog
-- ───────────────────────────────────────────────────────────
INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES
  ('storefront_opt_flexible', 'Storefront Options — Full Access', 'Unlock all storefront option features: layouts, gallery, QR codes, maps, advanced formatting, and more.', 2900, 'monthly', 14, true, 103),
  ('product_options_flexible', 'Product Options — Full Access', 'Unlock all product option features: layouts, sections, creation tools, supplier catalog, and advanced display.', 2900, 'monthly', 14, true, 104),
  ('featured_flexible', 'Featured Products — Full Access', 'Unlock all featured product types: badges, trending, seasonal, recommended, custom slots, and more.', 1900, 'monthly', 14, true, 105),
  ('social_commerce_flexible', 'Social Commerce — Full Access', 'Unlock all social commerce features: Meta integration, TikTok Shop, abandoned cart recovery, social proof, and UGC.', 3900, 'monthly', 14, true, 106),
  ('directory_entry_flexible', 'Directory Entry — Full Access', 'Unlock all directory features: gallery, premium layouts, map integration, SEO, and enhanced visibility.', 1900, 'monthly', 14, true, 107),
  ('integration_flexible', 'Integrations — Full Access', 'Unlock all integration features: Clover, Square, Google Business Profile, Google Merchant Center, and more.', 2900, 'monthly', 14, true, 108),
  ('fulfillment_flexible', 'Fulfillment — Full Access', 'Unlock all fulfillment methods: pickup, delivery, shipping, and service scheduling.', 1500, 'monthly', 14, true, 109),
  ('payment_gateway_flexible', 'Payment Gateways — Full Access', 'Unlock all payment gateways: Stripe, PayPal, and Square.', 2500, 'monthly', 14, true, 110),
  ('barcode_flexible', 'Barcode Scan — Full Access', 'Unlock all barcode scan methods: camera, USB, manual entry, and batch scan.', 1200, 'monthly', 14, true, 111),
  ('quickstart_flexible', 'Quickstart — Full Access', 'Unlock all quickstart features: wizard, AI assistance, image generation, and guided setup.', 1900, 'monthly', 14, true, 112),
  ('commerce_flexible', 'Commerce — Both Modes', 'Unlock both deposit and full payment collection modes.', 1500, 'monthly', 14, true, 113),
  ('storefront_flexible', 'Storefront — All Types', 'Unlock all storefront types: online, retail, service, and social.', 1500, 'monthly', 14, true, 114),
  ('product_types_flexible', 'Product Types — Full Access', 'Unlock all product types: physical, digital, hybrid, and service.', 1500, 'monthly', 14, true, 115),
  ('org_flexible', 'Organization — Full Access', 'Unlock all organization features: tabs, panels, chain propagation, and multi-location management.', 4900, 'monthly', 14, true, 116)
ON CONFLICT (feature_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();

-- ───────────────────────────────────────────────────────────
-- 2. Seed Commerce Power Pack bundle
-- ───────────────────────────────────────────────────────────
INSERT INTO bsaas_bundles (bundle_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES (
  'commerce_power_pack',
  'Commerce Power Pack',
  'Unlock full Social Commerce, Storefront Options, and Product Options in one bundle. Get Meta/TikTok integration, abandoned cart recovery, all storefront layouts and gallery features, and complete product creation and display tools.',
  6900,
  'monthly',
  14,
  true,
  201
)
ON CONFLICT (bundle_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();

INSERT INTO bsaas_bundle_items (bundle_id, feature_key, sort_order)
SELECT b.id, f.feature_key, f.sort_order
FROM (VALUES
  ('social_commerce_flexible', 1),
  ('storefront_opt_flexible', 2),
  ('product_options_flexible', 3)
) AS f(feature_key, sort_order)
JOIN bsaas_bundles b ON b.bundle_key = 'commerce_power_pack'
ON CONFLICT (bundle_id, feature_key) DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- 3. Seed Operations Bundle
-- ───────────────────────────────────────────────────────────
INSERT INTO bsaas_bundles (bundle_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES (
  'operations_bundle',
  'Operations Bundle',
  'Unlock full Integrations, Fulfillment, and Payment Gateways in one bundle. Get Clover, Square, Google Business Profile, Google Merchant Center, all fulfillment methods, and all payment gateways (Stripe, PayPal, Square).',
  4900,
  'monthly',
  14,
  true,
  202
)
ON CONFLICT (bundle_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();

INSERT INTO bsaas_bundle_items (bundle_id, feature_key, sort_order)
SELECT b.id, f.feature_key, f.sort_order
FROM (VALUES
  ('integration_flexible', 1),
  ('fulfillment_flexible', 2),
  ('payment_gateway_flexible', 3)
) AS f(feature_key, sort_order)
JOIN bsaas_bundles b ON b.bundle_key = 'operations_bundle'
ON CONFLICT (bundle_id, feature_key) DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- 4. Seed Growth Bundle
-- ───────────────────────────────────────────────────────────
INSERT INTO bsaas_bundles (bundle_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES (
  'growth_bundle',
  'Growth Bundle',
  'Unlock full Featured Products, Directory Entry, and Quickstart in one bundle. Get all featured product types and badges, premium directory listings with gallery and SEO, and the complete quickstart wizard with AI assistance.',
  3900,
  'monthly',
  14,
  true,
  203
)
ON CONFLICT (bundle_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();

INSERT INTO bsaas_bundle_items (bundle_id, feature_key, sort_order)
SELECT b.id, f.feature_key, f.sort_order
FROM (VALUES
  ('featured_flexible', 1),
  ('directory_entry_flexible', 2),
  ('quickstart_flexible', 3)
) AS f(feature_key, sort_order)
JOIN bsaas_bundles b ON b.bundle_key = 'growth_bundle'
ON CONFLICT (bundle_id, feature_key) DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- 5. Seed Everything Pack bundle (all 17 flexible toggles)
-- ───────────────────────────────────────────────────────────
INSERT INTO bsaas_bundles (bundle_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES (
  'everything_pack',
  'Everything Pack',
  'Unlock every capability domain on the platform. Get all 17 flexible toggles: Chatbot, CRM, FAQ, Storefront Options, Product Options, Featured, Social Commerce, Directory, Integrations, Fulfillment, Payment Gateways, Barcode, Quickstart, Commerce Modes, Storefront Types, Product Types, and Organization. The ultimate bundle for merchants who want full platform access without the Enterprise tier.',
  29900,
  'monthly',
  14,
  true,
  204
)
ON CONFLICT (bundle_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();

INSERT INTO bsaas_bundle_items (bundle_id, feature_key, sort_order)
SELECT b.id, f.feature_key, f.sort_order
FROM (VALUES
  ('chatbot_flexible', 1),
  ('crm_flexible', 2),
  ('faq_flexible', 3),
  ('storefront_opt_flexible', 4),
  ('product_options_flexible', 5),
  ('featured_flexible', 6),
  ('social_commerce_flexible', 7),
  ('directory_entry_flexible', 8),
  ('integration_flexible', 9),
  ('fulfillment_flexible', 10),
  ('payment_gateway_flexible', 11),
  ('barcode_flexible', 12),
  ('quickstart_flexible', 13),
  ('commerce_flexible', 14),
  ('storefront_flexible', 15),
  ('product_types_flexible', 16),
  ('org_flexible', 17)
) AS f(feature_key, sort_order)
JOIN bsaas_bundles b ON b.bundle_key = 'everything_pack'
ON CONFLICT (bundle_id, feature_key) DO NOTHING;
