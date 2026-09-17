-- ============================================================
-- Sales Funnels Capability Migration
--
-- Creates the tenant_sales_funnels, tenant_funnel_steps, and
-- funnel_events tables, wires the funnel_options capability into
-- the platform feature system, seeds the BSaaS catalog entry, and
-- assigns tier-gated step features.
--
-- Prerequisites: features_list, capability_type_list,
--                capability_features_list, tier_features_list,
--                subscription_tiers_list, bsaas_catalog,
--                tenants, inventory_items tables must exist
-- Date: 2026-07-16
-- ============================================================


-- ============================================================
-- STEP 1: Create tenant_sales_funnels table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_sales_funnels (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  entry_item_id   TEXT,
  trigger_type    TEXT NOT NULL DEFAULT 'product',
  min_cart_value_cents INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_tenant_sales_funnels_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_tenant_sales_funnels_item FOREIGN KEY (entry_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL,
  CONSTRAINT chk_tenant_sales_funnels_trigger_type CHECK (trigger_type IN ('product', 'cart_value', 'always'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_sales_funnels_tenant ON tenant_sales_funnels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_sales_funnels_tenant_active ON tenant_sales_funnels(tenant_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_sales_funnels_entry_item
  ON tenant_sales_funnels(tenant_id, entry_item_id)
  WHERE entry_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_tenant_sales_funnels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenant_sales_funnels_updated_at ON tenant_sales_funnels;
CREATE TRIGGER trigger_tenant_sales_funnels_updated_at
  BEFORE UPDATE ON tenant_sales_funnels
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_sales_funnels_updated_at();

ALTER TABLE tenant_sales_funnels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_sales_funnels_isolation ON tenant_sales_funnels;
CREATE POLICY tenant_sales_funnels_isolation ON tenant_sales_funnels
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ============================================================
-- STEP 2: Create tenant_funnel_steps table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_funnel_steps (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  funnel_id         TEXT NOT NULL,
  step_type         TEXT NOT NULL,
  offer_item_id     TEXT NOT NULL,
  display_title     TEXT,
  display_description TEXT,
  price_cents       INTEGER,
  discount_cents    INTEGER NOT NULL DEFAULT 0,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  accept_to_step_id TEXT,
  skip_to_step_id   TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_tenant_funnel_steps_funnel FOREIGN KEY (funnel_id) REFERENCES tenant_sales_funnels(id) ON DELETE CASCADE,
  CONSTRAINT fk_tenant_funnel_steps_offer_item FOREIGN KEY (offer_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_tenant_funnel_steps_accept_to FOREIGN KEY (accept_to_step_id) REFERENCES tenant_funnel_steps(id) ON DELETE SET NULL,
  CONSTRAINT fk_tenant_funnel_steps_skip_to FOREIGN KEY (skip_to_step_id) REFERENCES tenant_funnel_steps(id) ON DELETE SET NULL,
  CONSTRAINT chk_tenant_funnel_steps_step_type CHECK (step_type IN ('order_bump', 'upsell', 'downsell', 'oto'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_funnel_steps_funnel ON tenant_funnel_steps(funnel_id);
CREATE INDEX IF NOT EXISTS idx_tenant_funnel_steps_funnel_active ON tenant_funnel_steps(funnel_id, is_active, sort_order);

CREATE OR REPLACE FUNCTION update_tenant_funnel_steps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenant_funnel_steps_updated_at ON tenant_funnel_steps;
CREATE TRIGGER trigger_tenant_funnel_steps_updated_at
  BEFORE UPDATE ON tenant_funnel_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_funnel_steps_updated_at();

ALTER TABLE tenant_funnel_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_funnel_steps_isolation ON tenant_funnel_steps;
CREATE POLICY tenant_funnel_steps_isolation ON tenant_funnel_steps
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ============================================================
-- STEP 3: Create funnel_events table
-- ============================================================

CREATE TABLE IF NOT EXISTS funnel_events (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  funnel_id     TEXT NOT NULL,
  step_id       TEXT,
  event_type    TEXT NOT NULL,
  order_id      TEXT,
  session_id    TEXT,
  customer_id   TEXT,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_funnel_events_funnel FOREIGN KEY (funnel_id) REFERENCES tenant_sales_funnels(id) ON DELETE CASCADE,
  CONSTRAINT fk_funnel_events_step FOREIGN KEY (step_id) REFERENCES tenant_funnel_steps(id) ON DELETE SET NULL,
  CONSTRAINT chk_funnel_events_event_type CHECK (event_type IN (
    'viewed', 'accepted', 'declined', 'checkout_started', 'payment_initiated',
    'payment_succeeded', 'payment_failed', 'timeout', 'revenue', 'checkout_completed'
  ))
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel ON funnel_events(funnel_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_step ON funnel_events(step_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_tenant_created ON funnel_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_tenant_event_type ON funnel_events(tenant_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_order_id ON funnel_events(order_id) WHERE order_id IS NOT NULL;

ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS funnel_events_isolation ON funnel_events;
CREATE POLICY funnel_events_isolation ON funnel_events
  USING (tenant_id = current_setting('app.current_tenant_id', true));


-- ============================================================
-- STEP 4: Clean up legacy/renamed funnel feature keys
-- ============================================================
-- If this migration is re-run after earlier key names were seeded,
-- remove the obsolete keys from all dependent tables first.

DO $$
DECLARE
  v_old_keys TEXT[] := ARRAY[
    'funnel_builder_flexible',
    'funnel_builder',
    'funnel_order_bump',
    'funnel_upsell',
    'funnel_downsell',
    'funnel_oto'
  ];
BEGIN
  -- Unlink from capability types before deleting features_list rows
  DELETE FROM capability_features_list
  WHERE feature_id IN (SELECT id FROM features_list WHERE key = ANY(v_old_keys));

  -- Remove tier assignments
  DELETE FROM tier_features_list
  WHERE feature_key = ANY(v_old_keys);

  -- Remove BSaaS catalog entry for the old builder key
  DELETE FROM bsaas_catalog
  WHERE feature_key IN ('funnel_builder');

  -- Remove obsolete feature keys
  DELETE FROM features_list
  WHERE key = ANY(v_old_keys);

  RAISE NOTICE 'Cleaned up % old funnel feature keys', array_length(v_old_keys, 1);
END $$;


-- ============================================================
-- STEP 5: Insert funnel_options feature keys into features_list
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('funnel_options_enabled',                'Funnel Options Enabled',       'Master ON gate for sales funnel capability',                    'funnel_options', true, 0,  NOW(), NOW()),
  ('funnel_options_disabled',               'Funnel Options Disabled',      'Explicit disable gate for sales funnel capability',           'funnel_options', true, 1,  NOW(), NOW()),
  ('funnel_options_flexible',               'Funnel Options Flexible',      'Flexible tier — unlocks all funnel builder features',          'funnel_options', true, 2,  NOW(), NOW()),
  ('funnel_options_builder_on',             'Funnel Builder On',            'Group ON gate — build and manage sales funnels',                'funnel_options', true, 10, NOW(), NOW()),
  ('funnel_options_builder_off',            'Funnel Builder Off',           'Group OFF gate — explicitly block funnel builder',              'funnel_options', true, 11, NOW(), NOW()),
  ('funnel_options_builder_order_bump',       'Funnel Order Bump',            'Pre-checkout order bump offer',                               'funnel_options', true, 20, NOW(), NOW()),
  ('funnel_options_builder_upsell',         'Funnel Upsell',                'Post-purchase upsell step',                                     'funnel_options', true, 21, NOW(), NOW()),
  ('funnel_options_builder_downsell',       'Funnel Downsell',              'Post-purchase downsell step',                                   'funnel_options', true, 22, NOW(), NOW()),
  ('funnel_options_builder_oto',            'Funnel OTO',                   'One-time offer post-purchase step',                             'funnel_options', true, 23, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();


-- ============================================================
-- STEP 5: Create funnel_options capability type
-- ============================================================

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'funnel_options',
  'Sales Funnels',
  'Sales funnel capability — order bumps, upsells, downsells, and one-time offers attached to products or checkout flows.',
  'funnel_options',
  true,
  10,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();


-- ============================================================
-- STEP 6: Link funnel_options features to capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_key TEXT := 'funnel_options';
  v_feature_keys TEXT[] := ARRAY[
    'funnel_options_enabled',
    'funnel_options_disabled',
    'funnel_options_flexible',
    'funnel_options_builder_on',
    'funnel_options_builder_off',
    'funnel_options_builder_order_bump',
    'funnel_options_builder_upsell',
    'funnel_options_builder_downsell',
    'funnel_options_builder_oto'
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
-- STEP 7: Assign tier features
-- ============================================================
DO $$
DECLARE
  v_cap_type_id TEXT;
  v_tier_id TEXT;
  v_tier_key TEXT;

  -- Tiers that get no funnel features beyond the disabled/off gates
  v_none_tiers TEXT[] := ARRAY[
    'trial_starter', 'trial_discovery', 'trial_storefront', 'trial_commitment',
    'trial_ecommerce', 'trial_omnichannel', 'trial_professional', 'trial_enterprise',
    'trial_chain_starter', 'trial_chain_professional', 'trial_chain_enterprise',
    'discovery', 'starter'
  ];

  -- Growth-equivalent tiers: order_bump + upsell
  v_growth_tiers TEXT[] := ARRAY[
    'storefront', 'commitment', 'ecommerce', 'omnichannel', 'chain_starter'
  ];

  -- Scale-equivalent tiers: all funnel step features
  v_scale_tiers TEXT[] := ARRAY[
    'professional', 'chain_professional'
  ];

  -- Enterprise-equivalent tiers: all funnel step features + builder included
  v_enterprise_tiers TEXT[] := ARRAY[
    'enterprise', 'organization', 'chain_enterprise'
  ];
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'funnel_options' LIMIT 1;
  IF v_cap_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type funnel_options not found';
  END IF;

  -- Helper: assign feature key to a tier if not already present
  <<assign>>
  FOR v_tier_key IN
    SELECT unnest(v_none_tiers || v_growth_tiers || v_scale_tiers || v_enterprise_tiers)
  LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'Tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;

    -- Every tier gets explicit enable/disable gates (off by default for none tiers)
    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'funnel_options_enabled',  'Funnel Options Enabled',  false, false, '{"capability_type":"funnel_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'funnel_options_disabled', 'Funnel Options Disabled', true,  false, '{"capability_type":"funnel_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP assign;

  -- Growth tiers: enable master gate + order_bump + upsell
  <<growth>>
  FOREACH v_tier_key IN ARRAY v_growth_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN CONTINUE; END IF;

    UPDATE tier_features_list SET is_enabled = true, is_inherited = false
    WHERE tier_id = v_tier_id AND feature_key = 'funnel_options_enabled';

    UPDATE tier_features_list SET is_enabled = false, is_inherited = false
    WHERE tier_id = v_tier_id AND feature_key = 'funnel_options_disabled';

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'funnel_options_builder_order_bump', 'Funnel Order Bump', true, false, '{"capability_type":"funnel_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'funnel_options_builder_upsell',     'Funnel Upsell',     true, false, '{"capability_type":"funnel_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP growth;

  -- Scale/Enterprise tiers: enable all step features; enterprise also gets builder as included
  <<premium>>
  FOREACH v_tier_key IN ARRAY v_scale_tiers || v_enterprise_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN CONTINUE; END IF;

    UPDATE tier_features_list SET is_enabled = true, is_inherited = false
    WHERE tier_id = v_tier_id AND feature_key = 'funnel_options_enabled';

    UPDATE tier_features_list SET is_enabled = false, is_inherited = false
    WHERE tier_id = v_tier_id AND feature_key = 'funnel_options_disabled';

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'funnel_options_builder_order_bump', 'Funnel Order Bump', true, false, '{"capability_type":"funnel_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'funnel_options_builder_upsell',     'Funnel Upsell',     true, false, '{"capability_type":"funnel_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'funnel_options_builder_downsell',   'Funnel Downsell',   true, false, '{"capability_type":"funnel_options"}'),
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'funnel_options_builder_oto',        'Funnel OTO',        true, false, '{"capability_type":"funnel_options"}')
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP premium;

  -- Enterprise tiers get funnel_options_builder_on as an included feature (not just purchasable)
  <<enterprise>>
  FOREACH v_tier_key IN ARRAY v_enterprise_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name, is_enabled, is_inherited, metadata)
    VALUES
      (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'funnel_options_builder_on', 'Funnel Builder On', true, false, '{"capability_type":"funnel_options"}')
    ON CONFLICT (tier_id, feature_key) DO UPDATE SET is_enabled = true, is_inherited = false;
  END LOOP enterprise;

  RAISE NOTICE 'Funnel tier features assigned';
END $$;


-- ============================================================
-- STEP 8: Add funnel_options_builder_on to bsaas_catalog
-- ============================================================

INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order, trial_eligible, demo_eligible, is_private)
VALUES (
  'funnel_options_builder_on',
  'Sales Funnel Builder',
  'Create post-purchase upsells, downsells, one-time offers, and order bumps to increase average order value.',
  4900,
  'monthly',
  14,
  true,
  80,
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
  sort_order     = EXCLUDED.sort_order,
  trial_eligible = EXCLUDED.trial_eligible,
  demo_eligible  = EXCLUDED.demo_eligible,
  is_private     = EXCLUDED.is_private;


-- ============================================================
-- STEP 9: Link capability type to a representative tier
-- ============================================================

UPDATE capability_type_list SET tier_id = 'tier_professional'
WHERE key = 'funnel_options' AND tier_id IS NULL;


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- SELECT key, name, sort_order FROM features_list WHERE category = 'funnel_options' ORDER BY sort_order;
-- SELECT key, name FROM capability_type_list WHERE key = 'funnel_options';
-- SELECT f.key, f.name FROM capability_features_list cf
--   JOIN features_list f ON f.id = cf.feature_id
--   JOIN capability_type_list ct ON ct.id = cf.capability_type_id
--   WHERE ct.key = 'funnel_options' ORDER BY cf.sort_order;
-- SELECT tier_key, feature_key, is_enabled FROM tier_features_list tf
--   JOIN subscription_tiers_list t ON t.id = tf.tier_id
--   WHERE tf.feature_key LIKE 'funnel_%' ORDER BY t.tier_key, tf.feature_key;
-- SELECT feature_key, marketing_name, price_cents, billing_cycle, trial_days FROM bsaas_catalog WHERE feature_key = 'funnel_options_builder_on';

-- ============================================================
-- STEP 10: Navigation link — Sales Funnels (tenant sidebar)
-- ============================================================

INSERT INTO navigation_links (id, label, href, icon, badge, badge_variant, targets, sort_order, is_enabled, is_divider_before, required_permission, required_group, required_role, metadata, created_by)
SELECT
  'nav-tenant-funnels',
  'Sales Funnels',
  '/t/{tenantId}/settings/funnels',
  'filter',
  'NEW',
  'new',
  ARRAY['tenant'],
  (SELECT sort_order FROM navigation_links WHERE id = 'nav-tenant-directory-promotion') + 10,
  true,
  false,
  '',
  'IS_TENANT_ADMIN',
  '',
  jsonb_build_object(
    'parentKey', (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-directory-promotion'),
    'hasChildren', false,
    'childrenKeys', '[]'::jsonb,
    'nestingLevel', (SELECT (metadata->>'nestingLevel')::int FROM navigation_links WHERE id = 'nav-tenant-directory-promotion')
  ),
  'agent'
WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-funnels')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-directory-promotion');

UPDATE navigation_links
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{childrenKeys}',
  COALESCE(metadata->'childrenKeys', '[]'::jsonb) || to_jsonb('nav-tenant-funnels'::text)
)
WHERE id = (SELECT metadata->>'parentKey' FROM navigation_links WHERE id = 'nav-tenant-directory-promotion')
  AND NOT (metadata->'childrenKeys' ? 'nav-tenant-funnels')
  AND EXISTS (SELECT 1 FROM navigation_links WHERE id = 'nav-tenant-funnels');
