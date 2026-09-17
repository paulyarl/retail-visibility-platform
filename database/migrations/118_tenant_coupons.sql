-- ============================================================
-- Migration 118: Merchant Coupon Capability
--
-- Creates the coupon_options capability domain:
--   1. tenant_coupons          — merchant coupon definitions
--   2. coupon_redemptions      — redemption log (one per successful checkout)
--   3. coupon_events           — raw event log (view, copy, click, validate, redeem, fail)
--   4. coupon_analytics        — period-based aggregate rollups
--   5. tenant_coupon_options_settings — merchant preferences (spotlight toggle, featured coupon)
--
-- Seeds 14 feature keys, coupon_options capability type, capability-feature
-- links, tier assignments, bsaas_catalog entries, and a navigation_links
-- sidebar entry.
--
-- Feature keys:
--   coupon_enabled             (capability gate)
--   coupon_disabled            (capability disable)
--   coupon_flexible            (flexible — unlocks all)
--   coupon_discount_types_on   (group gate ON)
--   coupon_discount_types_off  (group gate OFF)
--   coupon_percent_off         (individual)
--   coupon_fixed_amount        (individual)
--   coupon_free_shipping       (individual)
--   coupon_bogo                (individual)
--   coupon_targeted            (individual)
--   coupon_limited_redemption  (individual)
--   coupon_analytics           (individual)
--   coupon_qr_sharing          (individual)
--   coupon_spotlight           (individual)
--
-- Tier gating:
--   free/discovery/starter/storefront/commitment = none
--   professional/ecommerce/omnichannel = enabled + percent + fixed + free_shipping + limited + analytics + qr + spotlight
--   enterprise/organization/chain_* = all features (flexible)
--
-- Prerequisites: features_list, capability_type_list, capability_features_list,
--                tier_features_list, subscription_tiers_list, bsaas_catalog,
--                navigation_links tables must exist
-- Date: 2026-07-18
-- ============================================================


-- ============================================================
-- STEP 1: Create tenant_coupons table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_coupons (
  id                  VARCHAR(255)  PRIMARY KEY,      -- cpn-{tk}-{nanoid}
  tenant_id           VARCHAR(255)  NOT NULL,
  code                VARCHAR(100)  NOT NULL,         -- alphanumeric + hyphens, 3-50 chars
  discount_type       VARCHAR(20)   NOT NULL,         -- percent_off | fixed_amount | free_shipping | bogo
  discount_value      INT           NOT NULL,         -- percentage (1-100) or cents amount
  min_spend_cents     INT           NOT NULL DEFAULT 0,
  max_redemptions     INT,                            -- nullable = unlimited
  redemption_count    INT           NOT NULL DEFAULT 0,
  expires_at          TIMESTAMPTZ,                    -- nullable = no expiry
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  target_type         VARCHAR(50),                    -- nullable = no targeting; product | category | all
  target_ids          TEXT[],                         -- product/category IDs; NULL = no targeting
  promotional_message TEXT,                           -- merchant marketing copy for spotlight
  terms_summary       VARCHAR(500),                   -- e.g. "Min order $50. Expires Aug 31."
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, code),
  CONSTRAINT fk_tenant_coupons_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_coupons_tenant_code ON tenant_coupons(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_tenant_coupons_active ON tenant_coupons(tenant_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_tenant_coupons_tenant_time ON tenant_coupons(tenant_id, created_at DESC);


-- ============================================================
-- STEP 2: Create coupon_redemptions table
-- ============================================================

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id              VARCHAR(255)  PRIMARY KEY,          -- redm-{tk}-{nanoid}
  tenant_id       VARCHAR(255)  NOT NULL,
  coupon_id       VARCHAR(255)  NOT NULL,
  order_id        VARCHAR(255),
  customer_email  VARCHAR(255),
  discount_cents  INT           NOT NULL,
  redeemed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_coupon_redemptions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_redemptions_coupon FOREIGN KEY (coupon_id) REFERENCES tenant_coupons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_tenant_time ON coupon_redemptions(tenant_id, redeemed_at DESC);


-- ============================================================
-- STEP 3: Create coupon_events table (raw event log)
-- ============================================================

CREATE TABLE IF NOT EXISTS coupon_events (
  id              VARCHAR(255)  PRIMARY KEY,          -- cpe-{tk}-{nanoid}
  tenant_id       VARCHAR(255)  NOT NULL,
  coupon_id       VARCHAR(255),                      -- nullable for invalid code attempts
  coupon_code     VARCHAR(100),                      -- the code entered/displayed
  event_type      VARCHAR(20)   NOT NULL,            -- view, copy, click, validate, redeem, fail
  surface         VARCHAR(30),                       -- storefront, directory, product, checkout, spotlight, qr_code
  session_id      VARCHAR(255),
  order_id        VARCHAR(255),                      -- populated on redeem events
  discount_cents  BIGINT        NOT NULL DEFAULT 0,  -- populated on redeem events
  source          VARCHAR(100)  NOT NULL DEFAULT 'coupon',
  referrer        TEXT,
  user_agent      TEXT,
  geo_country     VARCHAR(10),
  geo_city        VARCHAR(100),
  device_type     VARCHAR(20),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_coupon_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coupon_events_tenant_time ON coupon_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_events_tenant_event_time ON coupon_events(tenant_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_events_coupon ON coupon_events(coupon_id) WHERE coupon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coupon_events_surface ON coupon_events(surface);


-- ============================================================
-- STEP 4: Create coupon_analytics table (period rollups)
-- ============================================================

CREATE TABLE IF NOT EXISTS coupon_analytics (
  id                      VARCHAR(255)  PRIMARY KEY,  -- cpa-{tk}-{nanoid}
  tenant_id               VARCHAR(255)  NOT NULL,
  coupon_id               VARCHAR(255),              -- nullable for aggregate-all-coupons rows
  event_type              VARCHAR(20)   NOT NULL,
  surface                 VARCHAR(30),
  period_start            DATE          NOT NULL,
  period_end              DATE          NOT NULL,
  period_type             VARCHAR(10)   NOT NULL DEFAULT 'day',

  total_events            INT           NOT NULL DEFAULT 0,
  unique_visitors         INT           NOT NULL DEFAULT 0,
  unique_coupons          INT           NOT NULL DEFAULT 0,
  conversion_count        INT           NOT NULL DEFAULT 0,
  conversion_rate         DECIMAL(8,4)  NOT NULL DEFAULT 0,

  discount_cents          BIGINT        NOT NULL DEFAULT 0,
  revenue_cents           BIGINT        NOT NULL DEFAULT 0,
  avg_discount_per_redeem BIGINT        NOT NULL DEFAULT 0,

  top_country             VARCHAR(10),
  top_city                VARCHAR(100),
  mobile_scans            INT           NOT NULL DEFAULT 0,
  desktop_scans           INT           NOT NULL DEFAULT 0,
  tablet_scans            INT           NOT NULL DEFAULT 0,

  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, coupon_id, event_type, surface, period_start, period_type)
);

CREATE INDEX IF NOT EXISTS idx_coupon_analytics_tenant_period ON coupon_analytics(tenant_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_analytics_tenant_event ON coupon_analytics(tenant_id, event_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_analytics_tenant_coupon ON coupon_analytics(tenant_id, coupon_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_analytics_period_type ON coupon_analytics(period_type, period_start DESC);


-- ============================================================
-- STEP 5: Create tenant_coupon_options_settings table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_coupon_options_settings (
  id                    VARCHAR(255)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id             VARCHAR(255)  NOT NULL UNIQUE,
  coupon_enabled        BOOLEAN       NOT NULL DEFAULT false,
  spotlight_enabled     BOOLEAN       NOT NULL DEFAULT false,
  featured_coupon_id    VARCHAR(255),                -- references tenant_coupons.id (no FK — may be null when coupon deleted)
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_coupon_options_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coupon_options_tenant ON tenant_coupon_options_settings(tenant_id);


-- ============================================================
-- STEP 6: updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION update_tenant_coupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_coupons_updated_at ON tenant_coupons;
CREATE TRIGGER trg_tenant_coupons_updated_at
  BEFORE UPDATE ON tenant_coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_coupons_updated_at();

CREATE OR REPLACE FUNCTION update_coupon_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_coupon_analytics_updated_at ON coupon_analytics;
CREATE TRIGGER trg_coupon_analytics_updated_at
  BEFORE UPDATE ON coupon_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_coupon_analytics_updated_at();

CREATE OR REPLACE FUNCTION update_coupon_options_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_coupon_options_settings_updated_at ON tenant_coupon_options_settings;
CREATE TRIGGER trg_coupon_options_settings_updated_at
  BEFORE UPDATE ON tenant_coupon_options_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_coupon_options_settings_updated_at();


-- ============================================================
-- STEP 7: RLS Policies
-- ============================================================

-- tenant_coupons: tenant-scoped CRUD
ALTER TABLE tenant_coupons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_coupons_tenant_all ON tenant_coupons
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY tenant_coupons_admin_all ON tenant_coupons
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- coupon_redemptions: tenant-scoped read, service write
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY coupon_redemptions_tenant_read ON coupon_redemptions
    FOR SELECT
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY coupon_redemptions_admin_read ON coupon_redemptions
    FOR SELECT
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY coupon_redemptions_service_write ON coupon_redemptions
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- coupon_events: public INSERT (storefront tracking), tenant read
ALTER TABLE coupon_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY coupon_events_public_insert ON coupon_events
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY coupon_events_tenant_read ON coupon_events
    FOR SELECT
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY coupon_events_admin_read ON coupon_events
    FOR SELECT
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY coupon_events_service_write ON coupon_events
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- coupon_analytics: tenant read, service write (mirrors qr_analytics)
ALTER TABLE coupon_analytics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY coupon_analytics_tenant_read ON coupon_analytics
    FOR SELECT
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY coupon_analytics_admin_read ON coupon_analytics
    FOR SELECT
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY coupon_analytics_service_write ON coupon_analytics
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- tenant_coupon_options_settings: tenant-scoped CRUD
ALTER TABLE tenant_coupon_options_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY coupon_options_settings_tenant_all ON tenant_coupon_options_settings
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY coupon_options_settings_admin_all ON tenant_coupon_options_settings
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- STEP 8: Seed 14 coupon feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('coupon_enabled',             'Coupon Engine Enabled',       'Master ON gate for merchant coupon capability',                    'coupon_options', true, 0,  NOW(), NOW()),
  ('coupon_disabled',            'Coupon Engine Disabled',      'Explicit deactivation gate for merchant coupons',                  'coupon_options', true, 1,  NOW(), NOW()),
  ('coupon_flexible',            'Coupon Flexible',             'Flexible tier — unlocks all coupon features without individual keys', 'coupon_options', true, 2,  NOW(), NOW()),
  ('coupon_discount_types_on',   'All Discount Types On',       'Group gate ON — enables all discount type features',               'coupon_options', true, 3,  NOW(), NOW()),
  ('coupon_discount_types_off',  'All Discount Types Off',      'Group gate OFF — disables all discount type features',             'coupon_options', true, 4,  NOW(), NOW()),
  ('coupon_percent_off',         'Percentage Discounts',        'Create percentage-based coupons (e.g. 20% off)',                   'coupon_options', true, 5,  NOW(), NOW()),
  ('coupon_fixed_amount',        'Fixed Amount Discounts',      'Create fixed-amount coupons (e.g. $10 off)',                       'coupon_options', true, 6,  NOW(), NOW()),
  ('coupon_free_shipping',       'Free Shipping Coupons',       'Create free shipping coupons',                                     'coupon_options', true, 7,  NOW(), NOW()),
  ('coupon_bogo',                'BOGO Coupons',                'Create buy-one-get-one coupons',                                   'coupon_options', true, 8,  NOW(), NOW()),
  ('coupon_targeted',            'Product/Category Targeting',  'Target coupons to specific products or categories',                'coupon_options', true, 9,  NOW(), NOW()),
  ('coupon_limited_redemption',  'Usage Limits & Expiry',       'Set max redemption counts and expiry dates on coupons',            'coupon_options', true, 10, NOW(), NOW()),
  ('coupon_analytics',           'Coupon Analytics',            'Redemption analytics dashboard with conversion funnel and ROI',   'coupon_options', true, 11, NOW(), NOW()),
  ('coupon_qr_sharing',          'QR Code Sharing',             'Generate styled QR codes for coupon codes with short-code URLs',  'coupon_options', true, 12, NOW(), NOW()),
  ('coupon_spotlight',           'Coupon Spotlight',            'Featured coupon display on public surfaces (storefront, directory, product pages)', 'coupon_options', true, 13, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();


-- ============================================================
-- STEP 9: Create coupon_options capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'coupon_options',
  'Merchant Coupons',
  'Merchant-managed coupon codes with checkout validation, redemption tracking, QR sharing, spotlight display, and analytics.',
  'coupon_options',
  true,
  26,
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
-- STEP 10: Link all 14 coupon features to capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key  TEXT  := 'coupon_options';
  v_feature_keys         TEXT[] := ARRAY[
    'coupon_enabled',
    'coupon_disabled',
    'coupon_flexible',
    'coupon_discount_types_on',
    'coupon_discount_types_off',
    'coupon_percent_off',
    'coupon_fixed_amount',
    'coupon_free_shipping',
    'coupon_bogo',
    'coupon_targeted',
    'coupon_limited_redemption',
    'coupon_analytics',
    'coupon_qr_sharing',
    'coupon_spotlight'
  ];
  v_capability_type_id TEXT;
  v_feature_id TEXT;
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
-- STEP 11: Assign tier features
-- ============================================================
-- All tiers get _enabled=false and _disabled=true by default (opt-in capability).
-- Professional+ tiers get _enabled=true, _disabled=false + core features.
-- Enterprise+ tiers get all features including _flexible, _bogo, _targeted.

DO $$
DECLARE
  v_cap_type_id   TEXT;
  v_tier_id       TEXT;
  v_tier_key      TEXT;

  -- All known tiers
  v_all_tiers     TEXT[] := ARRAY[
    'discovery', 'starter', 'storefront', 'commitment', 'ecommerce', 'omnichannel',
    'professional', 'enterprise', 'organization',
    'chain_starter', 'chain_professional', 'chain_enterprise',
    'trial_starter', 'trial_discovery', 'trial_storefront', 'trial_commitment',
    'trial_ecommerce', 'trial_omnichannel', 'trial_professional', 'trial_enterprise',
    'trial_chain_starter', 'trial_chain_professional', 'trial_chain_enterprise'
  ];

  -- Professional+ tiers (core coupon features)
  v_prof_tiers    TEXT[] := ARRAY[
    'professional', 'ecommerce', 'omnichannel',
    'trial_professional', 'trial_ecommerce', 'trial_omnichannel',
    'chain_professional', 'trial_chain_professional'
  ];

  -- Enterprise+ tiers (all features including bogo, targeted, flexible)
  v_ent_tiers     TEXT[] := ARRAY[
    'enterprise', 'organization', 'chain_enterprise',
    'trial_enterprise', 'trial_chain_enterprise'
  ];

  -- Chain starter gets enabled but no individual features (must purchase)
  v_chain_starter TEXT[] := ARRAY['chain_starter', 'trial_chain_starter'];
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'coupon_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type coupon_options not found';
  END IF;

  -- 11a: All tiers — _enabled=false, _disabled=true (opt-in capability)
  FOREACH v_tier_key IN ARRAY v_all_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_enabled',  'Coupon Engine Enabled',  false, false, '{"capability_type": "coupon_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_disabled', 'Coupon Engine Disabled', true,  false, '{"capability_type": "coupon_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  -- 11b: Professional+ tiers — _enabled=true, _disabled=false + core features
  FOREACH v_tier_key IN ARRAY v_prof_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN CONTINUE; END IF;

    -- Enable the master gate
    UPDATE tier_features_list SET is_enabled = true
      WHERE tier_id = v_tier_id AND feature_key = 'coupon_enabled';
    UPDATE tier_features_list SET is_enabled = false
      WHERE tier_id = v_tier_id AND feature_key = 'coupon_disabled';

    -- Core features
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_discount_types_on',  'All Discount Types On',      true,  false, '{"capability_type": "coupon_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_percent_off',        'Percentage Discounts',       true,  false, '{"capability_type": "coupon_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_fixed_amount',       'Fixed Amount Discounts',      true,  false, '{"capability_type": "coupon_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_free_shipping',      'Free Shipping Coupons',       true,  false, '{"capability_type": "coupon_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_limited_redemption', 'Usage Limits & Expiry',       true,  false, '{"capability_type": "coupon_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_analytics',          'Coupon Analytics',            true,  false, '{"capability_type": "coupon_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_qr_sharing',         'QR Code Sharing',             true,  false, '{"capability_type": "coupon_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_spotlight',          'Coupon Spotlight',            true,  false, '{"capability_type": "coupon_options"}')
    ON CONFLICT (tier_id, feature_key) DO UPDATE SET is_enabled = true, is_inherited = false;
  END LOOP;

  -- 11c: Enterprise+ tiers — all features including bogo, targeted, flexible
  FOREACH v_tier_key IN ARRAY v_ent_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN CONTINUE; END IF;

    -- Enable the master gate
    UPDATE tier_features_list SET is_enabled = true
      WHERE tier_id = v_tier_id AND feature_key = 'coupon_enabled';
    UPDATE tier_features_list SET is_enabled = false
      WHERE tier_id = v_tier_id AND feature_key = 'coupon_disabled';

    -- Enterprise-only features
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_flexible',    'Coupon Flexible',           true, false, '{"capability_type": "coupon_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_bogo',        'BOGO Coupons',              true, false, '{"capability_type": "coupon_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'coupon_targeted',    'Product/Category Targeting', true, false, '{"capability_type": "coupon_options"}')
    ON CONFLICT (tier_id, feature_key) DO UPDATE SET is_enabled = true, is_inherited = false;
  END LOOP;

  RAISE NOTICE 'Coupon tier features assigned';
END $$;


-- ============================================================
-- STEP 12: Seed bsaas_catalog entries (11 purchasable items)
-- ============================================================

INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order, trial_eligible, demo_eligible, is_private)
VALUES
  ('coupon_enabled',             'Coupon Engine',              'Create and manage merchant coupons with checkout validation and redemption tracking.',                 1900, 'monthly', 14, true, 100, true,  true,  false),
  ('coupon_discount_types_on',   'All Discount Types',         'Unlock all discount types: percentage, fixed amount, free shipping, and BOGO coupons.',               2500, 'monthly', 14, true, 101, true,  true,  false),
  ('coupon_percent_off',         'Percentage Discounts',       'Create percentage-based coupons (e.g. 20% off entire order).',                                        900,  'monthly', 14, true, 102, true,  true,  false),
  ('coupon_fixed_amount',        'Fixed Amount Discounts',     'Create fixed-amount coupons (e.g. $10 off orders over $50).',                                        900,  'monthly', 14, true, 103, true,  true,  false),
  ('coupon_free_shipping',       'Free Shipping Coupons',      'Offer free shipping coupons to incentivize larger orders.',                                          1200, 'monthly', 14, true, 104, true,  true,  false),
  ('coupon_bogo',                'BOGO Coupons',               'Create buy-one-get-one coupons for product promotions.',                                             1500, 'monthly', 14, true, 105, true,  true,  false),
  ('coupon_targeted',            'Product/Category Targeting', 'Target coupons to specific products or categories for precise promotions.',                          1500, 'monthly', 14, true, 106, true,  true,  false),
  ('coupon_limited_redemption',  'Usage Limits & Expiry',      'Set max redemption counts and expiry dates to control coupon usage.',                                 900,  'monthly', 14, true, 107, true,  true,  false),
  ('coupon_analytics',           'Coupon Analytics',           'Redemption analytics dashboard with conversion funnel, ROI report, and per-coupon performance.',     1200, 'monthly', 14, true, 108, true,  true,  false),
  ('coupon_qr_sharing',          'QR Code Sharing',            'Generate styled QR codes for coupon codes with short-code URLs for offline marketing.',              1200, 'monthly', 14, true, 109, true,  true,  false),
  ('coupon_spotlight',           'Coupon Spotlight',           'Feature a coupon on your storefront, directory listing, and product pages with a promotional banner.', 900,  'monthly', 14, true, 110, true,  true,  false)
ON CONFLICT (feature_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  trial_eligible = EXCLUDED.trial_eligible,
  demo_eligible  = EXCLUDED.demo_eligible,
  is_private     = EXCLUDED.is_private,
  updated_at     = NOW();


-- ============================================================
-- STEP 13: Seed navigation_links sidebar entry
-- ============================================================

INSERT INTO navigation_links (
  id, label, href, icon, badge, badge_variant,
  targets, sort_order, is_enabled, is_divider_before,
  required_permission, required_group, required_role,
  metadata, created_by
) VALUES (
  'custom-coupons',
  'Coupons',
  '/t/{tenantId}/settings/coupons',
  'tags',
  'NEW',
  'new',
  ARRAY['tenant'],
  115,
  true,
  false,
  '',
  'IS_TENANT_USER',
  '',
  '{"nestingLevel": 0, "parentKey": null, "hasChildren": false, "childrenKeys": []}'::json,
  'agent'
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  href = EXCLUDED.href,
  icon = EXCLUDED.icon,
  badge = EXCLUDED.badge,
  is_enabled = EXCLUDED.is_enabled,
  sort_order = EXCLUDED.sort_order;


-- ============================================================
-- STEP 14: Link capability type to representative tier (admin UI)
-- ============================================================

UPDATE capability_type_list ct
SET tier_id = (SELECT id FROM subscription_tiers_list WHERE tier_key = 'professional' AND is_active = true LIMIT 1)
WHERE ct.key = 'coupon_options'
  AND ct.tier_id IS NULL;


-- ============================================================
-- STEP 15: Comments
-- ============================================================

COMMENT ON TABLE tenant_coupons IS 'Merchant coupon definitions — one per coupon code per tenant';
COMMENT ON TABLE coupon_redemptions IS 'Coupon redemption log — one row per successful checkout with a coupon';
COMMENT ON TABLE coupon_events IS 'Raw coupon event log for analytics — view, copy, click, validate, redeem, fail events from all surfaces';
COMMENT ON TABLE coupon_analytics IS 'Per-tenant, per-coupon, per-event-type, per-period aggregate coupon metrics';
COMMENT ON TABLE tenant_coupon_options_settings IS 'Merchant preferences for coupon capability — master toggle, spotlight toggle, featured coupon ID';

COMMENT ON COLUMN tenant_coupons.discount_type IS 'Coupon type: percent_off, fixed_amount, free_shipping, bogo';
COMMENT ON COLUMN coupon_events.event_type IS 'Event type: view, copy, click, validate, redeem, fail';
COMMENT ON COLUMN coupon_events.surface IS 'Surface where event occurred: storefront, directory, product, checkout, spotlight, qr_code';


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Verify capability type
-- SELECT key, name, description, category, is_active, sort_order FROM capability_type_list WHERE key = 'coupon_options';

-- Verify features
-- SELECT key, name, sort_order FROM features_list WHERE category = 'coupon_options' ORDER BY sort_order;

-- Verify capability-feature links
-- SELECT f.key, f.name FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'coupon_options'
--   ORDER BY cf.sort_order;

-- Verify tier features for Professional
-- SELECT tf.feature_key, tf.feature_name, tf.is_enabled FROM tier_features_list tf
--   WHERE tf.tier_id = (SELECT id FROM subscription_tiers_list WHERE tier_key = 'professional')
--   AND tf.feature_key LIKE 'coupon_%'
--   ORDER BY tf.feature_key;

-- Verify bsaas_catalog entries
-- SELECT feature_key, marketing_name, price_cents, trial_days, is_active FROM bsaas_catalog WHERE feature_key LIKE 'coupon_%' ORDER BY sort_order;

-- Verify navigation link
-- SELECT id, label, href, icon, targets, is_enabled FROM navigation_links WHERE id = 'custom-coupons';

-- Verify tables
-- SELECT tablename FROM pg_tables WHERE tablename IN ('tenant_coupons', 'coupon_redemptions', 'coupon_events', 'coupon_analytics', 'tenant_coupon_options_settings') ORDER BY tablename;
