-- ============================================================
-- Migration 117: QR Analytics
--
-- Enhances qr_scan_events with surface segmentation, consumer type,
-- product linking, session tracking, and geo/device info.
-- Creates qr_analytics aggregation table (mirrors badge_analytics).
-- Seeds storefront_qr_analytics feature key for premium offering.
-- Adds qr_analytics_enabled merchant gate column.
--
-- Surfaces: storefront, product, directory, qr_landing, promo, private_grant, general
-- Consumers: merchant, admin
--
-- Prerequisites: qr_scan_events (072), features_list, capability_type_list,
--                capability_features_list, tier_features_list,
--                subscription_tiers_list, tenant_storefront_qr_settings
-- Date: 2026-07-17
-- ============================================================

-- ============================================================
-- STEP 1: Enhance qr_scan_events table
-- ============================================================

ALTER TABLE qr_scan_events
  ADD COLUMN IF NOT EXISTS surface VARCHAR(30) DEFAULT 'qr_landing',
  ADD COLUMN IF NOT EXISTS consumer VARCHAR(20) DEFAULT 'merchant',
  ADD COLUMN IF NOT EXISTS product_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS geo_country VARCHAR(10),
  ADD COLUMN IF NOT EXISTS geo_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS device_type VARCHAR(20);

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_surface ON qr_scan_events (surface);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_consumer ON qr_scan_events (consumer);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_tenant_surface_time
  ON qr_scan_events (tenant_id, surface, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_tenant_consumer_time
  ON qr_scan_events (tenant_id, consumer, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_product ON qr_scan_events (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_session ON qr_scan_events (session_id) WHERE session_id IS NOT NULL;

-- Update RLS: allow public INSERT (storefront QR tracking from anonymous users)
DO $$ BEGIN
  CREATE POLICY qr_scan_events_public_insert ON qr_scan_events
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 2: Create qr_analytics aggregation table
-- ============================================================

CREATE TABLE IF NOT EXISTS qr_analytics (
  id              VARCHAR(255)  PRIMARY KEY,  -- tenant-scoped: qra-{tk}-{nanoid}
  tenant_id       VARCHAR(255)  NOT NULL,
  surface         VARCHAR(30)   NOT NULL,     -- storefront, product, directory, qr_landing, promo, private_grant, general
  consumer        VARCHAR(20)   NOT NULL DEFAULT 'merchant',
  period_start    DATE          NOT NULL,
  period_end      DATE          NOT NULL,
  period_type     VARCHAR(10)   NOT NULL DEFAULT 'day',  -- 'day' | 'week' | 'month'

  -- Counts
  total_scans             INT  NOT NULL DEFAULT 0,
  unique_visitors         INT  NOT NULL DEFAULT 0,   -- distinct session_id
  unique_surfaces         INT  NOT NULL DEFAULT 0,   -- distinct product_id (for product surface)
  conversion_count        INT  NOT NULL DEFAULT 0,   -- scans that led to a visit/action

  -- Revenue (cents) — attributed revenue from QR-driven visits
  revenue_cents           BIGINT NOT NULL DEFAULT 0,

  -- Computed metrics
  conversion_rate         DECIMAL(8,4) NOT NULL DEFAULT 0,  -- conversions / total_scans
  avg_revenue_per_scan    BIGINT NOT NULL DEFAULT 0,        -- revenue / total_scans

  -- Geo breakdown (top country/city for the period)
  top_country             VARCHAR(10),
  top_city                VARCHAR(100),

  -- Device breakdown
  mobile_scans            INT  NOT NULL DEFAULT 0,
  desktop_scans           INT  NOT NULL DEFAULT 0,
  tablet_scans            INT  NOT NULL DEFAULT 0,

  created_at              TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, surface, consumer, period_start, period_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qr_analytics_tenant_period
  ON qr_analytics(tenant_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_qr_analytics_tenant_surface
  ON qr_analytics(tenant_id, surface, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_qr_analytics_tenant_consumer
  ON qr_analytics(tenant_id, consumer, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_qr_analytics_period_type
  ON qr_analytics(period_type, period_start DESC);

-- ============================================================
-- STEP 3: Updated_at trigger for qr_analytics
-- ============================================================

CREATE OR REPLACE FUNCTION update_qr_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_qr_analytics_updated_at ON qr_analytics;
CREATE TRIGGER trg_qr_analytics_updated_at
  BEFORE UPDATE ON qr_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_qr_analytics_updated_at();

-- ============================================================
-- STEP 4: RLS Policies for qr_analytics
-- ============================================================

ALTER TABLE qr_analytics ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own analytics
DO $$ BEGIN
  CREATE POLICY qr_analytics_tenant_read ON qr_analytics
    FOR SELECT
    USING (
      tenant_id::text = current_setting('app.current_tenant_id', true)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Platform admins can read all
DO $$ BEGIN
  CREATE POLICY qr_analytics_admin_read ON qr_analytics
    FOR SELECT
    USING (
      current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role (backend jobs) can write
DO $$ BEGIN
  CREATE POLICY qr_analytics_service_write ON qr_analytics
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 5: Seed storefront_qr_analytics feature key
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('storefront_qr_analytics', 'QR Analytics', 'Track QR code scan interactions across storefront, product, and directory surfaces with per-surface breakdown, time-series, and conversion metrics', 'storefront_qr', true, 50, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Link to storefront_qr capability type
DO $$
DECLARE
  v_cap_id TEXT;
  v_feat_id TEXT;
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = 'storefront_qr';
  IF v_cap_id IS NULL THEN
    RAISE NOTICE 'Capability type storefront_qr not found — skipping link';
    RETURN;
  END IF;
  SELECT id INTO v_feat_id FROM features_list WHERE key = 'storefront_qr_analytics';
  IF v_feat_id IS NOT NULL THEN
    INSERT INTO capability_features_list (capability_type_id, feature_id)
    VALUES (v_cap_id, v_feat_id) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- STEP 6: Enable storefront_qr_analytics for professional+ tiers
-- ============================================================

INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, capability_type_id, is_enabled)
SELECT gen_random_uuid()::text, stl.id, 'storefront_qr_analytics', 'QR Analytics',
  (SELECT id FROM capability_type_list WHERE key = 'storefront_qr'), true
FROM subscription_tiers_list stl
WHERE stl.tier_key IN (
  'professional', 'ecommerce', 'omnichannel', 'enterprise', 'organization',
  'chain_professional', 'chain_enterprise'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 7: Add qr_analytics_enabled merchant gate column
-- ============================================================

ALTER TABLE tenant_storefront_qr_settings
  ADD COLUMN IF NOT EXISTS qr_analytics_enabled BOOLEAN DEFAULT false;

-- ============================================================
-- STEP 8: Comments
-- ============================================================

COMMENT ON TABLE qr_analytics IS 'Per-tenant, per-surface, per-period aggregate QR scan metrics for QR Analytics premium offering';
COMMENT ON COLUMN qr_scan_events.surface IS 'QR code surface: storefront, product, directory, qr_landing, promo, private_grant, general';
COMMENT ON COLUMN qr_scan_events.consumer IS 'QR code consumer: merchant (tenant QR) or admin (platform-generated QR)';
