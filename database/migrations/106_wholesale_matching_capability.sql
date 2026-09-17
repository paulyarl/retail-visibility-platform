-- ============================================================
-- Wholesale Matching Capability Type Seed Migration
--
-- Seeds the wholesale_matching_options capability type, feature keys,
-- capability-feature links, and tier assignments.
--
-- The resolver (WholesaleMatchingResolver.ts) and routes were already
-- implemented but the DB was never seeded — this migration completes
-- the capability registration so it appears in the Admin Capability UI
-- at /settings/admin/capabilities.
--
-- Tier gating (per resolver comment):
--   free/discovery/starter/storefront/commitment = none
--   ecommerce/omnichannel/chain_starter         = search
--   professional/enterprise/organization/chain_*  = full
--   flexible                                    = BSaaS purchase only
--
-- Prerequisites: features_list, capability_type_list,
--                capability_features_list, tier_features_list,
--                subscription_tiers_list, bsaas_catalog tables must exist
-- Date: 2026-07-13
-- ============================================================


-- ============================================================
-- STEP 0: Create tenant_wholesale_matching_settings table
-- ============================================================
-- Merchant preferences for wholesale matching capability.
-- Currently only stores the soft toggle (wholesale_matching_enabled).

CREATE TABLE IF NOT EXISTS tenant_wholesale_matching_settings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  tenant_id TEXT NOT NULL UNIQUE,

  -- Master soft toggle (merchant can disable even if tier allows)
  wholesale_matching_enabled BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_wholesale_matching_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Index
CREATE INDEX IF NOT EXISTS idx_wholesale_matching_tenant ON tenant_wholesale_matching_settings(tenant_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_wholesale_matching_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_wholesale_matching_settings_updated_at ON tenant_wholesale_matching_settings;
CREATE TRIGGER trigger_wholesale_matching_settings_updated_at
  BEFORE UPDATE ON tenant_wholesale_matching_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_wholesale_matching_settings_updated_at();

-- Enable RLS
ALTER TABLE tenant_wholesale_matching_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenants can only see their own row
DROP POLICY IF EXISTS tenant_wholesale_matching_isolation ON tenant_wholesale_matching_settings;
CREATE POLICY tenant_wholesale_matching_isolation ON tenant_wholesale_matching_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ============================================================
-- STEP 1: Insert wholesale_matching feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('wholesale_matching_enabled',    'Wholesale Matching Enabled',    'Master ON gate for wholesale matching capability',            'wholesale_matching', true, 0, NOW(), NOW()),
  ('wholesale_matching_disabled',   'Wholesale Matching Disabled',   'Explicit deactivation gate for wholesale matching',           'wholesale_matching', true, 1, NOW(), NOW()),
  ('wholesale_matching_flexible',   'Wholesale Matching Flexible',   'Flexible tier — unlocks all wholesale matching features',     'wholesale_matching', true, 2, NOW(), NOW()),
  ('wholesale_matching_search',     'Wholesale Matching: Search',    'Search tier — supplier match + Faire search',                 'wholesale_matching', true, 3, NOW(), NOW()),
  ('wholesale_matching_full',       'Wholesale Matching: Full',      'Full tier — search + affiliate link building + brand partners','wholesale_matching', true, 4, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 2: Create wholesale_matching_options capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'wholesale_matching_options',
  'Wholesale Matching',
  'Wholesale supplier matching, Faire search, affiliate link building, and brand partner discovery.',
  'wholesale_matching',
  true,
  6,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 3: Link wholesale_matching features to capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'wholesale_matching_options';
  v_feature_keys         TEXT[] := ARRAY[
    'wholesale_matching_enabled',
    'wholesale_matching_disabled',
    'wholesale_matching_flexible',
    'wholesale_matching_search',
    'wholesale_matching_full'
  ];
  v_capability_type_id TEXT;
  v_feature_id TEXT;
  v_idx INT;
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  IF v_capability_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type % not found', v_capability_type_key;
  END IF;

  FOR i IN 1 .. array_length(v_feature_keys, 1) LOOP
    SELECT id INTO v_feature_id FROM features_list WHERE key = v_feature_keys[i] LIMIT 1;
    IF v_feature_id IS NULL THEN
      RAISE NOTICE 'Feature key not found in features_list: %', v_feature_keys[i];
      CONTINUE;
    END IF;

    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    VALUES (v_capability_type_id, v_feature_id, true, i, NOW(), NOW())
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
      is_active = true,
      sort_order = i,
      updated_at = NOW();
  END LOOP;

  RAISE NOTICE 'Linked % features to capability type %', array_length(v_feature_keys, 1), v_capability_type_key;
END $$;


-- ============================================================
-- STEP 4: Assign tier features
-- ============================================================
-- All tiers get _enabled=true and _disabled=false (explicit engagement).
-- search tiers: _search=true
-- full tiers: _full=true (implies search as well per resolver logic)
-- trial tiers mirror their non-trial counterparts.

DO $$
DECLARE
  v_cap_type_id   TEXT;
  v_tier_id       TEXT;
  v_tier_key      TEXT;

  -- Tier groups
  v_all_tiers     TEXT[] := ARRAY[
    'discovery', 'starter', 'storefront', 'commitment', 'ecommerce', 'omnichannel',
    'professional', 'enterprise', 'organization',
    'chain_starter', 'chain_professional', 'chain_enterprise',
    'trial_starter', 'trial_discovery', 'trial_storefront', 'trial_commitment',
    'trial_ecommerce', 'trial_omnichannel', 'trial_professional', 'trial_enterprise',
    'trial_chain_starter', 'trial_chain_professional', 'trial_chain_enterprise'
  ];
  v_search_tiers  TEXT[] := ARRAY[
    'ecommerce', 'omnichannel', 'chain_starter',
    'trial_ecommerce', 'trial_omnichannel', 'trial_chain_starter'
  ];
  v_full_tiers    TEXT[] := ARRAY[
    'professional', 'enterprise', 'organization',
    'chain_professional', 'chain_enterprise',
    'trial_professional', 'trial_enterprise',
    'trial_chain_professional', 'trial_chain_enterprise'
  ];
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'wholesale_matching_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type wholesale_matching_options not found';
  END IF;

  -- 4a: All tiers — _enabled=true, _disabled=false
  FOREACH v_tier_key IN ARRAY v_all_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'wholesale_matching_enabled',  'Wholesale Matching Enabled',  true,  false, '{"capability_type": "wholesale_matching_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'wholesale_matching_disabled', 'Wholesale Matching Disabled', false, false, '{"capability_type": "wholesale_matching_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- 4b: Search tiers — _search=true
  FOREACH v_tier_key IN ARRAY v_search_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'wholesale_matching_search', 'Wholesale Matching: Search', true, false, '{"capability_type": "wholesale_matching_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- 4c: Full tiers — _full=true
  FOREACH v_tier_key IN ARRAY v_full_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'wholesale_matching_full', 'Wholesale Matching: Full', true, false, '{"capability_type": "wholesale_matching_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Wholesale matching tier features assigned';
END $$;


-- ============================================================
-- STEP 5: Add flexible key to bsaas_catalog
-- ============================================================

INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order, trial_eligible, demo_eligible, is_private)
VALUES (
  'wholesale_matching_flexible',
  'Wholesale Matching (Flexible)',
  'Unlock all wholesale matching features: supplier match, Faire search, affiliate link building, and brand partner discovery.',
  1900,
  'monthly',
  7,
  true,
  60,
  true,
  false,
  false
)
ON CONFLICT (feature_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order;


-- ============================================================
-- STEP 6: Link capability type to a representative tier (for admin UI)
-- ============================================================

UPDATE capability_type_list ct
SET tier_id = 'tier_professional'
WHERE ct.key = 'wholesale_matching_options'
  AND ct.tier_id IS NULL;


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Verify capability type
-- SELECT key, name, description, category, is_active, sort_order FROM capability_type_list WHERE key = 'wholesale_matching_options';

-- Verify features
-- SELECT key, name, sort_order FROM features_list WHERE category = 'wholesale_matching' ORDER BY sort_order;

-- Verify capability-feature links
-- SELECT f.key, f.name FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'wholesale_matching_options'
--   ORDER BY cf.sort_order;

-- Verify tier features for Professional
-- SELECT tf.feature_key, tf.feature_name, tf.is_enabled FROM tier_features_list tf
--   WHERE tf.tier_id = (SELECT id FROM subscription_tiers_list WHERE tier_key = 'professional')
--   AND tf.feature_key LIKE 'wholesale_matching_%'
--   ORDER BY tf.feature_key;

-- Verify bsaas_catalog entry
-- SELECT feature_key, marketing_name, price_cents, trial_days, is_active FROM bsaas_catalog WHERE feature_key = 'wholesale_matching_flexible';
