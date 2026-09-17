-- 081: Promotion catalog + purchases tables for Directory Promotion lifecycle
-- Mirrors the featured_placement_catalog + featured_placement_purchases pattern.
-- Enables Stripe checkout → activation → auto-renewal → grace period → expiration.
--
-- Idempotent: safe to run on both staging and production.

-- ====================
-- promotion_catalog
-- ====================
CREATE TABLE IF NOT EXISTS promotion_catalog (
  id            VARCHAR(255) PRIMARY KEY,
  plan_key      VARCHAR(100) UNIQUE NOT NULL,
  label         VARCHAR(200) NOT NULL,
  tier          VARCHAR(50)  NOT NULL,  -- basic | premium | featured
  duration_days INT          NOT NULL,
  price_cents   INT          NOT NULL,
  currency      VARCHAR(3)   DEFAULT 'USD',
  is_active     BOOLEAN      DEFAULT true,
  sort_order    INT          DEFAULT 0,
  created_at    TIMESTAMPTZ  DEFAULT now(),
  updated_at    TIMESTAMPTZ  DEFAULT now()
);

-- Index for querying active plans by tier
CREATE INDEX IF NOT EXISTS idx_promotion_catalog_tier ON promotion_catalog (tier);
CREATE INDEX IF NOT EXISTS idx_promotion_catalog_active ON promotion_catalog (is_active, sort_order);

-- updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER set_updated_at_promotion_catalog
    BEFORE UPDATE ON promotion_catalog
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN OTHERS THEN END $$;

-- Seed 9 plans: 3 tiers × 3 durations (30/90/365 days)
INSERT INTO promotion_catalog (id, plan_key, label, tier, duration_days, price_cents, currency, is_active, sort_order)
SELECT * FROM (VALUES
  ('promcat-seed-basic-30d',  'dir-promo-basic-30d',  'Basic Promotion — 30 Days',  'basic',    30,  2000, 'USD', true, 1),
  ('promcat-seed-basic-90d',  'dir-promo-basic-90d',  'Basic Promotion — 90 Days',  'basic',    90,  5400, 'USD', true, 2),
  ('promcat-seed-basic-365d', 'dir-promo-basic-365d', 'Basic Promotion — 365 Days', 'basic',   365, 18000, 'USD', true, 3),
  ('promcat-seed-premium-30d',  'dir-promo-premium-30d',  'Premium Promotion — 30 Days',  'premium',  30,  5000, 'USD', true, 4),
  ('promcat-seed-premium-90d',  'dir-promo-premium-90d',  'Premium Promotion — 90 Days',  'premium',  90, 13500, 'USD', true, 5),
  ('promcat-seed-premium-365d', 'dir-promo-premium-365d', 'Premium Promotion — 365 Days', 'premium', 365, 45000, 'USD', true, 6),
  ('promcat-seed-featured-30d',  'dir-promo-featured-30d',  'Featured Promotion — 30 Days',  'featured',  30, 10000, 'USD', true, 7),
  ('promcat-seed-featured-90d',  'dir-promo-featured-90d',  'Featured Promotion — 90 Days',  'featured',  90, 27000, 'USD', true, 8),
  ('promcat-seed-featured-365d', 'dir-promo-featured-365d', 'Featured Promotion — 365 Days', 'featured', 365, 90000, 'USD', true, 9)
) AS v(id, plan_key, label, tier, duration_days, price_cents, currency, is_active, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM promotion_catalog WHERE plan_key = v.plan_key);

-- ====================
-- promotion_purchases
-- ====================
CREATE TABLE IF NOT EXISTS promotion_purchases (
  id                         VARCHAR(255) PRIMARY KEY,
  tenant_id                  VARCHAR(255) NOT NULL,
  plan_key                   VARCHAR(100) NOT NULL REFERENCES promotion_catalog(plan_key),
  tier                       VARCHAR(50)  NOT NULL,
  price_cents                INT          NOT NULL,
  currency                   VARCHAR(3)   DEFAULT 'USD',
  duration_days              INT          NOT NULL,
  status                     VARCHAR(20)  DEFAULT 'pending',  -- pending | active | expired | cancelled | grace_period
  stripe_checkout_session_id VARCHAR(255),
  stripe_payment_intent_id   VARCHAR(255),
  starts_at                  TIMESTAMPTZ,
  expires_at                 TIMESTAMPTZ,
  grace_period_ends_at       TIMESTAMPTZ,
  renewed_from               VARCHAR(255),
  created_at                 TIMESTAMPTZ  DEFAULT now(),
  updated_at                 TIMESTAMPTZ  DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promotion_purchases_tenant ON promotion_purchases (tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotion_purchases_tenant_status ON promotion_purchases (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_promotion_purchases_status_expires ON promotion_purchases (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_promotion_purchases_stripe_session ON promotion_purchases (stripe_checkout_session_id);

-- Foreign key to tenants
DO $$ BEGIN
  ALTER TABLE promotion_purchases
    ADD CONSTRAINT fk_promotion_purchases_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN END $$;

-- updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER set_updated_at_promotion_purchases
    BEFORE UPDATE ON promotion_purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN OTHERS THEN END $$;

-- RLS policies
DO $$ BEGIN
  ALTER TABLE promotion_purchases ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN END $$;

DO $$ BEGIN
  CREATE POLICY promotion_purchases_tenant_isolated ON promotion_purchases
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN OTHERS THEN END $$;

DO $$ BEGIN
  CREATE POLICY promotion_purchases_admin_all ON promotion_purchases
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN OTHERS THEN END $$;
