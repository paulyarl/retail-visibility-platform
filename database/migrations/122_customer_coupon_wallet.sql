-- ============================================================
-- MIGRATION: Customer Coupon Wallet tables
-- Sprint 10
-- ============================================================

-- ============================================================
-- customer_saved_coupons: customer wallet entries for coupons
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_saved_coupons (
  id VARCHAR(255) PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  coupon_id VARCHAR(255) NOT NULL REFERENCES tenant_coupons(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'redeemed', 'expired')),
  reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, coupon_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_saved_coupons_customer_status
  ON customer_saved_coupons(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_customer_saved_coupons_customer_tenant
  ON customer_saved_coupons(customer_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_customer_saved_coupons_coupon
  ON customer_saved_coupons(coupon_id);

CREATE INDEX IF NOT EXISTS idx_customer_saved_coupons_status_saved_at
  ON customer_saved_coupons(status, saved_at) WHERE status = 'saved';

-- Row Level Security: customers can only see their own wallet entries
ALTER TABLE customer_saved_coupons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_saved_coupons' AND policyname = 'customer_saved_coupons_owner_policy'
  ) THEN
    CREATE POLICY customer_saved_coupons_owner_policy
      ON customer_saved_coupons
      FOR ALL
      TO authenticated
      USING (customer_id = auth.uid()::text)
      WITH CHECK (customer_id = auth.uid()::text);
  END IF;
END $$;

-- ============================================================
-- customer_coupon_reminders: expiry reminder log per saved coupon
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_coupon_reminders (
  id VARCHAR(255) PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  saved_coupon_id VARCHAR(255) NOT NULL REFERENCES customer_saved_coupons(id) ON DELETE CASCADE,
  reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('24h', '3d', '7d')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(saved_coupon_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_customer_coupon_reminders_customer
  ON customer_coupon_reminders(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_coupon_reminders_saved_coupon
  ON customer_coupon_reminders(saved_coupon_id);

ALTER TABLE customer_coupon_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_coupon_reminders' AND policyname = 'customer_coupon_reminders_owner_policy'
  ) THEN
    CREATE POLICY customer_coupon_reminders_owner_policy
      ON customer_coupon_reminders
      FOR ALL
      TO authenticated
      USING (customer_id = auth.uid()::text)
      WITH CHECK (customer_id = auth.uid()::text);
  END IF;
END $$;
