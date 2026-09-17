-- 093_everything_pack_split.sql
-- Splits the Everything Pack into two variants:
--   1. Everything Pack (16 components, no org) — $279/mo — for tiers without org engagement
--   2. Everything Pack + Org (17 components, with org_flexible) — $299/mo — for tiers with org engagement
--
-- The original everything_pack bundle is repurposed as the no-org variant (price reduced).
-- A new everything_pack_org bundle is added for the full 17-component version.

-- ───────────────────────────────────────────────────────────
-- 1. Update existing Everything Pack: remove org_flexible, reduce price
-- ───────────────────────────────────────────────────────────
UPDATE bsaas_bundles
SET
  marketing_name = 'Everything Pack',
  description    = 'Unlock every individual capability domain on the platform. Get all 16 flexible toggles: Chatbot, CRM, FAQ, Storefront Options, Product Options, Featured, Social Commerce, Directory, Integrations, Fulfillment, Payment Gateways, Barcode, Quickstart, Commerce Modes, Storefront Types, and Product Types. The ultimate bundle for merchants who want full platform access without the Enterprise tier.',
  price_cents    = 27900,
  updated_at     = NOW()
WHERE bundle_key = 'everything_pack';

-- Remove org_flexible from the original Everything Pack
DELETE FROM bsaas_bundle_items
WHERE bundle_id = (SELECT id FROM bsaas_bundles WHERE bundle_key = 'everything_pack')
  AND feature_key = 'org_flexible';

-- Re-index sort_order for remaining items
UPDATE bsaas_bundle_items bi
SET sort_order = sub.new_order
FROM (
  SELECT bi2.id, ROW_NUMBER() OVER (
    PARTITION BY bi2.bundle_id ORDER BY bi2.sort_order
  ) - 1 AS new_order
  FROM bsaas_bundle_items bi2
  WHERE bi2.bundle_id = (SELECT id FROM bsaas_bundles WHERE bundle_key = 'everything_pack')
) sub
WHERE bi.id = sub.id;

-- ───────────────────────────────────────────────────────────
-- 2. Create Everything Pack + Org bundle (17 components)
-- ───────────────────────────────────────────────────────────
INSERT INTO bsaas_bundles (bundle_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES (
  'everything_pack_org',
  'Everything Pack + Org',
  'Unlock every capability domain on the platform including Organization management. Get all 17 flexible toggles: Chatbot, CRM, FAQ, Storefront Options, Product Options, Featured, Social Commerce, Directory, Integrations, Fulfillment, Payment Gateways, Barcode, Quickstart, Commerce Modes, Storefront Types, Product Types, and Organization. The complete platform bundle for merchants who need multi-location and chain management.',
  29900,
  'monthly',
  14,
  true,
  205
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
JOIN bsaas_bundles b ON b.bundle_key = 'everything_pack_org'
ON CONFLICT (bundle_id, feature_key) DO NOTHING;
