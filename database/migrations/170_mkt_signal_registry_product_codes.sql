-- Migration 170: mkt_signal_registry — 7 new product-visibility signal codes
--
-- Sprint 1 (Universal Recalibration). Adds 7 signal codes (24 → 31) for product/inventory
-- businesses (grocery stores, bakeries, specialty markets) that the existing service-biased
-- taxonomy cannot detect:
--   - DS_MISSING_PRODUCT_CATALOG     — no website or no product browsing (product/hybrid business)
--   - WC_MISSING_PRODUCT_BROWSING    — website exists but no product/category browsing
--   - WC_MISSING_AVAILABILITY_INQUIRY — no way to check stock before visiting
--   - WC_MISSING_PICKUP_DELIVERY     — no pickup or delivery option surfaced online
--   - VP_MISSING_STOREFRONT_PHOTOS   — GBP photos lack storefront/exterior/interior
--   - VP_MISSING_PRODUCT_PHOTOS      — GBP photos lack product close-ups
--   - DS_OUTDATED_HOLIDAY_HOURS      — GBP special/holiday hours are absent
--
-- derived_rule JSON is documentation for the admin UI (matches migration 158's convention).
-- Actual detection logic is hand-written in signal-extractor.ts (pure function).
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

INSERT INTO mkt_signal_registry (id, code, family, label, description, detection_source, derived_rule, is_active) VALUES
  -- Digital Surface & Profile (DS) — +2 codes (was 6, now 8)
  ('sig-ds-missing-product-catalog', 'DS_MISSING_PRODUCT_CATALOG', 'DS', 'Missing Product Catalog',
   'Business has no website (product/hybrid) or website lacks product/category browsing — customers cannot see what products are carried before visiting',
   'derived', '{"field":"website.has_product_browsing","op":"==","threshold":false}'::jsonb, true),

  ('sig-ds-outdated-holiday-hours', 'DS_OUTDATED_HOLIDAY_HOURS', 'DS', 'Missing Holiday Hours',
   'GBP special/holiday hours are not present — customers cannot confirm holiday schedules before visiting',
   'derived', '{"field":"google.special_hours_present","op":"==","threshold":false}'::jsonb, true),

  -- Website & Conversion (WC) — +3 codes (was 6, now 9)
  ('sig-wc-missing-product-browsing', 'WC_MISSING_PRODUCT_BROWSING', 'WC', 'Missing Product Browsing',
   'Website exists but does not allow customers to browse products or categories',
   'derived', '{"field":"website.has_product_browsing","op":"==","threshold":false}'::jsonb, true),

  ('sig-wc-missing-availability-inquiry', 'WC_MISSING_AVAILABILITY_INQUIRY', 'WC', 'Missing Availability Inquiry',
   'No way for customers to check product availability before visiting (no WhatsApp, SMS, click-to-call-to-check-stock, or web form)',
   'derived', '{"field":"website.has_availability_inquiry","op":"==","threshold":false}'::jsonb, true),

  ('sig-wc-missing-pickup-delivery', 'WC_MISSING_PICKUP_DELIVERY', 'WC', 'Missing Pickup/Delivery Pathway',
   'No pickup or delivery option surfaced on website, GBP, or fulfillment settings',
   'derived', '{"field":"website.has_pickup_ordering","op":"==","threshold":false}'::jsonb, true),

  -- Content & Visual Proof (VP) — +2 codes (was 2, now 4)
  ('sig-vp-missing-storefront-photos', 'VP_MISSING_STOREFRONT_PHOTOS', 'VP', 'Missing Storefront Photos',
   'GBP photos lack storefront/exterior/interior shots — customers cannot see the store before visiting',
   'derived', '{"field":"google.photo_types","op":"missing_value","threshold":"storefront|exterior|interior"}'::jsonb, true),

  ('sig-vp-missing-product-photos', 'VP_MISSING_PRODUCT_PHOTOS', 'VP', 'Missing Product Photos',
   'GBP photos lack product close-ups — customers cannot see what products are carried',
   'derived', '{"field":"google.photo_types","op":"missing_value","threshold":"product"}'::jsonb, true)
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- Verification:
-- SELECT code, family, label, is_active FROM mkt_signal_registry WHERE code IN (
--   'DS_MISSING_PRODUCT_CATALOG','WC_MISSING_PRODUCT_BROWSING','WC_MISSING_AVAILABILITY_INQUIRY',
--   'WC_MISSING_PICKUP_DELIVERY','VP_MISSING_STOREFRONT_PHOTOS','VP_MISSING_PRODUCT_PHOTOS',
--   'DS_OUTDATED_HOLIDAY_HOURS'
-- ) ORDER BY family, code;
