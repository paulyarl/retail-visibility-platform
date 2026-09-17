-- ============================================================
-- Migration 064: Badge Analytics Aggregate Table
--
-- Phase 4: Badge Analytics
-- Tracks per-tenant, per-badge-type, per-period metrics:
--   views, clicks, add-to-cart, conversions, revenue
--
-- The aggregate is refreshed by a scheduled job that joins
-- featured_products with order_items to compute incremental
-- revenue attributable to each badge type.
--
-- Prerequisites: featured_products, order_items, inventory_items,
--                featured_type_registry tables must exist
-- ============================================================

-- ============================================================
-- 1. Badge analytics aggregate table
-- ============================================================

CREATE TABLE IF NOT EXISTS badge_analytics (
  id              VARCHAR(255)  PRIMARY KEY,  -- tenant-scoped: bdga-{tk}-{nanoid}
  tenant_id       VARCHAR(255)  NOT NULL,
  badge_key       VARCHAR(50)   NOT NULL,
  period_start    DATE          NOT NULL,
  period_end      DATE          NOT NULL,
  period_type     VARCHAR(10)   NOT NULL DEFAULT 'day',  -- 'day' | 'week' | 'month'

  -- Counts
  product_count           INT  NOT NULL DEFAULT 0,   -- number of products with this badge
  total_views             INT  NOT NULL DEFAULT 0,   -- storefront views of badged products
  total_clicks            INT  NOT NULL DEFAULT 0,   -- clicks on badged products
  add_to_cart_count       INT  NOT NULL DEFAULT 0,   -- add-to-cart events for badged products
  order_count             INT  NOT NULL DEFAULT 0,   -- orders containing badged products
  units_sold              INT  NOT NULL DEFAULT 0,   -- total units sold

  -- Revenue (cents)
  revenue_cents           BIGINT NOT NULL DEFAULT 0,  -- gross revenue from badged products

  -- Computed metrics (stored for quick dashboard reads)
  ctr                     DECIMAL(8,4) NOT NULL DEFAULT 0,  -- clicks / views
  conversion_rate         DECIMAL(8,4) NOT NULL DEFAULT 0,  -- orders / clicks
  avg_order_value_cents   BIGINT NOT NULL DEFAULT 0,        -- revenue / order_count

  -- Comparison: same metrics for unbadged products in same period
  unbadged_product_count   INT    NOT NULL DEFAULT 0,
  unbadged_order_count     INT    NOT NULL DEFAULT 0,
  unbadged_revenue_cents   BIGINT NOT NULL DEFAULT 0,
  unbadged_units_sold      INT    NOT NULL DEFAULT 0,

  -- Lift calculation: (badged_rate - unbadged_rate) / unbadged_rate
  revenue_lift             DECIMAL(8,4) NOT NULL DEFAULT 0,

  created_at              TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, badge_key, period_start, period_type)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_badge_analytics_tenant_period
  ON badge_analytics(tenant_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_badge_analytics_tenant_badge
  ON badge_analytics(tenant_id, badge_key, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_badge_analytics_period_type
  ON badge_analytics(period_type, period_start DESC);

-- ============================================================
-- 2. Updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_badge_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_badge_analytics_updated_at ON badge_analytics;
CREATE TRIGGER trg_badge_analytics_updated_at
  BEFORE UPDATE ON badge_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_badge_analytics_updated_at();

-- ============================================================
-- 3. RLS Policies
-- ============================================================

ALTER TABLE badge_analytics ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own analytics
DO $$ BEGIN
  CREATE POLICY badge_analytics_tenant_read ON badge_analytics
    FOR SELECT
    USING (
      tenant_id::text = current_setting('app.current_tenant_id', true)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Platform admins can read all
DO $$ BEGIN
  CREATE POLICY badge_analytics_admin_read ON badge_analytics
    FOR SELECT
    USING (
      current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role (backend jobs) can write
DO $$ BEGIN
  CREATE POLICY badge_analytics_service_write ON badge_analytics
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 4. Badge event log table (for real-time event tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS badge_events (
  id              VARCHAR(255)  PRIMARY KEY,  -- tenant-scoped: bdge-{tk}-{nanoid}
  tenant_id       VARCHAR(255)  NOT NULL,
  badge_key       VARCHAR(50)   NOT NULL,
  inventory_item_id VARCHAR(255) NOT NULL,
  event_type      VARCHAR(20)   NOT NULL,  -- 'view', 'click', 'add_to_cart', 'order'
  session_id      VARCHAR(255),
  order_id        VARCHAR(255),
  revenue_cents   INT           NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_badge_events_tenant_badge_time
  ON badge_events(tenant_id, badge_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_badge_events_tenant_item
  ON badge_events(tenant_id, inventory_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_badge_events_event_type
  ON badge_events(event_type, created_at DESC);

-- RLS for badge_events
ALTER TABLE badge_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY badge_events_tenant_read ON badge_events
    FOR SELECT
    USING (
      tenant_id::text = current_setting('app.current_tenant_id', true)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY badge_events_admin_read ON badge_events
    FOR SELECT
    USING (
      current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public can INSERT (storefront events from anonymous users)
DO $$ BEGIN
  CREATE POLICY badge_events_public_insert ON badge_events
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role can INSERT and DELETE
DO $$ BEGIN
  CREATE POLICY badge_events_service_write ON badge_events
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 5. Comments
-- ============================================================

COMMENT ON TABLE badge_analytics IS 'Phase 4: Per-tenant, per-badge, per-period aggregate metrics for badge ROI analysis';
COMMENT ON TABLE badge_events IS 'Phase 4: Real-time event log for badge interactions (views, clicks, add-to-cart, orders)';
