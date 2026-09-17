-- Migration 097: Coupon Target Rules
-- Platform-side targeting layer for BSaaS coupons/promo codes.
-- Stores per-coupon target constraints (features, tiers, capability types, tier types, demo status, subscription status).
-- Checkout flow validates these targets before applying the discount.

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS coupon_target_rules (
    id VARCHAR(255) PRIMARY KEY,
    coupon_id VARCHAR(255) NOT NULL UNIQUE,
    target_features JSONB,                    -- null = all features; array of feature keys
    target_tiers JSONB,                       -- null = all tiers; array of tier keys
    target_capability_types JSONB,            -- null = all capability types; array of capability type keys
    target_tier_types JSONB,                  -- null = all tier types; array: 'individual' | 'organization'
    target_demo_status JSONB,                 -- null = all; array: 'demo' | 'non_demo'
    target_subscription_statuses JSONB,       -- null = all; array of subscription_status values
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
EXCEPTION WHEN OTHERS THEN END $$;

-- Index for checkout lookup by coupon_id (unique constraint already creates one, but add explicit for clarity)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_coupon_target_rules_coupon_id ON coupon_target_rules(coupon_id);
EXCEPTION WHEN OTHERS THEN END $$;

-- updated_at trigger
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION update_coupon_target_rules_updated_at()
  RETURNS TRIGGER AS $func$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $func$
  LANGUAGE plpgsql;
EXCEPTION WHEN OTHERS THEN END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_coupon_target_rules_updated_at ON coupon_target_rules;
  CREATE TRIGGER trg_coupon_target_rules_updated_at
    BEFORE UPDATE ON coupon_target_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_coupon_target_rules_updated_at();
EXCEPTION WHEN OTHERS THEN END $$;

-- RLS: Admin-only (no tenant access — coupons are platform-managed)
DO $$ BEGIN
  ALTER TABLE coupon_target_rules ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "coupon_target_rules_admin_all" ON coupon_target_rules;
  CREATE POLICY "coupon_target_rules_admin_all" ON coupon_target_rules
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()::text
        AND users.role IN ('platform_admin', 'platform_owner', 'admin')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()::text
        AND users.role IN ('platform_admin', 'platform_owner', 'admin')
      )
    );
EXCEPTION WHEN OTHERS THEN END $$;

-- Service role bypass (for backend API calls using service role key)
DO $$ BEGIN
  DROP POLICY IF EXISTS "coupon_target_rules_service_bypass" ON coupon_target_rules;
  CREATE POLICY "coupon_target_rules_service_bypass" ON coupon_target_rules
    FOR ALL
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN END $$;
