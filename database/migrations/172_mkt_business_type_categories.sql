-- Migration 172: mkt_business_type_categories — business-type classifier reference table
--
-- Sprint 1 (Universal Recalibration). Maps GBP primary_category / matched_business.category
-- strings to a business_type classification ('service' | 'product' | 'hybrid') used by:
--   - signal-extractor.ts: business-type-sensitive thresholds (e.g. DS_PHOTO_DEFICIT <5 vs <10)
--   - archetype-selection.ts: A6 (Product Visibility Gap) only fires for product/hybrid
--   - MarketingBusinessTypeService.resolveBusinessType(): agent field → category mapping → null
--
-- Follows the mkt_* namespace convention: no RLS, no updated_at trigger (uses DEFAULT NOW()
-- + app-layer Prisma @updatedAt). The table is a global reference (not tenant-scoped) —
-- the category column is the PK.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

CREATE TABLE IF NOT EXISTS mkt_business_type_categories (
  category      VARCHAR(255) PRIMARY KEY,
  business_type VARCHAR(20)  NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed: initial category → business_type mappings.
-- Extend over time via admin tooling or follow-up migrations.
-- Categories are lowercased GBP primary_category or matched_business.category values.
INSERT INTO mkt_business_type_categories (category, business_type) VALUES
  -- Product / inventory businesses
  ('grocery store',          'product'),
  ('supermarket',            'product'),
  ('convenience store',      'product'),
  ('bakery',                 'product'),
  ('butcher shop',           'product'),
  ('liquor store',           'product'),
  ('pharmacy',               'product'),
  ('specialty food store',   'product'),
  -- Service businesses
  ('hvac contractor',        'service'),
  ('plumber',                'service'),
  ('dentist',                'service'),
  ('roofing contractor',     'service'),
  ('electrician',            'service'),
  ('landscaper',             'service'),
  -- Hybrid (both product + service components)
  ('restaurant',             'hybrid'),
  ('caterer',                'hybrid')
ON CONFLICT (category) DO NOTHING;

COMMIT;

-- Verification:
-- SELECT category, business_type, is_active FROM mkt_business_type_categories ORDER BY business_type, category;
