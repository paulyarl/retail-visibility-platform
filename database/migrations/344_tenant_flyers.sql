-- Migration 344: Tenant Flyers — time-boxed, image-led specials surface
--
-- Spec: docs/LocalBiz/FLYER_SURFACE_SPEC.md
--
-- Creates the flyer capability surface end-to-end:
--   * tenant_flyers                    — merchant-authored flyer (window + image + items)
--   * tenant_flyer_items               — flyer → catalog item OR dish-variant links (XOR)
--   * tenant_flyer_options_settings    — merchant soft-gate toggles (per-surface display)
--   * tenant_flyer_reports             — public report → ops suppress (reactive moderation)
--   * tenant_flyer_card_orders         — printed QR card pack orders (Phase 3; platform
--                                        delegates production to a print vendor)
--
-- Capability side:
--   * new capability_type_list row 'flyer' + 12 flyer_* feature keys linked to it
--   * separate capability_type_list row 'flyer_gbp' for flyer_gbp_publish — keeps the
--     channel-action key OUT of flyer_flexible's expansion (spec §2, decision (a))
--   * tier_features_list grants: storefront / commitment / ecommerce / omnichannel /
--     professional / organization / enterprise (db_only tiers grant here, not bags)
--
-- No flyer_disabled grants: veto keys are seeded + linked but granted to NO tier
-- (new enabled vetoes fail tier-db-witness.test.ts TIER_VETO_BASELINE by design).
--
-- Idempotent: IF NOT EXISTS / ON CONFLICT guards throughout.

-- ============================================================
-- 1. tenant_flyers
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_flyers (
  id              VARCHAR(50)  PRIMARY KEY,                    -- 'fly-' prefixed, app-minted
  tenant_id       VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           VARCHAR(160) NOT NULL,
  summary         TEXT,
  hero_image_url  TEXT,                                        -- flyer artwork (the WhatsApp image)
  starts_at       TIMESTAMPTZ  NOT NULL,
  ends_at         TIMESTAMPTZ  NOT NULL,                       -- generic window: day | weekend | week | custom
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft',       -- draft|scheduled|published|expired|archived|suppressed
  cta_mode        VARCHAR(16)  NOT NULL DEFAULT 'auto',        -- auto|order|view
  share_code      VARCHAR(12)  UNIQUE,                         -- standalone link: /flyer/<code>
  impressions     INT          NOT NULL DEFAULT 0,
  clicks          INT          NOT NULL DEFAULT 0,
  gbp_post_id     VARCHAR(50),                                 -- dual-published GBP OFFER post (Phase 3)
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_flyer_status   CHECK (status IN ('draft','scheduled','published','expired','archived','suppressed')),
  CONSTRAINT chk_flyer_cta_mode CHECK (cta_mode IN ('auto','order','view')),
  CONSTRAINT chk_flyer_window   CHECK (ends_at > starts_at)
);

-- Live-flyer lookup (the only read pattern the public endpoints use)
CREATE INDEX IF NOT EXISTS idx_tenant_flyers_live
  ON tenant_flyers (tenant_id, ends_at) WHERE status = 'published';

-- /flyer/[code] slug-hit fallback: most-recent flyer when nothing is live
CREATE INDEX IF NOT EXISTS idx_tenant_flyers_tenant_status
  ON tenant_flyers (tenant_id, status, ends_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_flyers_share_code
  ON tenant_flyers (share_code) WHERE share_code IS NOT NULL;

-- ============================================================
-- 2. tenant_flyer_items — flyer → catalog item XOR dish variant
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_flyer_items (
  id                VARCHAR(50)  PRIMARY KEY,                  -- 'fli-' prefixed, app-minted
  flyer_id          VARCHAR(50)  NOT NULL REFERENCES tenant_flyers(id) ON DELETE CASCADE,
  inventory_item_id VARCHAR(255) REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_id        VARCHAR(255) REFERENCES product_variants(id) ON DELETE CASCADE,
  sort_order        INT          NOT NULL DEFAULT 0,
  note              VARCHAR(120),                              -- "serves 4", "vegan", "while it lasts"
  CONSTRAINT chk_flyer_item_target CHECK (
    (variant_id IS NOT NULL) <> (inventory_item_id IS NOT NULL)  -- exactly one target
  )
);

-- NULLs are distinct in PG uniques, so each index only dedupes its own kind
CREATE UNIQUE INDEX IF NOT EXISTS uq_flyer_item_item
  ON tenant_flyer_items (flyer_id, inventory_item_id) WHERE inventory_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_flyer_item_variant
  ON tenant_flyer_items (flyer_id, variant_id)        WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_flyer_items_flyer
  ON tenant_flyer_items (flyer_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_flyer_items_variant
  ON tenant_flyer_items (variant_id) WHERE variant_id IS NOT NULL;

-- ============================================================
-- 3. tenant_flyer_options_settings — merchant soft gates
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_flyer_options_settings (
  id                        VARCHAR(255) PRIMARY KEY,          -- 'flos-' prefixed, app-assigned
  tenant_id                 VARCHAR(255) UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flyer_display             BOOLEAN DEFAULT true,              -- master merchant toggle
  flyer_storefront_display  BOOLEAN DEFAULT true,
  flyer_directory_display   BOOLEAN DEFAULT true,
  flyer_place_display       BOOLEAN DEFAULT true,
  flyer_frozen_display      BOOLEAN DEFAULT true,              -- frozen panel (only when flyer_frozen granted)
  default_title             VARCHAR(160) DEFAULT 'Featured Specials',
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_flyer_options_settings_tenant
  ON tenant_flyer_options_settings(tenant_id);

-- ============================================================
-- 4. tenant_flyer_reports — reactive moderation (report → suppress)
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_flyer_reports (
  id           VARCHAR(50)  PRIMARY KEY,                       -- 'flr-' prefixed, app-minted
  flyer_id     VARCHAR(50)  NOT NULL REFERENCES tenant_flyers(id) ON DELETE CASCADE,
  reason       VARCHAR(32)  NOT NULL,                          -- nudity|violence|illegal|spam|ip|other
  detail       TEXT,
  reporter_ip  VARCHAR(64),
  status       VARCHAR(16)  NOT NULL DEFAULT 'open',           -- open|actioned|dismissed
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_flyer_report_status CHECK (status IN ('open','actioned','dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_flyer_reports_flyer
  ON tenant_flyer_reports (flyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_flyer_reports_status
  ON tenant_flyer_reports (status, created_at DESC);

-- ============================================================
-- 5. tenant_flyer_card_orders — printed QR card packs (Phase 3)
-- ============================================================
-- Platform takes the refill order, delegates production to a print vendor
-- (Lob/Printful-class API). Platform holds no inventory; vendor dropships
-- and reports status back via webhook.

CREATE TABLE IF NOT EXISTS tenant_flyer_card_orders (
  id                VARCHAR(50)  PRIMARY KEY,                  -- 'fco-' prefixed, app-minted
  tenant_id         VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pack_size         INT          NOT NULL,                     -- 25 | 50 | 100
  pack_count        INT          NOT NULL DEFAULT 1,
  vendor            VARCHAR(32)  NOT NULL,                     -- lob|printful|…
  vendor_order_id   VARCHAR(128),
  status            VARCHAR(16)  NOT NULL DEFAULT 'submitted', -- submitted|printed|shipped|delivered|cancelled
  shipping_address  JSONB,
  unit_cost_cents   INT,
  total_cost_cents  INT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_flyer_card_pack   CHECK (pack_size IN (25,50,100)),
  CONSTRAINT chk_flyer_card_status CHECK (status IN ('submitted','printed','shipped','delivered','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_flyer_card_orders_tenant
  ON tenant_flyer_card_orders (tenant_id, created_at DESC);

-- ============================================================
-- 6. updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at_tenant_flyers()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_tenant_flyers ON tenant_flyers;
CREATE TRIGGER set_updated_at_tenant_flyers
  BEFORE UPDATE ON tenant_flyers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at_tenant_flyers();

CREATE OR REPLACE FUNCTION trigger_set_updated_at_tenant_flyer_options()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_tenant_flyer_options ON tenant_flyer_options_settings;
CREATE TRIGGER set_updated_at_tenant_flyer_options
  BEFORE UPDATE ON tenant_flyer_options_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at_tenant_flyer_options();

CREATE OR REPLACE FUNCTION trigger_set_updated_at_tenant_flyer_card_orders()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_tenant_flyer_card_orders ON tenant_flyer_card_orders;
CREATE TRIGGER set_updated_at_tenant_flyer_card_orders
  BEFORE UPDATE ON tenant_flyer_card_orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at_tenant_flyer_card_orders();

-- ============================================================
-- 7. RLS — mirrors migration 118 (coupon tables)
-- ============================================================

ALTER TABLE tenant_flyers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_flyers_tenant_all ON tenant_flyers
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY tenant_flyers_admin_all ON tenant_flyers
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE tenant_flyer_items ENABLE ROW LEVEL SECURITY;

-- tenant_flyer_items carries no tenant_id — scope through the parent flyer
DO $$ BEGIN
  CREATE POLICY tenant_flyer_items_tenant_all ON tenant_flyer_items
    FOR ALL
    USING (EXISTS (
      SELECT 1 FROM tenant_flyers tf
      WHERE tf.id = flyer_id
        AND tf.tenant_id::text = current_setting('app.current_tenant_id', true)
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM tenant_flyers tf
      WHERE tf.id = flyer_id
        AND tf.tenant_id::text = current_setting('app.current_tenant_id', true)
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY tenant_flyer_items_admin_all ON tenant_flyer_items
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE tenant_flyer_options_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY flyer_options_settings_tenant_all ON tenant_flyer_options_settings
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY flyer_options_settings_admin_all ON tenant_flyer_options_settings
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE tenant_flyer_reports ENABLE ROW LEVEL SECURITY;

-- Reports are public-write (anonymous reporters), admin-read/action —
-- merchants do NOT see reports against their flyers
DO $$ BEGIN
  CREATE POLICY flyer_reports_public_insert ON tenant_flyer_reports
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY flyer_reports_admin_all ON tenant_flyer_reports
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE tenant_flyer_card_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY flyer_card_orders_tenant_all ON tenant_flyer_card_orders
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY flyer_card_orders_admin_all ON tenant_flyer_card_orders
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 8. capability_type_list — 'flyer' module + 'flyer_gbp' channel type
-- ============================================================
-- 'flyer_gbp' is deliberately a separate capability type: the MV's flexible
-- expansion emits every active non-negative key linked to a type, so keeping
-- the channel-action key out of the 'flyer' type is what makes
-- flyer_gbp_publish exempt from flyer_flexible (spec §2, decision (a)).

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('flyer',     'Flyer',           'Time-boxed specials flyer surface — storefront, directory, place, and share-link display with optional orderable items', 'flyer', true, 0, NOW(), NOW()),
  ('flyer_gbp', 'Flyer GBP Publish', 'Channel action: dual-publish a flyer as a GBP OFFER post. Explicit grant only — never covered by flyer_flexible',       'flyer', true, 0, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- ============================================================
-- 9. features_list — flyer_* keys
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('flyer_enabled',       'Flyer Enabled',            'Master ON gate for the flyer module',                                        'flyer', true, 0,  NOW(), NOW()),
  ('flyer_on',            'Flyer On',                 'Master ON gate (alias of flyer_enabled)',                                    'flyer', true, 1,  NOW(), NOW()),
  ('flyer_disabled',      'Flyer Disabled',           'Explicit deactivation gate for the flyer module — absolute veto',            'flyer', true, 2,  NOW(), NOW()),
  ('flyer_flexible',      'Flyer Flexible',           'Unlock all flyer display features (excludes channel actions)',               'flyer', true, 3,  NOW(), NOW()),
  ('flyer_storefront_on', 'Flyer: Storefront Surface','Render the flyer section on the tenant storefront',                          'flyer', true, 4,  NOW(), NOW()),
  ('flyer_directory_on',  'Flyer: Directory Surface', 'Render the flyer section on the directory entry',                            'flyer', true, 5,  NOW(), NOW()),
  ('flyer_place_on',      'Flyer: Place Surface',     'Render the flyer section on the place page',                                 'flyer', true, 6,  NOW(), NOW()),
  ('flyer_image',         'Flyer: Image Upload',      'Hero/flyer artwork upload for flyer cards',                                  'flyer', true, 7,  NOW(), NOW()),
  ('flyer_items_5',       'Flyer: 5 Items',           'Link up to 5 items/dish variants per flyer',                                 'flyer', true, 8,  NOW(), NOW()),
  ('flyer_items_10',      'Flyer: 10 Items',          'Link up to 10 items/dish variants per flyer',                                'flyer', true, 9,  NOW(), NOW()),
  ('flyer_items_20',      'Flyer: 20 Items',          'Link up to 20 items/dish variants per flyer',                                'flyer', true, 10, NOW(), NOW()),
  ('flyer_frozen',        'Flyer: Frozen Specials',   'Frozen-twin workflow + FrozenSpecialsPanel beneath the flyer',               'flyer', true, 11, NOW(), NOW()),
  ('flyer_recurring',     'Flyer: Recurring Windows', 'Repeat-window presets (daily/weekly auto-roll)',                             'flyer', true, 12, NOW(), NOW()),
  ('flyer_gbp_publish',   'Flyer: GBP Publish',       'Dual-publish a flyer as a GBP OFFER post (channel action — explicit grant)','flyer', true, 0,  NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- ============================================================
-- 10. capability_features_list links (mandatory — _flexible
--     expansion reads this table exclusively)
-- ============================================================

DO $$
DECLARE
  v_flyer_type_id TEXT;
  v_gbp_type_id   TEXT;
  v_key           TEXT;
  v_feature_id    TEXT;
BEGIN
  SELECT id INTO v_flyer_type_id FROM capability_type_list WHERE key = 'flyer' LIMIT 1;
  SELECT id INTO v_gbp_type_id   FROM capability_type_list WHERE key = 'flyer_gbp' LIMIT 1;

  IF v_flyer_type_id IS NULL OR v_gbp_type_id IS NULL THEN
    RAISE EXCEPTION 'flyer capability type rows missing — aborting feature links';
  END IF;

  FOR v_key IN
    SELECT * FROM (VALUES
      ('flyer_enabled'), ('flyer_on'), ('flyer_disabled'), ('flyer_flexible'),
      ('flyer_storefront_on'), ('flyer_directory_on'), ('flyer_place_on'),
      ('flyer_image'), ('flyer_items_5'), ('flyer_items_10'), ('flyer_items_20'),
      ('flyer_frozen'), ('flyer_recurring')
    ) AS t(key)
  LOOP
    SELECT id INTO v_feature_id FROM features_list WHERE key = v_key LIMIT 1;
    IF v_feature_id IS NULL THEN
      RAISE NOTICE 'Feature % not found — skipping', v_key;
      CONTINUE;
    END IF;

    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    VALUES (v_flyer_type_id, v_feature_id, true, 0, NOW(), NOW())
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
      is_active = true, updated_at = NOW();
  END LOOP;

  -- Channel-action key lives under the separate 'flyer_gbp' type
  SELECT id INTO v_feature_id FROM features_list WHERE key = 'flyer_gbp_publish' LIMIT 1;
  IF v_feature_id IS NOT NULL THEN
    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    VALUES (v_gbp_type_id, v_feature_id, true, 0, NOW(), NOW())
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
      is_active = true, updated_at = NOW();
  END IF;
END $$;

-- ============================================================
-- 11. tier_features_list grants
-- ============================================================
-- Grant table (spec §2):
--   storefront                     → flyer_on, flyer_storefront_on, flyer_image, flyer_items_5
--   commitment / ecommerce         → storefront set + directory/place + items_10 + frozen
--   omnichannel / professional /
--   organization / enterprise      → + flyer_flexible + items_20 + recurring
--                                    (display keys granted EXPLICITLY — merge-path
--                                     _flexible expansion does not cover tier grants)
--   flyer_gbp_publish              → granted to NO tier (purchase/admin-grant only,
--                                    matching the gbp_* keys' posture — no tier holds
--                                    gbp_posts_scheduler either)
--   flyer_disabled                 → granted to NO tier (veto baseline pin)

INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, capability_type_id, is_enabled, is_inherited, created_at, updated_at)
SELECT gen_random_uuid()::text, stl.id, v.feature_key, v.feature_name,
       (SELECT id FROM capability_type_list WHERE key = 'flyer'), true, false, NOW(), NOW()
FROM subscription_tiers_list stl
CROSS JOIN (VALUES
  ('flyer_on',            'Flyer On'),
  ('flyer_storefront_on', 'Flyer: Storefront Surface'),
  ('flyer_image',         'Flyer: Image Upload'),
  ('flyer_items_5',       'Flyer: 5 Items')
) AS v(feature_key, feature_name)
WHERE stl.tier_key = 'storefront'
ON CONFLICT (tier_id, feature_key) DO UPDATE SET is_enabled = true, updated_at = NOW();

INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, capability_type_id, is_enabled, is_inherited, created_at, updated_at)
SELECT gen_random_uuid()::text, stl.id, v.feature_key, v.feature_name,
       (SELECT id FROM capability_type_list WHERE key = 'flyer'), true, false, NOW(), NOW()
FROM subscription_tiers_list stl
CROSS JOIN (VALUES
  ('flyer_on',            'Flyer On'),
  ('flyer_storefront_on', 'Flyer: Storefront Surface'),
  ('flyer_directory_on',  'Flyer: Directory Surface'),
  ('flyer_place_on',      'Flyer: Place Surface'),
  ('flyer_image',         'Flyer: Image Upload'),
  ('flyer_items_10',      'Flyer: 10 Items'),
  ('flyer_frozen',        'Flyer: Frozen Specials')
) AS v(feature_key, feature_name)
WHERE stl.tier_key IN ('commitment', 'ecommerce')
ON CONFLICT (tier_id, feature_key) DO UPDATE SET is_enabled = true, updated_at = NOW();

INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, capability_type_id, is_enabled, is_inherited, created_at, updated_at)
SELECT gen_random_uuid()::text, stl.id, v.feature_key, v.feature_name,
       (SELECT id FROM capability_type_list WHERE key = 'flyer'), true, false, NOW(), NOW()
FROM subscription_tiers_list stl
CROSS JOIN (VALUES
  ('flyer_on',            'Flyer On'),
  ('flyer_flexible',      'Flyer Flexible'),
  ('flyer_storefront_on', 'Flyer: Storefront Surface'),
  ('flyer_directory_on',  'Flyer: Directory Surface'),
  ('flyer_place_on',      'Flyer: Place Surface'),
  ('flyer_image',         'Flyer: Image Upload'),
  ('flyer_items_20',      'Flyer: 20 Items'),
  ('flyer_frozen',        'Flyer: Frozen Specials'),
  ('flyer_recurring',     'Flyer: Recurring Windows')
) AS v(feature_key, feature_name)
WHERE stl.tier_key IN ('omnichannel', 'professional', 'organization', 'enterprise')
ON CONFLICT (tier_id, feature_key) DO UPDATE SET is_enabled = true, updated_at = NOW();

-- ============================================================
-- 12. Refresh effective-capabilities MV so flyer feature keys flow
-- ============================================================
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_effective_capabilities;

-- ============================================================
-- 13. Verification queries (run manually to confirm)
-- ============================================================
-- Module wiring:
--   SELECT ctl.key, fl.key FROM capability_features_list cfl
--   JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
--   JOIN features_list fl ON fl.id = cfl.feature_id
--   WHERE ctl.key IN ('flyer','flyer_gbp') ORDER BY ctl.key, fl.key;
--
-- Tier grants:
--   SELECT stl.tier_key, tfl.feature_key FROM tier_features_list tfl
--   JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
--   WHERE tfl.feature_key LIKE 'flyer%' AND tfl.is_enabled
--   ORDER BY stl.tier_key, tfl.feature_key;
