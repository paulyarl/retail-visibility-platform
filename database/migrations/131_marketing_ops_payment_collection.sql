-- ============================================================
-- Migration 131: Marketing Ops Payment Collection
-- ============================================================
-- Description: Adds payment-flow columns to preview tokens and campaigns,
--   creates the marketing_revenue audit table, and adds service_category
--   to campaigns for dynamic per-category payment pages.
-- Prerequisite: 129_tenant_prospecting_channel.sql applied
-- Date: 2026-07-29
-- Design doc: docs/LocalBiz/local_marketing_ops_payment_collection_sprint_plan.md
-- ============================================================

-- ============================================================
-- STEP 1: Add payment columns to mkt_deliverable_preview_tokens
-- ============================================================

ALTER TABLE mkt_deliverable_preview_tokens
  ADD COLUMN IF NOT EXISTS order_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS discount_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS subscription_tier_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- ============================================================
-- STEP 2: Add pricing + service_category columns to mkt_campaigns_list
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS package_price_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_tier_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS service_category VARCHAR(100);

-- service_category: links campaign to a Marketing Ops service category
-- (e.g., 'gbp_optimization', 'review_management', 'website_audit', 'local_seo')
-- The public pay page uses this to dynamically render the package summary,
-- pricing, and available subscription tiers for that service category.

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_service_category
  ON mkt_campaigns_list(service_category);

-- ============================================================
-- STEP 3: Create marketing_revenue table
-- ============================================================

CREATE TABLE IF NOT EXISTS marketing_revenue (
  id                  VARCHAR(255)  PRIMARY KEY,          -- mrev-{nanoid}
  campaign_id         VARCHAR(255)  NOT NULL,
  order_id            VARCHAR(255),
  amount_cents        INTEGER       NOT NULL,
  discount_cents      INTEGER       NOT NULL DEFAULT 0,
  gateway_type        VARCHAR(50),                       -- 'stripe', 'paypal', 'manual'
  gateway_transaction_id VARCHAR(255),                    -- payment intent / charge ID
  source              VARCHAR(50)   NOT NULL,             -- 'qr_deliverable', 'demo_storefront', 'manual'
  subscription_tier_id VARCHAR(255),                      -- null for one-time packages
  service_category    VARCHAR(100),                       -- mirrors campaign service_category
  recorded_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_revenue_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_revenue_campaign
  ON marketing_revenue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_revenue_order
  ON marketing_revenue(order_id);
CREATE INDEX IF NOT EXISTS idx_mkt_revenue_recorded
  ON marketing_revenue(recorded_at);

-- RLS: admin full access, service write
ALTER TABLE marketing_revenue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_revenue_admin_all ON marketing_revenue
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_revenue_service_write ON marketing_revenue
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 4: updated_at trigger for marketing_revenue
-- ============================================================

CREATE OR REPLACE FUNCTION update_marketing_revenue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketing_revenue_updated_at ON marketing_revenue;
CREATE TRIGGER trg_marketing_revenue_updated_at
  BEFORE UPDATE ON marketing_revenue
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_revenue_updated_at();

-- ============================================================
-- VERIFICATION QUERIES (run manually after applying)
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'mkt_deliverable_preview_tokens'
--   AND column_name IN ('order_id','amount_cents','discount_cents','coupon_code','subscription_tier_id','paid_at');
--
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'mkt_campaigns_list'
--   AND column_name IN ('package_price_cents','subscription_tier_id','coupon_code','service_category');
--
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_name = 'marketing_revenue' ORDER BY ordinal_position;
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'marketing_revenue';
--
-- SELECT polname FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid
--   WHERE c.relname = 'marketing_revenue';
