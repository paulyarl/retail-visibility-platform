-- Migration 268: Directory Attribute Definitions (category-aware attribute picker)
--
-- Predefined attribute vocabulary backing the seed editor's "Sourced
-- attributes" picker. Replaces free-form JSON entry: the operator toggles
-- predefined chips (grouped: payments / accessibility / ownership /
-- service_options / certifications / other) and supplies each attribute's
-- evidence (source platform + URL + as_of) inline.
--
-- Matching semantics (see DirectoryPresenceSeedService.listAttributeDefinitions):
--   - applies_to_categories IS NULL → universal (every category)
--   - otherwise the array holds category names (lowercased) or
--     platform_categories slugs; a seed's primary category matches when its
--     name (case-insensitive) or its resolved slug appears in the array.
--
-- Adding a new preset is a data operation (INSERT into this table) — no
-- deploy required. Custom one-off attributes remain per-listing in
-- directory_listings_list.attributes and do not need a definition row.
--
-- SNAP/EBT stays in its own lane (migration 207): it has regulatory
-- sensitivity and its own stricter contract. Do NOT add a snap_ebt attribute
-- here — use the dedicated snap_ebt_* columns.
--
-- All statements are idempotent (IF NOT EXISTS / WHERE NOT EXISTS / ON CONFLICT DO NOTHING).
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- =============================================================
-- 1. Attribute definitions table
-- =============================================================
CREATE TABLE IF NOT EXISTS directory_attribute_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  group_key TEXT NOT NULL DEFAULT 'other',
  -- NULL = universal; otherwise lowercase category names or category slugs
  applies_to_categories TEXT[],
  -- Hint at where evidence for this attribute typically comes from
  -- (e.g. 'apple_maps', 'google', 'yelp'). Display-only placeholder —
  -- never auto-saved as provenance.
  default_source_platform TEXT,
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_directory_attribute_definitions_active
  ON directory_attribute_definitions (group_key, sort_order)
  WHERE is_active = true;

-- =============================================================
-- 2. Starter vocabulary — universal (applies to every category)
-- =============================================================
INSERT INTO directory_attribute_definitions (attribute_key, label, group_key, applies_to_categories, default_source_platform, sort_order) VALUES
  -- Payments accepted
  ('accepts_credit_cards',   'Credit cards', 'payments', NULL, NULL,        10),
  ('accepts_debit_cards',    'Debit cards',  'payments', NULL, NULL,        20),
  ('accepts_cash',           'Cash',         'payments', NULL, NULL,        30),
  ('accepts_checks',         'Checks',       'payments', NULL, NULL,        40),
  ('accepts_apple_pay',      'Apple Pay',    'payments', NULL, 'apple_maps', 50),
  ('accepts_google_pay',     'Google Pay',   'payments', NULL, 'google',     60),
  ('accepts_samsung_pay',    'Samsung Pay',  'payments', NULL, NULL,         70),
  ('accepts_contactless',    'Contactless',  'payments', NULL, NULL,         80),
  -- Accessibility
  ('wheelchair_accessible',  'Wheelchair accessible', 'accessibility', NULL, NULL, 10),
  ('accessible_entrance',    'Accessible entrance',   'accessibility', NULL, NULL, 20),
  ('accessible_parking',     'Accessible parking',    'accessibility', NULL, NULL, 30),
  ('accessible_restroom',    'Accessible restroom',   'accessibility', NULL, NULL, 40),
  -- Ownership
  ('family_owned',           'Family-owned',     'ownership', NULL, NULL, 10),
  ('immigrant_owned',        'Immigrant-owned',  'ownership', NULL, NULL, 20),
  ('black_owned',            'Black-owned',      'ownership', NULL, NULL, 30),
  ('woman_owned',            'Woman-owned',      'ownership', NULL, NULL, 40),
  ('veteran_owned',          'Veteran-owned',    'ownership', NULL, NULL, 50),
  -- Service options
  ('in_store_shopping',      'In-store shopping', 'service_options', NULL, NULL, 10),
  ('curbside_pickup',        'Curbside pickup',   'service_options', NULL, NULL, 20),
  ('in_store_pickup',        'In-store pickup',   'service_options', NULL, NULL, 30),
  ('delivery',               'Delivery',          'service_options', NULL, NULL, 40),
  ('takeout',                'Takeout',           'service_options', NULL, NULL, 50),
  ('dine_in',                'Dine-in',           'service_options', NULL, NULL, 60),
  ('online_ordering',        'Online ordering',   'service_options', NULL, NULL, 70)
ON CONFLICT (attribute_key) DO NOTHING;

-- =============================================================
-- 3. Starter vocabulary — category-specific (grocery / food niches)
--    Keys are lowercase category names or platform_categories slugs;
--    unmatched rows are simply never offered.
-- =============================================================
INSERT INTO directory_attribute_definitions (attribute_key, label, group_key, applies_to_categories, default_source_platform, sort_order) VALUES
  ('halal_certified',        'Halal certified',        'certifications',
   ARRAY['indian grocery','african grocery','middle eastern grocery','halal grocery','international grocery','grocery','groceries'],
   NULL, 10),
  ('kosher_certified',       'Kosher certified',       'certifications',
   ARRAY['grocery','groceries','deli','international grocery','european grocery'],
   NULL, 20),
  ('fresh_produce',          'Fresh produce',          'service_options',
   ARRAY['indian grocery','african grocery','international grocery','asian grocery','latin grocery','middle eastern grocery','grocery','groceries'],
   NULL, 10),
  ('bulk_spices',            'Bulk spices',            'service_options',
   ARRAY['indian grocery','african grocery','middle eastern grocery','international grocery'],
   NULL, 20),
  ('international_foods',    'International foods',    'service_options',
   ARRAY['indian grocery','african grocery','international grocery','asian grocery','latin grocery','european grocery','middle eastern grocery'],
   NULL, 30),
  ('halal_butcher_counter',  'Halal butcher counter',  'service_options',
   ARRAY['indian grocery','african grocery','middle eastern grocery','halal grocery'],
   NULL, 30),
  ('hot_foods_counter',      'Hot foods counter',      'service_options',
   ARRAY['indian grocery','african grocery','international grocery','asian grocery','latin grocery'],
   NULL, 30)
ON CONFLICT (attribute_key) DO NOTHING;

COMMIT;
